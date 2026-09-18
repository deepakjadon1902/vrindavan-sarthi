const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC } = require('./date');
const { isLodgingBooking } = require('./reservationLifecycle');
const { createBookingQuote } = require('./rateEngine');
const {
  getRazorpayConfig,
  verifyPaymentSignature,
  razorpayRequest,
} = require('./razorpay');
const {
  buildBookingRefundOperationKey,
  buildModificationRefundOperationKey,
  createRefundOperation,
} = require('./refundOperations');

const BOOKABLE_ROOM_STATUSES = ['active', 'available'];
const MODIFIABLE_STATUSES = new Set(['confirmed']);
const MODIFICATION_STATUSES = {
  preview: new Set(['inventory_pending', 'processing', 'cancelled', 'failed']),
  inventory_pending: new Set(['pending_payment', 'processing', 'failed']),
  pending_payment: new Set(['processing', 'payment_failed', 'cancelled']),
  processing: new Set(['completed', 'refund_pending', 'refund_failed', 'failed']),
  refund_pending: new Set(['completed', 'refund_failed']),
  refund_failed: new Set([]),
  completed: new Set([]),
  payment_failed: new Set([]),
  failed: new Set([]),
  cancelled: new Set([]),
};

const publicModificationFields = [
  'checkInDate',
  'checkOutDate',
  'roomTypeId',
  'ratePlanId',
  'roomQuantity',
  'adults',
  'children',
  'pets',
  'guestDetails',
];

const normalize = (v) => String(v || '').trim();
const oidString = (v) => String(v || '');
const dateKey = (d) => new Date(d).toISOString().slice(0, 10);
const lockKey = (roomUnitId, date) => `${oidString(roomUnitId)}:${dateKey(date)}`;

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const validateIdempotencyKey = (value) => {
  const key = normalize(value);
  if (!key) throw httpError('Idempotency-Key is required', 400);
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(key)) throw httpError('Invalid Idempotency-Key', 400);
  return key;
};

const validateBookingId = (bookingId) => {
  if (!mongoose.Types.ObjectId.isValid(String(bookingId || ''))) {
    throw httpError('Invalid booking id', 400);
  }
  return bookingId;
};

const transitionModification = (modification, nextStatus) => {
  const current = String(modification.status || 'preview');
  if (current === nextStatus) return;
  if (!MODIFICATION_STATUSES[current]?.has(nextStatus)) {
    throw httpError(`INVALID_MODIFICATION_STATE: ${current} -> ${nextStatus}`, 409);
  }
  modification.status = nextStatus;
  if (nextStatus === 'completed') modification.completedAt = modification.completedAt || new Date();
  if (['failed', 'payment_failed', 'refund_failed'].includes(nextStatus)) modification.failedAt = modification.failedAt || new Date();
};

const authorizeBookingForActor = (booking, actor) => {
  if (!booking || !actor) throw httpError('Booking not found', 404);
  if (actor.role === 'admin') return true;
  if (actor.role === 'partner') {
    if (booking.partnerId && oidString(booking.partnerId) === oidString(actor._id)) return true;
    throw httpError('Not authorized', 403);
  }
  if (oidString(booking.userId) === oidString(actor._id)) return true;
  throw httpError('Not authorized', 403);
};

const assertEligibleBooking = (booking) => {
  if (!isLodgingBooking(booking) || String(booking.bookingType || '') !== 'room_type') {
    throw httpError('Only room-type lodging bookings can be modified', 422);
  }
  if (!MODIFIABLE_STATUSES.has(String(booking.bookingStatus || ''))) {
    throw httpError('INVALID_BOOKING_STATE', 409);
  }
  if (String(booking.paymentStatus || '') !== 'paid') {
    throw httpError('Booking must be paid before modification', 409);
  }
  if (booking.isWaitlisted && !booking.waitlistAssignedAt) {
    throw httpError('Waitlisted bookings cannot be modified until inventory is assigned', 409);
  }
};

const rejectProtectedFields = (body) => {
  const allowed = new Set(publicModificationFields);
  for (const key of Object.keys(body || {})) {
    if (!allowed.has(key) && key !== 'idempotencyKey') {
      throw httpError(`Field is not modifiable: ${key}`, 400);
    }
  }
};

const normalizeGender = (v) => {
  const s = normalize(v).toLowerCase();
  if (!s) return null;
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  if (s === 'other' || s === 'o') return 'other';
  return null;
};

