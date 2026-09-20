const express = require('express');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const Cab = require('../models/Cab');
const CabFare = require('../models/CabFare');
const Tour = require('../models/Tour');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC } = require('../utils/date');
const {
  assertValidBookingTransition,
  transitionBookingStatus,
  getPaymentHoldExpiresAt,
  releaseBookingInventory,
  markBookingPaymentPaid,
  markBookingPaymentFailed,
  expirePendingBookings,
  tryReserveRoomUnitsForBooking,
} = require('../utils/reservationLifecycle');
const {
  LEGACY_GENERIC_BOOKING_TYPES,
  normalizeBookingType,
  isLodgingBookingType,
  rejectInvalidObjectId,
  pickAllowed,
} = require('../utils/security');
const { sendSms } = require('../utils/sms');
const {
  ensureBookingCancellationNotification,
  ensureBookingCreatedNotifications,
  ensureBookingInvoiceNotification,
} = require('../utils/notificationDelivery');
const {
  getPaymentOption,
  buildMoneyFields,
} = require('../utils/pricing');
const { createBookingQuote } = require('../utils/rateEngine');
const {
  createDharamshalaRequest,
  acceptDharamshalaRequest,
  rejectDharamshalaRequest,
} = require('../utils/dharamshalaLifecycle');
const {
  buildModificationPreview,
  createModification,
  verifyModificationPayment,
  executeBookingRefund,
} = require('../utils/bookingModification');
const router = express.Router();

const BOOKABLE_ROOM_STATUSES = ['active', 'available'];
const propertyTermsSectionKeys = [
  'generalTerms',
  'checkInRequirements',
  'checkOutRules',
  'cancellationPolicy',
  'guestPolicies',
  'idVerificationRequirements',
  'ageRestrictions',
  'propertyRules',
  'additionalInstructions',
];

const normalizeTermsSections = (sections = {}) => {
  const normalized = {};
  for (const key of propertyTermsSectionKeys) normalized[key] = String(sections?.[key] || '').trim();
  return normalized;
};

const hasAnyTermsText = (sections = {}) => propertyTermsSectionKeys.some((key) => String(sections?.[key] || '').trim());

const getActivePropertyTermsSnapshot = (hotel, userId) => {
  const terms = hotel?.propertyTerms || {};
  const sections = normalizeTermsSections(terms.sections || {});
  const version = Number(terms.currentVersion || 0);
  if (!terms.isActive || !version || !hasAnyTermsText(sections)) return null;
  return {
    accepted: true,
    propertyId: hotel._id,
    customerId: userId,
    version,
    acceptedAt: new Date(),
    sections,
  };
};

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

const getBillingModelForBookingType = (bookingType) => {
  if (bookingType === 'cab') return 'taxi_direct';
  if (bookingType === 'tour') return 'tour_direct';
  if (bookingType === 'hotel' || bookingType === 'room' || bookingType === 'room_type') return 'hotel_marketplace';
  return 'hotel_marketplace';
};

const findBookingHotel = async (bookingType, body) => {
  const hotelId = String(body?.hotelId || '').trim();
  const roomTypeId = String(body?.roomTypeId || '').trim();
  const itemId = String(body?.itemId || '').trim();

  if (hotelId) return Hotel.findById(hotelId).select('propertyType partnerId partnerName partnerPhone platform_commission_percentage').lean();
  if (bookingType === 'hotel' && itemId) return Hotel.findById(itemId).select('propertyType partnerId partnerName partnerPhone platform_commission_percentage').lean();
  if ((bookingType === 'room_type' || bookingType === 'room') && (roomTypeId || itemId)) {
    const roomType = await RoomType.findById(roomTypeId || itemId).select('hotelId').lean();
    if (roomType?.hotelId) return Hotel.findById(roomType.hotelId).select('propertyType partnerId partnerName partnerPhone platform_commission_percentage').lean();
  }
  return null;
};

