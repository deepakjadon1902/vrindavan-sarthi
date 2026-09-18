const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const EventEmitter = require('node:events');
const http = require('node:http');
const https = require('node:https');
const test = require('node:test');

const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-2-1-integration-secret';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_phase21';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'phase21_razorpay_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'phase21_webhook_secret';
process.env.BOOKING_PAYMENT_HOLD_MINUTES = process.env.BOOKING_PAYMENT_HOLD_MINUTES || '30';

const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const WebhookEvent = require('../models/WebhookEvent');
const RefundOperation = require('../models/RefundOperation');
const User = require('../models/User');
const bookingRoutes = require('../routes/booking.routes');
const paymentRoutes = require('../routes/payment.routes');
const {
  expirePendingBookings,
  markBookingPaymentFailed,
  releaseBookingInventory,
  transitionBookingStatus,
  tryReserveRoomUnitsForBooking,
} = require('../utils/reservationLifecycle');
const { enumerateDatesUTC, parseDateOnlyToUTC } = require('../utils/date');

const TEST_DB_NAME = 'vrindavan_sarthi_test';
const TEST_MONGO_URI = process.env.PHASE_2_1_MONGO_URI;
const TEST_CONNECT_TIMEOUT_MS = 10_000;
const TEST_SERVER_SELECTION_TIMEOUT_MS = 15_000;
const TEST_RUN = `phase21-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collectionsToClean = [Booking, Hotel, RoomType, RoomUnit, RoomUnitBlock, RoomUnitBookingDay, User];
let setupError = null;

const getConfiguredTestDbName = () => {
  if (!TEST_MONGO_URI) {
    throw new Error('PHASE_2_1_MONGO_URI is required for Phase 2.1 Atlas integration tests');
  }
  return new URL(TEST_MONGO_URI).pathname.replace('/', '');
};

const mustUseSafeTestDatabase = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing Phase 2.1 integration tests with NODE_ENV=production');
  }
  const dbName = mongoose.connection.db?.databaseName || getConfiguredTestDbName();
  if (dbName !== TEST_DB_NAME) {
    throw new Error(`Refusing destructive cleanup against non-test database: ${dbName}`);
  }
};

const cleanup = async () => {
  mustUseSafeTestDatabase();
  const [users, hotels, roomTypes, bookings] = await Promise.all([
    User.find({ email: /@phase21\.test$/ }).select('_id').lean(),
    Hotel.find({ name: /^P21 Hotel / }).select('_id').lean(),
    RoomType.find({ name: /^P21 / }).select('_id').lean(),
    Booking.find({
      $or: [
        { bookingId: /^P21-/ },
        { userEmail: /@phase21\.test$/ },
        { itemName: /^P21 Hotel / },
      ],
    }).select('_id').lean(),
  ]);

  const userIds = users.map((doc) => doc._id);
  const hotelIds = hotels.map((doc) => doc._id);
  const roomTypeIds = roomTypes.map((doc) => doc._id);
  const bookingIds = bookings.map((doc) => doc._id);
  const roomUnits = await RoomUnit.find({
    $or: [
      ...(hotelIds.length ? [{ hotelId: { $in: hotelIds } }] : []),
      ...(roomTypeIds.length ? [{ roomTypeId: { $in: roomTypeIds } }] : []),
    ],
  }).select('_id').lean();
  const roomUnitIds = roomUnits.map((doc) => doc._id);

  const relatedClauses = [
    ...(bookingIds.length ? [{ bookingId: { $in: bookingIds } }] : []),
    ...(hotelIds.length ? [{ hotelId: { $in: hotelIds } }] : []),
    ...(roomTypeIds.length ? [{ roomTypeId: { $in: roomTypeIds } }] : []),
    ...(roomUnitIds.length ? [{ roomUnitId: { $in: roomUnitIds } }] : []),
  ];

  if (relatedClauses.length) {
    const inventoryClauses = relatedClauses.filter((clause) => !clause.bookingId);
    await Promise.all([
      RoomUnitBookingDay.deleteMany({ $or: relatedClauses }),
      ...(inventoryClauses.length ? [RoomUnitBlock.deleteMany({ $or: inventoryClauses })] : []),
    ]);
  }

  const parentDeletes = [
    Booking.deleteMany({
      $or: [
        { bookingId: /^P21-/ },
        { userEmail: /@phase21\.test$/ },
        { itemName: /^P21 Hotel / },
      ],
    }),
    RoomType.deleteMany({
      $or: [
        { name: /^P21 / },
        ...(hotelIds.length ? [{ hotelId: { $in: hotelIds } }] : []),
      ],
    }),
    Hotel.deleteMany({ name: /^P21 Hotel / }),
    User.deleteMany({ email: /@phase21\.test$/ }),
    WebhookEvent.deleteMany({ provider: 'razorpay', eventId: /^evt_phase21/ }),
    ...(bookingIds.length ? [RefundOperation.deleteMany({ bookingId: { $in: bookingIds } })] : []),
  ];
  const roomUnitClauses = [
    ...(hotelIds.length ? [{ hotelId: { $in: hotelIds } }] : []),
    ...(roomTypeIds.length ? [{ roomTypeId: { $in: roomTypeIds } }] : []),
  ];
  if (roomUnitClauses.length) parentDeletes.push(RoomUnit.deleteMany({ $or: roomUnitClauses }));
  await Promise.all(parentDeletes);
};

const date = (value) => parseDateOnlyToUTC(value);
const tokenFor = (user) => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '15m' });
const signPayment = (orderId, paymentId) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
const signWebhook = (rawBody) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

const makeApp = () => {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }));
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);
  return app;
};

const withServer = async (app, fn) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const jsonRequest = async (baseUrl, path, { method = 'POST', token, body, headers = {} } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: typeof body === 'undefined' ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, payload };
};

const createFixture = async ({ rooms = ['101'], partnerHotel = true } = {}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const partner = await User.create({
    __phase21: TEST_RUN,
    name: `P21 Partner ${suffix}`,
    email: `partner-${suffix}@phase21.test`,
    phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'partner',
    partnerStatus: 'approved',
  });
  const customer = await User.create({
    __phase21: TEST_RUN,
    name: `P21 Customer ${suffix}`,
    email: `customer-${suffix}@phase21.test`,
    phone: `8${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'user',
  });
  const admin = await User.create({
    __phase21: TEST_RUN,
    name: `P21 Admin ${suffix}`,
    email: `admin-${suffix}@phase21.test`,
    phone: `7${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'admin',
  });
  const hotel = await Hotel.create({
    __phase21: TEST_RUN,
    name: `P21 Hotel ${suffix}`,
    location: 'Vrindavan',
    googleMapLink: 'https://maps.example.test/p21',
    nearestTemple: 'Banke Bihari',
    status: 'active',
    approvalStatus: 'approved',
    petsAllowed: false,
    taxEnabled: false,
    ...(partnerHotel ? {
      partnerId: partner._id,
      partnerName: partner.name,
      partnerPhone: partner.phone,
    } : {}),
  });
  const roomType = await RoomType.create({
    __phase21: TEST_RUN,
    hotelId: hotel._id,
    partnerId: partnerHotel ? partner._id : undefined,
    name: `P21 Deluxe ${suffix}`,
    pricePerNight: 1000,
    maxAdults: 2,
    maxChildren: 1,
    status: 'active',
  });
  const roomUnits = await RoomUnit.insertMany(rooms.map((number) => ({
    __phase21: TEST_RUN,
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    partnerId: partnerHotel ? partner._id : undefined,
    number,
    status: 'available',
  })));
  return { partner, customer, admin, hotel, roomType, roomUnits };
};

const newBooking = ({ customer, hotel, roomType, checkIn, checkOut, roomQuantity = 1, status = 'pending', paymentStatus = 'pending', provider = 'manual_upi' }) =>
  new Booking({
    __phase21: TEST_RUN,
    bookingId: `P21-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bookingType: 'room_type',
    service_billing_model: 'hotel_marketplace',
    itemId: String(roomType._id),
    itemName: `${hotel.name} - ${roomType.name}`,
    userId: customer._id,
    userName: customer.name,
    userEmail: customer.email,
    userPhone: customer.phone,
    partnerId: hotel.partnerId,
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    checkIn,
    checkOut,
    guests: roomQuantity,
    totalAdults: roomQuantity,
    totalChildren: 0,
    roomQuantity,
    customerFullName: customer.name,
    customerMobile: customer.phone,
    customerEmail: customer.email,
    baseAmount: 1000,
    totalAmount: 1000,
    advanceAmount: 1000,
    paymentOption: 'full_100',
    paymentMethod: 'online',
    paymentProvider: provider,
    bookingStatus: status,
    paymentStatus,
    paymentHoldExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    upiTransactionId: 'UPI-P21',
  });