const normalizeGuestDetails = ({ guestDetails, adults, children }) => {
  if (typeof guestDetails === 'undefined') return null;
  if (!Array.isArray(guestDetails)) throw httpError('guestDetails must be an array', 400);
  const normalized = guestDetails
    .map((g) => ({
      type: normalize(g?.type).toLowerCase(),
      name: normalize(g?.name),
      age: Number(g?.age || 0),
      gender: normalizeGender(g?.gender),
    }))
    .filter((g) => (g.type === 'adult' || g.type === 'child') && g.name && Number.isFinite(g.age) && g.age > 0);
  if (normalized.filter((g) => g.type === 'adult').length !== adults ||
      normalized.filter((g) => g.type === 'child').length !== children) {
    throw httpError('guestDetails must include name/age for each adult/child', 400);
  }
  return normalized;
};

const moneySnapshot = (value) => ({
  baseAmount: Math.round(Number(value?.baseAmount || 0)),
  taxPercent: Number(value?.taxPercent || 0),
  taxAmount: Math.round(Number(value?.taxAmount || 0)),
  checkoutSubtotal: Math.round(Number(value?.checkoutSubtotal || 0)),
  convenienceFeePercent: Number(value?.convenienceFeePercent || 0),
  convenienceFeeAmount: Math.round(Number(value?.convenienceFeeAmount || 0)),
  totalAmount: Math.round(Number(value?.totalAmount || 0)),
  advanceAmount: Math.round(Number(value?.advanceAmount || 0)),
  balanceAmount: Math.round(Number(value?.balanceAmount || 0)),
  paymentOption: String(value?.paymentOption || ''),
});

const snapshotBookingValues = (booking, roomType, money) => ({
  checkIn: booking.checkIn,
  checkOut: booking.checkOut,
  roomTypeId: booking.roomTypeId,
  ratePlanId: booking.ratePlanId,
  ratePlanName: booking.ratePlanName,
  ratePlanCode: booking.ratePlanCode,
  ratePlanMealPlan: booking.ratePlanMealPlan,
  nightlyBreakdown: Array.isArray(booking.nightlyBreakdown) ? booking.nightlyBreakdown.map((n) => ({ ...n })) : [],
  roomQuantity: Number(booking.roomQuantity || 1),
  guests: Number(booking.guests || 0),
  totalAdults: Number(booking.totalAdults || 0),
  totalChildren: Number(booking.totalChildren || 0),
  hasPet: Boolean(booking.hasPet),
  guestDetails: Array.isArray(booking.guestDetails) ? booking.guestDetails.map((g) => ({ ...g })) : [],
  roomUnitIds: Array.isArray(booking.roomUnitIds) ? booking.roomUnitIds : [],
  roomNumbers: Array.isArray(booking.roomNumbers) ? booking.roomNumbers : [],
  itemId: String(booking.itemId || ''),
  itemName: roomType ? `${booking.itemName}` : String(booking.itemName || ''),
  itemImage: String(booking.itemImage || ''),
  money: moneySnapshot(money || booking),
});

const loadAuthorizedBooking = async (bookingId, actor) => {
  validateBookingId(bookingId);
  const booking = await Booking.findById(bookingId);
  if (!booking) throw httpError('Booking not found', 404);
  authorizeBookingForActor(booking, actor);
  return booking;
};