const normalize = (v) => String(v || '').trim();
const normalizeLocationKey = (v) => normalize(v).replace(/\s+/g, ' ');
const comparableKey = (v) => normalizeLocationKey(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const vehicleKey = (v) => comparableKey(v).replace(/\b(seater|seat|seats|cab|car|taxi|vehicle)\b/g, '').replace(/\s+/g, ' ').trim();

const calcCabFare = ({ baseFare }) => {
  const base = Number(baseFare || 0);
  return { base, included: 0, extraCharge: 0, pax: 0, extraPersons: 0, extra: 0, total: Math.max(0, base) };
};

const findCabFareRule = async ({ pickupLocation, dropLocation, cabType }) => {
  const exact = await CabFare.findOne({ pickupLocation, dropLocation, cabType, status: 'active' }).lean();
  if (exact) return exact;
  const pickupKey = comparableKey(pickupLocation);
  const dropKey = comparableKey(dropLocation);
  const cabKey = vehicleKey(cabType);
  const fares = await CabFare.find({ status: 'active' }).lean();
  return fares.find((fare) => {
    const fareCabKey = vehicleKey(fare.cabType);
    return comparableKey(fare.pickupLocation) === pickupKey &&
      comparableKey(fare.dropLocation) === dropKey &&
      (fareCabKey === cabKey || fareCabKey.includes(cabKey) || cabKey.includes(fareCabKey));
  }) || null;
};

const cancellationMoney = (totalAmount) => {
  const total = Math.max(0, Math.round(Number(totalAmount || 0)));
  const cancellationDeductionPercent = 12;
  const cancellationDeductionAmount = Math.round((total * cancellationDeductionPercent) / 100);
  return {
    cancellationDeductionPercent,
    cancellationDeductionAmount,
    refundableAmount: Math.max(0, total - cancellationDeductionAmount),
  };
};

const enqueueBookingNotifications = async (booking, { invoice = false, partnerAlert = true } = {}) => {
  if (invoice) {
    await ensureBookingInvoiceNotification(booking);
  }
  await ensureBookingCreatedNotifications(booking, { partnerAlert });
};

const bookingDetailFields = [
  'bookingId bookingType itemId itemName itemImage userId userName userEmail userPhone partnerId partnerName partnerPhone',
  'service_billing_model propertyType paymentMode dharamshalaAmount vrindavanSarthiServiceFee amountPaidOnline amountPayableAtProperty amountPaidToProperty requestExpiresAt propertyRespondedAt propertyDecisionRole propertyDecisionReason',
  'hotelId roomTypeId ratePlanId ratePlanName ratePlanCode ratePlanMealPlan nightlyBreakdown roomUnitId roomUnitIds roomNumber roomNumbers roomQuantity checkIn checkOut guests',
  'pickupLocation dropLocation pickupDate pickupTime cabType cabFareTotal tollOption',
  'assignedVehicleName assignedVehicleType assignedDriverName assignedDriverPhone assignedDriverEmail',
  'customerFullName customerMobile customerEmail arrivalMode vehicleNumber arrivalTime',
  'totalAdults totalChildren hasPet guestDetails',
  'baseAmount taxPercent taxAmount checkoutSubtotal convenienceFeePercent convenienceFeeAmount totalAmount advanceAmount balanceAmount advancePercent paymentOption',
  'base_amount hotel_gst_amount convenience_fee customer_total advance_paid balance_at_property commission_rate commission_amount payment_gateway_fee gross_for_hotel hotel_net_payout payout_status hotel_gstin hotel_invoice_number',
  'platformCommissionPercent platformCommissionAmount grossForHotel paymentGatewayFeeAmount partnerNetPayout',
  'paymentMethod paymentStatus bookingStatus verificationStage partnerPaymentVerified adminPaymentVerified upiTransactionId paymentProvider razorpayOrderId razorpayPaymentId razorpayStatus paidAt additionalInfo',
  'paymentHoldExpiresAt confirmedAt checkedInAt checkedOutAt checkedInByPartnerId checkedInByPartnerName guestDigitalSignature paymentFailedAt expiredAt inventoryReleasedAt statusHistory',
  'acceptedPropertyTerms',
  'isWaitlisted waitlistAssignedAt cancellationRequested cancellationReason cancellationRequestedAt cancellationReviewedByAdmin cancelledByRole cancelledByName cancelledAt cancellationDetails cancellationDeductionPercent cancellationDeductionAmount refundableAmount refundId refundAmount refundStatus refundRequestedAt refundProcessedAt refundFailureReason refundReconciliationState createdAt',
].join(' ');

router.param('id', (req, res, next, id) => {
  if (rejectInvalidObjectId(res, id, 'booking id')) return;
  next();
});

const sanitizeCustomerBooking = (booking) => {
  if (!booking) return booking;
  const plain = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking };
  if (plain.bookingStatus !== 'confirmed') plain.partnerPhone = '';
  delete plain.roomUnitId;
  delete plain.roomUnitIds;
  delete plain.roomNumber;
  delete plain.roomNumbers;
  delete plain.platformCommissionPercent;
  delete plain.platformCommissionAmount;
  delete plain.commission_rate;
  delete plain.commission_amount;
  delete plain.grossForHotel;
  delete plain.gross_for_hotel;
  delete plain.paymentGatewayFeeAmount;
  delete plain.payment_gateway_fee;
  delete plain.partnerNetPayout;
  delete plain.hotel_net_payout;
  return plain;
};