const reserve = async ({ fixture, checkIn = date('2026-10-10'), checkOut = date('2026-10-11'), roomQuantity = 1, blockedSet = new Set() }) => {
  const booking = newBooking({ customer: fixture.customer, hotel: fixture.hotel, roomType: fixture.roomType, checkIn, checkOut, roomQuantity });
  const selectedUnits = await tryReserveRoomUnitsForBooking({
    booking,
    hotel: fixture.hotel,
    roomType: fixture.roomType,
    units: fixture.roomUnits,
    daysToReserve: enumerateDatesUTC(checkIn, checkOut),
    blockedSet,
    roomQuantity,
  });
  if (selectedUnits.length < roomQuantity) {
    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
    return { ok: false, booking, selectedUnits };
  }
  booking.roomUnitIds = selectedUnits.map((unit) => unit._id);
  booking.roomNumbers = selectedUnits.map((unit) => unit.number);
  booking.roomUnitId = selectedUnits[0]._id;
  booking.roomNumber = selectedUnits[0].number;
  await booking.save();
  return { ok: true, booking, selectedUnits };
};

const installFakeRazorpay = (paymentById) => {
  const original = https.request;
  https.request = (_options, callback) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.end = () => {
      const path = String(_options?.path || '');
      const match = path.match(/\/v1\/payments\/([^/]+)/);
      const paymentId = match ? decodeURIComponent(match[1]) : '';
      const payload = paymentById(paymentId);
      const res = new EventEmitter();
      res.statusCode = payload.statusCode || 200;
      res.setEncoding = () => {};
      process.nextTick(() => {
        callback(res);
        res.emit('data', JSON.stringify(payload.body));
        res.emit('end');
      });
    };
    return req;
  };
  return () => {
    https.request = original;
  };
};

