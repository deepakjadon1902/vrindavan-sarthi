const express = require('express');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { protect, authorize } = require('../middleware/auth');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC } = require('../utils/date');
const { processRoomTypeWaitlist } = require('../utils/waitlist');
const router = express.Router();

const normalizeGender = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  if (s === 'other' || s === 'o') return 'other';
  return null;
};

const generateBookingCode = () => {
  const year = new Date().getFullYear();
  return `VVS-${year}-${String(Math.floor(10000 + Math.random() * 90000))}`;
};

// Create booking for a room type (authenticated user)
// Body: { hotelId, roomTypeId, checkIn, checkOut, customerFullName, customerMobile, customerEmail, arrivalMode, vehicleNumber, arrivalTime, totalAdults, totalChildren, hasPet, guestDetails[], paymentMethod, totalAmount, upiTransactionId? }
router.post('/room-type', protect, async (req, res) => {
  try {
    const hotelId = String(req.body?.hotelId || '').trim();
    const roomTypeId = String(req.body?.roomTypeId || '').trim();
    if (!hotelId || !roomTypeId) return res.status(400).json({ success: false, message: 'hotelId and roomTypeId are required' });

    const hotel = await Hotel.findById(hotelId).lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const roomType = await RoomType.findOne({ _id: roomTypeId, hotelId: hotel._id, status: 'active' }).lean();
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });

    const checkIn = parseDateOnlyToUTC(String(req.body?.checkIn || ''));
    const checkOut = parseDateOnlyToUTC(String(req.body?.checkOut || ''));
    if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkIn >= checkOut) {
      return res.status(400).json({ success: false, message: 'Valid checkIn and checkOut are required' });
    }

    const customerFullName = String(req.body?.customerFullName || '').trim();
    const customerMobile = String(req.body?.customerMobile || '').trim();
    const customerEmail = String(req.body?.customerEmail || '').trim();
    if (!customerFullName || !customerMobile || !customerEmail) {
      return res.status(400).json({ success: false, message: 'customerFullName, customerMobile and customerEmail are required' });
    }

    const totalAdults = Number(req.body?.totalAdults || 0);
    const totalChildren = Number(req.body?.totalChildren || 0);
    if (!Number.isFinite(totalAdults) || totalAdults < 1) return res.status(400).json({ success: false, message: 'At least 1 adult is required' });
    if (!Number.isFinite(totalChildren) || totalChildren < 0) return res.status(400).json({ success: false, message: 'Invalid totalChildren' });

    if (totalAdults > (roomType.maxAdults || 0)) return res.status(400).json({ success: false, message: `Max adults for this room type is ${roomType.maxAdults}` });
    if (totalChildren > (roomType.maxChildren || 0)) return res.status(400).json({ success: false, message: `Max children for this room type is ${roomType.maxChildren}` });

    const hasPet = Boolean(req.body?.hasPet);
    if (hasPet && !hotel.petsAllowed) return res.status(400).json({ success: false, message: 'Pets are not allowed at this hotel' });

    const guestDetailsInput = Array.isArray(req.body?.guestDetails) ? req.body.guestDetails : [];
    const guestDetails = guestDetailsInput
      .map((g) => ({
        type: String(g?.type || '').trim().toLowerCase(),
        name: String(g?.name || '').trim(),
        age: Number(g?.age || 0),
        gender: normalizeGender(g?.gender),
      }))
      .filter((g) => (g.type === 'adult' || g.type === 'child') && g.name && Number.isFinite(g.age) && g.age > 0);

    const adultCountFromDetails = guestDetails.filter((g) => g.type === 'adult').length;
    const childCountFromDetails = guestDetails.filter((g) => g.type === 'child').length;
    if (adultCountFromDetails !== totalAdults || childCountFromDetails !== totalChildren) {
      return res.status(400).json({ success: false, message: 'guestDetails must include name/age for each adult/child' });
    }

    const daysToReserve = enumerateDatesUTC(checkIn, checkOut);
    if (daysToReserve.length <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    const isOnline = (req.body?.paymentMethod || 'online') === 'online';
    const totalAmount = Number(req.body?.totalAmount || 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return res.status(400).json({ success: false, message: 'Invalid totalAmount' });

    const units = await RoomUnit.find({ roomTypeId: roomType._id, status: 'active' }).sort({ number: 1 }).lean();
    if (!units.length) return res.status(409).json({ success: false, message: 'No rooms available for selected dates' });

    const blockedByBlocks = await RoomUnitBlock.distinct('roomUnitId', {
      roomTypeId: roomType._id,
      startDate: { $lt: checkOut },
      endDate: { $gt: checkIn },
    });
    const blockedSet = new Set(blockedByBlocks.map(String));

    const bookingId = generateBookingCode();

    let createdBooking = null;
    for (const unit of units) {
      if (blockedSet.has(String(unit._id))) continue;

      const effectivePetsAllowed =
        Boolean(hotel.petsAllowed) &&
        (unit.petsAllowedOverride === null || typeof unit.petsAllowedOverride === 'undefined'
          ? Boolean(roomType.petsAllowed)
          : Boolean(unit.petsAllowedOverride));
      if (hasPet && !effectivePetsAllowed) continue;

      const booking = new Booking({
        bookingId,
        bookingType: 'room_type',
        itemId: String(roomType._id),
        itemName: `${hotel.name} - ${roomType.name}`,
        itemImage: (roomType.images && roomType.images[0]) || hotel.image,

        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        userPhone: req.user.phone,

        partnerId: hotel.partnerId,
        partnerName: hotel.partnerName,

        hotelId: hotel._id,
        roomTypeId: roomType._id,
        roomUnitId: unit._id,
        roomNumber: unit.number,

        checkIn,
        checkOut,
        guests: totalAdults + totalChildren,

        customerFullName,
        customerMobile,
        customerEmail,
        arrivalMode: req.body?.arrivalMode || null,
        vehicleNumber: String(req.body?.vehicleNumber || '').trim() || undefined,
        arrivalTime: String(req.body?.arrivalTime || '').trim() || undefined,
        totalAdults,
        totalChildren,
        hasPet,
        guestDetails,

        totalAmount,
        paymentMethod: isOnline ? 'online' : (req.body?.paymentMethod || 'doorstep'),
        bookingStatus: 'pending',
        paymentStatus: isOnline ? 'pending' : (req.body?.paymentStatus || 'pending'),
        verificationStage: isOnline ? (hotel.partnerId ? 'pending_partner' : 'pending_admin') : 'verified',
        partnerPaymentVerified: false,
        adminPaymentVerified: false,
        upiTransactionId: String(req.body?.upiTransactionId || '').trim() || undefined,
        additionalInfo: String(req.body?.additionalInfo || '').trim() || undefined,
      });

      try {
        await RoomUnitBookingDay.insertMany(
          daysToReserve.map((d) => ({
            hotelId: hotel._id,
            roomTypeId: roomType._id,
            roomUnitId: unit._id,
            bookingId: booking._id,
            date: d,
          })),
          { ordered: true }
        );
      } catch (err) {
        if (String(err?.code) === '11000') continue;
        throw err;
      }

      try {
        await booking.save();
      } catch (err) {
        await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
        throw err;
      }

      createdBooking = booking;
      break;
    }

    if (!createdBooking) {
      const waitlistedBooking = await Booking.create({
        bookingId,
        bookingType: 'room_type',
        itemId: String(roomType._id),
        itemName: `${hotel.name} - ${roomType.name}`,
        itemImage: (roomType.images && roomType.images[0]) || hotel.image,

        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        userPhone: req.user.phone,

        partnerId: hotel.partnerId,
        partnerName: hotel.partnerName,

        hotelId: hotel._id,
        roomTypeId: roomType._id,

        checkIn,
        checkOut,
        guests: totalAdults + totalChildren,

        customerFullName,
        customerMobile,
        customerEmail,
        arrivalMode: req.body?.arrivalMode || null,
        vehicleNumber: String(req.body?.vehicleNumber || '').trim() || undefined,
        arrivalTime: String(req.body?.arrivalTime || '').trim() || undefined,
        totalAdults,
        totalChildren,
        hasPet,
        guestDetails,

        totalAmount,
        paymentMethod: isOnline ? 'online' : (req.body?.paymentMethod || 'doorstep'),
        bookingStatus: 'pending',
        paymentStatus: isOnline ? 'pending' : (req.body?.paymentStatus || 'pending'),
        verificationStage: isOnline ? (hotel.partnerId ? 'pending_partner' : 'pending_admin') : 'verified',
        partnerPaymentVerified: false,
        adminPaymentVerified: false,
        upiTransactionId: String(req.body?.upiTransactionId || '').trim() || undefined,
        additionalInfo: String(req.body?.additionalInfo || '').trim() || undefined,
        isWaitlisted: true,
      });

      return res.status(201).json({
        success: true,
        data: waitlistedBooking,
        message: 'All rooms are booked for selected dates. Added to waitlist; we will auto-assign a room if a slot opens.',
      });
    }

    res.status(201).json({ success: true, data: createdBooking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create booking (authenticated user)
router.post('/', protect, async (req, res) => {
  try {
    const partnerId = req.body?.partnerId || undefined;
    const isOnline = (req.body?.paymentMethod || 'online') === 'online';

    const payload = {
      ...req.body,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone,
      bookingStatus: isOnline ? 'confirmed' : (req.body?.bookingStatus || 'confirmed'),
      paymentStatus: isOnline ? 'pending' : (req.body?.paymentStatus || 'pending'),
      verificationStage: isOnline ? (partnerId ? 'pending_partner' : 'pending_admin') : 'verified',
      partnerPaymentVerified: false,
      adminPaymentVerified: false,
    };

    const booking = await Booking.create(payload);
    res.status(201).json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get user bookings
router.get('/my', protect, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 200;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    const bookings = await Booking.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('bookingId bookingType itemId itemName itemImage userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt')
      .lean();
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get partner bookings
router.get('/partner', protect, authorize('partner'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 200;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    const bookings = await Booking.find({ partnerId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('bookingId bookingType itemId itemName itemImage userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt')
      .lean();
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all bookings (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(1000, Math.floor(limitRaw)) : 300;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('bookingId bookingType itemId itemName itemImage userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt')
      .lean();
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get single booking (owner/admin/partner)
router.get('/:id', protect, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isOwner = String(booking.userId) === String(req.user._id);
    const isPartner = booking.partnerId && String(booking.partnerId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isPartner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cancel booking
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.bookingStatus = 'cancelled';
    await booking.save();

    if (booking.roomUnitId) {
      await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
    }

    if (booking.roomTypeId) {
      try {
        await processRoomTypeWaitlist({ roomTypeId: booking.roomTypeId, max: 50 });
      } catch {
        // ignore waitlist processing errors
      }
    }
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Submit payment transaction id (user)
router.put('/:id/payment', protect, async (req, res) => {
  try {
    const { upiTransactionId } = req.body || {};
    if (!upiTransactionId || typeof upiTransactionId !== 'string') {
      return res.status(400).json({ success: false, message: 'UPI transaction ID is required' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.upiTransactionId = upiTransactionId.trim();
    booking.paymentStatus = 'pending';
    booking.bookingStatus = 'pending';
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify payment (admin)
router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const bookingExisting = await Booking.findById(req.params.id);
    if (!bookingExisting) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (bookingExisting.paymentMethod === 'online' && bookingExisting.partnerId && !bookingExisting.partnerPaymentVerified) {
      return res.status(400).json({ success: false, message: 'Partner verification required before admin verification' });
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, {
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      verificationStage: 'verified',
      adminPaymentVerified: true,
      adminPaymentVerifiedAt: new Date(),
    }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject payment (admin)
router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        paymentStatus: 'failed',
        bookingStatus: 'cancelled',
        verificationStage: 'rejected',
        adminPaymentVerified: false,
        adminPaymentVerifiedAt: new Date(),
      },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify payment (partner - first step)
router.put('/:id/partner-verify', protect, authorize('partner'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.partnerId || String(booking.partnerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.paymentMethod !== 'online') {
      return res.status(400).json({ success: false, message: 'Partner verification is only for online payments' });
    }

    booking.partnerPaymentVerified = true;
    booking.partnerPaymentVerifiedAt = new Date();
    booking.verificationStage = 'pending_admin';
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject payment (partner)
router.put('/:id/partner-reject', protect, authorize('partner'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.partnerId || String(booking.partnerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.paymentMethod !== 'online') {
      return res.status(400).json({ success: false, message: 'Partner rejection is only for online payments' });
    }

    booking.partnerPaymentVerified = false;
    booking.partnerPaymentVerifiedAt = new Date();
    booking.adminPaymentVerified = false;
    booking.adminPaymentVerifiedAt = null;
    booking.paymentStatus = 'failed';
    booking.bookingStatus = 'cancelled';
    booking.verificationStage = 'rejected';
    await booking.save();

    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