// Create cab booking (authenticated user)
// Body: { fullName, mobileNumber, pickupLocation, dropLocation, pickupDate, pickupTime, passengers, cabType, tollOption, upiTransactionId }
router.post('/cab', protect, async (req, res) => {
  try {
    const fullName = normalize(req.body?.fullName) || normalize(req.body?.customerFullName) || normalize(req.user?.name);
    const mobileNumber = normalize(req.body?.mobileNumber) || normalize(req.body?.customerMobile) || normalize(req.user?.phone);
    let pickupLocation = normalizeLocationKey(req.body?.pickupLocation);
    let dropLocation = normalizeLocationKey(req.body?.dropLocation);
    const pickupDate = normalize(req.body?.pickupDate);
    const pickupTime = normalize(req.body?.pickupTime);
    let cabType = normalize(req.body?.cabType);
    const cabFareRuleId = normalize(req.body?.cabFareRuleId);
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
    if (!upiTransactionId) return res.status(400).json({ success: false, message: 'UPI transaction ID is required for the 30% advance payment' });
    if (cabFareRuleId && rejectInvalidObjectId(res, cabFareRuleId, 'cabFareRuleId')) return;

    let rule = cabFareRuleId ? await CabFare.findOne({ _id: cabFareRuleId, status: 'active' }).lean() : null;
    if (rule) {
      pickupLocation = rule.pickupLocation;
      dropLocation = rule.dropLocation;
      cabType = rule.cabType;
    } else {
      rule = await findCabFareRule({ pickupLocation, dropLocation, cabType });
    }
    if (!rule) return res.status(404).json({ success: false, message: 'Fare not set for this route/vehicle' });

    const breakdown = calcCabFare(rule);
    const paymentOption = getPaymentOption(req.body?.paymentOption || 'advance_30', ['advance_30']);
    if (!paymentOption) return res.status(400).json({ success: false, message: 'Cab bookings only support 30% advance online payment' });
    const money = buildMoneyFields({ subtotal: breakdown.total, baseAmount: breakdown.total, taxAmount: 0, paymentOption, gatewayFeeAmount: req.body?.paymentGatewayFeeAmount });
    const bookingId = generateBookingCode();

    const booking = await Booking.create({
      bookingId,
      bookingType: 'cab',
      service_billing_model: 'taxi_direct',
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
      ...(tollOption ? { tollOption } : {}),

      baseAmount: breakdown.total,
      taxPercent: 0,
      taxAmount: 0,
      ...money,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      bookingStatus: 'pending',
      paymentHoldExpiresAt: getPaymentHoldExpiresAt(),
      verificationStage: 'pending_admin',
      upiTransactionId,
      additionalInfo: `30% advance submitted by UPI. Balance INR ${money.balanceAmount.toLocaleString('en-IN')} payable later.`,
    });

    await enqueueBookingNotifications(booking, { partnerAlert: true });
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Booking update failed' });
  }
});

