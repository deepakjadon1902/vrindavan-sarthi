const crypto = require('crypto');
const Booking = require('../models/Booking');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { enumerateDatesUTC } = require('./date');
const {
  getPaymentHoldExpiresAt,
  releaseBookingInventory,
  transitionBookingStatus,
  tryReserveRoomUnitsForBooking,
} = require('./reservationLifecycle');

const BOOKABLE_ROOM_STATUSES = ['active', 'available'];
const DHARAMSHALA_PAYMENT_MODES = new Set(['pay_at_dharamshala', 'full_online', 'request_only']);

const normalizePaymentMode = (hotel) => {
  const mode = String(hotel?.dharamshalaPaymentMode || '').trim().toLowerCase();
  return DHARAMSHALA_PAYMENT_MODES.has(mode) ? mode : 'pay_at_dharamshala';
};

const getDharamshalaResponseTimeoutMinutes = (hotel) => {
  const minutes = Number(hotel?.dharamshalaResponseTimeoutMinutes || 30);
  if (!Number.isFinite(minutes) || minutes <= 0) return 30;
  return Math.min(7 * 24 * 60, Math.floor(minutes));
};

const getDharamshalaRequestExpiresAt = (hotel, from = new Date()) =>
  new Date(from.getTime() + getDharamshalaResponseTimeoutMinutes(hotel) * 60 * 1000);

const roundMoney = (value) => Math.max(0, Math.round(Number(value || 0)));

const buildDharamshalaAccounting = ({ hotel, roomType, nights, roomQuantity }) => {
  const paymentMode = normalizePaymentMode(hotel);
  const dharamshalaAmount = roundMoney(Number(roomType?.pricePerNight || 0) * Math.max(1, nights) * Math.max(1, roomQuantity));
  const vrindavanSarthiServiceFee = paymentMode === 'request_only' ? 0 : roundMoney(hotel?.dharamshalaServiceFee);
  const amountPaidOnline = paymentMode === 'full_online'
    ? dharamshalaAmount + vrindavanSarthiServiceFee
    : vrindavanSarthiServiceFee;
  const amountPayableAtProperty = paymentMode === 'full_online' ? 0 : dharamshalaAmount;

  return {
    paymentMode,
    dharamshalaAmount,
    vrindavanSarthiServiceFee,
    amountPaidOnline,
    amountPayableAtProperty,
    totalAmount: dharamshalaAmount + vrindavanSarthiServiceFee,
    advanceAmount: amountPaidOnline,
    advance_paid: amountPaidOnline,
    balanceAmount: amountPayableAtProperty,
    balance_at_property: amountPayableAtProperty,
    customer_total: dharamshalaAmount + vrindavanSarthiServiceFee,
    checkoutSubtotal: dharamshalaAmount,
    baseAmount: dharamshalaAmount,
    base_amount: dharamshalaAmount,
  };
};

