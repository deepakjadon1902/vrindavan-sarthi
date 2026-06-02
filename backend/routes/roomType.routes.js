const express = require('express');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC } = require('../utils/date');

const router = express.Router();

const stripLargeInlineImage = (value) => {
  const v = typeof value === 'string' ? value : '';
  if (!v) return '';
  if (v.startsWith('data:') && v.length > 2048) return '';
  return v;
};

const memCache = new Map();
const getMemCache = (key) => {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return hit.value;
};
const setMemCache = (key, value, ttlMs) => {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const enrichRoomType = async ({ roomType, hotel, checkIn, checkOut }) => {
  const totalCount = await RoomUnit.countDocuments({ roomTypeId: roomType._id, status: 'active' });

  const creator =
    roomType.createdByUserId
      ? await User.findById(roomType.createdByUserId).select('_id name email phone role businessName').lean()
      : null;

      const base = {
        ...roomType,
        totalCount,
        uploader: creator || null,
        hotel: {
      _id: hotel._id,
      name: hotel.name,
      location: hotel.location,
      rating: hotel.rating,
      image: hotel.image,
      images: hotel.images,
      amenities: hotel.amenities,
      petsAllowed: hotel.petsAllowed,
      taxEnabled: hotel.taxEnabled,
      taxPercent: hotel.taxPercent,
          checkInTime: hotel.checkInTime,
          checkOutTime: hotel.checkOutTime,
          partnerId: hotel.partnerId,
          partnerName: hotel.partnerName,
          // Do not expose partner contact details publicly.
        },
      };

  const withAvailability = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;
  if (!withAvailability) return base;

  const blockedByBlocks = await RoomUnitBlock.distinct('roomUnitId', {
    roomTypeId: roomType._id,
    startDate: { $lt: checkOut },
    endDate: { $gt: checkIn },
  });

  const blockedByBookings = await Booking.distinct('roomUnitId', {
    roomTypeId: roomType._id,
    bookingStatus: { $ne: 'cancelled' },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  });

  const blockedSet = new Set([...blockedByBlocks.map(String), ...blockedByBookings.map(String)]);
  const availableCount = Math.max(0, totalCount - blockedSet.size);
  return { ...base, availableCount };
};

// Public: list all room types under approved active hotels
// Optional query: ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD (returns totalCount/availableCount)
router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));
    const withAvailability = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;

    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(300, Math.floor(limitRaw)) : 200;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    // Fast path for Rooms page (no date filters): single aggregation instead of multiple round trips.
    if (!withAvailability) {
      const cacheKey = `rt:noAvail:${skip}:${limit}`;
      const cached = getMemCache(cacheKey);
      if (cached) return res.json({ success: true, data: cached });

      const data = await RoomType.aggregate([
        { $match: { status: 'active' } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'hotels',
            let: { hid: '$hotelId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$hid'] },
                  status: 'active',
                  approvalStatus: 'approved',
                },
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  location: 1,
                  rating: 1,
                  image: 1,
                  images: { $slice: ['$images', 1] },
                  amenities: 1,
                  petsAllowed: 1,
                  taxEnabled: 1,
                  taxPercent: 1,
                  checkInTime: 1,
                  checkOutTime: 1,
                  partnerId: 1,
                  partnerName: 1,
                  // Do not expose partner contact details publicly.
                },
              },
            ],
            as: 'hotel',
          },
        },
        { $unwind: { path: '$hotel', preserveNullAndEmptyArrays: false } },
        {
          $lookup: {
            from: 'roomunits',
            let: { rtId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$roomTypeId', '$$rtId'] }, status: 'active' } },
              { $group: { _id: null, total: { $sum: 1 } } },
            ],
            as: 'totals',
          },
        },
        {
          $addFields: {
            totalCount: {
              $ifNull: [{ $arrayElemAt: ['$totals.total', 0] }, 0],
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            let: { uid: '$createdByUserId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
              { $project: { _id: 1, name: 1, email: 1, phone: 1, role: 1, businessName: 1 } },
            ],
            as: 'uploader',
          },
        },
        { $addFields: { uploader: { $ifNull: [{ $arrayElemAt: ['$uploader', 0] }, null] } } },
        { $project: { totals: 0 } },
      ]).option({ allowDiskUse: true });

      for (const rt of data) {
        if (rt?.hotel) {
          rt.hotel.image = rt.hotel.image || '/placeholder.svg';
          if (Array.isArray(rt.hotel.images)) rt.hotel.images = rt.hotel.images.filter(Boolean);
        }
        if (Array.isArray(rt.images)) rt.images = rt.images.filter(Boolean);
        if (!rt.images?.length && rt?.hotel?.image) rt.images = [rt.hotel.image];
      }

      setMemCache(cacheKey, data, 30_000);
      return res.json({ success: true, data });
    }

    // Availability mode is expensive; keep it bounded.
    // If the client doesn't pass dates, they will hit the fast path above.
    // Ensure pagination is enforced (default 200).

    const hotels = await Hotel.find({ status: 'active', approvalStatus: 'approved' })
      .select('_id name location rating image images amenities petsAllowed taxEnabled taxPercent checkInTime checkOutTime')
      .slice('images', 1)
      .lean();
    if (!hotels.length) return res.json({ success: true, data: [] });

    for (const h of hotels) {
      h.image = h.image || '/placeholder.svg';
      if (Array.isArray(h.images)) {
        h.images = h.images.filter(Boolean);
      }
    }

    const hotelById = new Map(hotels.map((h) => [String(h._id), h]));
    const hotelIds = hotels.map((h) => h._id);

    const availCacheKey = `rt:avail:${checkIn.toISOString()}:${checkOut.toISOString()}:${skip}:${limit}`;
    const cachedAvail = getMemCache(availCacheKey);
    if (cachedAvail) return res.json({ success: true, data: cachedAvail });

    const roomTypes = await RoomType.find({ hotelId: { $in: hotelIds }, status: 'active' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id hotelId partnerId createdByUserId createdByRole name description images amenities pricePerNight maxAdults maxChildren petsAllowed status createdAt updatedAt')
      .slice('images', 1)
      .lean();
    if (!roomTypes.length) return res.json({ success: true, data: [] });

    for (const rt of roomTypes) {
      if (Array.isArray(rt.images)) {
        rt.images = rt.images.filter(Boolean);
      }
    }

    // Total rooms per type (for displaying "X rooms" even without date filters).
    const roomTypeIds = roomTypes.map((rt) => rt._id);
    const totalsAgg = await RoomUnit.aggregate([
      { $match: { roomTypeId: { $in: roomTypeIds }, status: 'active' } },
      { $group: { _id: '$roomTypeId', total: { $sum: 1 } } },
    ]);
    const totalByRoomType = new Map(totalsAgg.map((r) => [String(r._id), Number(r.total || 0)]));

    // Uploader (creator) info
    const creatorIds = roomTypes.map((rt) => rt.createdByUserId).filter(Boolean);
    const creators = await User.find({ _id: { $in: creatorIds } })
      .select('_id name email phone role businessName')
      .lean();
    const creatorById = new Map(creators.map((u) => [String(u._id), u]));

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

    const data = roomTypes
      .map((rt) => {
        const hotel = hotelById.get(String(rt.hotelId));
        if (!hotel) return null;

        const rtId = String(rt._id);
        const totalCount = totalByRoomType.get(rtId) || 0;
        const blockedSet = new Set([
          ...(blockedByBlocks.get(rtId) || []),
          ...(blockedByBookings.get(rtId) || []),
        ]);
        const availableCount = Math.max(0, totalCount - blockedSet.size);

        return {
          ...rt,
          totalCount,
          availableCount,
          uploader: rt.createdByUserId ? creatorById.get(String(rt.createdByUserId)) || null : null,
          hotel: {
            _id: hotel._id,
            name: hotel.name,
            location: hotel.location,
            rating: hotel.rating,
            image: hotel.image,
            images: hotel.images,
            amenities: hotel.amenities,
            petsAllowed: hotel.petsAllowed,
            taxEnabled: hotel.taxEnabled,
            taxPercent: hotel.taxPercent,
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
            partnerId: hotel.partnerId,
            partnerName: hotel.partnerName,
            // Do not expose partner contact details publicly.
          },
        };
      })
      .filter(Boolean);

    setMemCache(availCacheKey, data, 20_000);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: get one room type with hotel/uploader details and optional availability
router.get('/:id', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    const cacheKey = (() => {
      const checkInQ = String(req.query?.checkIn || '').trim();
      const checkOutQ = String(req.query?.checkOut || '').trim();
      return `roomType:${String(req.params.id)}:${checkInQ}:${checkOutQ}`;
    })();
    const cached = getMemCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const roomType = await RoomType.findById(req.params.id)
      .select('_id hotelId partnerId createdByUserId createdByRole name description images amenities pricePerNight maxAdults maxChildren petsAllowed status createdAt updatedAt')
      .lean();
    if (!roomType || roomType.status !== 'active') return res.status(404).json({ success: false, message: 'Room type not found' });

    const hotel = await Hotel.findOne({ _id: roomType.hotelId, status: 'active', approvalStatus: 'approved' })
      .select('_id name location rating image images amenities petsAllowed taxEnabled taxPercent checkInTime checkOutTime partnerId partnerName')
      .slice('images', 1)
      .lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));

    const enriched = await enrichRoomType({ roomType, hotel, checkIn, checkOut });
    const hasDates = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;
    setMemCache(cacheKey, enriched, hasDates ? 10_000 : 60_000);
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: calendar-style availability for a room type (per-day counts + room numbers)
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD (max 90 days)
router.get('/:id/calendar', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');

    const roomType = await RoomType.findById(req.params.id)
      .select('_id hotelId status')
      .lean();
    if (!roomType || roomType.status !== 'active') return res.status(404).json({ success: false, message: 'Room type not found' });

    const hotel = await Hotel.findOne({ _id: roomType.hotelId, status: 'active', approvalStatus: 'approved' })
      .select('_id')
      .lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const fromRaw = parseDateOnlyToUTC(String(req.query?.from || ''));
    const toRaw = parseDateOnlyToUTC(String(req.query?.to || ''));
    const from = isValidDate(fromRaw) ? fromRaw : todayUtc;
    const defaultTo = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    const to = isValidDate(toRaw) && toRaw > from ? toRaw : defaultTo;

    const maxTo = new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
    const boundedTo = to > maxTo ? maxTo : to;

    const days = enumerateDatesUTC(from, boundedTo);
    if (!days.length) return res.status(400).json({ success: false, message: 'Invalid date range' });

    const units = await RoomUnit.find({ roomTypeId: roomType._id, status: 'active' })
      .sort({ number: 1 })
      .select('_id number')
      .lean();

    const totalCount = units.length;
    const numberByUnitId = new Map(units.map((u) => [String(u._id), String(u.number)]));

    const dateKey = (d) => d.toISOString().slice(0, 10);
    const blockedByDate = new Map(days.map((d) => [dateKey(d), new Set()]));

    // Blocks
    const blocks = await RoomUnitBlock.find({
      roomTypeId: roomType._id,
      startDate: { $lt: boundedTo },
      endDate: { $gt: from },
    })
      .select('roomUnitId startDate endDate')
      .lean();

    for (const b of blocks) {
      const start = isValidDate(b.startDate) ? b.startDate : from;
      const end = isValidDate(b.endDate) ? b.endDate : boundedTo;
      const overlapStart = start < from ? from : start;
      const overlapEnd = end > boundedTo ? boundedTo : end;
      for (const d of enumerateDatesUTC(overlapStart, overlapEnd)) {
        const key = dateKey(d);
        const set = blockedByDate.get(key);
        if (set) set.add(String(b.roomUnitId));
      }
    }

    // Booked days
    const bookingDays = await RoomUnitBookingDay.find({
      roomTypeId: roomType._id,
      date: { $gte: from, $lt: boundedTo },
    })
      .select('date roomUnitId')
      .lean();

    for (const bd of bookingDays) {
      const key = dateKey(bd.date);
      const set = blockedByDate.get(key);
      if (set) set.add(String(bd.roomUnitId));
    }

    const calendar = days.map((d) => {
      const key = dateKey(d);
      const blockedSet = blockedByDate.get(key) || new Set();
      const unavailableRooms = Array.from(blockedSet)
        .map((id) => numberByUnitId.get(String(id)))
        .filter(Boolean);
      const unavailableCount = blockedSet.size;
      const availableCount = Math.max(0, totalCount - unavailableCount);
      return {
        date: key,
        totalCount,
        availableCount,
        unavailableRooms,
      };
    });

    res.json({ success: true, data: { from: dateKey(from), to: dateKey(boundedTo), totalCount, calendar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