const buildTarget = async (booking, body = {}) => {
  rejectProtectedFields(body);
  assertEligibleBooking(booking);

  const checkIn = typeof body.checkInDate !== 'undefined'
    ? parseDateOnlyToUTC(String(body.checkInDate || ''))
    : new Date(booking.checkIn);
  const checkOut = typeof body.checkOutDate !== 'undefined'
    ? parseDateOnlyToUTC(String(body.checkOutDate || ''))
    : new Date(booking.checkOut);
  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkIn >= checkOut) {
    throw httpError('Valid checkInDate and checkOutDate are required', 400);
  }

  const days = enumerateDatesUTC(checkIn, checkOut);
  if (!days.length) throw httpError('Invalid date range', 400);

  const roomQuantity = typeof body.roomQuantity !== 'undefined'
    ? Math.floor(Number(body.roomQuantity))
    : Math.floor(Number(booking.roomQuantity || 1));
  if (!Number.isFinite(roomQuantity) || roomQuantity < 1 || roomQuantity > 20) throw httpError('Invalid roomQuantity', 400);

  const adults = typeof body.adults !== 'undefined'
    ? Number(body.adults)
    : Number(booking.totalAdults || booking.guests || 1);
  const children = typeof body.children !== 'undefined'
    ? Number(body.children)
    : Number(booking.totalChildren || 0);
  if (!Number.isFinite(adults) || adults < 1) throw httpError('At least 1 adult is required', 400);
  if (!Number.isFinite(children) || children < 0) throw httpError('Invalid children count', 400);

  const currentHotel = await Hotel.findById(booking.hotelId).lean();
  if (!currentHotel) throw httpError('Hotel not found', 404);

  const targetRoomTypeId = normalize(body.roomTypeId || booking.roomTypeId);
  if (!mongoose.Types.ObjectId.isValid(targetRoomTypeId)) throw httpError('Invalid roomTypeId', 400);
  const roomType = await RoomType.findOne({ _id: targetRoomTypeId, hotelId: currentHotel._id, status: 'active' }).lean();
  if (!roomType) throw httpError('Room type not found for this hotel', 404);

  const maxAdultsForBooking = Math.max(1, Number(roomType.maxAdults || 1)) * roomQuantity;
  const maxChildrenForBooking = Math.max(0, Number(roomType.maxChildren || 0)) * roomQuantity;
  if (adults > maxAdultsForBooking) throw httpError(`Max adults for ${roomQuantity} room(s) is ${maxAdultsForBooking}`, 422);
  if (children > maxChildrenForBooking) throw httpError(`Max children for ${roomQuantity} room(s) is ${maxChildrenForBooking}`, 422);

  const hasPet = typeof body.pets !== 'undefined' ? Boolean(body.pets) : Boolean(booking.hasPet);
  if (hasPet && !currentHotel.petsAllowed) throw httpError('Pets are not allowed at this hotel', 422);

  const guestDetails = normalizeGuestDetails({ guestDetails: body.guestDetails, adults, children }) ||
    (Array.isArray(booking.guestDetails) ? booking.guestDetails.map((g) => ({ ...g })) : []);

  const quoteResult = await createBookingQuote({
    hotelId: currentHotel._id,
    roomTypeId: roomType._id,
    ratePlanId: body.ratePlanId || booking.ratePlanId,
    checkIn,
    checkOut,
    roomQuantity,
    adults,
    children,
    hasPet,
    paymentOption: booking.paymentOption || 'advance_30',
    checkInventory: false,
  });

  return {
    hotel: currentHotel,
    roomType,
    ratePlan: quoteResult.ratePlan,
    quote: quoteResult.quote,
    checkIn,
    checkOut,
    days,
    roomQuantity,
    totalAdults: adults,
    totalChildren: children,
    guests: adults + children,
    hasPet,
    guestDetails,
    price: quoteResult.money,
  };
};

const getBlockedUnitSet = async ({ roomTypeId, checkIn, checkOut }) => {
  const blockedByBlocks = await RoomUnitBlock.distinct('roomUnitId', {
    roomTypeId,
    startDate: { $lt: checkOut },
    endDate: { $gt: checkIn },
  });
  return new Set(blockedByBlocks.map(String));
};

const getOtherBookingLockSet = async ({ roomTypeId, bookingId, checkIn, checkOut }) => {
  const locks = await RoomUnitBookingDay.find({
    roomTypeId,
    bookingId: { $ne: bookingId },
    date: { $gte: checkIn, $lt: checkOut },
  }).select('roomUnitId date').lean();
  return new Set(locks.map((lock) => lockKey(lock.roomUnitId, lock.date)));
};

const unitAllowsPet = ({ unit, hotel, roomType, hasPet }) => {
  if (!hasPet) return true;
  const effectivePetsAllowed =
    Boolean(hotel?.petsAllowed) &&
    (unit.petsAllowedOverride === null || typeof unit.petsAllowedOverride === 'undefined'
      ? Boolean(roomType?.petsAllowed)
      : Boolean(unit.petsAllowedOverride));
  return effectivePetsAllowed;
};