test.before(async () => {
  try {
    mustUseSafeTestDatabase();
    await mongoose.connect(TEST_MONGO_URI, {
      serverSelectionTimeoutMS: TEST_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: TEST_CONNECT_TIMEOUT_MS,
    });
    mustUseSafeTestDatabase();
    await Promise.all(collectionsToClean.map((Model) => Model.createIndexes()));
    await cleanup();
  } catch (err) {
    setupError = err;
  }
});

test.beforeEach((t) => {
  if (setupError && t.name !== 'safe isolated MongoDB test database is available') {
    t.skip(`BLOCKED - SAFE TEST DATABASE UNAVAILABLE: ${setupError.message}`);
  }
});

const dbTest = (name, fn) => test(name, async (t) => {
  if (setupError) {
    t.skip(`BLOCKED - SAFE TEST DATABASE UNAVAILABLE: ${setupError.message}`);
    return;
  }
  return fn(t);
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) await cleanup();
  await mongoose.disconnect();
});

test.afterEach(async () => {
  if (!setupError && mongoose.connection.readyState === 1) await cleanup();
});

test('safe isolated MongoDB test database is available', () => {
  assert.ifError(setupError);
  assert.equal(mongoose.connection.db.databaseName, TEST_DB_NAME);
});

dbTest('actual MongoDB has and enforces unique roomUnitId + date index', async () => {
  const indexes = await RoomUnitBookingDay.collection.indexes();
  const uniqueIndex = indexes.find((idx) =>
    idx.unique === true &&
    idx.key?.roomUnitId === 1 &&
    idx.key?.date === 1
  );
  assert.ok(uniqueIndex, `missing unique index in MongoDB indexes: ${JSON.stringify(indexes)}`);

  const fixture = await createFixture();
  const bookingA = newBooking({ customer: fixture.customer, hotel: fixture.hotel, roomType: fixture.roomType, checkIn: date('2026-10-10'), checkOut: date('2026-10-11') });
  const bookingB = newBooking({ customer: fixture.customer, hotel: fixture.hotel, roomType: fixture.roomType, checkIn: date('2026-10-10'), checkOut: date('2026-10-11') });
  await RoomUnitBookingDay.create({
    __phase21: TEST_RUN,
    hotelId: fixture.hotel._id,
    roomTypeId: fixture.roomType._id,
    roomUnitId: fixture.roomUnits[0]._id,
    bookingId: bookingA._id,
    date: date('2026-10-10'),
  });
  await assert.rejects(
    RoomUnitBookingDay.create({
      __phase21: TEST_RUN,
      hotelId: fixture.hotel._id,
      roomTypeId: fixture.roomType._id,
      roomUnitId: fixture.roomUnits[0]._id,
      bookingId: bookingB._id,
      date: date('2026-10-10'),
    }),
    /E11000|duplicate key/
  );
});

