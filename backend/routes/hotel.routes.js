const express = require('express');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const { parseDateOnlyToUTC, isValidDate } = require('../utils/date');
const { normalizeImageFields } = require('../utils/imageFields');
const { normalizePublicImageSet, normalizePublicImages, stripLargeInlineImage } = require('../utils/publicImages');
const router = express.Router();

const normalizePublicHotel = (hotel) => {
  if (!hotel) return hotel;
  const imageSet = normalizePublicImageSet(hotel, { max: 4 });
  return {
    ...hotel,
    ...imageSet,
  };
};

const normalizePublicRoomType = (roomType) => {
  if (!roomType) return roomType;
  return {
    ...roomType,
    images: normalizePublicImages(roomType.images, { max: 4 }),
  };
};

const normalizeHotelTaxControls = (body) => {
  if (!body || typeof body !== 'object') return body;
  const hasTaxFlag = typeof body.taxEnabled !== 'undefined';
  const hasTaxPercent = typeof body.taxPercent !== 'undefined';
  if (hasTaxFlag) body.taxEnabled = Boolean(body.taxEnabled);
  if (hasTaxPercent) {
    const p = Number(body.taxPercent);
    body.taxPercent = Number.isFinite(p) && p >= 0 ? Math.min(50, p) : 12;
  }
  return body;
};

const publicHotelListProjection = {
  name: 1,
  location: 1,
  rating: 1,
  amenities: 1,
  taxEnabled: 1,
  taxPercent: 1,
  createdAt: 1,
  image: {
    $let: {
      vars: { imageValue: { $ifNull: ['$image', ''] } },
      in: {
        $cond: [
          {
            $and: [
              { $regexMatch: { input: '$$imageValue', regex: /^data:/ } },
              { $gt: [{ $strLenBytes: '$$imageValue' }, 2048] },
            ],
          },
          '',
          '$$imageValue',
        ],
      },
    },
  },
  images: { $slice: [{ $ifNull: ['$images', []] }, 4] },
};

