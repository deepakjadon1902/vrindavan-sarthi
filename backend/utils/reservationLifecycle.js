const Booking = require('../models/Booking');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { enumerateDatesUTC, isValidDate } = require('./date');
const { processRoomTypeWaitlist } = require('./waitlist');
const { ensureBookingConfirmedAlarmNotifications } = require('./notificationDelivery');

const LODGING_TYPES = new Set(['hotel', 'room', 'room_type']);
const TERMINAL_BOOKING_STATUSES = new Set(['cancelled', 'expired', 'payment_failed', 'checked_out', 'rejected_by_property', 'expired_property_no_response']);

const BOOKING_TRANSITIONS = {
  pending: new Set(['confirmed', 'payment_failed', 'expired', 'cancelled']),
  pending_property_confirmation: new Set(['awaiting_customer_payment', 'confirmed', 'rejected_by_property', 'expired_property_no_response', 'cancelled']),
  awaiting_customer_payment: new Set(['confirmed', 'payment_failed', 'expired', 'cancelled']),
  rejected_by_property: new Set([]),
  expired_property_no_response: new Set([]),
  confirmed: new Set(['checked_in', 'cancelled', 'no_show']),
  checked_in: new Set(['checked_out', 'completed']),
  no_show: new Set(['cancelled', 'completed']),
  checked_out: new Set(['completed']),
  cancelled: new Set([]),
  expired: new Set([]),
  payment_failed: new Set([]),
  completed: new Set(['settled']),
  settled: new Set([]),
};

const isLodgingBooking = (booking) => LODGING_TYPES.has(String(booking?.bookingType || ''));

const getPaymentHoldMinutes = () => {
  const configured = Number(process.env.BOOKING_PAYMENT_HOLD_MINUTES || 30);
  if (!Number.isFinite(configured) || configured <= 0) return 30;
  return Math.min(24 * 60, Math.floor(configured));
};

const getPaymentHoldExpiresAt = (from = new Date()) =>
  new Date(from.getTime() + getPaymentHoldMinutes() * 60 * 1000);

const getExpectedRoomNightLockCount = (booking) => {
  if (!isLodgingBooking(booking) || !booking?.checkIn || !booking?.checkOut) return 0;
  const checkIn = booking.checkIn instanceof Date ? booking.checkIn : new Date(booking.checkIn);
  const checkOut = booking.checkOut instanceof Date ? booking.checkOut : new Date(booking.checkOut);
  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkIn >= checkOut) return 0;
  const roomQuantity = Math.max(1, Math.floor(Number(booking.roomQuantity || 1)));
  return enumerateDatesUTC(checkIn, checkOut).length * roomQuantity;
};

const appendStatusHistory = (booking, from, to, actor = {}) => {
  if (!booking || from === to) return;
  booking.statusHistory = [
    ...(Array.isArray(booking.statusHistory) ? booking.statusHistory : []),
    {
      from,
      to,
      at: new Date(),
      actorId: actor.actorId || actor.userId || undefined,
      actorRole: actor.actorRole || actor.role || 'system',
      reason: actor.reason || undefined,
    },
  ].slice(-100);
};

const assertValidBookingTransition = (currentStatus, nextStatus) => {
  const from = String(currentStatus || 'pending');
  const to = String(nextStatus || '').trim();
  if (!to) {
    const err = new Error('INVALID_BOOKING_STATE');
    err.statusCode = 400;
    throw err;
  }
  if (from === to) return true;
  if (!BOOKING_TRANSITIONS[from] || !BOOKING_TRANSITIONS[from].has(to)) {
    const err = new Error(`INVALID_BOOKING_STATE: ${from} -> ${to}`);
    err.statusCode = 409;
    throw err;
  }
  return true;
};