dbTest('one room-night can be locked only once with real MongoDB inserts', async () => {
  const fixture = await createFixture();
  const first = await reserve({ fixture });
  const second = await reserve({ fixture });

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(await RoomUnitBookingDay.countDocuments({ roomUnitId: fixture.roomUnits[0]._id, date: date('2026-10-10') }), 1);
});

dbTest('concurrent one-night attempts produce exactly one successful physical-room lock', async () => {
  const fixture = await createFixture();
  const attempts = await Promise.allSettled([
    reserve({ fixture }),
    reserve({ fixture }),
  ]);
  const results = attempts.map((attempt) => attempt.status === 'fulfilled' ? attempt.value : { ok: false, error: attempt.reason });

  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => !r.ok).length, 1);
  assert.equal(await RoomUnitBookingDay.countDocuments({ roomUnitId: fixture.roomUnits[0]._id, date: date('2026-10-10') }), 1);
});

dbTest('concurrent multi-night attempts leave one complete three-lock reservation and no losing partial set', async () => {
  const fixture = await createFixture();
  const checkIn = date('2026-10-10');
  const checkOut = date('2026-10-13');
  const results = (await Promise.allSettled([
    reserve({ fixture, checkIn, checkOut }),
    reserve({ fixture, checkIn, checkOut }),
  ])).map((attempt) => attempt.status === 'fulfilled' ? attempt.value : { ok: false });

  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(await RoomUnitBookingDay.countDocuments({ roomUnitId: fixture.roomUnits[0]._id }), 3);
  const failed = results.find((r) => !r.ok);
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: failed.booking._id }), 0);
});

dbTest('concurrent quantity=2 attempts over two rooms allocate both rooms to exactly one booking', async () => {
  const fixture = await createFixture({ rooms: ['101', '102'] });
  const results = (await Promise.allSettled([
    reserve({ fixture, roomQuantity: 2 }),
    reserve({ fixture, roomQuantity: 2 }),
  ])).map((attempt) => attempt.status === 'fulfilled' ? attempt.value : { ok: false });
  const winner = results.find((r) => r.ok);

  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(winner.selectedUnits.length, 2);
  assert.equal(await RoomUnitBookingDay.countDocuments({ date: date('2026-10-10') }), 2);
  assert.equal(new Set((await RoomUnitBookingDay.find().lean()).map((lock) => String(lock.roomUnitId))).size, 2);
});