const getInventoryPlan = async (booking, target, { forHold = false } = {}) => {
  const currentLocks = await RoomUnitBookingDay.find({ bookingId: booking._id })
    .sort({ date: 1 })
    .lean();
  const existingByPair = new Map(currentLocks.map((lock) => [lockKey(lock.roomUnitId, lock.date), lock]));
  const targetDateKeys = new Set(target.days.map(dateKey));
  const currentUnitIds = new Set((booking.roomUnitIds || []).map(String));

  const blockedUnits = await getBlockedUnitSet({
    roomTypeId: target.roomType._id,
    checkIn: target.checkIn,
    checkOut: target.checkOut,
  });
  const otherLocks = await getOtherBookingLockSet({
    roomTypeId: target.roomType._id,
    bookingId: booking._id,
    checkIn: target.checkIn,
    checkOut: target.checkOut,
  });
  const units = await RoomUnit.find({
    roomTypeId: target.roomType._id,
    status: { $in: BOOKABLE_ROOM_STATUSES },
  }).sort({ number: 1, createdAt: 1 }).lean();

  const retained = [];
  const acquired = [];
  const selected = [];
  const newlyRequired = [];

  const unitCandidates = [
    ...units.filter((unit) => currentUnitIds.has(String(unit._id))),
    ...units.filter((unit) => !currentUnitIds.has(String(unit._id))),
  ];

  for (const unit of unitCandidates) {
    if (selected.length >= target.roomQuantity) break;
    if (String(unit.hotelId) !== String(target.hotel._id)) continue;
    if (String(unit.roomTypeId) !== String(target.roomType._id)) continue;
    if (blockedUnits.has(String(unit._id))) continue;
    if (!unitAllowsPet({ unit, hotel: target.hotel, roomType: target.roomType, hasPet: target.hasPet })) continue;

    const missingDates = [];
    let blockedByOther = false;
    for (const day of target.days) {
      const key = lockKey(unit._id, day);
      if (otherLocks.has(key)) {
        blockedByOther = true;
        break;
      }
      if (!existingByPair.has(key)) missingDates.push(day);
    }
    if (blockedByOther) continue;

    selected.push(unit);
    if (currentUnitIds.has(String(unit._id))) retained.push(unit);
    else acquired.push(unit);
    for (const day of missingDates) newlyRequired.push({ roomUnitId: unit._id, date: day });
  }

  const targetPairs = new Set();
  for (const unit of selected) {
    for (const day of target.days) targetPairs.add(lockKey(unit._id, day));
  }

  const obsoleteLocks = currentLocks.filter((lock) => !targetPairs.has(lockKey(lock.roomUnitId, lock.date)));
  const inventoryAvailable = selected.length === target.roomQuantity;

  return {
    inventoryAvailable,
    selectedUnits: selected,
    retainedUnits: retained,
    acquiredUnits: acquired,
    newlyRequired,
    obsoleteLocks,
    currentLocks,
    expectedLockCount: target.roomQuantity * target.days.length,
    canHold: forHold ? inventoryAvailable : true,
  };
};

const holdAdditionalLocks = async (booking, target, plan) => {
  const held = [];
  try {
    for (const lock of plan.newlyRequired) {
      await RoomUnitBookingDay.create({
        hotelId: target.hotel._id,
        roomTypeId: target.roomType._id,
        roomUnitId: lock.roomUnitId,
        bookingId: booking._id,
        date: lock.date,
      });
      held.push({ roomUnitId: lock.roomUnitId, date: lock.date });
    }
    return held;
  } catch (err) {
    await releaseHeldLocks(booking._id, held);
    if (String(err?.code) === '11000') throw httpError('Target inventory is no longer available', 409);
    throw err;
  }
};

const releaseHeldLocks = async (bookingId, heldLocks = []) => {
  if (!heldLocks.length) return { deletedCount: 0 };
  const clauses = heldLocks.map((lock) => ({
    bookingId,
    roomUnitId: lock.roomUnitId,
    date: lock.date,
  }));
  return RoomUnitBookingDay.deleteMany({ $or: clauses });
};

const calculatePreviewAmounts = (oldAmount, newAmount) => {
  const oldTotal = Math.max(0, Math.round(Number(oldAmount || 0)));
  const newTotal = Math.max(0, Math.round(Number(newAmount || 0)));
  const differenceAmount = newTotal - oldTotal;
  const paymentAction = differenceAmount > 0
    ? 'additional_payment'
    : differenceAmount < 0
      ? 'refund'
      : 'no_change';
  return {
    oldAmount: oldTotal,
    newAmount: newTotal,
    differenceAmount,
    paymentAction,
    additionalAmount: differenceAmount > 0 ? differenceAmount : 0,
    refundAmount: differenceAmount < 0 ? Math.abs(differenceAmount) : 0,
  };
};

const buildModificationPreview = async ({ bookingId, actor, changes }) => {
  const booking = await loadAuthorizedBooking(bookingId, actor);
  const target = await buildTarget(booking, changes);
  const plan = await getInventoryPlan(booking, target);
  const money = calculatePreviewAmounts(booking.totalAmount, target.price.totalAmount);

  return {
    booking,
    target,
    plan,
    response: {
      oldAmount: money.oldAmount,
      newAmount: money.newAmount,
      differenceAmount: money.differenceAmount,
      paymentAction: money.paymentAction,
      additionalAmount: money.additionalAmount,
      refundAmount: money.refundAmount,
      inventoryAvailable: plan.inventoryAvailable,
      roomQuantity: target.roomQuantity,
      checkIn: target.checkIn,
      checkOut: target.checkOut,
      roomTypeId: target.roomType._id,
      roomTypeName: target.roomType.name,
      nights: target.days.length,
    },
  };
};