// Create booking for a room type (authenticated user)
// Body: { hotelId, roomTypeId, checkIn, checkOut, customerFullName, customerMobile, customerEmail, arrivalMode, vehicleNumber, arrivalTime, totalAdults, totalChildren, hasPet, guestDetails[], paymentMethod, totalAmount, upiTransactionId? }
router.post('/room-type', protect, async (req, res) => {
  try {
    const hotelId = String(req.body?.hotelId || '').trim();
    const roomTypeId = String(req.body?.roomTypeId || '').trim();
    if (!hotelId || !roomTypeId) return res.status(400).json({ success: false, message: 'hotelId and roomTypeId are required' });
    if (rejectInvalidObjectId(res, hotelId, 'hotelId')) return;
    if (rejectInvalidObjectId(res, roomTypeId, 'roomTypeId')) return;

    const hotel = await Hotel.findById(hotelId).lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    const acceptedTermsSnapshot = getActivePropertyTermsSnapshot(hotel, req.user._id);
    if (acceptedTermsSnapshot) {
      const accepted = Boolean(req.body?.propertyTermsAccepted);
      const acceptedVersion = Number(req.body?.acceptedPropertyTermsVersion || 0);
      if (!accepted || acceptedVersion !== acceptedTermsSnapshot.version) {
        return res.status(400).json({
          success: false,
          message: 'Please read and accept this property terms and policies before booking.',
        });
      }
    }

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
    const roomQuantity = Math.min(20, Math.max(1, Math.floor(Number(req.body?.roomQuantity || 1))));
    if (!Number.isFinite(totalAdults) || totalAdults < 1) return res.status(400).json({ success: false, message: 'At least 1 adult is required' });
    if (!Number.isFinite(totalChildren) || totalChildren < 0) return res.status(400).json({ success: false, message: 'Invalid totalChildren' });

    const maxAdultsForBooking = Math.max(1, Number(roomType.maxAdults || 1)) * roomQuantity;
    const maxChildrenForBooking = Math.max(0, Number(roomType.maxChildren || 0)) * roomQuantity;
    if (totalAdults > maxAdultsForBooking) return res.status(400).json({ success: false, message: `Max adults for ${roomQuantity} room(s) is ${maxAdultsForBooking}` });
    if (totalChildren > maxChildrenForBooking) return res.status(400).json({ success: false, message: `Max children for ${roomQuantity} room(s) is ${maxChildrenForBooking}` });

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

    const isDharamshala = String(hotel.propertyType || '').trim().toLowerCase() === 'dharamshala';
    if (isDharamshala) {
      const result = await createDharamshalaRequest({
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
      });
      try {
        await enqueueBookingNotifications(result.booking, { partnerAlert: !result.idempotent });
      } catch (notifyErr) {
        console.warn('[dharamshala.request.notification_failed]', notifyErr?.message || notifyErr);
      }
      return res.status(result.idempotent ? 200 : 201).json({
        success: true,
        data: sanitizeCustomerBooking(result.booking),
        idempotent: result.idempotent,
        message: 'Dharamshala request submitted. The property will confirm availability before any online payment.',
      });
    }

    // Server-side quote calculation (date rates + existing GST/fee formulas).
    const paymentOption = isDharamshala ? 'full_100' : getPaymentOption(req.body?.paymentOption, ['advance_30', 'full_100']);
    if (!paymentOption) return res.status(400).json({ success: false, message: 'Please select 30% advance or 100% full online payment' });
    if (isDharamshala && req.body?.paymentOption && String(req.body.paymentOption).trim() !== 'full_100') {
      return res.status(400).json({ success: false, message: 'Dharamshala bookings require 100% full online payment' });
    }
    const paymentProvider = String(req.body?.paymentProvider || '').trim().toLowerCase() === 'razorpay' ? 'razorpay' : 'manual_upi';
    const upiTransactionId = String(req.body?.upiTransactionId || '').trim();
    if (paymentProvider !== 'razorpay' && !upiTransactionId) {
      return res.status(400).json({ success: false, message: 'UPI transaction ID is required for online payment' });
    }

    const quoteResult = await createBookingQuote({
      hotelId: hotel._id,
      roomTypeId: roomType._id,
      ratePlanId: req.body?.ratePlanId,
      checkIn,
      checkOut,
      roomQuantity,
      adults: totalAdults,
      children: totalChildren,
      hasPet,
      paymentOption,
      checkInventory: false,
    });
    const money = quoteResult.money;
    const ratePlan = quoteResult.ratePlan;
    const quote = quoteResult.quote;
    const { baseAmount, taxPercent, taxAmount } = money;

    const units = await RoomUnit.find({ roomTypeId: roomType._id, status: { $in: BOOKABLE_ROOM_STATUSES } }).sort({ number: 1 }).lean();
    if (!units.length) return res.status(409).json({ success: false, message: 'No rooms available for selected dates' });
    if (roomQuantity > units.length) {
      return res.status(400).json({
        success: false,
        message: `Only ${units.length} room(s) are listed under this room type.`,
      });
    }

    const blockedByBlocks = await RoomUnitBlock.distinct('roomUnitId', {
      roomTypeId: roomType._id,
      startDate: { $lt: checkOut },
      endDate: { $gt: checkIn },
    });
    const blockedSet = new Set(blockedByBlocks.map(String));

    const bookingId = generateBookingCode();
    const booking = new Booking({
      bookingId,
      bookingType: 'room_type',
      service_billing_model: 'hotel_marketplace',
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
      ratePlanId: ratePlan._id,
      ratePlanName: ratePlan.name,
      ratePlanCode: ratePlan.code,
      ratePlanMealPlan: ratePlan.mealPlan,
      nightlyBreakdown: quote.nightlyBreakdown,

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

      baseAmount,
      taxPercent,
      taxAmount,
      hotel_gstin: hotel.hotelGstin || '',
      ...money,
      paymentMethod: 'online',
      bookingStatus: 'pending',
      paymentStatus: 'pending',
      paymentHoldExpiresAt: getPaymentHoldExpiresAt(),
      verificationStage: hotel.partnerId ? 'pending_partner' : 'pending_admin',
      partnerPaymentVerified: false,
      adminPaymentVerified: false,
      upiTransactionId,
      paymentProvider,
      additionalInfo: String(req.body?.additionalInfo || '').trim() || undefined,
      acceptedPropertyTerms: acceptedTermsSnapshot || undefined,
    });

    const selectedUnits = await tryReserveRoomUnitsForBooking({
      booking,
      hotel,
      roomType,
      units,
      daysToReserve,
      blockedSet,
      hasPet,
      roomQuantity,
    });

    if (selectedUnits.length >= roomQuantity) {
      booking.roomUnitIds = selectedUnits.map((unit) => unit._id);
      booking.roomNumbers = selectedUnits.map((unit) => unit.number);
      booking.roomUnitId = selectedUnits[0]._id;
      booking.roomNumber = selectedUnits[0].number;
      try {
        await booking.save();
      } catch (err) {
        await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
        throw err;
      }

      await enqueueBookingNotifications(booking, { partnerAlert: true });
      return res.status(201).json({ success: true, data: sanitizeCustomerBooking(booking) });
    }

    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });

    if (selectedUnits.length < roomQuantity) {
      const waitlistedBooking = await Booking.create({
        bookingId,
        bookingType: 'room_type',
        service_billing_model: 'hotel_marketplace',
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
        roomQuantity,

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

        baseAmount,
        taxPercent,
        taxAmount,
        hotel_gstin: hotel.hotelGstin || '',
        ...money,
        paymentMethod: 'online',
        bookingStatus: 'pending',
        paymentStatus: 'pending',
        paymentHoldExpiresAt: getPaymentHoldExpiresAt(),
        verificationStage: hotel.partnerId ? 'pending_partner' : 'pending_admin',
        partnerPaymentVerified: false,
        adminPaymentVerified: false,
        upiTransactionId,
        paymentProvider,
        additionalInfo: String(req.body?.additionalInfo || '').trim() || undefined,
        acceptedPropertyTerms: acceptedTermsSnapshot || undefined,
        isWaitlisted: true,
      });

      await enqueueBookingNotifications(waitlistedBooking, { partnerAlert: true });
      return res.status(201).json({
        success: true,
        data: sanitizeCustomerBooking(waitlistedBooking),
        message: `Only ${selectedUnits.length} room(s) are available for selected dates. Added to waitlist; we will auto-assign rooms if slots open.`,
      });
    }
  } catch (err) {
    const isDharamshalaRequest = String(req.body?.propertyType || '').toLowerCase() === 'dharamshala' ||
      Boolean(req.body?.hotelId && req.body?.roomTypeId);
    console.error('[booking.room_type.create_failed]', err?.message || err);
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode
        ? err.message
        : isDharamshalaRequest
          ? (err.message || 'Booking request failed')
          : 'Payment verification failed',
    });
  }
});