dbTest('manual room-unit block rejects reservation and removal permits it', async () => {
  const fixture = await createFixture();
  const block = await RoomUnitBlock.create({
    __phase21: TEST_RUN,
    hotelId: fixture.hotel._id,
    roomTypeId: fixture.roomType._id,
    roomUnitId: fixture.roomUnits[0]._id,
    kind: 'unavailable',
    reason: 'offline_booking',
    startDate: date('2026-10-10'),
    endDate: date('2026-10-11'),
  });
  const blockedSet = new Set((await RoomUnitBlock.distinct('roomUnitId', {
    roomTypeId: fixture.roomType._id,
    startDate: { $lt: date('2026-10-11') },
    endDate: { $gt: date('2026-10-10') },
  })).map(String));

  assert.equal((await reserve({ fixture, blockedSet })).ok, false);
  assert.equal(await RoomUnitBookingDay.countDocuments(), 0);
  await RoomUnitBlock.deleteOne({ _id: block._id });
  assert.equal((await reserve({ fixture })).ok, true);
  assert.equal(await RoomUnitBookingDay.countDocuments(), 1);
});

dbTest('cancellation releases inventory and repeated cancellation is controlled', async () => {
  const fixture = await createFixture();
  const { booking } = await reserve({ fixture });
  await transitionBookingStatus(booking, 'confirmed', { actorRole: 'system' });
  booking.paymentStatus = 'paid';
  await booking.save();

  await withServer(makeApp(), async (baseUrl) => {
    const first = await jsonRequest(baseUrl, `/api/bookings/${booking._id}/cancel`, {
      method: 'PUT',
      token: tokenFor(fixture.customer),
      body: { reason: 'Change in plan', details: 'Integration test cancellation' },
    });
    assert.equal(first.status, 200);
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);

    const second = await jsonRequest(baseUrl, `/api/bookings/${booking._id}/cancel`, {
      method: 'PUT',
      token: tokenFor(fixture.customer),
      body: { reason: 'Change in plan', details: 'Integration test cancellation' },
    });
    assert.equal(second.status, 409);
  });

  assert.equal((await reserve({ fixture })).ok, true);
});

dbTest('payment failure releases inventory and permits a new reservation', async () => {
  const fixture = await createFixture();
  const { booking } = await reserve({ fixture });
  booking.paymentProvider = 'razorpay';
  await booking.save();

  await markBookingPaymentFailed(booking, { paymentProvider: 'razorpay', status: 'failed', actorRole: 'system' });
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.bookingStatus, 'payment_failed');
  assert.equal(updated.paymentStatus, 'failed');
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
  assert.equal((await reserve({ fixture })).ok, true);
});

dbTest('expiration releases only stale pending holds and is repeat-safe', async () => {
  const fixture = await createFixture();
  const { booking } = await reserve({ fixture });
  booking.paymentHoldExpiresAt = new Date(Date.now() - 60_000);
  await booking.save();

  assert.deepEqual(await expirePendingBookings({ now: new Date(), limit: 10 }), { scanned: 1, expired: 1 });
  assert.deepEqual(await expirePendingBookings({ now: new Date(), limit: 10 }), { scanned: 0, expired: 0 });
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.bookingStatus, 'expired');
  assert.equal(updated.paymentStatus, 'expired');
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
});

dbTest('future pending holds and confirmed bookings do not expire', async () => {
  const futureFixture = await createFixture();
  const future = (await reserve({ fixture: futureFixture })).booking;
  future.paymentHoldExpiresAt = new Date(Date.now() + 60 * 60_000);
  await future.save();

  const confirmedFixture = await createFixture();
  const confirmed = (await reserve({ fixture: confirmedFixture })).booking;
  await transitionBookingStatus(confirmed, 'confirmed', { actorRole: 'system' });
  confirmed.paymentStatus = 'paid';
  confirmed.paymentHoldExpiresAt = new Date(Date.now() - 60 * 60_000);
  await confirmed.save();

  assert.deepEqual(await expirePendingBookings({ now: new Date(), limit: 10 }), { scanned: 0, expired: 0 });
  assert.equal((await Booking.findById(future._id).lean()).bookingStatus, 'pending');
  assert.equal((await Booking.findById(confirmed._id).lean()).bookingStatus, 'confirmed');
  assert.equal(await RoomUnitBookingDay.countDocuments(), 2);
});

