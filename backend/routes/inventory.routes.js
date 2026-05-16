const express = require('express');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const { parseDateOnlyToUTC, isValidDate } = require('../utils/date');

const router = express.Router();

// All routes are partner-only
router.use(protect, authorize('partner'));

const ensurePartnerHotel = async (hotelId, partnerId) => {
  const hotel = await Hotel.findOne({ _id: hotelId, partnerId }).lean();
  return hotel || null;
};

// Room Types CRUD (partner scope)
router.get('/hotels/:hotelId/room-types', async (req, res) => {
  try {
    const hotel = await ensurePartnerHotel(req.params.hotelId, req.user._id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    const roomTypes = await RoomType.find({ hotelId: hotel._id, partnerId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: roomTypes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/hotels/:hotelId/room-types', async (req, res) => {
  try {
    const hotel = await ensurePartnerHotel(req.params.hotelId, req.user._id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const roomType = await RoomType.create({
      ...req.body,
      hotelId: hotel._id,
      partnerId: req.user._id,
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
    Object.assign(roomType, req.body);
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

// Room Units CRUD
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

    const number = String(req.body?.number || '').trim();
    if (!number) return res.status(400).json({ success: false, message: 'Room number is required' });

    const room = await RoomUnit.create({
      ...req.body,
      number,
      hotelId: roomType.hotelId,
      roomTypeId: roomType._id,
      partnerId: req.user._id,
    });
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    // Handle unique constraint for roomTypeId+number
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
    Object.assign(room, req.body);
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

// Room calendar blocks (manual)
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

    const { kind, note } = req.body || {};
    const startDate = parseDateOnlyToUTC(String(req.body?.startDate || ''));
    const endDate = parseDateOnlyToUTC(String(req.body?.endDate || ''));
    if (!isValidDate(startDate) || !isValidDate(endDate) || startDate >= endDate) {
      return res.status(400).json({ success: false, message: 'Valid startDate and endDate are required' });
    }

    // Prevent blocking over existing confirmed/pending bookings
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
      note: typeof note === 'string' ? note : '',
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

// Room-type availability summary (partner view)
router.get('/room-types/:roomTypeId/availability', async (req, res) => {
  try {
    const roomType = await RoomType.findOne({ _id: req.params.roomTypeId, partnerId: req.user._id }).lean();
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });

    const checkIn = parseDateOnlyToUTC(String(req.query?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.query?.checkOut || ''));
    if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkIn >= checkOut) {
      return res.status(400).json({ success: false, message: 'Valid checkIn and checkOut are required' });
    }

    const totalCount = await RoomUnit.countDocuments({ roomTypeId: roomType._id, status: 'active' });

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

    res.json({ success: true, data: { totalCount, availableCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