// Create booking (authenticated user)
router.post('/', protect, async (req, res) => {
  try {
    const bookingType = normalizeBookingType(req.body?.bookingType);
    if (!bookingType) return res.status(400).json({ success: false, message: 'bookingType is required' });

    if (isLodgingBookingType(bookingType)) {
      return res.status(409).json({
        success: false,
        message: 'Lodging bookings must use the room-type reservation flow so physical-room inventory is locked.',
      });
    }

    if (bookingType === 'cab') {
      return res.status(409).json({
        success: false,
        message: 'Cab bookings must use the cab booking flow.',
      });
    }

    if (!LEGACY_GENERIC_BOOKING_TYPES.has(bookingType)) {
      return res.status(400).json({ success: false, message: 'Unsupported booking type' });
    }

    const itemId = normalize(req.body?.itemId);
    if (!itemId) return res.status(400).json({ success: false, message: 'itemId is required' });
    if (rejectInvalidObjectId(res, itemId, 'itemId')) return;

    const tour = await Tour.findOne({ _id: itemId, status: 'active', approvalStatus: 'approved' }).lean();
    if (!tour) return res.status(404).json({ success: false, message: 'Tour not found' });

    let paymentOption = getPaymentOption(req.body?.paymentOption || 'full_100', ['advance_30', 'full_100']);
    if (!paymentOption) return res.status(400).json({ success: false, message: 'Invalid payment option' });

    const guests = Math.max(1, Math.min(50, Math.floor(Number(req.body?.guests || req.body?.persons || 1))));
    const baseAmount = Math.max(0, Math.round(Number(tour.pricePerPerson || 0) * guests));
    if (!baseAmount) return res.status(400).json({ success: false, message: 'Tour price is not available' });
    const money = buildMoneyFields({ subtotal: baseAmount, baseAmount, taxAmount: 0, paymentOption, commissionPercent: 0, gatewayFeeAmount: 0 });

    const payload = {
      ...pickAllowed(req.body, [
        'customerFullName',
        'customerMobile',
        'customerEmail',
        'additionalInfo',
        'upiTransactionId',
        'paymentProvider',
      ]),
      bookingType,
      itemId: String(tour._id),
      itemName: tour.name,
      itemImage: tour.image || tour.images?.[0] || '/placeholder.svg',
      ...money,
      baseAmount,
      taxAmount: 0,
      service_billing_model: getBillingModelForBookingType(bookingType),
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone,
      paymentMethod: 'online',
      bookingStatus: 'pending',
      paymentStatus: 'pending',
      paymentHoldExpiresAt: getPaymentHoldExpiresAt(),
      verificationStage: 'pending_admin',
      partnerId: tour.partnerId || undefined,
      partnerName: tour.partnerName || undefined,
      partnerPhone: tour.partnerPhone || undefined,
      partnerPaymentVerified: false,
      adminPaymentVerified: false,
      checkIn: parseDateOnlyToUTC(String(req.body?.checkIn || req.body?.travelDate || '')) || undefined,
      guests,
    };

    const booking = await Booking.create(payload);
    await enqueueBookingNotifications(booking, { partnerAlert: true });
    res.status(201).json({ success: true, data: sanitizeCustomerBooking(booking) });
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
        withImages ? bookingDetailFields : bookingDetailFields.replace('itemImage ', '')
      )
      .lean();

    if (!withImages) {
      for (const b of bookings) b.itemImage = '/placeholder.svg';
    } else {
      for (const b of bookings) b.itemImage = stripLargeInlineImage(b.itemImage) || '/placeholder.svg';
    }
    // Redact customer-hidden operational details. Admin/partner APIs keep full data.
    for (let i = 0; i < bookings.length; i += 1) {
      bookings[i] = sanitizeCustomerBooking(bookings[i]);
      const b = bookings[i];
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
        withImages ? bookingDetailFields : bookingDetailFields.replace('itemImage ', '')
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
        withImages ? bookingDetailFields : bookingDetailFields.replace('itemImage ', '')
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

const findDharamshalaBookingForDecision = async (req) => {
  const query = req.user.role === 'admin'
    ? { _id: req.params.id, propertyType: 'dharamshala' }
    : { _id: req.params.id, propertyType: 'dharamshala', partnerId: req.user._id };
  return Booking.findOne(query);
};

router.put('/:id/dharamshala/accept', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const booking = await findDharamshalaBookingForDecision(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Dharamshala request not found' });
    const result = await acceptDharamshalaRequest({ booking, actor: req.user });
    res.json({
      success: true,
      data: req.user.role === 'user' ? sanitizeCustomerBooking(result.booking) : result.booking,
      idempotent: result.idempotent,
      message: result.booking.bookingStatus === 'awaiting_customer_payment'
        ? 'Request accepted. Customer can now complete the online payment.'
        : 'Request accepted and confirmed.',
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Dharamshala request acceptance failed' });
  }
});

router.put('/:id/dharamshala/reject', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const booking = await findDharamshalaBookingForDecision(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Dharamshala request not found' });
    const reason = normalize(req.body?.reason || req.body?.propertyDecisionReason || 'Rejected by property');
    const result = await rejectDharamshalaRequest({ booking, actor: req.user, reason });
    res.json({ success: true, data: result.booking, idempotent: result.idempotent });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Dharamshala request rejection failed' });
  }
});

// Admin/system-safe maintenance hook: expire stale pending payment holds in bounded batches.
router.post('/maintenance/expire-pending', protect, authorize('admin'), async (req, res) => {
  try {
    const limitRaw = Number(req.body?.limit || req.query?.limit || 100);
    const result = await expirePendingBookings({ limit: limitRaw });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Booking expiration failed' });
  }
});

router.post('/:id/modify/preview', protect, async (req, res) => {
  try {
    const result = await buildModificationPreview({
      bookingId: req.params.id,
      actor: req.user,
      changes: req.body || {},
    });
    res.json({ success: true, modification: result.response });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : 'Modification preview failed',
    });
  }
});

router.post('/:id/modify', protect, async (req, res) => {
  try {
    const idempotencyKey = req.get('Idempotency-Key') || req.body?.idempotencyKey;
    const result = await createModification({
      bookingId: req.params.id,
      actor: req.user,
      changes: req.body || {},
      idempotencyKey,
    });
    res.status(result.idempotent ? 200 : 201).json({
      success: true,
      data: result.booking ? (req.user.role === 'user' ? sanitizeCustomerBooking(result.booking) : result.booking) : undefined,
      modification: result.modification,
      preview: result.preview,
      payment: result.payment,
      idempotent: result.idempotent,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : 'Booking modification failed',
    });
  }
});

router.post('/:id/modify/payment', protect, async (req, res) => {
  try {
    const result = await verifyModificationPayment({
      bookingId: req.params.id,
      actor: req.user,
      body: req.body || {},
    });
    res.json({
      success: true,
      data: req.user.role === 'user' ? sanitizeCustomerBooking(result.booking) : result.booking,
      modification: result.modification,
      message: result.idempotent ? 'PAYMENT_ALREADY_PROCESSED' : 'MODIFICATION_APPLIED',
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : 'Modification payment verification failed',
    });
  }
});

router.post('/:id/refund', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (String(booking.paymentStatus || '') !== 'paid') {
      return res.status(409).json({ success: false, message: 'Booking is not paid' });
    }
    const refundableAmount = Math.max(0, Math.round(Number(booking.refundableAmount || 0)));
    if (!refundableAmount) return res.status(409).json({ success: false, message: 'No refundable amount is available' });
    await executeBookingRefund({
      booking,
      amount: refundableAmount,
      idempotencyKey: req.get('Idempotency-Key') || `admin-refund:${booking._id}`,
      reason: 'admin_refund_reconciliation',
    });
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.statusCode ? err.message : 'Refund failed',
    });
  }
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

    res.json({ success: true, data: isOwner && !isAdmin && !isPartner ? sanitizeCustomerBooking(booking) : booking });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment rejection failed' });
  }
});

