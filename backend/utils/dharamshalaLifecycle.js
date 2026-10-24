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
const { getPaymentOption } = require('./pricing');
const { createBookingQuote } = require('./rateEngine');
const { getNextBookingId } = require('./idAllocation');

const BOOKABLE_ROOM_STATUSES = ['active', 'available'];
const DEFAULT_DHARAMSHALA_PLATFORM_FEE = 79;

const normalizePaymentMode = () => 'pay_at_dharamshala';
const isDharamshalaProperty = (value) => String(value || '').trim().toLowerCase() === 'dharamshala';

// Confirmed business rules:
// - Dharamshala approval window is 5 minutes from server-side request creation timestamp.
// - Partner reminder is scheduled 2 minutes after request creation.
// - Customer payment window after acceptance is 15 minutes.
const DHARAMSHALA_RESPONSE_TIMEOUT_MINUTES = 5;
const DHARAMSHALA_REMINDER_MINUTES = 2;
const DHARAMSHALA_PAYMENT_HOLD_MINUTES = 15;

const getDharamshalaResponseTimeoutMinutes = (hotel) => {
  if (isDharamshalaProperty(hotel?.propertyType)) {
    return DHARAMSHALA_RESPONSE_TIMEOUT_MINUTES;
  }
  const minutes = Number(hotel?.dharamshalaResponseTimeoutMinutes || 30);
  if (!Number.isFinite(minutes) || minutes <= 0) return 30;
  return Math.min(7 * 24 * 60, Math.max(5, Math.floor(minutes)));
};

const getDharamshalaRequestExpiresAt = (hotel, from = new Date()) =>
  new Date(from.getTime() + getDharamshalaResponseTimeoutMinutes(hotel) * 60 * 1000);

const roundMoney = (value) => Math.max(0, Math.round(Number(value || 0)));

const getDharamshalaPlatformFee = (hotel) => {
  if (hotel?.dharamshalaPlatformFeeEnabled === false) return 0;
  const fee = Number(hotel?.dharamshalaServiceFee);
  return roundMoney(Number.isFinite(fee) ? fee : DEFAULT_DHARAMSHALA_PLATFORM_FEE);
};

