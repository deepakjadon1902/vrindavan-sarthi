const express = require('express');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const Settings = require('../models/Settings');
const Cab = require('../models/Cab');
const CabFare = require('../models/CabFare');
const { protect, authorize } = require('../middleware/auth');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC } = require('../utils/date');
const { processRoomTypeWaitlist } = require('../utils/waitlist');
const { sendEmail } = require('../utils/email');
const { sendSms } = require('../utils/sms');
const { buildPdf } = require('../utils/invoicePdf');
const router = express.Router();

const stripLargeInlineImage = (value) => {
  const v = typeof value === 'string' ? value : '';
  if (!v) return '';
  if (v.startsWith('data:') && v.length > 2048) return '';
  return v;
};

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

const getHotelTaxPercent = async (hotel) => {
  if (!hotel?.taxEnabled) return 0;
  const hotelPercent = Number(hotel?.taxPercent);
  if (Number.isFinite(hotelPercent) && hotelPercent >= 0) return Math.min(50, hotelPercent);
  try {
    const s = await Settings.findOne().select('hotelTaxPercent').lean();
    const p = Number(s?.hotelTaxPercent ?? 12);
    if (!Number.isFinite(p) || p < 0) return 0;
    return Math.min(50, p);
  } catch {
    return 12;
  }
};

const normalize = (v) => String(v || '').trim();
const normalizeLocationKey = (v) => normalize(v).replace(/\s+/g, ' ');

const calcCabFare = ({ baseFare }) => {
  const base = Number(baseFare || 0);
  return { base, included: 0, extraCharge: 0, pax: 0, extraPersons: 0, extra: 0, total: Math.max(0, base) };
};

const buildInvoiceLines = (booking) => {
  const total = Number(booking.totalAmount || 0);
  const advance = Number(booking.advanceAmount || 0);
  const balance = Number(booking.balanceAmount || Math.max(0, total - advance));
  return [
    `Invoice/Booking ID: ${booking.bookingId}`,
    `Customer: ${booking.customerFullName || booking.userName}`,
    `Mobile: ${booking.customerMobile || booking.userPhone}`,
    `Service: ${booking.itemName}`,
    booking.bookingType === 'cab' ? `Route: ${booking.pickupLocation} to ${booking.dropLocation}` : '',
    booking.bookingType === 'cab' ? `Pickup: ${booking.pickupDate} ${booking.pickupTime}` : '',
    booking.bookingType === 'cab' ? `Passengers: ${booking.guests || 1}` : '',
    booking.bookingType === 'cab' ? `Tolls: ${booking.tollOption === 'included' ? 'Included' : 'Excluded'}` : '',
    `Total amount: INR ${total.toLocaleString('en-IN')}`,
    `Advance paid online: INR ${advance.toLocaleString('en-IN')}`,
    `Balance payable later: INR ${balance.toLocaleString('en-IN')}`,
    `Payment status: ${booking.paymentStatus}`,
  ].filter(Boolean);
};

const sendCustomerInvoice = async (booking) => {
  const to = normalize(booking.customerEmail || booking.userEmail);
  if (!to || booking.invoiceSentAt) return;
  const lines = buildInvoiceLines(booking);
  await sendEmail({
    to,
    subject: `Vrindavan Sarthi Invoice ${booking.bookingId}`,
    text: ['Vrindavan Sarthi Invoice', ...lines].join('\n'),
    attachments: [
      {
        filename: `invoice-${booking.bookingId}.pdf`,
        content: buildPdf({ lines }),
        contentType: 'application/pdf',
      },
    ],
  });
};

