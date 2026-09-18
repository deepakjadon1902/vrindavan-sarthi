const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const {
  assertValidBookingTransition,
  getExpectedRoomNightLockCount,
  getPaymentHoldMinutes,
  getPaymentHoldExpiresAt,
  releaseBookingInventory,
  expirePendingBookings,
  tryReserveRoomUnitsForBooking,
  markBookingPaymentPaid,
  markBookingPaymentFailed,
} = require('../utils/reservationLifecycle');

const oid = () => new mongoose.Types.ObjectId();
const saveableBooking = (fields = {}) => ({
  _id: oid(),
  bookingType: 'room_type',
  bookingStatus: 'pending',
  paymentStatus: 'pending',
  roomQuantity: 1,
  checkIn: new Date('2026-10-10T00:00:00.000Z'),
  checkOut: new Date('2026-10-11T00:00:00.000Z'),
  saveCount: 0,
  async save() { this.saveCount += 1; return this; },
  ...fields,
});

test('Booking schema supports Phase 2 lifecycle states and audit timestamps', () => {
  assert.ok(Booking.schema.path('bookingStatus').enumValues.includes('expired'));
  assert.ok(Booking.schema.path('bookingStatus').enumValues.includes('payment_failed'));
  assert.ok(Booking.schema.path('paymentStatus').enumValues.includes('expired'));
  assert.ok(Booking.schema.path('paymentHoldExpiresAt'));
  assert.ok(Booking.schema.path('confirmedAt'));
  assert.ok(Booking.schema.path('checkedOutAt'));
  assert.ok(Booking.schema.path('expiredAt'));
  assert.ok(Booking.schema.path('paymentFailedAt'));
  assert.ok(Booking.schema.path('inventoryReleasedAt'));
  assert.ok(Booking.schema.path('statusHistory'));
});

test('controlled booking state machine allows only intended lifecycle transitions', () => {
  assert.equal(assertValidBookingTransition('pending', 'confirmed'), true);
  assert.equal(assertValidBookingTransition('pending', 'payment_failed'), true);
  assert.equal(assertValidBookingTransition('pending', 'expired'), true);
  assert.equal(assertValidBookingTransition('confirmed', 'checked_in'), true);
  assert.equal(assertValidBookingTransition('confirmed', 'cancelled'), true);
  assert.equal(assertValidBookingTransition('checked_in', 'checked_out'), true);

  assert.throws(() => assertValidBookingTransition('cancelled', 'confirmed'), /INVALID_BOOKING_STATE/);
  assert.throws(() => assertValidBookingTransition('expired', 'confirmed'), /INVALID_BOOKING_STATE/);
  assert.throws(() => assertValidBookingTransition('payment_failed', 'checked_in'), /INVALID_BOOKING_STATE/);
  assert.throws(() => assertValidBookingTransition('pending', 'checked_in'), /INVALID_BOOKING_STATE/);
});

test('date semantics and quantity produce correct room-night counts', () => {
  assert.equal(getExpectedRoomNightLockCount(saveableBooking()), 1);
  assert.equal(getExpectedRoomNightLockCount(saveableBooking({
    checkOut: new Date('2026-10-13T00:00:00.000Z'),
  })), 3);
  assert.equal(getExpectedRoomNightLockCount(saveableBooking({
    roomQuantity: 2,
    checkOut: new Date('2026-10-13T00:00:00.000Z'),
  })), 6);
  assert.equal(getExpectedRoomNightLockCount(saveableBooking({
    checkOut: new Date('2026-10-10T00:00:00.000Z'),
  })), 0);
});

test('payment hold expiration default is bounded and configurable', () => {
  const original = process.env.BOOKING_PAYMENT_HOLD_MINUTES;
  try {
    delete process.env.BOOKING_PAYMENT_HOLD_MINUTES;
    assert.equal(getPaymentHoldMinutes(), 30);
    process.env.BOOKING_PAYMENT_HOLD_MINUTES = '5';
    assert.equal(getPaymentHoldMinutes(), 5);
    process.env.BOOKING_PAYMENT_HOLD_MINUTES = '-99';
    assert.equal(getPaymentHoldMinutes(), 30);

    const base = new Date('2026-10-10T00:00:00.000Z');
    process.env.BOOKING_PAYMENT_HOLD_MINUTES = '10';
    assert.equal(getPaymentHoldExpiresAt(base).toISOString(), '2026-10-10T00:10:00.000Z');
  } finally {
    if (typeof original === 'undefined') delete process.env.BOOKING_PAYMENT_HOLD_MINUTES;
    else process.env.BOOKING_PAYMENT_HOLD_MINUTES = original;
  }
});

test('inventory release deletes only locks for the booking and is safe to repeat', async () => {
  const originalDeleteMany = RoomUnitBookingDay.deleteMany;
  const booking = saveableBooking();
  const seenQueries = [];
  let remaining = 3;

  RoomUnitBookingDay.deleteMany = async (query) => {
    seenQueries.push(query);
    const deletedCount = remaining;
    remaining = 0;
    return { deletedCount };
  };

  try {
    const first = await releaseBookingInventory(booking, { processWaitlist: false });
    const second = await releaseBookingInventory(booking, { processWaitlist: false });

    assert.equal(first.released, 3);
    assert.equal(second.released, 0);
    assert.deepEqual(seenQueries, [{ bookingId: booking._id }, { bookingId: booking._id }]);
    assert.ok(booking.inventoryReleasedAt instanceof Date);
  } finally {
    RoomUnitBookingDay.deleteMany = originalDeleteMany;
  }
});