const buildDharamshalaAccounting = ({ hotel, roomType, nights, roomQuantity, paymentMode = normalizePaymentMode() }) => {
  const dharamshalaAmount = roundMoney(Number(roomType?.pricePerNight || 0) * Math.max(1, nights) * Math.max(1, roomQuantity));
  const vrindavanSarthiServiceFee = getDharamshalaPlatformFee(hotel);
  const amountPaidOnline = paymentMode === 'full_online'
    ? vrindavanSarthiServiceFee + dharamshalaAmount
    : paymentMode === 'pay_at_dharamshala'
      ? vrindavanSarthiServiceFee
      : 0;
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

const createRequestIdempotencyKey = ({ req, customerUser, hotel, roomType, checkIn, checkOut, roomQuantity, totalAdults, totalChildren }) => {
  const provided = String(req.get?.('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
  if (provided) return provided.slice(0, 200);
  return crypto
    .createHash('sha256')
    .update([
      'dharamshala-request',
      customerUser?._id || req.user?._id,
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
  if (!isDharamshalaProperty(booking?.propertyType)) {
    const err = new Error('Not a Dharamshala booking');
    err.statusCode = 400;
    throw err;
  }
};

const assertPropertyRequestBooking = (booking) => {
  if (booking?.bookingType !== 'room_type' || !booking?.hotelId || !booking?.roomTypeId) {
    const err = new Error('Not a property room booking request');
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
  customerUser,
  isGuestBooking = false,
  guestAccessTokenHash = '',
}) => {
  const daysToReserve = enumerateDatesUTC(checkIn, checkOut);
  const user = customerUser || req.user;
  const idempotencyKey = createRequestIdempotencyKey({ req, customerUser: user, hotel, roomType, checkIn, checkOut, roomQuantity, totalAdults, totalChildren });
  const existing = await Booking.findOne({ userId: user._id, idempotencyKey });
  if (existing) return { booking: existing, idempotent: true };

  const roomContext = await getAvailableRoomContext({ hotel, roomType, checkIn, checkOut });
  const availableUnits = await countAvailableUnits({ ...roomContext, checkIn, checkOut, hasPet });
  if (availableUnits < roomQuantity) {
    const err = new Error('No rooms available for selected dates');
    err.statusCode = 409;
    throw err;
  }

  const isDharamshala = isDharamshalaProperty(hotel?.propertyType);
  let money;
  let ratePlan = null;
  let quote = null;
  let paymentOption = 'full_100';
  if (isDharamshala) {
    money = buildDharamshalaAccounting({ hotel, roomType, nights: daysToReserve.length, roomQuantity });
  } else {
    paymentOption = getPaymentOption(req.body?.paymentOption, ['advance_30', 'full_100']) || 'advance_30';
    const quoteResult = await createBookingQuote({
      hotelId: hotel._id,
      roomTypeId: roomType._id,
      ratePlanId: req.body?.ratePlanId,
      checkIn,
      checkOut,
    checkInTime: hotel?.checkInTime || '12:00',

      roomQuantity,
      adults: totalAdults,
      children: totalChildren,
      hasPet,
      paymentOption,
      checkInventory: false,
    });
    money = quoteResult.money;
    ratePlan = quoteResult.ratePlan;
    quote = quoteResult.quote;
  }

  const displayBookingId = await getNextBookingId();
  const propertyId = hotel.propertyId || undefined;
  const categoryId = roomType.categoryId || undefined;

  const booking = await Booking.create({
    bookingId: generateDharamshalaBookingCode(),
    displayBookingId,
    propertyId,
    categoryId,
    bookingType: 'room_type',
    service_billing_model: isDharamshala ? 'dharamshala_booking' : 'hotel_marketplace',
    propertyType: hotel.propertyType || 'hotel',
    paymentMode: isDharamshala ? money.paymentMode : null,
    paymentOption,
    itemId: String(roomType._id),
    itemName: `${hotel.name} - ${roomType.name}`,
    itemImage: (roomType.images && roomType.images[0]) || hotel.image,
    userId: user._id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone,
    isGuestBooking,
    guestAccessTokenHash: guestAccessTokenHash || undefined,
    partnerId: hotel.partnerId,
    partnerName: hotel.partnerName,
    partnerPhone: hotel.partnerPhone,
    partnerEmail: hotel.partnerEmail || '',
    partnerWhatsapp: hotel.partnerWhatsapp || hotel.partnerPhone || '',
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    ratePlanId: ratePlan?._id,
    ratePlanName: ratePlan?.name,
    ratePlanCode: ratePlan?.code,
    ratePlanMealPlan: ratePlan?.mealPlan,
    nightlyBreakdown: quote?.nightlyBreakdown || [],
    checkIn,
    checkOut,
    checkInTime: hotel?.checkInTime || '12:00',

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
    taxPercent: isDharamshala ? 0 : money.taxPercent,
    taxAmount: isDharamshala ? 0 : money.taxAmount,
    hotel_gstin: hotel.hotelGstin || '',
    paymentMethod: 'online',
    paymentStatus: 'pending',
    paymentProvider: 'razorpay',
    bookingStatus: 'pending_property_confirmation',
    verificationStage: 'pending_partner',
    partnerPaymentVerified: false,
    adminPaymentVerified: false,
    requestExpiresAt: getDharamshalaRequestExpiresAt(hotel),
    requestReminderAt: new Date(Date.now() + DHARAMSHALA_REMINDER_MINUTES * 60 * 1000),
    requestReminderSent: false,
    idempotencyKey,
    bookingSource: isGuestBooking ? 'guest_web' : 'web',
    additionalInfo: String(req.body?.additionalInfo || '').trim() || undefined,
    acceptedPropertyTerms: acceptedTermsSnapshot || undefined,
  });
  return { booking, idempotent: false };
};

const acceptDharamshalaRequest = async ({ booking, actor }) => {
  assertPropertyRequestBooking(booking);
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
  if (isDharamshalaProperty(booking.propertyType)) {
    const requestedMode = String(actor?.paymentMode || actor?.propertyPaymentChoice || '').trim();
    const paymentMode = requestedMode === 'full_online' ? 'full_online' : 'pay_at_dharamshala';
    const accounting = buildDharamshalaAccounting({
      hotel,
      roomType,
      nights: roomContext.daysToReserve.length,
      roomQuantity: booking.roomQuantity,
      paymentMode,
    });

    booking.paymentMode = paymentMode;
    booking.propertyPaymentChoice = paymentMode;
    booking.vrindavanSarthiServiceFee = accounting.vrindavanSarthiServiceFee;
    booking.amountPaidOnline = accounting.amountPaidOnline;
    booking.amountPayableAtProperty = accounting.amountPayableAtProperty;
    booking.advanceAmount = accounting.advanceAmount;
    booking.advance_paid = accounting.advance_paid;
    booking.balanceAmount = accounting.balanceAmount;
    booking.balance_at_property = accounting.balance_at_property;
    booking.totalAmount = accounting.totalAmount;
    booking.customer_total = booking.totalAmount;
    booking.dharamshalaAmount = accounting.dharamshalaAmount;
    booking.checkoutSubtotal = accounting.checkoutSubtotal;
    booking.baseAmount = accounting.baseAmount;
    booking.base_amount = accounting.base_amount;

    if (accounting.amountPaidOnline > 0) {
      booking.paymentStatus = 'pending';
      booking.paymentHoldExpiresAt = getPaymentHoldExpiresAt(new Date(), DHARAMSHALA_PAYMENT_HOLD_MINUTES);
      await transitionBookingStatus(booking, 'awaiting_customer_payment', {
        actorId: actor?._id,
        actorRole: actor?.role || 'partner',
        reason: paymentMode === 'full_online'
          ? 'dharamshala_request_accepted_full_online_payment_required'
          : 'dharamshala_request_accepted_platform_fee_required',
      });
    } else {
      booking.paymentStatus = 'not_required';
      booking.paymentHoldExpiresAt = undefined;
      await transitionBookingStatus(booking, 'confirmed', {
        actorId: actor?._id,
        actorRole: actor?.role || 'partner',
        reason: 'dharamshala_request_accepted_no_online_payment_required',
      });
    }
  } else {
    const paymentOption = getPaymentOption(booking.paymentOption, ['advance_30', 'full_100']) || 'advance_30';
    const quoteResult = await createBookingQuote({
      hotelId: hotel._id,
      roomTypeId: roomType._id,
      ratePlanId: booking.ratePlanId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomQuantity: booking.roomQuantity,
      adults: booking.totalAdults,
      children: booking.totalChildren,
      hasPet: booking.hasPet,
      paymentOption,
      checkInventory: false,
    });
    const accounting = quoteResult.money;
    const ratePlan = quoteResult.ratePlan;
    const quote = quoteResult.quote;
    booking.paymentOption = paymentOption;
    booking.ratePlanId = ratePlan?._id;
    booking.ratePlanName = ratePlan?.name;
    booking.ratePlanCode = ratePlan?.code;
    booking.ratePlanMealPlan = ratePlan?.mealPlan;
    booking.nightlyBreakdown = quote?.nightlyBreakdown || [];
    booking.baseAmount = accounting.baseAmount;
    booking.base_amount = accounting.baseAmount;
    booking.taxPercent = accounting.taxPercent;
    booking.taxAmount = accounting.taxAmount;
    booking.hotel_gst_amount = accounting.taxAmount;
    Object.assign(booking, accounting);
    booking.paymentStatus = 'pending';
    booking.paymentHoldExpiresAt = getPaymentHoldExpiresAt(new Date(), DHARAMSHALA_PAYMENT_HOLD_MINUTES);
    await transitionBookingStatus(booking, 'awaiting_customer_payment', {
      actorId: actor?._id,
      actorRole: actor?.role || 'partner',
      reason: 'property_request_accepted_customer_payment_required',
    });
  }
  await booking.save();
  return { booking, idempotent: false };
};

const rejectDharamshalaRequest = async ({ booking, actor, reason }) => {
  assertPropertyRequestBooking(booking);
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

const processDharamshalaReminders = async ({ now = new Date(), limit = 100 } = {}) => {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const candidates = await Booking.find({
    propertyType: 'dharamshala',
    bookingStatus: 'pending_property_confirmation',
    requestReminderAt: { $lte: now },
    requestReminderSent: { $ne: true },
  }).sort({ requestReminderAt: 1, createdAt: 1 }).limit(safeLimit);

  let remindersSent = 0;
  for (const candidate of candidates) {
    try {
      const claimed = await Booking.findOneAndUpdate(
        {
          _id: candidate._id,
          bookingStatus: 'pending_property_confirmation',
          requestReminderSent: { $ne: true },
        },
        {
          $set: {
            requestReminderSent: true,
            requestReminderSentAt: now,
          },
        },
        { new: true }
      );
      if (!claimed) continue;

      try {
        const { ensureDharamshalaReminderNotifications } = require('./notificationDelivery');
        await ensureDharamshalaReminderNotifications(claimed);
      } catch (err) {
        console.warn('[dharamshala.reminder.notification_failed]', err?.message || err);
      }
      remindersSent += 1;
    } catch {
      // Safe to retry in next sweep if not claimed
    }
  }
  return { scanned: candidates.length, remindersSent };
};

module.exports = {
  buildDharamshalaAccounting,
  createDharamshalaRequest,
  acceptDharamshalaRequest,
  rejectDharamshalaRequest,
  expireDharamshalaRequests,
  processDharamshalaReminders,
  getDharamshalaRequestExpiresAt,
  getDharamshalaResponseTimeoutMinutes,
  DHARAMSHALA_RESPONSE_TIMEOUT_MINUTES,
  DHARAMSHALA_REMINDER_MINUTES,
  DHARAMSHALA_PAYMENT_HOLD_MINUTES,
  normalizePaymentMode,
  getDharamshalaPlatformFee,
};