const applyModificationToBooking = async ({ booking, target, plan, modification, actor }) => {
  const selectedUnitIds = plan.selectedUnits.map((unit) => unit._id);
  const selectedNumbers = plan.selectedUnits.map((unit) => unit.number);

  booking.roomTypeId = target.roomType._id;
  booking.ratePlanId = target.ratePlan?._id;
  booking.ratePlanName = target.ratePlan?.name || '';
  booking.ratePlanCode = target.ratePlan?.code || '';
  booking.ratePlanMealPlan = target.ratePlan?.mealPlan || '';
  booking.nightlyBreakdown = target.quote?.nightlyBreakdown || [];
  booking.itemId = String(target.roomType._id);
  booking.itemName = `${target.hotel.name} - ${target.roomType.name}`;
  booking.itemImage = (target.roomType.images && target.roomType.images[0]) || target.hotel.image || booking.itemImage;
  booking.roomQuantity = target.roomQuantity;
  booking.roomUnitIds = selectedUnitIds;
  booking.roomNumbers = selectedNumbers;
  booking.roomUnitId = selectedUnitIds[0];
  booking.roomNumber = selectedNumbers[0];
  booking.checkIn = target.checkIn;
  booking.checkOut = target.checkOut;
  booking.guests = target.guests;
  booking.totalAdults = target.totalAdults;
  booking.totalChildren = target.totalChildren;
  booking.hasPet = target.hasPet;
  booking.guestDetails = target.guestDetails;
  booking.baseAmount = target.price.baseAmount;
  booking.taxPercent = target.price.taxPercent;
  booking.taxAmount = target.price.taxAmount;
  Object.assign(booking, target.price);
  booking.statusHistory = [
    ...(Array.isArray(booking.statusHistory) ? booking.statusHistory : []),
    {
      from: booking.bookingStatus,
      to: booking.bookingStatus,
      at: new Date(),
      actorId: actor._id,
      actorRole: actor.role || 'system',
      reason: `booking_modified:${modification._id}`,
    },
  ].slice(-100);

  try {
    await booking.save();
    if (plan.obsoleteLocks.length) {
      await RoomUnitBookingDay.deleteMany({ _id: { $in: plan.obsoleteLocks.map((lock) => lock._id) } });
    }
  } catch (err) {
    await releaseHeldLocks(booking._id, modification.heldLocks || []);
    modification.inventoryStatus = 'failed';
    modification.failureReason = err.message;
    transitionModification(modification, 'failed');
    await modification.save();
    throw err;
  }

  const actual = await RoomUnitBookingDay.countDocuments({ bookingId: booking._id });
  if (actual !== plan.expectedLockCount) {
    modification.inventoryStatus = 'failed';
    modification.reconciliationState = 'needs_inventory_reconciliation';
    modification.failureReason = `Expected ${plan.expectedLockCount} locks, found ${actual}`;
    transitionModification(modification, 'failed');
    await modification.save();
    throw httpError('Modified booking inventory requires reconciliation', 500);
  }

  modification.inventoryStatus = 'applied';
  modification.releasedLocks = plan.obsoleteLocks.map((lock) => ({ roomUnitId: lock.roomUnitId, date: lock.date }));
};

const createRazorpayOrderForModification = async (modification, booking) => {
  const { keyId } = getRazorpayConfig();
  const amount = Math.round(Number(modification.differenceAmount || 0));
  if (amount <= 0) throw httpError('No additional payment is due', 400);
  const order = await razorpayRequest({
    method: 'POST',
    path: '/v1/orders',
    body: {
      amount: amount * 100,
      currency: 'INR',
      receipt: `mod-${String(modification._id).slice(-20)}`,
      notes: {
        bookingMongoId: String(booking._id),
        bookingId: booking.bookingId,
        modificationId: String(modification._id),
      },
    },
  });
  modification.razorpayOrderId = order.id;
  await modification.save();
  return { keyId, order };
};

const processModificationRefund = async ({ booking, modification }) => {
  if (modification.refundStatus === 'processed' || modification.refundId) return;
  modification.refundRequestedAt = modification.refundRequestedAt || new Date();
  try {
    await createRefundOperation({
      modification,
      amount: modification.refundAmount,
      reason: 'modification_refund',
      operationKey: buildModificationRefundOperationKey({ modificationId: modification._id, reason: 'modification_refund' }),
    });
    modification.refundStatus = 'pending';
  } catch (err) {
    modification.refundStatus = 'failed';
    modification.refundFailureReason = err.message;
    modification.reconciliationState = 'needs_refund_reconciliation';
    transitionModification(modification, 'refund_failed');
  }
};