const cancelBookingNow = async (booking, reason, reviewedByAdmin = false, meta = {}) => {
  await transitionBookingStatus(booking, 'cancelled', {
    actorId: meta.actorId,
    actorRole: meta.cancelledByRole || (reviewedByAdmin ? 'admin' : 'user'),
    reason,
  });
  booking.cancellationRequested = true;
  booking.cancellationReason = reason;
  booking.cancellationRequestedAt = booking.cancellationRequestedAt || new Date();
  booking.cancellationReviewedByAdmin = reviewedByAdmin;
  booking.cancellationReviewedAt = reviewedByAdmin ? new Date() : booking.cancellationReviewedAt;
  booking.cancelledByRole = meta.cancelledByRole || booking.cancelledByRole || (reviewedByAdmin ? 'admin' : 'user');
  booking.cancelledByName = meta.cancelledByName || booking.cancelledByName || '';
  booking.cancelledAt = booking.cancelledAt || new Date();
  booking.payout_status = 'cancelled';
  booking.cancellationDetails = meta.cancellationDetails || booking.cancellationDetails || '';
  const refundableBase = String(booking.propertyType || '').toLowerCase() === 'dharamshala'
    ? booking.amountPaidOnline
    : booking.totalAmount;
  Object.assign(booking, cancellationMoney(refundableBase));
  await executeBookingRefund({
    booking,
    amount: booking.refundableAmount,
    idempotencyKey: meta.idempotencyKey || `cancel:${booking._id}`,
    reason: 'booking_cancellation',
  });
  await booking.save();
  await releaseBookingInventory(booking);
  await ensureBookingCancellationNotification(booking, reason);
};