// Get all active hotels (public)
router.get('/', async (req, res) => {
  try {
    // Optimize payload for listing pages (Home/Hotels).
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));
    const withAvailability = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;

    const hotels = await Hotel.aggregate([
      { $match: { status: 'active', approvalStatus: 'approved' } },
      { $sort: { createdAt: -1 } },
      { $project: publicHotelListProjection },
    ]).option({ maxTimeMS: 7000 });

    for (const h of hotels) {
      const normalized = normalizePublicHotel(h);
      Object.assign(h, normalized);
    }

    if (!withAvailability || hotels.length === 0) {
      return res.json({ success: true, data: hotels });
    }

    // Availability summary (room types -> room units) per hotel for the requested date range.
    const hotelIds = hotels.map((h) => h._id);
    const roomTypes = await RoomType.find({ hotelId: { $in: hotelIds }, status: 'active' })
      .select('_id hotelId name maxAdults maxChildren pricePerNight')
      .lean();

    const roomTypeIds = roomTypes.map((rt) => rt._id);
    if (roomTypeIds.length === 0) {
      return res.json({ success: true, data: hotels.map((h) => ({ ...h, availableRooms: 0 })) });
    }

    const totalsAgg = await RoomUnit.aggregate([
      { $match: { roomTypeId: { $in: roomTypeIds }, status: 'active' } },
      { $group: { _id: '$roomTypeId', total: { $sum: 1 } } },
    ]);
    const totalByRoomType = new Map(totalsAgg.map((r) => [String(r._id), Number(r.total || 0)]));

    const blocksAgg = await RoomUnitBlock.aggregate([
      {
        $match: {
          roomTypeId: { $in: roomTypeIds },
          startDate: { $lt: checkOut },
          endDate: { $gt: checkIn },
        },
      },
      { $group: { _id: '$roomTypeId', roomUnitIds: { $addToSet: '$roomUnitId' } } },
    ]);
    const blockedByBlocks = new Map(blocksAgg.map((r) => [String(r._id), (r.roomUnitIds || []).map(String)]));

    const bookingsAgg = await Booking.aggregate([
      {
        $match: {
          roomTypeId: { $in: roomTypeIds },
          bookingStatus: { $ne: 'cancelled' },
          checkIn: { $lt: checkOut },
          checkOut: { $gt: checkIn },
        },
      },
      { $group: { _id: '$roomTypeId', roomUnitIds: { $addToSet: '$roomUnitId' } } },
    ]);
    const blockedByBookings = new Map(bookingsAgg.map((r) => [String(r._id), (r.roomUnitIds || []).map(String)]));

    const availableByRoomType = new Map();
    for (const rt of roomTypes) {
      const rtId = String(rt._id);
      const total = totalByRoomType.get(rtId) || 0;
      if (total <= 0) {
        availableByRoomType.set(rtId, 0);
        continue;
      }
      const set = new Set([
        ...(blockedByBlocks.get(rtId) || []),
        ...(blockedByBookings.get(rtId) || []),
      ]);
      availableByRoomType.set(rtId, Math.max(0, total - set.size));
    }

    const roomTypesByHotel = new Map();
    for (const rt of roomTypes) {
      const hid = String(rt.hotelId);
      const list = roomTypesByHotel.get(hid) || [];
      list.push(rt);
      roomTypesByHotel.set(hid, list);
    }

    const enrichedHotels = hotels.map((h) => {
      const types = roomTypesByHotel.get(String(h._id)) || [];
      const availableRooms = types.reduce((sum, rt) => sum + (availableByRoomType.get(String(rt._id)) || 0), 0);
      return { ...h, availableRooms };
    });

    res.json({ success: true, data: enrichedHotels });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all hotels (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5000, Math.floor(limitRaw)) : 1000;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    // Avoid unindexed in-memory sorts in large collections.
    // Keep payload small: large base64 images in DB can make this endpoint extremely slow.
    const hotels = await Hotel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      // Do not fetch image by default; it may be huge base64.
      .select('name location rating image status approvalStatus partnerName taxEnabled taxPercent createdAt updatedAt')
      .lean();

    for (const h of hotels) h.image = stripLargeInlineImage(h.image) || '/placeholder.svg';

    res.json({ success: true, data: hotels });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get room types for a hotel (public) with optional availability
// Query: ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
router.get('/:id/room-types', async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ _id: req.params.id, status: 'active', approvalStatus: 'approved' }).lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const roomTypes = await RoomType.find({ hotelId: hotel._id, status: 'active' })
      .sort({ createdAt: -1 })
      .select('_id hotelId partnerId createdByUserId createdByRole name description images amenities pricePerNight maxAdults maxChildren petsAllowed status createdAt updatedAt')
      .lean();

    const roomTypeIds = roomTypes.map((rt) => rt._id);
    const totalsAgg = roomTypeIds.length
      ? await RoomUnit.aggregate([
        { $match: { roomTypeId: { $in: roomTypeIds }, status: 'active' } },
        { $group: { _id: '$roomTypeId', total: { $sum: 1 } } },
      ])
      : [];
    const totalByRoomType = new Map(totalsAgg.map((r) => [String(r._id), Number(r.total || 0)]));

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));
    const withAvailability = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;

    if (!withAvailability) {
      return res.json({
        success: true,
        data: roomTypes.map((rt) => normalizePublicRoomType({
          ...rt,
          totalCount: totalByRoomType.get(String(rt._id)) || 0,
        })),
      });
    }

    const enriched = await Promise.all(
      roomTypes.map(async (rt) => {
        const totalCount = totalByRoomType.get(String(rt._id)) || 0;
        if (totalCount <= 0) return { ...rt, totalCount: 0, availableCount: 0 };

        const blockedByBlocks = await RoomUnitBlock.distinct('roomUnitId', {
          roomTypeId: rt._id,
          startDate: { $lt: checkOut },
          endDate: { $gt: checkIn },
        });

        const blockedByBookings = await Booking.distinct('roomUnitId', {
          roomTypeId: rt._id,
          bookingStatus: { $ne: 'cancelled' },
          checkIn: { $lt: checkOut },
          checkOut: { $gt: checkIn },
        });

        const blockedSet = new Set([...blockedByBlocks.map(String), ...blockedByBookings.map(String)]);
        const availableCount = Math.max(0, totalCount - blockedSet.size);
        return normalizePublicRoomType({ ...rt, totalCount, availableCount });
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single hotel (public)
router.get('/:id', async (req, res) => {
  try {
    const [hotel] = await Hotel.aggregate([
      { $match: { _id: new Hotel.base.Types.ObjectId(req.params.id), status: 'active', approvalStatus: 'approved' } },
      {
        $project: {
          ...publicHotelListProjection,
          description: 1,
          partnerName: 1,
          petsAllowed: 1,
          taxEnabled: 1,
          taxPercent: 1,
          checkInTime: 1,
          checkOutTime: 1,
          updatedAt: 1,
        },
      },
    ]).option({ maxTimeMS: 7000 });
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    res.json({ success: true, data: normalizePublicHotel(hotel) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Create (admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    normalizeHotelTaxControls(body);
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/hotels', single: ['image'], multi: ['images'], tags: ['hotel'] });
    const hotel = await Hotel.create(body);
    res.status(201).json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update (admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    normalizeHotelTaxControls(body);
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/hotels', single: ['image'], multi: ['images'], tags: ['hotel'] });
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Delete (admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Hotel deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