const transitionBookingStatus = async (booking, nextStatus, actor = {}) => {
  const current = String(booking.bookingStatus || 'pending');
  assertValidBookingTransition(current, nextStatus);
  if (current === nextStatus) return booking;

  appendStatusHistory(booking, current, nextStatus, actor);
  booking.bookingStatus = nextStatus;
  const now = new Date();
  if (nextStatus === 'confirmed') booking.confirmedAt = booking.confirmedAt || now;
  if (nextStatus === 'cancelled') booking.cancelledAt = booking.cancelledAt || now;
  if (nextStatus === 'expired') booking.expiredAt = booking.expiredAt || now;
  if (nextStatus === 'payment_failed') booking.paymentFailedAt = booking.paymentFailedAt || now;
  if (nextStatus === 'checked_in') booking.checkedInAt = booking.checkedInAt || now;
  if (nextStatus === 'checked_out') booking.checkedOutAt = booking.checkedOutAt || now;
  return booking;
};

const hasExpectedInventoryLocks = async (booking) => {
  const expected = getExpectedRoomNightLockCount(booking);
  if (!expected) return !isLodgingBooking(booking);
  const actual = await RoomUnitBookingDay.countDocuments({ bookingId: booking._id });
  return actual === expected;
};

const releaseBookingInventory = async (bookingOrId, { processWaitlist = true } = {}) => {
  const booking = typeof bookingOrId === 'object' && bookingOrId?._id
    ? bookingOrId
    : await Booking.findById(bookingOrId);
  if (!booking) return { released: 0 };

  const result = await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
  booking.inventoryReleasedAt = booking.inventoryReleasedAt || new Date();
  if (typeof booking.save === 'function') await booking.save();

  if (processWaitlist && booking.roomTypeId) {
    try {
      await processRoomTypeWaitlist({ roomTypeId: booking.roomTypeId, max: 50 });
    } catch {
      // best-effort only; releasing locks remains authoritative
    }
  }

  return { released: result.deletedCount || 0 };
};

const tryReserveRoomUnitsForBooking = async ({
  booking,
  hotel,
  roomType,
  units = [],
  daysToReserve = [],
  blockedSet = new Set(),
  hasPet = false,
  roomQuantity = 1,
  LockModel = RoomUnitBookingDay,
}) => {
  const requiredRooms = Math.max(1, Math.floor(Number(roomQuantity || 1)));
  const candidates = units.filter((unit) => {
    if (String(unit?.hotelId || '') !== String(hotel?._id || '')) return false;
    if (String(unit?.roomTypeId || '') !== String(roomType?._id || '')) return false;
    if (blockedSet.has(String(unit._id))) return false;
    const effectivePetsAllowed =
      Boolean(hotel?.petsAllowed) &&
      (unit.petsAllowedOverride === null || typeof unit.petsAllowedOverride === 'undefined'
        ? Boolean(roomType?.petsAllowed)
        : Boolean(unit.petsAllowedOverride));
    return !hasPet || effectivePetsAllowed;
  });

  const visitCandidateSets = async (start, selectedUnits) => {
    if (selectedUnits.length === requiredRooms) {
      const lockDocs = selectedUnits.flatMap((unit) =>
        daysToReserve.map((d) => ({
          hotelId: hotel._id,
          roomTypeId: roomType._id,
          roomUnitId: unit._id,
          bookingId: booking._id,
          date: d,
        }))
      );
      try {
        await LockModel.insertMany(lockDocs, { ordered: true });
        return selectedUnits;
      } catch (err) {
        await LockModel.deleteMany({ bookingId: booking._id });
        if (String(err?.code) === '11000') return null;
        throw err;
      }
    }

    for (let i = start; i <= candidates.length - (requiredRooms - selectedUnits.length); i += 1) {
      const result = await visitCandidateSets(i + 1, [...selectedUnits, candidates[i]]);
      if (result) return result;
    }
    return null;
  };

  const selectedUnits = await visitCandidateSets(0, []);
  return selectedUnits || [];
};

