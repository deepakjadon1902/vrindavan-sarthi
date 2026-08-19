const express = require('express');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const User = require('../models/User');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC } = require('../utils/date');
const { normalizePublicImages, normalizePublicImageSet } = require('../utils/publicImages');

const router = express.Router();
const BOOKABLE_ROOM_STATUSES = ['active', 'available'];
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getLocationSearchTerms = (value) => {
  const q = String(value || '').trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const terms = new Set([q]);
  if (lower.includes('govardhan')) terms.add('goverdhan');
  if (lower.includes('goverdhan')) terms.add('govardhan');
  if (lower.includes('barsana')) terms.add('barshana');
  if (lower.includes('barshana')) terms.add('barsana');
  if (lower.includes('vrindavan')) terms.add('brindavan');
  if (lower.includes('brindavan')) terms.add('vrindavan');
  if (lower.includes('radha kund')) terms.add('radhakund');
  if (lower.includes('radhakund')) terms.add('radha kund');
  return Array.from(terms);
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

const getAvailabilityStatus = ({ totalCount, availableCount, manualKinds = [], hasOnlineBookings = false }) => {
  if (availableCount > 0) return { status: 'available', label: `${availableCount} rooms available` };
  if (totalCount <= 0) return { status: 'closed', label: 'Booking closed' };

  const kinds = new Set(manualKinds.map((kind) => String(kind || '').trim()).filter(Boolean));
  if (kinds.size === 1 && kinds.has('offline_booking') && !hasOnlineBookings) {
    return { status: 'offline_booking', label: 'Offline booked' };
  }
  if (kinds.size === 1 && kinds.has('closed') && !hasOnlineBookings) {
    return { status: 'closed', label: 'Booking closed' };
  }
  return { status: 'unavailable', label: 'Unavailable at this time' };
};

const getRoomUnitAvailability = ({ unit, block, isBooked }) => {
  const unitStatus = String(unit?.status || '').trim().toLowerCase();
  if (!BOOKABLE_ROOM_STATUSES.includes(unitStatus)) {
    return unitStatus === 'closed'
      ? { status: 'closed', label: 'Booking closed' }
      : { status: 'unavailable', label: 'Unavailable at this time' };
  }

  if (isBooked) return { status: 'unavailable', label: 'Unavailable at this time' };

  if (block) {
    const reason = String(block.reason || block.kind || '').trim();
    if (reason === 'offline_booking') return { status: 'offline_booking', label: 'Offline booked' };
    if (reason === 'closed') return { status: 'closed', label: 'Booking closed' };
    return { status: 'unavailable', label: 'Unavailable at this time' };
  }

  return { status: 'available', label: 'Available' };
};

const enrichRoomType = async ({ roomType, hotel, checkIn, checkOut }) => {
  const totalCount = await RoomUnit.countDocuments({ roomTypeId: roomType._id, status: { $in: BOOKABLE_ROOM_STATUSES } });
  const roomImages = normalizePublicImages(roomType.images, { max: 8 });
  const hotelImageSet = normalizePublicImageSet(hotel, { max: 4 });

  const creator =
    roomType.createdByUserId
      ? await User.findById(roomType.createdByUserId).select('_id role businessName profileDisplayName profileBio profilePicture').lean()
      : null;

      const base = {
        ...roomType,
        images: roomImages.length ? roomImages : hotelImageSet.images,
        totalCount,
        uploader: creator
          ? {
            _id: creator._id,
            role: creator.role,
            displayName: creator.profileDisplayName || creator.businessName || 'Verified partner',
            bio: creator.profileBio || '',
            profilePicture: creator.profilePicture || '',
          }
          : null,
        hotel: {
      _id: hotel._id,
      name: hotel.name,
      location: hotel.location,
      propertyType: hotel.propertyType || 'hotel',
      rating: hotel.rating,
      image: hotelImageSet.image,
      images: hotelImageSet.images,
      amenities: hotel.amenities,
      petsAllowed: hotel.petsAllowed,
      taxEnabled: hotel.taxEnabled,
      taxPercent: hotel.taxPercent,
          checkInTime: hotel.checkInTime,
          checkOutTime: hotel.checkOutTime,
          partnerId: hotel.partnerId,
          nearestTemple: hotel.nearestTemple,
          googleMapLink: hotel.googleMapLink,
          propertyTerms: hotel.propertyTerms,
        },
      };

  const withAvailability = isValidDate(checkIn) && isValidDate(checkOut) && checkIn < checkOut;
  if (!withAvailability) return base;

  const roomUnits = await RoomUnit.find({ roomTypeId: roomType._id })
    .select('_id number floor status petsAllowedOverride')
    .sort({ number: 1, createdAt: 1 })
    .lean();

  const blockDocs = await RoomUnitBlock.find({
    roomTypeId: roomType._id,
    startDate: { $lt: checkOut },
    endDate: { $gt: checkIn },
  })
    .select('roomUnitId kind reason')
    .lean();
  const blockedByBlocks = blockDocs.map((block) => block.roomUnitId);
  const blockByUnit = new Map(blockDocs.map((block) => [String(block.roomUnitId), block]));

  const blockedByBookings = await RoomUnitBookingDay.distinct('roomUnitId', {
    roomTypeId: roomType._id,
    date: { $gte: checkIn, $lt: checkOut },
  });
  const bookedSet = new Set(blockedByBookings.map(String));

  const roomAvailability = roomUnits.map((unit, index) => {
    const unitId = String(unit._id);
    const availability = getRoomUnitAvailability({
      unit,
      block: blockByUnit.get(unitId),
      isBooked: bookedSet.has(unitId),
    });
    return {
      displayLabel: `Room option ${index + 1}`,
      status: availability.status,
      label: availability.label,
    };
  });
  const availableCount = roomAvailability.filter((room) => room.status === 'available').length;
  const availabilityStatus = getAvailabilityStatus({
    totalCount,
    availableCount,
    manualKinds: blockDocs.map((block) => block.reason || block.kind),
    hasOnlineBookings: blockedByBookings.length > 0,
  });
  return {
    ...base,
    availableCount,
    availabilityStatus: availabilityStatus.status,
    availabilityStatusLabel: availabilityStatus.label,
    roomAvailability,
  };
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
    const q = String(req.query?.q || '').trim();
    const searchRegexes = q ? getLocationSearchTerms(q).map((term) => new RegExp(escapeRegex(term), 'i')) : [];

    // Fast path for Rooms page (no date filters): single aggregation instead of multiple round trips.
    if (!withAvailability) {
      const cacheKey = q ? '' : `rt:noAvail:${skip}:${limit}`;
      const cached = cacheKey ? getMemCache(cacheKey) : null;
      if (cached) return res.json({ success: true, data: cached });

      const data = await RoomType.aggregate([
        { $match: { status: 'active' } },
        { $sort: { createdAt: -1 } },
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
                  propertyType: 1,
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
                  nearestTemple: 1,
                  googleMapLink: 1,
                },
              },
            ],
            as: 'hotel',
          },
        },
        { $unwind: { path: '$hotel', preserveNullAndEmptyArrays: false } },
        ...(searchRegexes.length ? [{
          $match: {
            $or: searchRegexes.flatMap((searchRegex) => [
              { name: searchRegex },
              { description: searchRegex },
              { 'hotel.name': searchRegex },
              { 'hotel.location': searchRegex },
              { 'hotel.nearestTemple': searchRegex },
            ]),
          },
        }] : []),
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'roomunits',
            let: { rtId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$roomTypeId', '$$rtId'] }, status: { $in: BOOKABLE_ROOM_STATUSES } } },
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
              { $project: { _id: 1, role: 1, businessName: 1, profileDisplayName: 1, profileBio: 1, profilePicture: 1 } },
            ],
            as: 'uploader',
          },
        },
        { $addFields: { uploader: { $ifNull: [{ $arrayElemAt: ['$uploader', 0] }, null] } } },
        { $project: { totals: 0 } },
      ]).option({ allowDiskUse: true });

      for (const rt of data) {
        if (rt?.hotel) {
          Object.assign(rt.hotel, normalizePublicImageSet(rt.hotel, { max: 4 }));
        }
        rt.images = normalizePublicImages(rt.images, { max: 4 });
        if (!rt.images?.length && rt?.hotel?.images?.length) rt.images = rt.hotel.images;
      }

      if (cacheKey) setMemCache(cacheKey, data, 30_000);
      return res.json({ success: true, data });
    }

    // Availability mode is expensive; keep it bounded.
    // If the client doesn't pass dates, they will hit the fast path above.
    // Ensure pagination is enforced (default 200).

    const hotels = await Hotel.find({ status: 'active', approvalStatus: 'approved' })
      .select('_id name propertyType location rating image images amenities petsAllowed taxEnabled taxPercent gstMode checkInTime checkOutTime nearestTemple googleMapLink propertyTerms')
      .slice('images', 1)
      .lean();
    if (!hotels.length) return res.json({ success: true, data: [] });

    for (const h of hotels) {
      Object.assign(h, normalizePublicImageSet(h, { max: 4 }));
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
      rt.images = normalizePublicImages(rt.images, { max: 4 });
    }

    // Total rooms per type (for displaying "X rooms" even without date filters).
    const roomTypeIds = roomTypes.map((rt) => rt._id);
    const totalsAgg = await RoomUnit.aggregate([
      { $match: { roomTypeId: { $in: roomTypeIds }, status: { $in: BOOKABLE_ROOM_STATUSES } } },
      { $group: { _id: '$roomTypeId', total: { $sum: 1 } } },
    ]);
    const totalByRoomType = new Map(totalsAgg.map((r) => [String(r._id), Number(r.total || 0)]));

    // Uploader (creator) info
    const creatorIds = roomTypes.map((rt) => rt.createdByUserId).filter(Boolean);
    const creators = await User.find({ _id: { $in: creatorIds } })
      .select('_id role businessName profileDisplayName profileBio profilePicture')
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
      { $group: { _id: '$roomTypeId', roomUnitIds: { $addToSet: '$roomUnitId' }, kinds: { $addToSet: { $ifNull: ['$reason', '$kind'] } } } },
    ]);
    const blockedByBlocks = new Map(blocksAgg.map((r) => [String(r._id), { roomUnitIds: (r.roomUnitIds || []).map(String), kinds: r.kinds || [] }]));

    const bookingsAgg = await RoomUnitBookingDay.aggregate([
      {
        $match: {
          roomTypeId: { $in: roomTypeIds },
          date: { $gte: checkIn, $lt: checkOut },
        },
      },
      { $group: { _id: '$roomTypeId', roomUnitIds: { $addToSet: '$roomUnitId' } } },
    ]);
    const blockedByBookings = new Map(bookingsAgg.map((r) => [String(r._id), (r.roomUnitIds || []).map(String)]));

    const data = roomTypes
      .map((rt) => {
        const hotel = hotelById.get(String(rt.hotelId));
        if (!hotel) return null;
        const hotelImageSet = normalizePublicImageSet(hotel, { max: 4 });
        const roomImages = normalizePublicImages(rt.images, { max: 4 });

        const rtId = String(rt._id);
        const totalCount = totalByRoomType.get(rtId) || 0;
        const blockInfo = blockedByBlocks.get(rtId) || { roomUnitIds: [], kinds: [] };
        const bookedIds = blockedByBookings.get(rtId) || [];
        const blockedSet = new Set([
          ...blockInfo.roomUnitIds,
          ...bookedIds,
        ].filter(Boolean));
        const availableCount = Math.max(0, totalCount - blockedSet.size);
        const availabilityStatus = getAvailabilityStatus({
          totalCount,
          availableCount,
          manualKinds: blockInfo.kinds,
          hasOnlineBookings: bookedIds.length > 0,
        });

        return {
          ...rt,
          totalCount,
          availableCount,
          availabilityStatus: availabilityStatus.status,
          availabilityStatusLabel: availabilityStatus.label,
          uploader: (() => {
            const creator = rt.createdByUserId ? creatorById.get(String(rt.createdByUserId)) : null;
            return creator
              ? {
                _id: creator._id,
                role: creator.role,
                displayName: creator.profileDisplayName || creator.businessName || 'Verified partner',
                bio: creator.profileBio || '',
                profilePicture: creator.profilePicture || '',
              }
              : null;
          })(),
          images: roomImages.length ? roomImages : hotelImageSet.images,
          hotel: {
            _id: hotel._id,
            name: hotel.name,
            location: hotel.location,
            rating: hotel.rating,
            image: hotelImageSet.image,
            images: hotelImageSet.images,
            amenities: hotel.amenities,
            petsAllowed: hotel.petsAllowed,
            taxEnabled: hotel.taxEnabled,
            taxPercent: hotel.taxPercent,
            propertyType: hotel.propertyType || 'hotel',
            checkInTime: hotel.checkInTime,
            checkOutTime: hotel.checkOutTime,
            partnerId: hotel.partnerId,
          nearestTemple: hotel.nearestTemple,
          googleMapLink: hotel.googleMapLink,
          propertyTerms: hotel.propertyTerms,
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
    res.set('Cache-Control', 'no-store');

    const roomType = await RoomType.findById(req.params.id)
      .select('_id hotelId partnerId createdByUserId createdByRole name description images amenities pricePerNight maxAdults maxChildren petsAllowed status createdAt updatedAt')
      .lean();
    if (!roomType || roomType.status !== 'active') return res.status(404).json({ success: false, message: 'Room type not found' });

    const hotel = await Hotel.findOne({ _id: roomType.hotelId, status: 'active', approvalStatus: 'approved' })
      .select('_id name propertyType location rating image images amenities petsAllowed taxEnabled taxPercent gstMode checkInTime checkOutTime nearestTemple googleMapLink propertyTerms')
      .slice('images', 1)
      .lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));

    const enriched = await enrichRoomType({ roomType, hotel, checkIn, checkOut });
    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: room availability for a selected stay duration. Exact room numbers stay private to admin/partner.
// Query: ?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD
router.get('/:id/room-availability', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const roomType = await RoomType.findById(req.params.id)
      .select('_id hotelId status')
      .lean();
    if (!roomType || roomType.status !== 'active') return res.status(404).json({ success: false, message: 'Room type not found' });

    const hotel = await Hotel.findOne({ _id: roomType.hotelId, status: 'active', approvalStatus: 'approved' })
      .select('_id')
      .lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));
    if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkIn >= checkOut) {
      return res.status(400).json({ success: false, message: 'Valid checkIn and checkOut are required' });
    }

    const roomUnits = await RoomUnit.find({ roomTypeId: roomType._id })
      .select('_id number floor status petsAllowedOverride')
      .sort({ number: 1, createdAt: 1 })
      .lean();
    const totalCount = roomUnits.filter((unit) => BOOKABLE_ROOM_STATUSES.includes(String(unit?.status || '').trim().toLowerCase())).length;

    const blockDocs = await RoomUnitBlock.find({
      roomTypeId: roomType._id,
      startDate: { $lt: checkOut },
      endDate: { $gt: checkIn },
    })
      .select('roomUnitId kind reason')
      .lean();
    const blockByUnit = new Map(blockDocs.map((block) => [String(block.roomUnitId), block]));

    const bookedIds = await RoomUnitBookingDay.distinct('roomUnitId', {
      roomTypeId: roomType._id,
      date: { $gte: checkIn, $lt: checkOut },
    });
    const bookedSet = new Set(bookedIds.map(String));

    const roomAvailability = roomUnits.map((unit, index) => {
      const unitId = String(unit._id);
      const availability = getRoomUnitAvailability({
        unit,
        block: blockByUnit.get(unitId),
        isBooked: bookedSet.has(unitId),
      });
      return {
        displayLabel: `Room option ${index + 1}`,
        status: availability.status,
        label: availability.label,
      };
    });
    const availableCount = roomAvailability.filter((room) => room.status === 'available').length;
    const availabilityStatus = getAvailabilityStatus({
      totalCount,
      availableCount,
      manualKinds: blockDocs.map((block) => block.reason || block.kind),
      hasOnlineBookings: bookedIds.length > 0,
    });

    res.json({
      success: true,
      data: {
        totalCount,
        availableCount,
        availabilityStatus: availabilityStatus.status,
        availabilityStatusLabel: availabilityStatus.label,
        roomAvailability,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: calendar-style availability for a room type (per-day counts only)
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

    const units = await RoomUnit.find({ roomTypeId: roomType._id, status: { $in: BOOKABLE_ROOM_STATUSES } })
      .sort({ number: 1 })
      .select('_id number')
      .lean();

    const totalCount = units.length;
    const dateKey = (d) => d.toISOString().slice(0, 10);
    const blockedByDate = new Map(days.map((d) => [dateKey(d), { unitIds: new Set(), manualKinds: new Set(), hasOnlineBookings: false }]));

    // Blocks
    const blocks = await RoomUnitBlock.find({
      roomTypeId: roomType._id,
      startDate: { $lt: boundedTo },
      endDate: { $gt: from },
    })
      .select('roomUnitId startDate endDate kind reason')
      .lean();

    for (const b of blocks) {
      const start = isValidDate(b.startDate) ? b.startDate : from;
      const end = isValidDate(b.endDate) ? b.endDate : boundedTo;
      const overlapStart = start < from ? from : start;
      const overlapEnd = end > boundedTo ? boundedTo : end;
      for (const d of enumerateDatesUTC(overlapStart, overlapEnd)) {
        const key = dateKey(d);
        const item = blockedByDate.get(key);
        if (item) {
          item.unitIds.add(String(b.roomUnitId));
          item.manualKinds.add(String(b.reason || b.kind || 'unavailable'));
        }
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
      const item = blockedByDate.get(key);
      if (item) {
        item.unitIds.add(String(bd.roomUnitId));
        item.hasOnlineBookings = true;
      }
    }

    const calendar = days.map((d) => {
      const key = dateKey(d);
      const blockedInfo = blockedByDate.get(key) || { unitIds: new Set(), manualKinds: new Set(), hasOnlineBookings: false };
      const unavailableCount = blockedInfo.unitIds.size;
      const availableCount = Math.max(0, totalCount - unavailableCount);
      const availabilityStatus = getAvailabilityStatus({
        totalCount,
        availableCount,
        manualKinds: Array.from(blockedInfo.manualKinds),
        hasOnlineBookings: blockedInfo.hasOnlineBookings,
      });
      return {
        date: key,
        totalCount,
        availableCount,
        availabilityStatus: availabilityStatus.status,
        availabilityStatusLabel: availabilityStatus.label,
      };
    });

    res.json({ success: true, data: { from: dateKey(from), to: dateKey(boundedTo), totalCount, calendar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