// Cancel booking
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id }
      : req.user.role === 'partner'
        ? { _id: req.params.id, partnerId: req.user._id }
        : { _id: req.params.id, userId: req.user._id };
    const booking = await Booking.findOne(query);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const reason = normalize(req.body?.reason || req.body?.cancellationReason);
    const cancellationDetails = normalize(req.body?.details || req.body?.cancellationDetails);
    if (!reason) return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    if (!cancellationDetails) return res.status(400).json({ success: false, message: 'Cancellation details are required' });
    if (['cancelled', 'expired', 'payment_failed', 'checked_out'].includes(String(booking.bookingStatus || ''))) {
      return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    }

    if (req.user.role === 'admin' || req.user.role === 'partner') {
      await cancelBookingNow(booking, reason, true, {
        cancelledByRole: req.user.role,
        cancelledByName: req.user.name,
        actorId: req.user._id,
        cancellationDetails,
        idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey,
      });
      return res.json({ success: true, data: booking, message: 'Booking cancelled and customer notified.' });
    }

    await cancelBookingNow(booking, reason, true, {
      cancelledByRole: 'user',
      cancelledByName: req.user.name,
      actorId: req.user._id,
      cancellationDetails,
      idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey,
    });
    res.json({ success: true, data: req.user.role === 'user' ? sanitizeCustomerBooking(booking) : booking });
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
      await cancelBookingNow(booking, booking.cancellationReason || 'Cancellation approved by admin', true);
      return res.json({ success: true, data: booking });
    }

    // Deny: keep booking status as-is, just mark reviewed.
    await booking.save();
    res.json({ success: true, data: sanitizeCustomerBooking(booking) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Status update failed' });
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
    if (rejectInvalidObjectId(res, cabId, 'cabId')) return;

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
    if (booking.paymentStatus !== 'paid') {
      return res.status(409).json({ success: false, message: 'Payment must be verified before cab assignment' });
    }
    await transitionBookingStatus(booking, 'confirmed', {
      actorId: req.user._id,
      actorRole: 'admin',
      reason: 'cab_assigned',
    });
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
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Check-in failed' });
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
    if (['cancelled', 'expired', 'payment_failed', 'checked_in', 'checked_out', 'settled'].includes(String(booking.bookingStatus || ''))) {
      return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    }

    booking.upiTransactionId = upiTransactionId.trim();
    booking.paymentStatus = 'pending';
    booking.paymentHoldExpiresAt = getPaymentHoldExpiresAt();
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment rejection failed' });
  }
});

// Verify payment (admin)
router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const bookingExisting = await Booking.findById(req.params.id);
    if (!bookingExisting) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (bookingExisting.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are verified automatically by server/webhook.' });
    }

    if (bookingExisting.paymentMethod === 'online' && bookingExisting.partnerId && !bookingExisting.partnerPaymentVerified) {
      return res.status(400).json({ success: false, message: 'Partner verification required before admin verification' });
    }

    const booking = await markBookingPaymentPaid(bookingExisting, {
      paymentProvider: 'manual_upi',
      actorId: req.user._id,
      actorRole: 'admin',
      reason: 'manual_upi_admin_verified',
    });
    await enqueueBookingNotifications(booking, {
      invoice: !['cab', 'tour'].includes(String(booking.bookingType || '')),
      partnerAlert: false,
    });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject payment (admin)