const createModification = async ({ bookingId, actor, changes, idempotencyKey }) => {
  validateBookingId(bookingId);
  const key = validateIdempotencyKey(idempotencyKey);
  const existing = await BookingModification.findOne({ bookingId, idempotencyKey: key });
  if (existing) return { modification: existing, idempotent: true };

  const { booking, target, plan, response } = await buildModificationPreview({ bookingId, actor, changes });
  if (!plan.inventoryAvailable) throw httpError('Requested inventory is not available', 409);

  const amount = calculatePreviewAmounts(booking.totalAmount, target.price.totalAmount);
  const oldValues = snapshotBookingValues(booking);
  const newValues = {
    ...snapshotBookingValues({
      ...booking.toObject(),
      checkIn: target.checkIn,
      checkOut: target.checkOut,
      roomTypeId: target.roomType._id,
      ratePlanId: target.ratePlan?._id,
      ratePlanName: target.ratePlan?.name || '',
      ratePlanCode: target.ratePlan?.code || '',
      ratePlanMealPlan: target.ratePlan?.mealPlan || '',
      nightlyBreakdown: target.quote?.nightlyBreakdown || [],
      roomQuantity: target.roomQuantity,
      guests: target.guests,
      totalAdults: target.totalAdults,
      totalChildren: target.totalChildren,
      hasPet: target.hasPet,
      guestDetails: target.guestDetails,
      itemId: String(target.roomType._id),
      itemName: `${target.hotel.name} - ${target.roomType.name}`,
      itemImage: (target.roomType.images && target.roomType.images[0]) || target.hotel.image || booking.itemImage,
    }, target.roomType, target.price),
  };

  let modification;
  try {
    modification = await BookingModification.create({
      bookingId: booking._id,
      actorId: actor._id,
      actorRole: actor.role || 'user',
      idempotencyKey: key,
      status: 'inventory_pending',
      action: amount.paymentAction,
      oldValues,
      newValues,
      oldAmount: amount.oldAmount,
      newAmount: amount.newAmount,
      differenceAmount: amount.differenceAmount,
      paymentAction: amount.paymentAction,
      paymentStatus: amount.paymentAction === 'additional_payment' ? 'pending' : 'not_required',
      refundAmount: amount.refundAmount,
      refundStatus: amount.paymentAction === 'refund' ? 'pending' : 'not_required',
      inventoryStatus: 'planned',
    });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return { modification: await BookingModification.findOne({ bookingId, idempotencyKey: key }), idempotent: true };
    }
    throw err;
  }

  const heldLocks = await holdAdditionalLocks(booking, target, plan);
  modification.heldLocks = heldLocks;
  modification.inventoryStatus = 'held';

  if (amount.paymentAction === 'additional_payment') {
    try {
      const payment = await createRazorpayOrderForModification(modification, booking);
      transitionModification(modification, 'pending_payment');
      await modification.save();
      return { modification, booking, preview: response, payment, idempotent: false };
    } catch (err) {
      await releaseHeldLocks(booking._id, heldLocks);
      modification.inventoryStatus = 'released';
      modification.failureReason = err.message;
      transitionModification(modification, 'failed');
      await modification.save();
      throw err;
    }
  }

  transitionModification(modification, 'processing');
  await applyModificationToBooking({ booking, target, plan, modification, actor });

  if (amount.paymentAction === 'refund') {
    transitionModification(modification, 'refund_pending');
    await processModificationRefund({ booking, modification });
  }

  if (modification.status !== 'refund_failed') transitionModification(modification, 'completed');
  await modification.save();
  return { modification, booking, preview: response, idempotent: false };
};

