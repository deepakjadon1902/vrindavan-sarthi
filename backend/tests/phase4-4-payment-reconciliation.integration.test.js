const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-4-4-integration-secret';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_phase44';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'phase44_razorpay_secret';

const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const User = require('../models/User');
const PaymentReconciliation = require('../models/PaymentReconciliation');
const { processPaymentReconciliationJob } = require('../utils/paymentReconciliation');

const TEST_DB_NAME = 'vrindavan_sarthi_test';
const TEST_MONGO_URI = process.env.PHASE_2_1_MONGO_URI;
const TEST_CONNECT_TIMEOUT_MS = 10_000;
const TEST_SERVER_SELECTION_TIMEOUT_MS = 15_000;
const TEST_RUN = `phase44-pay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let setupError = null;

const getConfiguredTestDbName = () => {
  if (!TEST_MONGO_URI) throw new Error('PHASE_2_1_MONGO_URI is required for Phase 4.4 Atlas integration tests');
  return new URL(TEST_MONGO_URI).pathname.replace('/', '');
};

const mustUseSafeTestDatabase = () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing Phase 4.4 tests with NODE_ENV=production');
  const dbName = mongoose.connection.db?.databaseName || getConfiguredTestDbName();
  if (dbName !== TEST_DB_NAME) throw new Error(`Refusing cleanup against non-test database: ${dbName}`);
};

const cleanup = async () => {
  mustUseSafeTestDatabase();
  const [users, hotels, bookings, modifications] = await Promise.all([
    User.find({ email: /@phase44\.test$/ }).select('_id').lean(),
    Hotel.find({ name: /^P44 / }).select('_id').lean(),
    Booking.find({ bookingId: /^P44-/ }).select('_id').lean(),
    BookingModification.find({ idempotencyKey: /^p44-/ }).select('_id').lean(),
  ]);
  const userIds = users.map((d) => d._id);
  const hotelIds = hotels.map((d) => d._id);
  const bookingIds = bookings.map((d) => d._id);
  const modificationIds = modifications.map((d) => d._id);
  await Promise.all([
    PaymentReconciliation.deleteMany({
      $or: [{ bookingId: { $in: bookingIds } }, { modificationId: { $in: modificationIds } }, { reconciliationKey: /phase44|P44|p44/ }],
    }),
    BookingModification.deleteMany({ _id: { $in: modificationIds } }),
    RoomUnitBookingDay.deleteMany({ $or: [{ bookingId: { $in: bookingIds } }, { hotelId: { $in: hotelIds } }] }),
    Booking.deleteMany({ _id: { $in: bookingIds } }),
    RoomUnit.deleteMany({ hotelId: { $in: hotelIds } }),
    RoomType.deleteMany({ hotelId: { $in: hotelIds } }),
    Hotel.deleteMany({ _id: { $in: hotelIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
};

test.before(async () => {
  try {
    mustUseSafeTestDatabase();
    await mongoose.connect(TEST_MONGO_URI, {
      serverSelectionTimeoutMS: TEST_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: TEST_CONNECT_TIMEOUT_MS,
    });
    mustUseSafeTestDatabase();
    await Promise.all([Booking, BookingModification, Hotel, RoomType, RoomUnit, RoomUnitBookingDay, User, PaymentReconciliation].map((Model) => Model.createIndexes()));
    await cleanup();
  } catch (err) {
    setupError = err;
  }
});

test.after(async () => {
  if (!setupError && mongoose.connection.readyState === 1) await cleanup();
  await mongoose.disconnect();
});

test.afterEach(async () => {
  if (!setupError && mongoose.connection.readyState === 1) await cleanup();
});

const dbTest = (name, fn) => test(name, async (t) => {
  if (setupError) {
    t.skip(`BLOCKED - SAFE TEST DATABASE UNAVAILABLE: ${setupError.message}`);
    return;
  }
  return fn(t);
});

test('safe isolated MongoDB test database is available', () => {
  assert.ifError(setupError);
  assert.equal(mongoose.connection.db.databaseName, TEST_DB_NAME);
});

const date = (value) => new Date(`${value}T00:00:00.000Z`);

const provider = ({ payment, items, error } = {}) => ({
  getPayment: async () => {
    if (error) throw error;
    return payment;
  },
  listPaymentsForOrder: async () => {
    if (error) throw error;
    return { items: items || (payment ? [payment] : []) };
  },
});

const fixture = async ({ status = 'pending', paymentStatus = 'pending', withLock = true } = {}) => {
  const customer = await User.create({
    name: 'P44 Customer',
    email: `customer-${TEST_RUN}-${Date.now()}@phase44.test`,
    phone: '9000000000',
    password: 'password123',
  });
  const partner = await User.create({
    name: 'P44 Partner',
    email: `partner-${TEST_RUN}-${Date.now()}@phase44.test`,
    phone: '9000000001',
    password: 'password123',
    role: 'partner',
    partnerStatus: 'approved',
  });
  const hotel = await Hotel.create({
    name: `P44 Hotel ${TEST_RUN}`,
    partnerId: partner._id,
    location: 'Vrindavan',
    googleMapLink: 'https://maps.example.test',
    nearestTemple: 'Banke Bihari',
  });
  const roomType = await RoomType.create({ hotelId: hotel._id, partnerId: partner._id, name: `P44 Room ${TEST_RUN}`, pricePerNight: 1000, status: 'active' });
  const unit = await RoomUnit.create({ hotelId: hotel._id, roomTypeId: roomType._id, partnerId: partner._id, number: `P44-${Date.now()}`, status: 'available' });
  const booking = await Booking.create({
    bookingId: `P44-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bookingType: 'room_type',
    itemId: String(roomType._id),
    itemName: hotel.name,
    userId: customer._id,
    userName: customer.name,
    userEmail: customer.email,
    partnerId: partner._id,
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    roomUnitIds: [unit._id],
    roomQuantity: 1,
    checkIn: date('2026-10-10'),
    checkOut: date('2026-10-11'),
    totalAmount: 1000,
    advanceAmount: 1000,
    paymentOption: 'full_100',
    paymentProvider: 'razorpay',
    paymentStatus,
    bookingStatus: status,
    razorpayOrderId: `order_p44_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    paymentHoldExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  if (withLock) {
    await RoomUnitBookingDay.create({ hotelId: hotel._id, roomTypeId: roomType._id, roomUnitId: unit._id, bookingId: booking._id, date: date('2026-10-10') });
  }
  return { booking, customer, partner, hotel, roomType, unit };
};

dbTest('pending booking + captured provider payment reconciles', async () => {
  const { booking } = await fixture();
  await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ payment: { id: 'pay_p44_captured', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' } }),
  });
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.paymentStatus, 'paid');
  assert.equal(updated.bookingStatus, 'confirmed');
});

dbTest('pending booking + failed provider payment becomes payment_failed', async () => {
  const { booking } = await fixture();
  await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ payment: { id: 'pay_p44_failed', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'failed' } }),
  });
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.paymentStatus, 'failed');
  assert.equal(updated.bookingStatus, 'payment_failed');
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
});

dbTest('captured payment amount mismatch becomes reconciliation_required', async () => {
  const { booking } = await fixture();
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ payment: { id: 'pay_p44_amount', order_id: booking.razorpayOrderId, amount: 99000, currency: 'INR', status: 'captured' } }),
  });
  assert.equal(record.reconciliationStatus, 'reconciliation_required');
  assert.equal((await Booking.findById(booking._id)).paymentStatus, 'pending');
});

dbTest('captured payment currency mismatch becomes reconciliation_required', async () => {
  const { booking } = await fixture();
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ payment: { id: 'pay_p44_currency', order_id: booking.razorpayOrderId, amount: 100000, currency: 'USD', status: 'captured' } }),
  });
  assert.equal(record.reconciliationStatus, 'reconciliation_required');
});

dbTest('captured payment for expired booking does not confirm booking', async () => {
  const { booking } = await fixture({ status: 'expired', paymentStatus: 'expired', withLock: false });
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ payment: { id: 'pay_p44_expired', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' } }),
  });
  assert.equal(record.reconciliationStatus, 'reconciliation_required');
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'expired');
});

dbTest('captured payment for cancelled booking does not confirm booking', async () => {
  const { booking } = await fixture({ status: 'cancelled', paymentStatus: 'pending', withLock: false });
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ payment: { id: 'pay_p44_cancelled', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' } }),
  });
  assert.equal(record.reconciliationStatus, 'reconciliation_required');
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'cancelled');
});

dbTest('duplicate reconciliation is idempotent', async () => {
  const { booking } = await fixture();
  const fake = provider({ payment: { id: 'pay_p44_dupe', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' } });
  await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, { provider: fake });
  await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, { provider: fake });
  assert.equal(await PaymentReconciliation.countDocuments({ bookingId: booking._id }), 1);
  assert.equal((await Booking.findById(booking._id)).paymentStatus, 'paid');
});

dbTest('two concurrent reconciliation jobs do not double-confirm', async () => {
  const { booking } = await fixture();
  const fake = provider({ payment: { id: 'pay_p44_concurrent', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' } });
  await Promise.allSettled([
    processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, { provider: fake }),
    processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, { provider: fake }),
  ]);
  assert.equal(await PaymentReconciliation.countDocuments({ bookingId: booking._id }), 1);
  assert.equal((await Booking.findById(booking._id)).paymentStatus, 'paid');
});

dbTest('modification payment reconciles safely when already completed', async () => {
  const { booking } = await fixture({ status: 'confirmed', paymentStatus: 'paid' });
  const modification = await BookingModification.create({
    bookingId: booking._id,
    actorId: booking.userId,
    actorRole: 'user',
    idempotencyKey: `p44-${Date.now()}`,
    status: 'completed',
    action: 'additional_payment',
    paymentAction: 'additional_payment',
    paymentStatus: 'paid',
    differenceAmount: 500,
    razorpayOrderId: `order_p44_mod_${Date.now()}`,
    razorpayPaymentId: 'pay_p44_mod',
  });
  const record = await processPaymentReconciliationJob({ targetType: 'modification', targetId: String(modification._id) }, {
    provider: provider({ payment: { id: 'pay_p44_mod', order_id: modification.razorpayOrderId, amount: 50000, currency: 'INR', status: 'captured' } }),
  });
  assert.equal(record.reconciliationStatus, 'resolved');
});

dbTest('modification reconciliation does not incorrectly change original booking payment', async () => {
  const { booking } = await fixture({ status: 'confirmed', paymentStatus: 'paid' });
  const beforePaidAt = booking.paidAt;
  const modification = await BookingModification.create({
    bookingId: booking._id,
    actorId: booking.userId,
    actorRole: 'user',
    idempotencyKey: `p44-${Date.now()}`,
    status: 'completed',
    action: 'additional_payment',
    paymentAction: 'additional_payment',
    paymentStatus: 'paid',
    differenceAmount: 500,
    razorpayOrderId: `order_p44_mod2_${Date.now()}`,
    razorpayPaymentId: 'pay_p44_mod2',
  });
  await processPaymentReconciliationJob({ targetType: 'modification', targetId: String(modification._id) }, {
    provider: provider({ payment: { id: 'pay_p44_mod2', order_id: modification.razorpayOrderId, amount: 50000, currency: 'INR', status: 'captured' } }),
  });
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.paymentStatus, 'paid');
  assert.equal(String(updated.paidAt || ''), String(beforePaidAt || ''));
});

dbTest('provider timeout becomes reconciliation_required or retryable', async () => {
  const { booking } = await fixture();
  const err = new Error('timeout');
  err.code = 'ETIMEDOUT';
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, { provider: provider({ error: err }) });
  assert.equal(record.reconciliationStatus, 'reconciliation_required');
});

dbTest('provider 5xx is retryable', async () => {
  const { booking } = await fixture();
  const err = new Error('provider down');
  err.statusCode = 500;
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, { provider: provider({ error: err }) });
  assert.equal(record.reconciliationStatus, 'retry_scheduled');
});

dbTest('wrong order becomes reconciliation_required', async () => {
  const { booking } = await fixture();
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ payment: { id: 'pay_p44_wrong', order_id: 'other_order', amount: 100000, currency: 'INR', status: 'captured' } }),
  });
  assert.equal(record.reconciliationStatus, 'reconciliation_required');
});

dbTest('multiple provider payments becomes reconciliation_required', async () => {
  const { booking } = await fixture();
  const record = await processPaymentReconciliationJob({ targetType: 'booking', targetId: String(booking._id) }, {
    provider: provider({ items: [
      { id: 'pay_p44_multi_1', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' },
      { id: 'pay_p44_multi_2', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' },
    ] }),
  });
  assert.equal(record.reconciliationStatus, 'reconciliation_required');
});
