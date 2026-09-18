const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-4-4-expiration-secret';

const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const User = require('../models/User');
const PaymentReconciliation = require('../models/PaymentReconciliation');
const { expirePendingBookings } = require('../utils/reservationLifecycle');
const { processBookingExpirationJob } = require('../utils/bookingExpirationJobs');

const TEST_DB_NAME = 'vrindavan_sarthi_test';
const TEST_MONGO_URI = process.env.PHASE_2_1_MONGO_URI;
const TEST_CONNECT_TIMEOUT_MS = 10_000;
const TEST_SERVER_SELECTION_TIMEOUT_MS = 15_000;
const TEST_RUN = `phase44-exp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let setupError = null;

const getConfiguredTestDbName = () => {
  if (!TEST_MONGO_URI) throw new Error('PHASE_2_1_MONGO_URI is required for Phase 4.4 expiration Atlas tests');
  return new URL(TEST_MONGO_URI).pathname.replace('/', '');
};

const mustUseSafeTestDatabase = () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing Phase 4.4 expiration tests with NODE_ENV=production');
  const dbName = mongoose.connection.db?.databaseName || getConfiguredTestDbName();
  if (dbName !== TEST_DB_NAME) throw new Error(`Refusing cleanup against non-test database: ${dbName}`);
};

const cleanup = async () => {
  mustUseSafeTestDatabase();
  const [users, hotels, bookings] = await Promise.all([
    User.find({ email: /@phase44-exp\.test$/ }).select('_id').lean(),
    Hotel.find({ name: /^P44 Exp / }).select('_id').lean(),
    Booking.find({ bookingId: /^P44EXP-/ }).select('_id').lean(),
  ]);
  const userIds = users.map((d) => d._id);
  const hotelIds = hotels.map((d) => d._id);
  const bookingIds = bookings.map((d) => d._id);
  await Promise.all([
    PaymentReconciliation.deleteMany({ $or: [{ bookingId: { $in: bookingIds } }, { reconciliationKey: /P44EXP|phase44-exp/ }] }),
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
    await Promise.all([Booking, Hotel, RoomType, RoomUnit, RoomUnitBookingDay, User, PaymentReconciliation].map((Model) => Model.createIndexes()));
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
  listPaymentsForOrder: async () => {
    if (error) throw error;
    return { items: items || (payment ? [payment] : []) };
  },
  getPayment: async () => {
    if (error) throw error;
    return payment;
  },
});

const fixture = async ({
  bookingStatus = 'pending',
  paymentStatus = 'pending',
  expiresAt = new Date(Date.now() - 60 * 1000),
  paymentProvider = 'manual_upi',
  quantity = 1,
  secondBooking = false,
} = {}) => {
  const customer = await User.create({
    name: 'P44 Exp Customer',
    email: `customer-${TEST_RUN}-${Date.now()}-${Math.random().toString(16).slice(2)}@phase44-exp.test`,
    phone: '9100000000',
    password: 'password123',
  });
  const partner = await User.create({
    name: 'P44 Exp Partner',
    email: `partner-${TEST_RUN}-${Date.now()}-${Math.random().toString(16).slice(2)}@phase44-exp.test`,
    phone: '9100000001',
    password: 'password123',
    role: 'partner',
    partnerStatus: 'approved',
  });
  const hotel = await Hotel.create({
    name: `P44 Exp Hotel ${TEST_RUN}`,
    partnerId: partner._id,
    location: 'Vrindavan',
    googleMapLink: 'https://maps.example.test',
    nearestTemple: 'Banke Bihari',
  });
  const roomType = await RoomType.create({ hotelId: hotel._id, partnerId: partner._id, name: `P44 Exp Room ${TEST_RUN}`, pricePerNight: 1000, status: 'active' });
  const units = [];
  for (let i = 0; i < Math.max(quantity, 2); i += 1) {
    units.push(await RoomUnit.create({ hotelId: hotel._id, roomTypeId: roomType._id, partnerId: partner._id, number: `P44E-${Date.now()}-${i}`, status: 'available' }));
  }
  const booking = await Booking.create({
    bookingId: `P44EXP-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bookingType: 'room_type',
    itemId: String(roomType._id),
    itemName: hotel.name,
    userId: customer._id,
    userName: customer.name,
    userEmail: customer.email,
    partnerId: partner._id,
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    roomUnitIds: units.slice(0, quantity).map((u) => u._id),
    roomQuantity: quantity,
    checkIn: date('2026-10-10'),
    checkOut: date('2026-10-11'),
    totalAmount: 1000 * quantity,
    advanceAmount: 1000 * quantity,
    paymentOption: 'full_100',
    paymentProvider,
    paymentStatus,
    bookingStatus,
    razorpayOrderId: paymentProvider === 'razorpay' ? `order_p44_exp_${Date.now()}_${Math.random().toString(16).slice(2)}` : undefined,
    paymentHoldExpiresAt: expiresAt,
  });
  for (const unit of units.slice(0, quantity)) {
    await RoomUnitBookingDay.create({ hotelId: hotel._id, roomTypeId: roomType._id, roomUnitId: unit._id, bookingId: booking._id, date: date('2026-10-10') });
  }
  let otherBooking;
  if (secondBooking) {
    otherBooking = await Booking.create({
      bookingId: `P44EXP-OTHER-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      bookingType: 'room_type',
      itemId: String(roomType._id),
      itemName: hotel.name,
      userId: customer._id,
      partnerId: partner._id,
      hotelId: hotel._id,
      roomTypeId: roomType._id,
      roomUnitIds: [units[1]._id],
      roomQuantity: 1,
      checkIn: date('2026-10-11'),
      checkOut: date('2026-10-12'),
      totalAmount: 1000,
      advanceAmount: 1000,
      paymentProvider: 'manual_upi',
      paymentStatus: 'pending',
      bookingStatus: 'pending',
      paymentHoldExpiresAt: expiresAt,
    });
    await RoomUnitBookingDay.create({ hotelId: hotel._id, roomTypeId: roomType._id, roomUnitId: units[1]._id, bookingId: otherBooking._id, date: date('2026-10-11') });
  }
  return { booking, otherBooking, units };
};

dbTest('stale pending booking expires', async () => {
  const { booking } = await fixture();
  const result = await expirePendingBookings();
  assert.equal(result.expired, 1);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'expired');
});

dbTest('expiration releases inventory', async () => {
  const { booking } = await fixture();
  await expirePendingBookings();
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
});

dbTest('expiration releases inventory exactly once', async () => {
  const { booking } = await fixture();
  await expirePendingBookings();
  const second = await expirePendingBookings();
  assert.equal(second.expired, 0);
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
});

dbTest('repeated expiration is safe', async () => {
  const { booking } = await fixture();
  await expirePendingBookings();
  await expirePendingBookings();
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'expired');
});

dbTest('concurrent expiration attempts are safe', async () => {
  const { booking } = await fixture();
  const [a, b] = await Promise.all([expirePendingBookings(), expirePendingBookings()]);
  assert.equal(a.expired + b.expired, 1);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'expired');
});

dbTest('confirmed booking never expires', async () => {
  const { booking } = await fixture({ bookingStatus: 'confirmed', paymentStatus: 'paid' });
  const result = await expirePendingBookings();
  assert.equal(result.expired, 0);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'confirmed');
});

dbTest('paid booking never expires', async () => {
  const { booking } = await fixture({ paymentStatus: 'paid' });
  const result = await expirePendingBookings();
  assert.equal(result.expired, 0);
  assert.equal((await Booking.findById(booking._id)).paymentStatus, 'paid');
});

dbTest('cancelled booking never expires', async () => {
  const { booking } = await fixture({ bookingStatus: 'cancelled' });
  const result = await expirePendingBookings();
  assert.equal(result.expired, 0);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'cancelled');
});

dbTest('future hold does not expire', async () => {
  const { booking } = await fixture({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  const result = await expirePendingBookings();
  assert.equal(result.expired, 0);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'pending');
});

dbTest('payment_failed booking does not expire', async () => {
  const { booking } = await fixture({ bookingStatus: 'payment_failed', paymentStatus: 'failed' });
  const result = await expirePendingBookings();
  assert.equal(result.expired, 0);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'payment_failed');
});

dbTest('Razorpay captured payment is not blindly expired', async () => {
  const { booking } = await fixture({ paymentProvider: 'razorpay' });
  const result = await processBookingExpirationJob({}, {
    provider: provider({ payment: { id: 'pay_p44_exp_captured', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'captured' } }),
  });
  assert.equal(result.expired, 0);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'pending');
  assert.equal(await PaymentReconciliation.countDocuments({ bookingId: booking._id, reconciliationStatus: 'reconciliation_required' }), 1);
});

dbTest('Razorpay failed payment can safely expire', async () => {
  const { booking } = await fixture({ paymentProvider: 'razorpay' });
  const result = await processBookingExpirationJob({}, {
    provider: provider({ payment: { id: 'pay_p44_exp_failed', order_id: booking.razorpayOrderId, amount: 100000, currency: 'INR', status: 'failed' } }),
  });
  assert.equal(result.expired, 1);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'expired');
});

dbTest('provider unknown state does not cause destructive expiration', async () => {
  const { booking } = await fixture({ paymentProvider: 'razorpay' });
  const err = new Error('provider timeout');
  err.code = 'ETIMEDOUT';
  const result = await processBookingExpirationJob({}, { provider: provider({ error: err }) });
  assert.equal(result.expired, 0);
  assert.equal((await Booking.findById(booking._id)).bookingStatus, 'pending');
});

dbTest('expiration preserves other booking inventory', async () => {
  const { booking, otherBooking } = await fixture({ secondBooking: true });
  await expirePendingBookings({ limit: 1 });
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: otherBooking._id }), 1);
});

dbTest('quantity=2 inventory is released correctly', async () => {
  const { booking } = await fixture({ quantity: 2 });
  await expirePendingBookings();
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
});
