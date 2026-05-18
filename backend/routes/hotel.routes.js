const express = require('express');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const { parseDateOnlyToUTC, isValidDate } = require('../utils/date');
const router = express.Router();

// Get all active hotels (public)
router.get('/', async (req, res) => {
  try {
    // Optimize payload for listing pages (Home/Hotels).
    res.set('Cache-Control', 'no-store');

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));
    const withAvailability = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;

    const hotels = await Hotel.find({ status: 'active', approvalStatus: 'approved' })
      .sort({ createdAt: -1 })
      .select('name location rating image images amenities createdAt')
      .slice('images', 1)
      .lean();

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
    const hotels = await Hotel.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: hotels });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get single hotel (public)
router.get('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id).lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    res.json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get room types for a hotel (public) with optional availability
// Query: ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
router.get('/:id/room-types', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id).lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const roomTypes = await RoomType.find({ hotelId: hotel._id, status: 'active' }).sort({ createdAt: -1 }).lean();

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));
    const withAvailability = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;

    if (!withAvailability) {
      return res.json({ success: true, data: roomTypes });
    }

    const enriched = await Promise.all(
      roomTypes.map(async (rt) => {
        const totalCount = await RoomUnit.countDocuments({ roomTypeId: rt._id, status: 'active' });
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
        return { ...rt, totalCount, availableCount };
      })
    );

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create (admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const hotel = await Hotel.create(req.body);
    res.status(201).json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update (admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