test('expiration service queries bounded eligible pending holds and releases inventory', async () => {
  const originalFind = Booking.find;
  const originalFindOneAndUpdate = Booking.findOneAndUpdate;
  const originalDeleteMany = RoomUnitBookingDay.deleteMany;
  const expiredBooking = saveableBooking({ paymentHoldExpiresAt: new Date('2026-10-10T00:00:00.000Z') });
  let capturedQuery = null;
  let capturedClaimQuery = null;
  let capturedLimit = null;
  let released = 0;

  Booking.find = (query) => {
    capturedQuery = query;
    return {
      sort() { return this; },
      limit(value) { capturedLimit = value; return [expiredBooking]; },
    };
  };
  Booking.findOneAndUpdate = async (query, update) => {
    capturedClaimQuery = query;
    Object.assign(expiredBooking, update.$set);
    return expiredBooking;
  };
  RoomUnitBookingDay.deleteMany = async () => {
    released += 1;
    return { deletedCount: 1 };
  };

  try {
    const result = await expirePendingBookings({ now: new Date('2026-10-10T00:30:00.000Z'), limit: 9999 });
    assert.equal(result.scanned, 1);
    assert.equal(result.expired, 1);
    assert.equal(capturedQuery.bookingStatus, 'pending');
    assert.equal(capturedQuery.paymentStatus, 'pending');
    assert.deepEqual(capturedQuery.paymentHoldExpiresAt, { $lte: new Date('2026-10-10T00:30:00.000Z') });
    assert.equal(capturedClaimQuery.bookingStatus, 'pending');
    assert.equal(capturedClaimQuery.paymentStatus, 'pending');
    assert.equal(capturedLimit, 500);
    assert.equal(expiredBooking.bookingStatus, 'expired');
    assert.equal(expiredBooking.paymentStatus, 'expired');
    assert.equal(released, 1);
  } finally {
    Booking.find = originalFind;
    Booking.findOneAndUpdate = originalFindOneAndUpdate;
    RoomUnitBookingDay.deleteMany = originalDeleteMany;
  }
});

test('payment success and failure are idempotent and inventory-aware', async () => {
  const originalCountDocuments = RoomUnitBookingDay.countDocuments;
  const originalDeleteMany = RoomUnitBookingDay.deleteMany;
  const booking = saveableBooking({
    roomQuantity: 1,
    checkOut: new Date('2026-10-12T00:00:00.000Z'),
    bookingId: 'VVS-2026-12345',
  });
  let deleteCalls = 0;

  RoomUnitBookingDay.countDocuments = async () => 2;
  RoomUnitBookingDay.deleteMany = async () => {
    deleteCalls += 1;
    return { deletedCount: 2 };
  };

  try {
    await markBookingPaymentPaid(booking, { paymentProvider: 'razorpay', paymentId: 'pay_1', actorRole: 'system' });
    await markBookingPaymentPaid(booking, { paymentProvider: 'razorpay', paymentId: 'pay_1', actorRole: 'system' });
    assert.equal(booking.paymentStatus, 'paid');
    assert.equal(booking.bookingStatus, 'confirmed');
    assert.equal(booking.statusHistory.length, 1);

    const failed = saveableBooking();
    await markBookingPaymentFailed(failed, { status: 'failed', actorRole: 'system' });
    await markBookingPaymentFailed(failed, { status: 'failed', actorRole: 'system' });
    assert.equal(failed.paymentStatus, 'failed');
    assert.equal(failed.bookingStatus, 'payment_failed');
    assert.equal(deleteCalls, 2);
  } finally {
    RoomUnitBookingDay.countDocuments = originalCountDocuments;
    RoomUnitBookingDay.deleteMany = originalDeleteMany;
  }
});

test('concurrent room-night lock acquisition allows only one booking for one physical room date', async () => {
  const lockKeys = new Set();
  const insertCalls = [];
  const LockModel = {
    async insertMany(rows) {
      await new Promise((resolve) => setImmediate(resolve));
      const key = `${rows[0].roomUnitId}:${rows[0].date.toISOString().slice(0, 10)}`;
      if (lockKeys.has(key)) {
        const err = new Error('duplicate key');
        err.code = 11000;
        throw err;
      }
      lockKeys.add(key);
      insertCalls.push(rows);
      return rows;
    },
    async deleteMany() { return { deletedCount: 0 }; },
  };

  const hotel = { _id: oid(), petsAllowed: false };
  const roomType = { _id: oid(), petsAllowed: false };
  const unit = { _id: oid(), hotelId: hotel._id, roomTypeId: roomType._id, number: '101' };
  const daysToReserve = [new Date('2026-10-10T00:00:00.000Z')];

  const attempts = await Promise.all([
    tryReserveRoomUnitsForBooking({ booking: saveableBooking(), hotel, roomType, units: [unit], daysToReserve, roomQuantity: 1, LockModel }),
    tryReserveRoomUnitsForBooking({ booking: saveableBooking(), hotel, roomType, units: [unit], daysToReserve, roomQuantity: 1, LockModel }),
  ]);

  assert.equal(attempts.filter((units) => units.length === 1).length, 1);
  assert.equal(attempts.filter((units) => units.length === 0).length, 1);
  assert.equal(lockKeys.size, 1);
  assert.equal(insertCalls.length, 1);
});