dbTest('duplicate Razorpay verification is idempotent with real locks', async () => {
  const fixture = await createFixture();
  const { booking } = await reserve({ fixture });
  booking.paymentProvider = 'razorpay';
  booking.razorpayOrderId = 'order_phase21_verify';
  booking.advanceAmount = 1000;
  await booking.save();
  const restore = installFakeRazorpay(() => ({ body: { id: 'pay_phase21_verify', amount: 100000, currency: 'INR', status: 'captured' } }));

  try {
    await withServer(makeApp(), async (baseUrl) => {
      const body = {
        bookingId: String(booking._id),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: 'pay_phase21_verify',
        razorpay_signature: signPayment(booking.razorpayOrderId, 'pay_phase21_verify'),
      };
      assert.equal((await jsonRequest(baseUrl, '/api/payments/razorpay/verify', { token: tokenFor(fixture.customer), body })).status, 200);
      const second = await jsonRequest(baseUrl, '/api/payments/razorpay/verify', { token: tokenFor(fixture.customer), body });
      assert.equal(second.status, 200);
      assert.equal(second.payload.message, 'PAYMENT_ALREADY_PROCESSED');
    });
  } finally {
    restore();
  }

  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.bookingStatus, 'confirmed');
  assert.equal(updated.paymentStatus, 'paid');
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
});

