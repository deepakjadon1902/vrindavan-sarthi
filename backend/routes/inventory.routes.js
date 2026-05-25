const express = require('express');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const { processRoomTypeWaitlist } = require('../utils/waitlist');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const { parseDateOnlyToUTC, isValidDate } = require('../utils/date');
const { normalizeImageFields } = require('../utils/imageFields');

const router = express.Router();

// Partner-only inventory APIs
router.use(protect, authorize('partner'));

const stripLargeInlineImage = (value) => {
  const v = typeof value === 'string' ? value : '';
  if (!v) return '';
  if (v.startsWith('data:') && v.length > 2048) return '';
  return v;
};

const ensurePartnerHotel = async (hotelId, partnerId) => {
  const hotel = await Hotel.findOne({ _id: hotelId, partnerId }).lean();
  return hotel || null;
};

const normalizeString = (v) => String(v || '').trim();
const normalizeStringArray = (v) => (Array.isArray(v) ? v.map((x) => normalizeString(x)).filter(Boolean) : []);

// Room Types (CRUD) under a partner hotel
router.get('/hotels/:hotelId/room-types', async (req, res) => {
  try {
    const hotel = await ensurePartnerHotel(req.params.hotelId, req.user._id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const roomTypes = await RoomType.find({ hotelId: hotel._id, partnerId: req.user._id })
      .sort({ createdAt: -1 })
      .select('_id hotelId name description amenities pricePerNight maxAdults maxChildren petsAllowed status createdAt updatedAt')
      .lean();

    res.json({ success: true, data: roomTypes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/hotels/:hotelId/room-types', async (req, res) => {
  try {
    const hotel = await ensurePartnerHotel(req.params.hotelId, req.user._id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const name = normalizeString(req.body?.name);
    const pricePerNight = Number(req.body?.pricePerNight || 0);
    if (!name) return res.status(400).json({ success: false, message: 'Room type name is required' });
    if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) return res.status(400).json({ success: false, message: 'Valid pricePerNight is required' });

    const body = { ...req.body };
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/room-types', multi: ['images'], tags: ['roomType', 'partner'] });

    const roomType = await RoomType.create({
      hotelId: hotel._id,
      partnerId: req.user._id,
      createdByUserId: req.user._id,
      createdByRole: 'partner',
      name,
      description: normalizeString(req.body?.description),
      images: normalizeStringArray(body?.images),
      amenities: normalizeStringArray(req.body?.amenities),
      pricePerNight,
      maxAdults: Math.max(1, Number(req.body?.maxAdults || 1)),
      maxChildren: Math.max(0, Number(req.body?.maxChildren || 0)),
      petsAllowed: Boolean(req.body?.petsAllowed),
      status: normalizeString(req.body?.status) === 'inactive' ? 'inactive' : 'active',
    });

    res.status(201).json({ success: true, data: roomType });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/room-types/:roomTypeId', async (req, res) => {
  try {
    const roomType = await RoomType.findOne({ _id: req.params.roomTypeId, partnerId: req.user._id });
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });

    const body = { ...req.body };
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/room-types', multi: ['images'], tags: ['roomType', 'partner'] });

    if (typeof req.body?.name !== 'undefined') roomType.name = normalizeString(req.body?.name) || roomType.name;
    if (typeof req.body?.description !== 'undefined') roomType.description = normalizeString(req.body?.description);
    if (typeof req.body?.images !== 'undefined') roomType.images = normalizeStringArray(body?.images);
    if (typeof req.body?.amenities !== 'undefined') roomType.amenities = normalizeStringArray(req.body?.amenities);
    if (typeof req.body?.pricePerNight !== 'undefined') {
      const pricePerNight = Number(req.body?.pricePerNight || 0);
      if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) return res.status(400).json({ success: false, message: 'Valid pricePerNight is required' });
      roomType.pricePerNight = pricePerNight;
    }
    if (typeof req.body?.maxAdults !== 'undefined') roomType.maxAdults = Math.max(1, Number(req.body?.maxAdults || 1));
    if (typeof req.body?.maxChildren !== 'undefined') roomType.maxChildren = Math.max(0, Number(req.body?.maxChildren || 0));
    if (typeof req.body?.petsAllowed !== 'undefined') roomType.petsAllowed = Boolean(req.body?.petsAllowed);
    if (typeof req.body?.status !== 'undefined') roomType.status = normalizeString(req.body?.status) === 'inactive' ? 'inactive' : 'active';

    roomType.createdByUserId = req.user._id;
    roomType.createdByRole = 'partner';
    await roomType.save();

    res.json({ success: true, data: roomType });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/room-types/:roomTypeId', async (req, res) => {
  try {
    const roomType = await RoomType.findOne({ _id: req.params.roomTypeId, partnerId: req.user._id });
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });

    await RoomUnit.deleteMany({ roomTypeId: roomType._id, partnerId: req.user._id });
    await RoomUnitBlock.deleteMany({ roomTypeId: roomType._id });
    await roomType.deleteOne();

    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Room Units (CRUD) under a partner room type
router.get('/room-types/:roomTypeId/rooms', async (req, res) => {
  try {
    const roomType = await RoomType.findOne({ _id: req.params.roomTypeId, partnerId: req.user._id }).lean();
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });

    const rooms = await RoomUnit.find({ roomTypeId: roomType._id, partnerId: req.user._id }).sort({ number: 1 }).lean();
    res.json({ success: true, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/room-types/:roomTypeId/rooms', async (req, res) => {
  try {
    const roomType = await RoomType.findOne({ _id: req.params.roomTypeId, partnerId: req.user._id }).lean();
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });

    const number = normalizeString(req.body?.number);
    if (!number) return res.status(400).json({ success: false, message: 'Room number is required' });

    const room = await RoomUnit.create({
      hotelId: roomType.hotelId,
      roomTypeId: roomType._id,
      partnerId: req.user._id,
      createdByUserId: req.user._id,
      createdByRole: 'partner',
      number,
      floor: normalizeString(req.body?.floor),
      petsAllowedOverride: typeof req.body?.petsAllowedOverride === 'boolean' ? Boolean(req.body?.petsAllowedOverride) : null,
      status: normalizeString(req.body?.status) === 'inactive' ? 'inactive' : 'active',
    });

    try {
      await processRoomTypeWaitlist({ roomTypeId: roomType._id, max: 50 });
    } catch {
      // ignore waitlist processing errors
    }

    res.status(201).json({ success: true, data: room });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(409).json({ success: false, message: 'Room number already exists for this room type' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/rooms/:roomUnitId', async (req, res) => {
  try {
    const room = await RoomUnit.findOne({ _id: req.params.roomUnitId, partnerId: req.user._id });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (typeof req.body?.number !== 'undefined') room.number = normalizeString(req.body?.number) || room.number;
    if (typeof req.body?.floor !== 'undefined') room.floor = normalizeString(req.body?.floor);
    if (typeof req.body?.petsAllowedOverride !== 'undefined') {
      room.petsAllowedOverride = typeof req.body?.petsAllowedOverride === 'boolean' ? Boolean(req.body?.petsAllowedOverride) : null;
    }
    if (typeof req.body?.status !== 'undefined') room.status = normalizeString(req.body?.status) === 'inactive' ? 'inactive' : 'active';

    room.createdByUserId = req.user._id;
    room.createdByRole = 'partner';
    await room.save();

    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/rooms/:roomUnitId', async (req, res) => {
  try {
    const room = await RoomUnit.findOne({ _id: req.params.roomUnitId, partnerId: req.user._id });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    await RoomUnitBlock.deleteMany({ roomUnitId: room._id });
    await room.deleteOne();

    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Calendar (blocks + bookings) for a room unit
router.get('/rooms/:roomUnitId/calendar', async (req, res) => {
  try {
    const room = await RoomUnit.findOne({ _id: req.params.roomUnitId, partnerId: req.user._id }).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const from = parseDateOnlyToUTC(String(req.query?.from || ''));
    const to = parseDateOnlyToUTC(String(req.query?.to || ''));

    const match = { roomUnitId: room._id };
    if (isValidDate(from) && isValidDate(to) && from < to) {
      match.$and = [{ startDate: { $lt: to } }, { endDate: { $gt: from } }];
    }

    const blocks = await RoomUnitBlock.find(match).sort({ startDate: 1 }).lean();
    const bookings = await Booking.find({
      roomUnitId: room._id,
      bookingStatus: { $ne: 'cancelled' },
      checkIn: { $lt: isValidDate(to) ? to : new Date('2100-01-01T00:00:00.000Z') },
      checkOut: { $gt: isValidDate(from) ? from : new Date('1970-01-01T00:00:00.000Z') },
    })
      .sort({ checkIn: 1 })
      .select('bookingId bookingStatus paymentStatus checkIn checkOut customerFullName userName userPhone totalAdults totalChildren hasPet')
      .lean();

    res.json({ success: true, data: { blocks, bookings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/rooms/:roomUnitId/blocks', async (req, res) => {
  try {
    const room = await RoomUnit.findOne({ _id: req.params.roomUnitId, partnerId: req.user._id }).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    const kind = normalizeString(req.body?.kind);
    const startDate = parseDateOnlyToUTC(String(req.body?.startDate || ''));
    const endDate = parseDateOnlyToUTC(String(req.body?.endDate || ''));
    if (!isValidDate(startDate) || !isValidDate(endDate) || startDate >= endDate) {
      return res.status(400).json({ success: false, message: 'Valid startDate and endDate are required' });
    }

    const conflictingBooking = await Booking.findOne({
      roomUnitId: room._id,
      bookingStatus: { $ne: 'cancelled' },
      checkIn: { $lt: endDate },
      checkOut: { $gt: startDate },
    }).lean();
    if (conflictingBooking) {
      return res.status(409).json({ success: false, message: 'Room has a booking in this date range' });
    }

    const block = await RoomUnitBlock.create({
      hotelId: room.hotelId,
      roomTypeId: room.roomTypeId,
      roomUnitId: room._id,
      kind,
      startDate,
      endDate,
      note: normalizeString(req.body?.note),
      createdByUserId: req.user._id,
    });

    res.status(201).json({ success: true, data: block });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/blocks/:blockId', async (req, res) => {
  try {
    const block = await RoomUnitBlock.findById(req.params.blockId);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });

    const room = await RoomUnit.findOne({ _id: block.roomUnitId, partnerId: req.user._id }).lean();
    if (!room) return res.status(403).json({ success: false, message: 'Not authorized' });

    await block.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