router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (existing.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are updated automatically by server/webhook.' });
    }
    const booking = await markBookingPaymentFailed(existing, {
      paymentProvider: 'manual_upi',
      status: 'rejected',
      actorId: req.user._id,
      actorRole: 'admin',
      reason: 'manual_upi_admin_rejected',
    });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: update operational stay status for hotel settlement flow
router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const nextStatus = normalize(req.body?.bookingStatus || req.body?.status);
    const allowed = ['checked_in', 'checked_out', 'completed', 'settled', 'no_show'];
    if (!allowed.includes(nextStatus)) return res.status(400).json({ success: false, message: 'Invalid booking status' });
    if (nextStatus === 'settled' && booking.bookingStatus !== 'checked_out') {
      return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    }
    if (nextStatus !== 'settled' && booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'not_required') {
      return res.status(409).json({ success: false, message: 'Payment must be verified before stay status changes' });
    }

    if (nextStatus !== 'settled') {
      await transitionBookingStatus(booking, nextStatus, {
        actorId: req.user._id,
        actorRole: 'admin',
        reason: 'admin_status_update',
      });
    } else {
      booking.bookingStatus = 'settled';
    }
    if (nextStatus === 'checked_in') booking.payout_status = 'checked_in';
    if (nextStatus === 'checked_out') booking.payout_status = 'checked_out';
    if (nextStatus === 'completed') booking.payout_status = 'checked_out';
    if (nextStatus === 'no_show') booking.payout_status = 'cancelled';
    if (nextStatus === 'settled') booking.payout_status = 'settled';
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/no-show', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id, propertyType: 'dharamshala' }
      : { _id: req.params.id, propertyType: 'dharamshala', partnerId: req.user._id };
    const booking = await Booking.findOne(query);
    if (!booking) return res.status(404).json({ success: false, message: 'Dharamshala booking not found' });
    if (booking.bookingStatus !== 'confirmed') return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    await transitionBookingStatus(booking, 'no_show', {
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: normalize(req.body?.reason || 'dharamshala_no_show'),
    });
    booking.payout_status = 'cancelled';
    booking.propertyDecisionReason = booking.propertyDecisionReason || normalize(req.body?.reason || 'Guest did not arrive');
    await booking.save();
    await releaseBookingInventory(booking);
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'No-show update failed' });
  }
});

router.put('/:id/dharamshala/complete', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { _id: req.params.id, propertyType: 'dharamshala' }
      : { _id: req.params.id, propertyType: 'dharamshala', partnerId: req.user._id };
    const booking = await Booking.findOne(query);
    if (!booking) return res.status(404).json({ success: false, message: 'Dharamshala booking not found' });
    if (!['checked_in', 'checked_out'].includes(String(booking.bookingStatus || ''))) {
      return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    }
    await transitionBookingStatus(booking, 'completed', {
      actorId: req.user._id,
      actorRole: req.user.role,
      reason: normalize(req.body?.reason || 'dharamshala_completed'),
    });
    booking.payout_status = 'checked_out';
    await booking.save();
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Completion update failed' });
  }
});

// Partner: digital guest check-in with signature audit trail
router.put('/:id/partner-check-in', protect, authorize('partner'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['hotel', 'room', 'room_type'].includes(String(booking.bookingType || ''))) {
      return res.status(400).json({ success: false, message: 'Check-in is only available for lodging bookings' });
    }
    if (booking.bookingStatus !== 'confirmed') return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'not_required') {
      return res.status(400).json({ success: false, message: 'Payment must be verified before check-in' });
    }

    const guestDigitalSignature = normalize(req.body?.guestDigitalSignature || req.body?.guestFullName);
    if (!guestDigitalSignature) {
      return res.status(400).json({ success: false, message: 'Guest full name / digital signature is required' });
    }

    const checkedInAt = new Date();
    await transitionBookingStatus(booking, 'checked_in', {
      actorId: req.user._id,
      actorRole: 'partner',
      reason: 'partner_guest_check_in',
    });
    booking.payout_status = 'checked_in';
    booking.checkedInAt = checkedInAt;
    booking.checkedInByPartnerId = req.user._id;
    booking.checkedInByPartnerName = req.user.name;
    booking.guestDigitalSignature = guestDigitalSignature;
    await booking.save();

    res.json({ success: true, data: booking, message: `Checked In: ${checkedInAt.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify payment (partner - first step)
router.put('/:id/partner-verify', protect, authorize('partner'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are updated automatically by server/webhook.' });
    }

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
    if (booking.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are updated automatically by server/webhook.' });
    }

    if (!booking.partnerId || String(booking.partnerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.paymentMethod !== 'online') {
      return res.status(400).json({ success: false, message: 'Partner rejection is only for online payments' });
    }

    await markBookingPaymentFailed(booking, {
      paymentProvider: 'manual_upi',
      status: 'rejected',
      actorId: req.user._id,
      actorRole: 'partner',
      reason: 'manual_upi_partner_rejected',
    });

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