dbTest('duplicate Razorpay webhook event is idempotent', async () => {
  const fixture = await createFixture();
  const { booking } = await reserve({ fixture });
  booking.paymentProvider = 'razorpay';
  booking.razorpayOrderId = 'order_phase21_webhook';
  booking.advanceAmount = 1000;
  await booking.save();
  const rawBody = JSON.stringify({
    id: 'evt_phase21_duplicate',
    event: 'payment.captured',
    payload: {
      payment: { entity: { id: 'pay_phase21_webhook', order_id: 'order_phase21_webhook', status: 'captured' } },
    },
  });

  await withServer(makeApp(), async (baseUrl) => {
    const postWebhook = () => fetch(`${baseUrl}/api/payments/razorpay/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signWebhook(rawBody) },
      body: rawBody,
    });
    assert.equal((await postWebhook()).status, 200);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal((await postWebhook()).status, 200);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.paymentStatus, 'paid');
  assert.deepEqual(updated.razorpayWebhookEventIds, ['evt_phase21_duplicate']);
  assert.equal(await Booking.countDocuments({ _id: booking._id }), 1);
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
});

dbTest('Razorpay amount and currency mismatch are rejected without confirmation', async () => {
  for (const payment of [
    { id: 'pay_bad_amount', amount: 90000, currency: 'INR', status: 'captured' },
    { id: 'pay_bad_currency', amount: 100000, currency: 'USD', status: 'captured' },
  ]) {
    await cleanup();
    const fixture = await createFixture();
    const { booking } = await reserve({ fixture });
    booking.paymentProvider = 'razorpay';
    booking.razorpayOrderId = `order_${payment.id}`;
    booking.advanceAmount = 1000;
    await booking.save();
    const restore = installFakeRazorpay(() => ({ body: payment }));
    try {
      await withServer(makeApp(), async (baseUrl) => {
        const response = await jsonRequest(baseUrl, '/api/payments/razorpay/verify', {
          token: tokenFor(fixture.customer),
          body: {
            bookingId: String(booking._id),
            razorpay_order_id: booking.razorpayOrderId,
            razorpay_payment_id: payment.id,
            razorpay_signature: signPayment(booking.razorpayOrderId, payment.id),
          },
        });
        assert.equal(response.status, 400);
      });
    } finally {
      restore();
    }
    assert.equal((await Booking.findById(booking._id).lean()).bookingStatus, 'pending');
  }
});

dbTest('route-backed booking creation enforces date boundaries and creates two locks for two nights', async () => {
  const fixture = await createFixture({ partnerHotel: false });
  await withServer(makeApp(), async (baseUrl) => {
    const body = {
      hotelId: String(fixture.hotel._id),
      roomTypeId: String(fixture.roomType._id),
      checkIn: '2026-10-10',
      checkOut: '2026-10-12',
      customerFullName: 'Route Customer',
      customerMobile: '8888888888',
      customerEmail: 'route@phase21.test',
      totalAdults: 1,
      totalChildren: 0,
      guestDetails: [{ type: 'adult', name: 'Route Customer', age: 31 }],
      roomQuantity: 1,
      paymentOption: 'full_100',
      paymentProvider: 'razorpay',
    };
    const response = await jsonRequest(baseUrl, '/api/bookings/room-type', {
      token: tokenFor(fixture.customer),
      body,
    });
    assert.equal(response.status, 201);
    assert.equal(await RoomUnitBookingDay.countDocuments({ date: { $in: [date('2026-10-10'), date('2026-10-11')] } }), 2);
    assert.equal(await RoomUnitBookingDay.countDocuments({ date: date('2026-10-12') }), 0);

    const invalid = await jsonRequest(baseUrl, '/api/bookings/room-type', {
      token: tokenFor(fixture.customer),
      body: { ...body, checkIn: '2026-10-10', checkOut: '2026-10-10' },
    });
    assert.equal(invalid.status, 400);
  });
});

dbTest('hotel, room type, and room unit relationships must remain consistent', async () => {
  const a = await createFixture({ rooms: ['A1'] });
  const b = await createFixture({ rooms: ['B1'] });

  const invalidHotelRoomType = await RoomType.findOne({ _id: b.roomType._id, hotelId: a.hotel._id, status: 'active' }).lean();
  assert.equal(invalidHotelRoomType, null);

  const inconsistentUnit = b.roomUnits[0];
  assert.notEqual(String(inconsistentUnit.hotelId), String(a.hotel._id));
  assert.notEqual(String(inconsistentUnit.roomTypeId), String(a.roomType._id));

  const booking = newBooking({ customer: a.customer, hotel: a.hotel, roomType: a.roomType, checkIn: date('2026-10-10'), checkOut: date('2026-10-11') });
  const selected = await tryReserveRoomUnitsForBooking({
    booking,
    hotel: a.hotel,
    roomType: a.roomType,
    units: [inconsistentUnit],
    daysToReserve: [date('2026-10-10')],
    roomQuantity: 1,
  });
  assert.equal(selected.length, 0);
  assert.equal(await RoomUnitBookingDay.countDocuments({ hotelId: a.hotel._id, roomTypeId: a.roomType._id, roomUnitId: b.roomUnits[0]._id }), 0);
});

dbTest('booking save failure after lock creation releases compensating inventory', async () => {
  const fixture = await createFixture();
  const booking = newBooking({ customer: fixture.customer, hotel: fixture.hotel, roomType: fixture.roomType, checkIn: date('2026-10-10'), checkOut: date('2026-10-11') });
  await tryReserveRoomUnitsForBooking({
    booking,
    hotel: fixture.hotel,
    roomType: fixture.roomType,
    units: fixture.roomUnits,
    daysToReserve: [date('2026-10-10')],
    roomQuantity: 1,
  });
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);

  try {
    throw new Error('simulated booking save failure');
  } catch {
    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
  }
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
});

dbTest('payment order failure leaves pending locked booking eligible for expiration cleanup', async () => {
  const fixture = await createFixture();
  const { booking } = await reserve({ fixture });
  booking.paymentProvider = 'razorpay';
  booking.paymentHoldExpiresAt = new Date(Date.now() - 60_000);
  await booking.save();

  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
  const result = await expirePendingBookings({ now: new Date(), limit: 10 });
  assert.equal(result.expired, 1);
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
});