const markBookingPaymentPaid = async (booking, meta = {}) => {
  if (!booking) return booking;
  if (TERMINAL_BOOKING_STATUSES.has(String(booking.bookingStatus || ''))) {
    const err = new Error('INVALID_BOOKING_STATE');
    err.statusCode = 409;
    throw err;
  }

  booking.paymentProvider = meta.paymentProvider || booking.paymentProvider || 'razorpay';
  booking.razorpayOrderId = meta.orderId || booking.razorpayOrderId;
  booking.razorpayPaymentId = meta.paymentId || booking.razorpayPaymentId;
  booking.razorpaySignature = meta.signature || booking.razorpaySignature;
  booking.razorpayStatus = meta.status || booking.razorpayStatus;
  booking.paymentStatus = 'paid';
  booking.verificationStage = 'verified';
  booking.partnerPaymentVerified = true;
  booking.partnerPaymentVerifiedAt = booking.partnerPaymentVerifiedAt || new Date();
  booking.adminPaymentVerified = true;
  booking.adminPaymentVerifiedAt = booking.adminPaymentVerifiedAt || new Date();
  booking.paidAt = booking.paidAt || new Date();

  const wasConfirmed = String(booking.bookingStatus || '') === 'confirmed';
  if (!isLodgingBooking(booking) || await hasExpectedInventoryLocks(booking)) {
    await transitionBookingStatus(booking, 'confirmed', meta);
  }

  await booking.save();
  if (!wasConfirmed && String(booking.bookingStatus || '') === 'confirmed') {
    try {
      await ensureBookingConfirmedAlarmNotifications(booking);
    } catch (err) {
      console.warn('[booking.confirmed.notification_failed]', err?.message || err);
    }
  }
  return booking;
};

const markBookingPaymentFailed = async (booking, meta = {}) => {
  if (!booking || booking.paymentStatus === 'paid') return booking;
  const status = String(booking.bookingStatus || 'pending');
  if (status !== 'payment_failed') {
    if (!TERMINAL_BOOKING_STATUSES.has(status)) {
      await transitionBookingStatus(booking, 'payment_failed', meta);
    }
  }
  booking.paymentProvider = meta.paymentProvider || booking.paymentProvider || 'razorpay';
  booking.razorpayPaymentId = meta.paymentId || booking.razorpayPaymentId;
  booking.razorpayStatus = meta.status || 'failed';
  booking.paymentStatus = 'failed';
  booking.verificationStage = 'rejected';
  booking.partnerPaymentVerified = false;
  booking.adminPaymentVerified = false;
  booking.adminPaymentVerifiedAt = null;
  booking.payout_status = 'cancelled';
  await booking.save();
  await releaseBookingInventory(booking);
  return booking;
};

const expirePendingBookings = async ({ now = new Date(), limit = 100, beforeExpireBooking } = {}) => {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const bookings = await Booking.find({
    bookingStatus: 'pending',
    paymentStatus: 'pending',
    paymentHoldExpiresAt: { $lte: now },
  })
    .sort({ paymentHoldExpiresAt: 1, createdAt: 1 })
    .limit(safeLimit);

  let expired = 0;
  for (const booking of bookings) {
    try {
      if (typeof beforeExpireBooking === 'function') {
        const decision = await beforeExpireBooking(booking);
        if (decision && decision.expire === false) {
          continue;
        }
      }
      const claimed = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          bookingStatus: 'pending',
          paymentStatus: 'pending',
          paymentHoldExpiresAt: { $lte: now },
        },
        {
          $set: {
            bookingStatus: 'expired',
            paymentStatus: 'expired',
            verificationStage: 'rejected',
            payout_status: 'cancelled',
            expiredAt: new Date(),
          },
          $push: {
            statusHistory: {
              from: 'pending',
              to: 'expired',
              at: new Date(),
              actorRole: 'system',
              reason: 'payment_hold_expired',
            },
          },
        },
        { new: true }
      );
      if (!claimed) {
        continue;
      }
      await releaseBookingInventory(claimed);
      expired += 1;
    } catch {
      // Another caller may have moved the booking first; expiration remains idempotent.
    }
  }

  return { scanned: bookings.length, expired };
};

module.exports = {
  BOOKING_TRANSITIONS,
  TERMINAL_BOOKING_STATUSES,
  assertValidBookingTransition,
  transitionBookingStatus,
  getExpectedRoomNightLockCount,
  getPaymentHoldMinutes,
  getPaymentHoldExpiresAt,
  hasExpectedInventoryLocks,
  tryReserveRoomUnitsForBooking,
  releaseBookingInventory,
  markBookingPaymentPaid,
  markBookingPaymentFailed,
  expirePendingBookings,
  isLodgingBooking,
};