const createRequestIdempotencyKey = ({ req, hotel, roomType, checkIn, checkOut, roomQuantity, totalAdults, totalChildren }) => {
  const provided = String(req.get?.('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
  if (provided) return provided.slice(0, 200);
  return crypto
    .createHash('sha256')
    .update([
      'dharamshala-request',
      req.user?._id,
      hotel?._id,
      roomType?._id,
      checkIn?.toISOString?.() || checkIn,
      checkOut?.toISOString?.() || checkOut,
      roomQuantity,
      totalAdults,
      totalChildren,
    ].map((v) => String(v || '')).join('|'))
    .digest('hex');
};

const generateDharamshalaBookingCode = () => {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `VVS-DR-${ymd}-${crypto.randomInt(100000, 999999)}`;
};

const assertDharamshala = (booking) => {
  if (String(booking?.propertyType || '').toLowerCase() !== 'dharamshala') {
    const err = new Error('Not a Dharamshala booking');
    err.statusCode = 400;
    throw err;
  }
};

const getAvailableRoomContext = async ({ hotel, roomType, checkIn, checkOut }) => {
  const units = await RoomUnit.find({ roomTypeId: roomType._id, status: { $in: BOOKABLE_ROOM_STATUSES } }).sort({ number: 1 }).lean();
  const blockedByBlocks = await RoomUnitBlock.distinct('roomUnitId', {
    roomTypeId: roomType._id,
    startDate: { $lt: checkOut },
    endDate: { $gt: checkIn },
  });
  return {
    units,
    blockedSet: new Set(blockedByBlocks.map(String)),
    daysToReserve: enumerateDatesUTC(checkIn, checkOut),
    hotel,
    roomType,
  };
};

const countAvailableUnits = async ({ units, blockedSet, hotel, roomType, checkIn, checkOut, hasPet }) => {
  if (!units.length) return 0;
  const lockedUnitIds = await RoomUnitBookingDay.distinct('roomUnitId', {
    roomTypeId: roomType._id,
    date: { $gte: checkIn, $lt: checkOut },
  });
  const lockedSet = new Set(lockedUnitIds.map(String));
  return units.filter((unit) => {
    if (blockedSet.has(String(unit._id)) || lockedSet.has(String(unit._id))) return false;
    const effectivePetsAllowed =
      Boolean(hotel?.petsAllowed) &&
      (unit.petsAllowedOverride === null || typeof unit.petsAllowedOverride === 'undefined'
        ? Boolean(roomType?.petsAllowed)
        : Boolean(unit.petsAllowedOverride));
    return !hasPet || effectivePetsAllowed;
  }).length;
};

const createDharamshalaRequest = async ({
  req,
  hotel,
  roomType,
  checkIn,
  checkOut,
  roomQuantity,
  totalAdults,
  totalChildren,
  hasPet,
  guestDetails,
  customerFullName,
  customerMobile,
  customerEmail,
  acceptedTermsSnapshot,
}) => {
  const daysToReserve = enumerateDatesUTC(checkIn, checkOut);
  const idempotencyKey = createRequestIdempotencyKey({ req, hotel, roomType, checkIn, checkOut, roomQuantity, totalAdults, totalChildren });
  const existing = await Booking.findOne({ userId: req.user._id, idempotencyKey });
  if (existing) return { booking: existing, idempotent: true };

  const roomContext = await getAvailableRoomContext({ hotel, roomType, checkIn, checkOut });
  const availableUnits = await countAvailableUnits({ ...roomContext, checkIn, checkOut, hasPet });
  if (availableUnits < roomQuantity) {
    const err = new Error('No rooms available for selected dates');
    err.statusCode = 409;
    throw err;
  }

  const money = buildDharamshalaAccounting({ hotel, roomType, nights: daysToReserve.length, roomQuantity });
  const booking = await Booking.create({
    bookingId: generateDharamshalaBookingCode(),
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    propertyType: 'dharamshala',
    paymentMode: money.paymentMode,
    itemId: String(roomType._id),
    itemName: `${hotel.name} - ${roomType.name}`,
    itemImage: (roomType.images && roomType.images[0]) || hotel.image,
    userId: req.user._id,
    userName: req.user.name,
    userEmail: req.user.email,
    userPhone: req.user.phone,
    partnerId: hotel.partnerId,
    partnerName: hotel.partnerName,
    partnerPhone: hotel.partnerPhone,
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    checkIn,
    checkOut,
    guests: totalAdults + totalChildren,
    roomQuantity,
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
    ...money,
    taxPercent: 0,
    taxAmount: 0,
    hotel_gstin: hotel.hotelGstin || '',
    paymentMethod: 'online',
    paymentStatus: 'pending',
    paymentProvider: 'razorpay',
    bookingStatus: 'pending_property_confirmation',
    verificationStage: 'pending_partner',
    partnerPaymentVerified: false,
    adminPaymentVerified: false,
    requestExpiresAt: getDharamshalaRequestExpiresAt(hotel),
    idempotencyKey,
    bookingSource: 'web',
    additionalInfo: String(req.body?.additionalInfo || '').trim() || undefined,
    acceptedPropertyTerms: acceptedTermsSnapshot || undefined,
  });
  return { booking, idempotent: false };
};

const acceptDharamshalaRequest = async ({ booking, actor }) => {
  assertDharamshala(booking);
  if (booking.bookingStatus !== 'pending_property_confirmation') return { booking, idempotent: true };
  if (booking.requestExpiresAt && booking.requestExpiresAt <= new Date()) {
    return expireOneDharamshalaRequest({ booking, reason: 'property_response_timeout' });
  }

  const hotel = await require('../models/Hotel').findById(booking.hotelId).lean();
  const roomType = await require('../models/RoomType').findById(booking.roomTypeId).lean();
  if (!hotel || !roomType) {
    const err = new Error('Property or room type not found');
    err.statusCode = 404;
    throw err;
  }

  const roomContext = await getAvailableRoomContext({ hotel, roomType, checkIn: booking.checkIn, checkOut: booking.checkOut });
  const selectedUnits = await tryReserveRoomUnitsForBooking({
    booking,
    hotel,
    roomType,
    units: roomContext.units,
    daysToReserve: roomContext.daysToReserve,
    blockedSet: roomContext.blockedSet,
    hasPet: booking.hasPet,
    roomQuantity: booking.roomQuantity,
  });

  if (selectedUnits.length < Number(booking.roomQuantity || 1)) {
    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
    await transitionBookingStatus(booking, 'rejected_by_property', {
      actorId: actor?._id,
      actorRole: actor?.role || 'partner',
      reason: 'inventory_unavailable_at_acceptance',
    });
    booking.propertyRespondedAt = new Date();
    booking.propertyDecisionBy = actor?._id;
    booking.propertyDecisionRole = actor?.role || 'partner';
    booking.propertyDecisionReason = 'Inventory unavailable at acceptance';
    await booking.save();
    return { booking, idempotent: false };
  }

  booking.roomUnitIds = selectedUnits.map((unit) => unit._id);
  booking.roomNumbers = selectedUnits.map((unit) => unit.number);
  booking.roomUnitId = selectedUnits[0]._id;
  booking.roomNumber = selectedUnits[0].number;
  booking.propertyRespondedAt = new Date();
  booking.propertyDecisionBy = actor?._id;
  booking.propertyDecisionRole = actor?.role || 'partner';
  booking.propertyDecisionReason = 'accepted';

  if (Number(booking.amountPaidOnline || 0) > 0) {
    booking.paymentStatus = 'pending';
    booking.paymentHoldExpiresAt = getPaymentHoldExpiresAt();
    await transitionBookingStatus(booking, 'awaiting_customer_payment', {
      actorId: actor?._id,
      actorRole: actor?.role || 'partner',
      reason: 'dharamshala_request_accepted_payment_required',
    });
  } else {
    booking.paymentStatus = 'not_required';
    booking.verificationStage = 'verified';
    booking.partnerPaymentVerified = true;
    booking.adminPaymentVerified = true;
    await transitionBookingStatus(booking, 'confirmed', {
      actorId: actor?._id,
      actorRole: actor?.role || 'partner',
      reason: 'dharamshala_request_accepted_no_online_payment',
    });
  }
  await booking.save();
  return { booking, idempotent: false };
};

const rejectDharamshalaRequest = async ({ booking, actor, reason }) => {
  assertDharamshala(booking);
  if (booking.bookingStatus === 'rejected_by_property') return { booking, idempotent: true };
  if (booking.bookingStatus !== 'pending_property_confirmation') {
    const err = new Error('INVALID_BOOKING_STATE');
    err.statusCode = 409;
    throw err;
  }
  await transitionBookingStatus(booking, 'rejected_by_property', {
    actorId: actor?._id,
    actorRole: actor?.role || 'partner',
    reason: reason || 'property_rejected',
  });
  booking.propertyRespondedAt = new Date();
  booking.propertyDecisionBy = actor?._id;
  booking.propertyDecisionRole = actor?.role || 'partner';
  booking.propertyDecisionReason = reason || 'Rejected by property';
  await booking.save();
  await releaseBookingInventory(booking);
  return { booking, idempotent: false };
};

const expireOneDharamshalaRequest = async ({ booking, reason = 'property_response_timeout' }) => {
  if (booking.bookingStatus !== 'pending_property_confirmation') return { booking, idempotent: true };
  await transitionBookingStatus(booking, 'expired_property_no_response', {
    actorRole: 'system',
    reason,
  });
  booking.paymentStatus = 'expired';
  booking.verificationStage = 'rejected';
  booking.payout_status = 'cancelled';
  booking.propertyDecisionRole = 'system';
  booking.propertyDecisionReason = reason;
  booking.expiredAt = booking.expiredAt || new Date();
  await booking.save();
  await releaseBookingInventory(booking);
  return { booking, idempotent: false };
};

const expireDharamshalaRequests = async ({ now = new Date(), limit = 100 } = {}) => {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const bookings = await Booking.find({
    propertyType: 'dharamshala',
    bookingStatus: 'pending_property_confirmation',
    requestExpiresAt: { $lte: now },
  }).sort({ requestExpiresAt: 1, createdAt: 1 }).limit(safeLimit);

  let expired = 0;
  for (const booking of bookings) {
    try {
      const result = await expireOneDharamshalaRequest({ booking });
      if (!result.idempotent) expired += 1;
    } catch {
      // Safe to retry in the next durable queue sweep.
    }
  }
  return { scanned: bookings.length, expired };
};

module.exports = {
  buildDharamshalaAccounting,
  createDharamshalaRequest,
  acceptDharamshalaRequest,
  rejectDharamshalaRequest,
  expireDharamshalaRequests,
  getDharamshalaRequestExpiresAt,
  normalizePaymentMode,
};