const rebuildTargetFromModification = async (booking, modification) => {
  const storedGuestDetails = Array.isArray(modification.newValues?.guestDetails)
    ? modification.newValues.guestDetails
    : [];
  const expectedGuestDetails = Number(modification.newValues.totalAdults || 0) + Number(modification.newValues.totalChildren || 0);
  assertEligibleBooking(booking);

  const values = modification.newValues || {};
  const checkIn = new Date(values.checkIn);
  const checkOut = new Date(values.checkOut);
  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkIn >= checkOut) {
    throw httpError('Valid checkInDate and checkOutDate are required', 400);
  }
  const days = enumerateDatesUTC(checkIn, checkOut);
  if (!days.length) throw httpError('Invalid date range', 400);

  const roomQuantity = Math.floor(Number(values.roomQuantity || 1));
  if (!Number.isFinite(roomQuantity) || roomQuantity < 1 || roomQuantity > 20) throw httpError('Invalid roomQuantity', 400);

  const adults = Number(values.totalAdults || values.guests || 1);
  const children = Number(values.totalChildren || 0);
  if (!Number.isFinite(adults) || adults < 1) throw httpError('At least 1 adult is required', 400);
  if (!Number.isFinite(children) || children < 0) throw httpError('Invalid children count', 400);

  const targetRoomTypeId = normalize(values.roomTypeId);
  if (!mongoose.Types.ObjectId.isValid(targetRoomTypeId)) throw httpError('Invalid roomTypeId', 400);
  const roomType = await RoomType.findOne({ _id: targetRoomTypeId, status: 'active' }).lean();
  if (!roomType) throw httpError('Room type not found for this hotel', 404);

  if (booking.hotelId && String(roomType.hotelId) !== String(booking.hotelId)) {
    throw httpError('Room type not found for this hotel', 404);
  }

  const hotelId = booking.hotelId || roomType.hotelId;
  const hotel = await Hotel.findById(hotelId).lean();
  if (!hotel) throw httpError('Hotel not found', 404);
  if (String(roomType.hotelId) !== String(hotel._id)) {
    throw httpError('Room type not found for this hotel', 404);
  }

  const maxAdultsForBooking = Math.max(1, Number(roomType.maxAdults || 1)) * roomQuantity;
  const maxChildrenForBooking = Math.max(0, Number(roomType.maxChildren || 0)) * roomQuantity;
  if (adults > maxAdultsForBooking) throw httpError(`Max adults for ${roomQuantity} room(s) is ${maxAdultsForBooking}`, 422);
  if (children > maxChildrenForBooking) throw httpError(`Max children for ${roomQuantity} room(s) is ${maxChildrenForBooking}`, 422);

  const hasPet = Boolean(values.hasPet);
  if (hasPet && !hotel.petsAllowed) throw httpError('Pets are not allowed at this hotel', 422);

  let guestDetails = [];
  if (storedGuestDetails.length === expectedGuestDetails) {
    guestDetails = normalizeGuestDetails({ guestDetails: storedGuestDetails, adults, children });
  } else if (Array.isArray(booking.guestDetails) && booking.guestDetails.length === expectedGuestDetails) {
    guestDetails = booking.guestDetails.map((g) => ({ ...g }));
  }

  const quoteResult = await createBookingQuote({
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    ratePlanId: values.ratePlanId || booking.ratePlanId,
    checkIn,
    checkOut,
    roomQuantity,
    adults,
    children,
    hasPet,
    paymentOption: values.money?.paymentOption || booking.paymentOption || 'advance_30',
    checkInventory: false,
  });

  return {
    hotel,
    roomType,
    ratePlan: quoteResult.ratePlan,
    quote: quoteResult.quote,
    checkIn,
    checkOut,
    days,
    roomQuantity,
    totalAdults: adults,
    totalChildren: children,
    guests: adults + children,
    hasPet,
    guestDetails,
    price: quoteResult.money,
  };
};

const verifyModificationPayment = async ({ bookingId, actor, body }) => {
  const { keySecret } = getRazorpayConfig();
  const modificationId = normalize(body?.modificationId);
  const razorpayOrderId = normalize(body?.razorpay_order_id);
  const razorpayPaymentId = normalize(body?.razorpay_payment_id);
  const razorpaySignature = normalize(body?.razorpay_signature);
  if (!mongoose.Types.ObjectId.isValid(modificationId)) throw httpError('Invalid modification id', 400);
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) throw httpError('Razorpay payment response is incomplete', 400);

  const booking = await loadAuthorizedBooking(bookingId, actor);
  const modification = await BookingModification.findOne({ _id: modificationId, bookingId: booking._id });
  if (!modification) throw httpError('Modification not found', 404);
  if (modification.status === 'completed') {
    if (modification.razorpayPaymentId && modification.razorpayPaymentId !== razorpayPaymentId) {
      throw httpError('PAYMENT_ALREADY_PROCESSED', 409);
    }
    return { modification, booking, idempotent: true };
  }
  if (modification.status !== 'pending_payment') throw httpError('INVALID_MODIFICATION_STATE', 409);
  if (modification.razorpayOrderId !== razorpayOrderId) throw httpError('Razorpay order does not match this modification', 400);

  const signatureOk = verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
    secret: keySecret,
  });
  if (!signatureOk) throw httpError('Razorpay payment signature mismatch', 400);

  const expectedPaise = Math.round(Number(modification.differenceAmount || 0)) * 100;
  let payment = await razorpayRequest({ path: `/v1/payments/${encodeURIComponent(razorpayPaymentId)}` });
  if (Number(payment.amount || 0) !== expectedPaise || payment.currency !== 'INR') {
    throw httpError('Razorpay amount verification failed', 400);
  }
  if (String(payment.status || '') === 'authorized') {
    payment = await razorpayRequest({
      method: 'POST',
      path: `/v1/payments/${encodeURIComponent(razorpayPaymentId)}/capture`,
      body: { amount: expectedPaise, currency: 'INR' },
    });
  }
  if (String(payment.status || '') !== 'captured') throw httpError(`Razorpay payment is ${payment.status || 'not complete'}`, 400);

  modification.paymentStatus = 'paid';
  modification.razorpayPaymentId = razorpayPaymentId;
  transitionModification(modification, 'processing');

  const target = await rebuildTargetFromModification(booking, modification);
  const plan = await getInventoryPlan(booking, target, { forHold: true });
  if (!plan.inventoryAvailable) {
    modification.failureReason = 'Target inventory is no longer available after payment';
    modification.reconciliationState = 'needs_payment_reconciliation';
    transitionModification(modification, 'failed');
    await modification.save();
    throw httpError('Target inventory is no longer available', 409);
  }
  await applyModificationToBooking({ booking, target, plan, modification, actor });
  transitionModification(modification, 'completed');
  await modification.save();
  return { modification, booking, idempotent: false };
};