// Create cab booking (authenticated user)
// Body: { fullName, mobileNumber, pickupLocation, dropLocation, pickupDate, pickupTime, passengers, cabType, tollOption, upiTransactionId }
router.post('/cab', protect, async (req, res) => {
  try {
    const fullName = normalize(req.body?.fullName) || normalize(req.body?.customerFullName) || normalize(req.user?.name);
    const mobileNumber = normalize(req.body?.mobileNumber) || normalize(req.body?.customerMobile) || normalize(req.user?.phone);
    const pickupLocation = normalizeLocationKey(req.body?.pickupLocation);
    const dropLocation = normalizeLocationKey(req.body?.dropLocation);
    const pickupDate = normalize(req.body?.pickupDate);
    const pickupTime = normalize(req.body?.pickupTime);
    const cabType = normalize(req.body?.cabType);
    const passengers = Number(req.body?.passengers || req.body?.persons || req.body?.guests || 1);
    const tollOptionInput = normalize(req.body?.tollOption).toLowerCase();
    const tollOption = tollOptionInput === 'included' || tollOptionInput === 'tolls_included'
      ? 'included'
      : tollOptionInput === 'excluded' || tollOptionInput === 'tolls_excluded'
        ? 'excluded'
        : '';
    const upiTransactionId = normalize(req.body?.upiTransactionId);

    if (!fullName || !mobileNumber) return res.status(400).json({ success: false, message: 'Full Name and Mobile Number are required' });
    if (!pickupLocation || !dropLocation || !pickupDate || !pickupTime || !cabType) {
      return res.status(400).json({ success: false, message: 'pickupLocation, dropLocation, pickupDate, pickupTime, and cabType are required' });
    }
    if (!Number.isFinite(passengers) || passengers < 1) return res.status(400).json({ success: false, message: 'Invalid number of passengers' });
    if (!tollOption) return res.status(400).json({ success: false, message: 'Please choose Tolls Included or Tolls Excluded' });
    if (!upiTransactionId) return res.status(400).json({ success: false, message: 'UPI transaction ID is required for the 30% advance payment' });

    const rule = await CabFare.findOne({ pickupLocation, dropLocation, cabType, status: 'active' }).lean();
    if (!rule) return res.status(404).json({ success: false, message: 'Fare not set for this route/vehicle' });

    const breakdown = calcCabFare(rule);
    const totalAmount = breakdown.total;
    const advanceAmount = Math.round(totalAmount * 0.3);
    const balanceAmount = Math.max(0, totalAmount - advanceAmount);
    const bookingId = generateBookingCode();

    const booking = await Booking.create({
      bookingId,
      bookingType: 'cab',
      itemId: 'cab_request',
      itemName: `${pickupLocation} → ${dropLocation} (${cabType})`,
      itemImage: '/placeholder.svg',

      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone,

      checkIn: parseDateOnlyToUTC(pickupDate),
      guests: passengers,

      customerFullName: fullName,
      customerMobile: mobileNumber,
      customerEmail: normalize(req.user.email),

      pickupLocation,
      dropLocation,
      pickupDate,
      pickupTime,
      cabType,
      cabFareRuleId: rule._id,
      cabFareBase: breakdown.base,
      cabFareExtra: breakdown.extra,
      cabFareTotal: breakdown.total,
      tollOption,

      totalAmount,
      advanceAmount,
      balanceAmount,
      advancePercent: 30,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      bookingStatus: 'pending',
      verificationStage: 'pending_admin',
      upiTransactionId,
      additionalInfo: `30% advance submitted by UPI. Balance INR ${balanceAmount.toLocaleString('en-IN')} payable later. Tolls ${tollOption}.`,
    });

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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

    // Server-side total amount calculation (includes admin-controlled hotel tax).
    const nights = Math.max(1, daysToReserve.length);
    const baseAmount = Math.max(0, Number(roomType.pricePerNight || 0)) * nights;
    const taxPercent = await getHotelTaxPercent(hotel);
    const taxAmount = Math.round((baseAmount * taxPercent) / 100);
    const totalAmount = Math.round(baseAmount + taxAmount);

    const isOnline = (req.body?.paymentMethod || 'online') === 'online';

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
    const withImages = String(req.query?.withImages || '').toLowerCase() === 'true';

    const bookings = await Booking.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        withImages
          ? 'bookingId bookingType itemId itemName itemImage userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests pickupLocation dropLocation pickupDate pickupTime cabType cabFareTotal tollOption advanceAmount balanceAmount assignedVehicleName assignedVehicleType assignedDriverName assignedDriverPhone assignedDriverEmail cancellationRequested cancellationReason cancellationRequestedAt cancellationReviewedByAdmin totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt'
          : 'bookingId bookingType itemId itemName userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests pickupLocation dropLocation pickupDate pickupTime cabType cabFareTotal tollOption advanceAmount balanceAmount assignedVehicleName assignedVehicleType assignedDriverName assignedDriverPhone assignedDriverEmail cancellationRequested cancellationReason cancellationRequestedAt cancellationReviewedByAdmin totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt'
      )
      .lean();

    if (!withImages) {
      for (const b of bookings) b.itemImage = '/placeholder.svg';
    } else {
      for (const b of bookings) b.itemImage = stripLargeInlineImage(b.itemImage) || '/placeholder.svg';
    }
    // Redact sensitive cab driver contact details until confirmed.
    for (const b of bookings) {
      if (b.bookingType === 'cab' && b.bookingStatus !== 'confirmed') {
        b.assignedDriverPhone = '';
        b.assignedDriverEmail = '';
      }
    }

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
    const withImages = String(req.query?.withImages || '').toLowerCase() === 'true';

    const bookings = await Booking.find({ partnerId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        withImages
          ? 'bookingId bookingType itemId itemName itemImage userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests pickupLocation dropLocation pickupDate pickupTime cabType cabFareTotal assignedVehicleName assignedVehicleType assignedDriverName assignedDriverPhone cancellationRequested cancellationReason cancellationRequestedAt cancellationReviewedByAdmin totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt'
          : 'bookingId bookingType itemId itemName userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests pickupLocation dropLocation pickupDate pickupTime cabType cabFareTotal assignedVehicleName assignedVehicleType assignedDriverName assignedDriverPhone cancellationRequested cancellationReason cancellationRequestedAt cancellationReviewedByAdmin totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt'
      )
      .lean();

    if (!withImages) {
      for (const b of bookings) b.itemImage = '/placeholder.svg';
    } else {
      for (const b of bookings) b.itemImage = stripLargeInlineImage(b.itemImage) || '/placeholder.svg';
    }
    // Partners should only see limited customer info until booking is confirmed.
    for (const b of bookings) {
      if (b.bookingStatus !== 'confirmed') {
        b.userName = '';
        b.userPhone = '';
        b.userEmail = '';
        b.customerFullName = '';
        b.customerMobile = '';
        b.customerEmail = '';
      } else {
        // Even after confirmation, keep customer email hidden.
        b.userEmail = '';
        b.customerEmail = '';
      }
    }

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
    const withImages = String(req.query?.withImages || '').toLowerCase() === 'true';

    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        withImages
          ? 'bookingId bookingType itemId itemName itemImage userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests pickupLocation dropLocation pickupDate pickupTime cabType cabFareTotal tollOption advanceAmount balanceAmount totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt'
          : 'bookingId bookingType itemId itemName userId userName userEmail userPhone partnerId partnerName hotelId roomTypeId roomUnitId roomNumber checkIn checkOut guests pickupLocation dropLocation pickupDate pickupTime cabType cabFareTotal tollOption advanceAmount balanceAmount totalAmount paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId additionalInfo createdAt'
      )
      .lean();

    if (!withImages) {
      for (const b of bookings) b.itemImage = '/placeholder.svg';
    } else {
      for (const b of bookings) b.itemImage = stripLargeInlineImage(b.itemImage) || '/placeholder.svg';
    }
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

    const reason = normalize(req.body?.reason || req.body?.cancellationReason);

    // If already confirmed, require a reason and route through admin review.
    if (booking.bookingStatus === 'confirmed') {
      if (!reason) return res.status(400).json({ success: false, message: 'Cancellation reason is required for confirmed bookings' });
      booking.cancellationRequested = true;
      booking.cancellationReason = reason;
      booking.cancellationRequestedAt = new Date();
      await booking.save();
      return res.json({ success: true, data: booking, message: 'Cancellation request submitted. Admin will review.' });
    }

    // Pending bookings can be cancelled immediately.
    booking.bookingStatus = 'cancelled';
    booking.cancellationRequested = true;
    booking.cancellationReason = reason || 'user_cancelled';
    booking.cancellationRequestedAt = new Date();
    booking.cancellationReviewedByAdmin = true;
    booking.cancellationReviewedAt = new Date();
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

// Admin: approve/deny cancellation request
router.put('/:id/cancel-review', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const approve = Boolean(req.body?.approve);
    booking.cancellationReviewedByAdmin = true;
    booking.cancellationReviewedAt = new Date();

    if (approve) {
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
      return res.json({ success: true, data: booking });
    }

    // Deny: keep booking status as-is, just mark reviewed.
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: assign cab/driver to a cab booking + confirm
router.put('/:id/assign-cab', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.bookingType !== 'cab') return res.status(400).json({ success: false, message: 'Not a cab booking' });

    const cabId = normalize(req.body?.cabId);
    if (!cabId) return res.status(400).json({ success: false, message: 'cabId is required' });

    const cab = await Cab.findById(cabId).lean();
    if (!cab) return res.status(404).json({ success: false, message: 'Cab not found' });
    if (cab.status !== 'available' || cab.approvalStatus !== 'approved') {
      return res.status(400).json({ success: false, message: 'Cab is not available/approved' });
    }

    booking.assignedCabId = cab._id;
    booking.assignedVehicleName = cab.vehicleName;
    booking.assignedVehicleType = cab.vehicleType;
    booking.assignedDriverName = cab.driverName;
    booking.assignedDriverPhone = cab.driverPhone;
    booking.assignedDriverEmail = normalize(cab.driverEmail);
    booking.itemId = String(cab._id);
    booking.itemName = cab.vehicleName;
    booking.itemImage = cab.image || booking.itemImage;
    booking.bookingStatus = 'confirmed';
    await booking.save();

    // SMS driver (best-effort). Drivers must be notified by mobile number, not email.
    if (booking.assignedDriverPhone) {
      const subject = '';
      const text =
        `Booking ID: ${booking.bookingId}\n` +
        `Customer: ${booking.customerFullName || booking.userName}\n` +
        `Mobile: ${booking.customerMobile || booking.userPhone}\n` +
        `Pickup: ${booking.pickupLocation}\n` +
        `Drop: ${booking.dropLocation}\n` +
        `Date: ${booking.pickupDate}\n` +
        `Time: ${booking.pickupTime}\n` +
        `Passengers: ${booking.guests || 1}\n` +
        `Cab Type: ${booking.cabType}\n` +
        `Total Fare: ₹${Number(booking.cabFareTotal || booking.totalAmount || 0).toLocaleString('en-IN')}\n\n` +
        `Payment: 30% advance online, 70% balance later\n`;
      try { await sendSms({ to: booking.assignedDriverPhone, message: text }); } catch { /* ignore */ }
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
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
      bookingStatus: bookingExisting.bookingType === 'cab' ? 'pending' : 'confirmed',
      verificationStage: 'verified',
      adminPaymentVerified: true,
      adminPaymentVerifiedAt: new Date(),
    }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    try {
      await sendCustomerInvoice(booking);
      booking.invoiceSentAt = new Date();
      await booking.save();
    } catch {
      // Email is best-effort; verification should not fail if mail is down.
    }
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