const markModificationPaymentFailed = async ({ orderId, eventId, status = 'failed' }) => {
  const modification = await BookingModification.findOne({ razorpayOrderId: orderId });
  if (!modification) return null;
  if (eventId && modification.razorpayWebhookEventIds?.map(String).includes(eventId)) return modification;
  if (eventId) modification.razorpayWebhookEventIds = [...(modification.razorpayWebhookEventIds || []), eventId].slice(-25);
  if (modification.status === 'pending_payment') {
    await releaseHeldLocks(modification.bookingId, modification.heldLocks || []);
    modification.inventoryStatus = 'released';
    modification.paymentStatus = 'failed';
    modification.failureReason = status;
    transitionModification(modification, 'payment_failed');
    await modification.save();
  }
  return modification;
};

const applyModificationPaymentFromWebhook = async ({ orderId, paymentId, eventId, status = 'captured' }) => {
  const modification = await BookingModification.findOne({ razorpayOrderId: orderId });
  if (!modification) return null;
  if (eventId && modification.razorpayWebhookEventIds?.map(String).includes(eventId)) return modification;
  if (eventId) modification.razorpayWebhookEventIds = [...(modification.razorpayWebhookEventIds || []), eventId].slice(-25);
  if (modification.status === 'completed') {
    await modification.save();
    return modification;
  }
  if (modification.status !== 'pending_payment') {
    await modification.save();
    return modification;
  }

  const booking = await Booking.findById(modification.bookingId);
  if (!booking) return modification;
  modification.paymentStatus = 'paid';
  modification.razorpayPaymentId = paymentId;
  transitionModification(modification, 'processing');
  const target = await rebuildTargetFromModification(booking, modification);
  const plan = await getInventoryPlan(booking, target, { forHold: true });
  if (!plan.inventoryAvailable) {
    modification.failureReason = `Target inventory unavailable after webhook ${status}`;
    modification.reconciliationState = 'needs_payment_reconciliation';
    transitionModification(modification, 'failed');
    await modification.save();
    return modification;
  }
  await applyModificationToBooking({ booking, target, plan, modification, actor: { _id: modification.actorId, role: modification.actorRole } });
  transitionModification(modification, 'completed');
  await modification.save();
  return modification;
};

const executeBookingRefund = async ({ booking, amount, idempotencyKey, reason = 'booking_refund' }) => {
  const refundAmount = Math.max(0, Math.round(Number(amount || 0)));
  if (!refundAmount) {
    booking.refundStatus = 'not_required';
    booking.refundAmount = 0;
    return booking;
  }
  if (booking.refundId || booking.refundStatus === 'processed') return booking;
  if (String(booking.paymentProvider || '') !== 'razorpay' || String(booking.paymentStatus || '') !== 'paid') {
    booking.refundAmount = refundAmount;
    booking.refundStatus = 'pending';
    booking.refundReconciliationState = 'needs_refund_reconciliation';
    return booking;
  }
  booking.refundAmount = refundAmount;
  booking.refundStatus = 'pending';
  booking.refundRequestedAt = booking.refundRequestedAt || new Date();
  try {
    await createRefundOperation({
      booking,
      amount: refundAmount,
      reason,
      operationKey: normalize(idempotencyKey) || buildBookingRefundOperationKey({ bookingId: booking._id, reason }),
    });
  } catch (err) {
    booking.refundStatus = 'failed';
    booking.refundFailureReason = err.message;
    booking.refundReconciliationState = 'needs_refund_reconciliation';
  }
  return booking;
};

module.exports = {
  MODIFICATION_STATUSES,
  buildModificationPreview,
  createModification,
  verifyModificationPayment,
  applyModificationPaymentFromWebhook,
  markModificationPaymentFailed,
  executeBookingRefund,
  validateIdempotencyKey,
  calculatePreviewAmounts,
  authorizeBookingForActor,
};
