const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const test = require('node:test');

const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-3-integration-secret';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_phase3';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'phase3_razorpay_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'phase3_webhook_secret';
process.env.BOOKING_PAYMENT_HOLD_MINUTES = process.env.BOOKING_PAYMENT_HOLD_MINUTES || '30';

const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
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
const { parseDateOnlyToUTC, enumerateDatesUTC } = require('../utils/date');
const { tryReserveRoomUnitsForBooking, transitionBookingStatus } = require('../utils/reservationLifecycle');
const { createModification, verifyModificationPayment } = require('../utils/bookingModification');
const { resetRazorpayProvider, setRazorpayProvider } = require('../utils/razorpay');

const TEST_DB_NAME = 'vrindavan_sarthi_test';
const TEST_MONGO_URI = process.env.PHASE_2_1_MONGO_URI;
const TEST_CONNECT_TIMEOUT_MS = 10_000;
const TEST_SERVER_SELECTION_TIMEOUT_MS = 15_000;
const TEST_RUN = `phase3-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const collectionsToClean = [Booking, BookingModification, Hotel, RoomType, RoomUnit, RoomUnitBlock, RoomUnitBookingDay, User];
let setupError = null;

const getConfiguredTestDbName = () => {
  if (!TEST_MONGO_URI) {
    throw new Error('PHASE_2_1_MONGO_URI is required for Phase 3 Atlas integration tests');
  }
  return new URL(TEST_MONGO_URI).pathname.replace('/', '');
};

const mustUseSafeTestDatabase = () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing Phase 3 integration tests with NODE_ENV=production');
  }
  const dbName = mongoose.connection.db?.databaseName || getConfiguredTestDbName();
  if (dbName !== TEST_DB_NAME) {
    throw new Error(`Refusing destructive cleanup against non-test database: ${dbName}`);
  }
};

const cleanup = async () => {
  mustUseSafeTestDatabase();
  const [users, hotels, bookings] = await Promise.all([
    User.find({ email: /@phase3\.test$/ }).select('_id').lean(),
    Hotel.find({ name: /^(P3 Hotel|Other P3 Hotel)/ }).select('_id').lean(),
    Booking.find({
      $or: [
        { bookingId: /^P3-/ },
        { userEmail: /@phase3\.test$/ },
        { itemName: /^P3 Hotel / },
      ],
    }).select('_id').lean(),
  ]);

  const userIds = users.map((doc) => doc._id);
  const hotelIds = hotels.map((doc) => doc._id);
  const roomTypes = await RoomType.find({
    $or: [
      { name: /^P3 / },
      ...(hotelIds.length ? [{ hotelId: { $in: hotelIds } }] : []),
    ],
  }).select('_id').lean();
  const roomTypeIds = roomTypes.map((doc) => doc._id);
  const bookingIds = bookings.map((doc) => doc._id);
  const modificationLookup = [
    ...(bookingIds.length ? [{ bookingId: { $in: bookingIds } }] : []),
    ...(userIds.length ? [{ actorId: { $in: userIds } }] : []),
  ];
  const modifications = modificationLookup.length
    ? await BookingModification.find({ $or: modificationLookup }).select('_id').lean()
    : [];
  const modificationIds = modifications.map((doc) => doc._id);
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
  const inventoryClauses = relatedClauses.filter((clause) => !clause.bookingId);

  await Promise.all([
    ...(relatedClauses.length ? [RoomUnitBookingDay.deleteMany({ $or: relatedClauses })] : []),
    ...(inventoryClauses.length ? [RoomUnitBlock.deleteMany({ $or: inventoryClauses })] : []),
    ...((bookingIds.length || userIds.length)
      ? [BookingModification.deleteMany({
        $or: [
          ...(bookingIds.length ? [{ bookingId: { $in: bookingIds } }] : []),
          ...(userIds.length ? [{ actorId: { $in: userIds } }] : []),
        ],
      })]
      : []),
  ]);

  const parentDeletes = [
    Booking.deleteMany({
      $or: [
        { bookingId: /^P3-/ },
        { userEmail: /@phase3\.test$/ },
        { itemName: /^P3 Hotel / },
      ],
    }),
    RoomType.deleteMany({
      $or: [
        { name: /^P3 / },
        ...(hotelIds.length ? [{ hotelId: { $in: hotelIds } }] : []),
      ],
    }),
    Hotel.deleteMany({ name: /^(P3 Hotel|Other P3 Hotel)/ }),
    User.deleteMany({ email: /@phase3\.test$/ }),
    WebhookEvent.deleteMany({ provider: 'razorpay', eventId: /^evt_phase3/ }),
    ...(bookingIds.length ? [RefundOperation.deleteMany({ bookingId: { $in: bookingIds } })] : []),
    ...(modificationIds.length ? [RefundOperation.deleteMany({ modificationId: { $in: modificationIds } })] : []),
  ];
  const roomUnitClauses = [
    ...(hotelIds.length ? [{ hotelId: { $in: hotelIds } }] : []),
    ...(roomTypeIds.length ? [{ roomTypeId: { $in: roomTypeIds } }] : []),
  ];
  if (roomUnitClauses.length) parentDeletes.push(RoomUnit.deleteMany({ $or: roomUnitClauses }));
  await Promise.all(parentDeletes);
};

const date = (value) => parseDateOnlyToUTC(value);
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const key = () => `phase3-key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const tokenFor = (user) => jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '15m' });
const signPayment = (orderId, paymentId) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
const signWebhook = (rawBody) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
const lodgingTotalFor = (pricePerNight, nights = 1, roomQuantity = 1) => {
  const baseAmount = Math.max(0, Number(pricePerNight || 0)) * Math.max(1, nights) * Math.max(1, roomQuantity);
  return baseAmount + Math.round((baseAmount * 4.45) / 100);
};

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

const installFakeRazorpay = ({ paymentAmountPaise = 10000, currency = 'INR', paymentStatus = 'captured', refundStatus = 'processed' } = {}) => {
  const calls = { orders: [], payments: [], captures: [], refunds: [] };
  setRazorpayProvider({
    request: async ({ method = 'GET', path, body }) => {
      if (path === '/v1/orders' && method === 'POST') {
        calls.orders.push(body);
        return { id: `order_phase3_${calls.orders.length}`, amount: body.amount, currency: body.currency, status: 'created' };
      }
      if (/\/capture$/.test(path) && method === 'POST') {
        calls.captures.push(body);
        return { id: 'pay_phase3', amount: body.amount, currency: body.currency, status: 'captured' };
      }
      if (/\/refund$/.test(path) && method === 'POST') {
        calls.refunds.push(body);
        return { id: `rfnd_phase3_${calls.refunds.length}`, amount: body.amount, currency: 'INR', status: refundStatus };
      }
      if (/\/v1\/payments\//.test(path)) {
        calls.payments.push(path);
        return { id: decodeURIComponent(path.split('/').pop()), amount: paymentAmountPaise, currency, status: paymentStatus };
      }
      const err = new Error('not found');
      err.statusCode = 404;
      throw err;
    },
  });
  return { calls, restore: resetRazorpayProvider };
};

const createFixture = async ({ rooms = ['101'], deluxeRooms = ['201'], price = 1000, deluxePrice = 1500, partnerHotel = true } = {}) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const partner = await User.create({
    __phase3: TEST_RUN,
    name: `P3 Partner ${suffix}`,
    email: `partner-${suffix}@phase3.test`,
    phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'partner',
    partnerStatus: 'approved',
  });
  const otherPartner = await User.create({
    __phase3: TEST_RUN,
    name: `P3 Other Partner ${suffix}`,
    email: `other-partner-${suffix}@phase3.test`,
    phone: `6${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'partner',
    partnerStatus: 'approved',
  });
  const customer = await User.create({
    __phase3: TEST_RUN,
    name: `P3 Customer ${suffix}`,
    email: `customer-${suffix}@phase3.test`,
    phone: `8${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'user',
  });
  const otherCustomer = await User.create({
    __phase3: TEST_RUN,
    name: `P3 Other Customer ${suffix}`,
    email: `other-customer-${suffix}@phase3.test`,
    phone: `7${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'user',
  });
  const admin = await User.create({
    __phase3: TEST_RUN,
    name: `P3 Admin ${suffix}`,
    email: `admin-${suffix}@phase3.test`,
    phone: `5${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
    password: 'not-used',
    role: 'admin',
  });
  const hotel = await Hotel.create({
    __phase3: TEST_RUN,
    name: `P3 Hotel ${suffix}`,
    location: 'Vrindavan',
    googleMapLink: 'https://maps.example.test/p3',
    nearestTemple: 'Banke Bihari',
    status: 'active',
    approvalStatus: 'approved',
    petsAllowed: true,
    taxEnabled: false,
    ...(partnerHotel ? {
      partnerId: partner._id,
      partnerName: partner.name,
      partnerPhone: partner.phone,
    } : {}),
  });
  const roomType = await RoomType.create({
    __phase3: TEST_RUN,
    hotelId: hotel._id,
    partnerId: partnerHotel ? partner._id : undefined,
    name: `P3 Standard ${suffix}`,
    pricePerNight: price,
    maxAdults: 2,
    maxChildren: 1,
    petsAllowed: true,
    status: 'active',
  });
  const deluxeRoomType = await RoomType.create({
    __phase3: TEST_RUN,
    hotelId: hotel._id,
    partnerId: partnerHotel ? partner._id : undefined,
    name: `P3 Deluxe ${suffix}`,
    pricePerNight: deluxePrice,
    maxAdults: 3,
    maxChildren: 2,
    petsAllowed: true,
    status: 'active',
  });
  const roomUnits = await RoomUnit.insertMany(rooms.map((number) => ({
    __phase3: TEST_RUN,
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    partnerId: partnerHotel ? partner._id : undefined,
    number,
    status: 'available',
  })));
  const deluxeUnits = await RoomUnit.insertMany(deluxeRooms.map((number) => ({
    __phase3: TEST_RUN,
    hotelId: hotel._id,
    roomTypeId: deluxeRoomType._id,
    partnerId: partnerHotel ? partner._id : undefined,
    number,
    status: 'available',
  })));
  return { partner, otherPartner, customer, otherCustomer, admin, hotel, roomType, deluxeRoomType, roomUnits, deluxeUnits };
};

const newBooking = ({ fixture, checkIn = date('2026-10-10'), checkOut = date('2026-10-11'), roomQuantity = 1, roomType = fixture.roomType, units = fixture.roomUnits, totalAmount, paymentProvider = 'razorpay' }) => {
  const nights = enumerateDatesUTC(checkIn, checkOut).length || 1;
  const authoritativeTotal = lodgingTotalFor(roomType.pricePerNight, nights, roomQuantity);
  const amount = Number(totalAmount || authoritativeTotal);
  const guestDetails = Array.from({ length: roomQuantity }, (_, index) => ({
    type: 'adult',
    name: `Guest ${index + 1}`,
    age: 30,
    gender: 'male',
  }));
  return new Booking({
    __phase3: TEST_RUN,
    bookingId: `P3-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    bookingType: 'room_type',
    service_billing_model: 'hotel_marketplace',
    itemId: String(roomType._id),
    itemName: `${fixture.hotel.name} - ${roomType.name}`,
    userId: fixture.customer._id,
    userName: fixture.customer.name,
    userEmail: fixture.customer.email,
    userPhone: fixture.customer.phone,
    partnerId: fixture.hotel.partnerId,
    hotelId: fixture.hotel._id,
    roomTypeId: roomType._id,
    checkIn,
    checkOut,
    guests: roomQuantity,
    totalAdults: roomQuantity,
    totalChildren: 0,
    roomQuantity,
    customerFullName: fixture.customer.name,
    customerMobile: fixture.customer.phone,
    customerEmail: fixture.customer.email,
    guestDetails,
    baseAmount: amount,
    totalAmount: amount,
    advanceAmount: amount,
    paymentOption: 'full_100',
    paymentMethod: 'online',
    paymentProvider,
    razorpayOrderId: paymentProvider === 'razorpay' ? `order_paid_${Date.now()}` : undefined,
    razorpayPaymentId: paymentProvider === 'razorpay' ? `pay_paid_${Date.now()}` : undefined,
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    paidAt: new Date(),
  });
};

const reservePaid = async (fixture, options = {}) => {
  const booking = newBooking({ fixture, ...options });
  const roomType = options.roomType || fixture.roomType;
  const units = options.units || fixture.roomUnits;
  const days = enumerateDatesUTC(booking.checkIn, booking.checkOut);
  const selectedUnits = await tryReserveRoomUnitsForBooking({
    booking,
    hotel: fixture.hotel,
    roomType,
    units,
    daysToReserve: days,
    roomQuantity: booking.roomQuantity,
  });
  assert.equal(selectedUnits.length, booking.roomQuantity);
  booking.roomUnitIds = selectedUnits.map((unit) => unit._id);
  booking.roomNumbers = selectedUnits.map((unit) => unit.number);
  booking.roomUnitId = selectedUnits[0]._id;
  booking.roomNumber = selectedUnits[0].number;
  await booking.save();
  return booking;
};

const dbTest = (name, fn) => test(name, async (t) => {
  if (setupError) {
    t.skip(`BLOCKED - SAFE TEST DATABASE UNAVAILABLE: ${setupError.message}`);
    return;
  }
  return fn(t);
});

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

dbTest('same-date occupancy modification keeps inventory and no financial difference', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture);
  const result = await createModification({
    bookingId: booking._id,
    actor: fixture.customer,
    changes: { adults: 1, children: 1, guestDetails: [
      { type: 'adult', name: 'A', age: 30 },
      { type: 'child', name: 'C', age: 6 },
    ] },
    idempotencyKey: key(),
  });
  assert.equal(result.modification.status, 'completed');
  assert.equal(result.modification.paymentAction, 'no_change');
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
  assert.equal((await Booking.findById(booking._id)).totalChildren, 1);
});

dbTest('date extension acquires new night before keeping original booking valid', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture);
  const fake = installFakeRazorpay({ paymentAmountPaise: 104400 });
  try {
    const created = await createModification({
      bookingId: booking._id,
      actor: fixture.customer,
      changes: { checkOutDate: '2026-10-12' },
      idempotencyKey: key(),
    });
    assert.equal(created.modification.status, 'pending_payment');
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 2);
    const orderId = created.modification.razorpayOrderId;
    await verifyModificationPayment({
      bookingId: booking._id,
      actor: fixture.customer,
      body: {
        modificationId: String(created.modification._id),
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_phase3_date_extension',
        razorpay_signature: signPayment(orderId, 'pay_phase3_date_extension'),
      },
    });
    const updated = await Booking.findById(booking._id).lean();
    assert.equal(dateKey(updated.checkOut), '2026-10-12');
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 2);
  } finally {
    fake.restore();
  }
});

dbTest('date shortening releases obsolete locks and creates refund record', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture, { checkOut: date('2026-10-12'), totalAmount: 2000 });
  const fake = installFakeRazorpay();
  try {
    const result = await createModification({
      bookingId: booking._id,
      actor: fixture.customer,
      changes: { checkOutDate: '2026-10-11' },
      idempotencyKey: key(),
    });
    assert.equal(result.modification.paymentAction, 'refund');
    assert.equal(result.modification.refundAmount, 955);
    assert.equal(fake.calls.refunds.length, 1);
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
  } finally {
    fake.restore();
  }
});

dbTest('date shift replaces old date lock after new date is held', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture);
  await createModification({
    bookingId: booking._id,
    actor: fixture.customer,
    changes: { checkInDate: '2026-10-11', checkOutDate: '2026-10-12' },
    idempotencyKey: key(),
  });
  const locks = await RoomUnitBookingDay.find({ bookingId: booking._id }).lean();
  assert.deepEqual(locks.map((lock) => dateKey(lock.date)).sort(), ['2026-10-11']);
});

dbTest('quantity increase and decrease keep exact physical room-night locks', async () => {
  const fixture = await createFixture({ rooms: ['101', '102'] });
  const booking = await reservePaid(fixture);
  const fake = installFakeRazorpay({ paymentAmountPaise: 104400 });
  try {
    const created = await createModification({
      bookingId: booking._id,
      actor: fixture.customer,
      changes: { roomQuantity: 2, adults: 2 },
      idempotencyKey: key(),
    });
    const orderId = created.modification.razorpayOrderId;
    await verifyModificationPayment({
      bookingId: booking._id,
      actor: fixture.customer,
      body: {
        modificationId: String(created.modification._id),
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_phase3_qty_increase',
        razorpay_signature: signPayment(orderId, 'pay_phase3_qty_increase'),
      },
    });
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 2);
    await createModification({
      bookingId: booking._id,
      actor: fixture.customer,
      changes: { roomQuantity: 1, adults: 1 },
      idempotencyKey: key(),
    });
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
  } finally {
    fake.restore();
  }
});

dbTest('room type change allocates new physical room units in the same hotel', async () => {
  const fixture = await createFixture({ deluxePrice: 1000 });
  const booking = await reservePaid(fixture);
  await createModification({
    bookingId: booking._id,
    actor: fixture.admin,
    changes: { roomTypeId: String(fixture.deluxeRoomType._id) },
    idempotencyKey: key(),
  });
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(String(updated.roomTypeId), String(fixture.deluxeRoomType._id));
  const locks = await RoomUnitBookingDay.find({ bookingId: booking._id }).lean();
  assert.equal(String(locks[0].roomTypeId), String(fixture.deluxeRoomType._id));
});

dbTest('preview reports additional payment and does not accept client amounts', async () => {
  const fixture = await createFixture({ deluxePrice: 2000 });
  const booking = await reservePaid(fixture, { totalAmount: 1000 });
  await withServer(makeApp(), async (baseUrl) => {
    const res = await jsonRequest(baseUrl, `/api/bookings/${booking._id}/modify/preview`, {
      token: tokenFor(fixture.customer),
      body: { roomTypeId: String(fixture.deluxeRoomType._id), oldAmount: 1, newAmount: 1 },
    });
    assert.equal(res.status, 400);

    const ok = await jsonRequest(baseUrl, `/api/bookings/${booking._id}/modify/preview`, {
      token: tokenFor(fixture.customer),
      body: { roomTypeId: String(fixture.deluxeRoomType._id) },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.payload.modification.paymentAction, 'additional_payment');
    assert.equal(ok.payload.modification.newAmount, 2089);
  });
});

dbTest('additional payment flow creates new order and applies after verification', async () => {
  const fixture = await createFixture({ deluxePrice: 2000 });
  const booking = await reservePaid(fixture, { totalAmount: 1000 });
  const fake = installFakeRazorpay({ paymentAmountPaise: 108900 });
  try {
    const created = await createModification({
      bookingId: booking._id,
      actor: fixture.customer,
      changes: { roomTypeId: String(fixture.deluxeRoomType._id) },
      idempotencyKey: key(),
    });
    assert.equal(created.modification.status, 'pending_payment');
    assert.equal(fake.calls.orders.length, 1);
    const orderId = created.modification.razorpayOrderId;
    const verified = await verifyModificationPayment({
      bookingId: booking._id,
      actor: fixture.customer,
      body: {
        modificationId: String(created.modification._id),
        razorpay_order_id: orderId,
        razorpay_payment_id: 'pay_phase3_additional',
        razorpay_signature: signPayment(orderId, 'pay_phase3_additional'),
      },
    });
    assert.equal(verified.modification.status, 'completed');
    assert.equal((await Booking.findById(booking._id)).totalAmount, 2089);
  } finally {
    fake.restore();
  }
});

dbTest('insufficient inventory rejects modification and preserves original inventory', async () => {
  const fixture = await createFixture({ rooms: ['101'] });
  const booking = await reservePaid(fixture);
  const other = newBooking({ fixture, checkIn: date('2026-10-11'), checkOut: date('2026-10-12') });
  await RoomUnitBookingDay.create({
    hotelId: fixture.hotel._id,
    roomTypeId: fixture.roomType._id,
    roomUnitId: fixture.roomUnits[0]._id,
    bookingId: other._id,
    date: date('2026-10-11'),
  });
  await assert.rejects(
    createModification({
      bookingId: booking._id,
      actor: fixture.customer,
      changes: { checkOutDate: '2026-10-12' },
      idempotencyKey: key(),
    }),
    /not available/
  );
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(dateKey(updated.checkOut), '2026-10-11');
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
});

dbTest('invalid date, room type, quantity, and occupancy are rejected', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture);
  const otherHotel = await Hotel.create({
    name: 'Other P3 Hotel',
    location: 'Vrindavan',
    googleMapLink: 'https://maps.example.test/other',
    nearestTemple: 'Prem Mandir',
    status: 'active',
    approvalStatus: 'approved',
  });
  const otherRoomType = await RoomType.create({
    hotelId: otherHotel._id,
    name: 'Other Room',
    pricePerNight: 1000,
    status: 'active',
  });

  await assert.rejects(
    createModification({ bookingId: booking._id, actor: fixture.customer, changes: { checkInDate: '2026-10-12', checkOutDate: '2026-10-11' }, idempotencyKey: key() }),
    /Valid checkInDate/
  );
  await assert.rejects(
    createModification({ bookingId: booking._id, actor: fixture.customer, changes: { roomTypeId: String(otherRoomType._id) }, idempotencyKey: key() }),
    /Room type not found/
  );
  await assert.rejects(
    createModification({ bookingId: booking._id, actor: fixture.customer, changes: { roomQuantity: 0 }, idempotencyKey: key() }),
    /Invalid roomQuantity/
  );
  await assert.rejects(
    createModification({ bookingId: booking._id, actor: fixture.customer, changes: { adults: 99 }, idempotencyKey: key() }),
    /Max adults/
  );
});

dbTest('newly acquired locks are compensated when booking save fails', async () => {
  const fixture = await createFixture({ rooms: ['101', '102'] });
  const booking = await reservePaid(fixture, { totalAmount: lodgingTotalFor(fixture.roomType.pricePerNight, 1, 2) });
  const originalSave = Booking.prototype.save;
  Booking.prototype.save = async function patchedSave(...args) {
    if (String(this._id) === String(booking._id) && Number(this.roomQuantity || 0) === 2) {
      throw new Error('simulated booking save failure');
    }
    return originalSave.apply(this, args);
  };
  try {
    await assert.rejects(
      createModification({
        bookingId: booking._id,
        actor: fixture.customer,
        changes: { roomQuantity: 2, adults: 2 },
        idempotencyKey: key(),
      }),
      /simulated booking save failure/
    );
  } finally {
    Booking.prototype.save = originalSave;
  }
  const updated = await Booking.findById(booking._id).lean();
  assert.equal(updated.roomQuantity, 1);
  assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 1);
});

dbTest('concurrent modification race produces one winner and no partial modified booking', async () => {
  const fixture = await createFixture({ rooms: ['101'] });
  const booking = await reservePaid(fixture);
  const fake = installFakeRazorpay({ paymentAmountPaise: 104400 });
  try {
    const attempts = await Promise.allSettled([
      createModification({ bookingId: booking._id, actor: fixture.customer, changes: { checkOutDate: '2026-10-12' }, idempotencyKey: key() }),
      createModification({ bookingId: booking._id, actor: fixture.admin, changes: { checkOutDate: '2026-10-12' }, idempotencyKey: key() }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id, date: date('2026-10-11') }), 1);
  } finally {
    fake.restore();
  }
});

dbTest('duplicate modification request returns existing operation without duplicate locks', async () => {
  const fixture = await createFixture({ rooms: ['101', '102'] });
  const booking = await reservePaid(fixture);
  const idem = key();
  const fake = installFakeRazorpay({ paymentAmountPaise: 104400 });
  try {
    await createModification({ bookingId: booking._id, actor: fixture.customer, changes: { roomQuantity: 2, adults: 2 }, idempotencyKey: idem });
    const again = await createModification({ bookingId: booking._id, actor: fixture.customer, changes: { roomQuantity: 2, adults: 2 }, idempotencyKey: idem });
    assert.equal(again.idempotent, true);
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 2);
    assert.equal(fake.calls.orders.length, 1);
  } finally {
    fake.restore();
  }
});

dbTest('duplicate payment verification is idempotent and amount/currency mismatches are rejected', async () => {
  const fixture = await createFixture({ deluxePrice: 2000 });
  const booking = await reservePaid(fixture, { totalAmount: 1000 });
  let fake = installFakeRazorpay({ paymentAmountPaise: 108900 });
  try {
    const created = await createModification({ bookingId: booking._id, actor: fixture.customer, changes: { roomTypeId: String(fixture.deluxeRoomType._id) }, idempotencyKey: key() });
    const orderId = created.modification.razorpayOrderId;
    const body = {
      modificationId: String(created.modification._id),
      razorpay_order_id: orderId,
      razorpay_payment_id: 'pay_phase3_dup',
      razorpay_signature: signPayment(orderId, 'pay_phase3_dup'),
    };
    await verifyModificationPayment({ bookingId: booking._id, actor: fixture.customer, body });
    const again = await verifyModificationPayment({ bookingId: booking._id, actor: fixture.customer, body });
    assert.equal(again.idempotent, true);
  } finally {
    fake.restore();
  }

  await cleanup();
  const fixture2 = await createFixture({ deluxePrice: 2000 });
  const booking2 = await reservePaid(fixture2, { totalAmount: 1000 });
  fake = installFakeRazorpay({ paymentAmountPaise: 99900 });
  try {
    const created = await createModification({ bookingId: booking2._id, actor: fixture2.customer, changes: { roomTypeId: String(fixture2.deluxeRoomType._id) }, idempotencyKey: key() });
    await assert.rejects(
      verifyModificationPayment({
        bookingId: booking2._id,
        actor: fixture2.customer,
        body: {
          modificationId: String(created.modification._id),
          razorpay_order_id: created.modification.razorpayOrderId,
          razorpay_payment_id: 'pay_phase3_bad_amount',
          razorpay_signature: signPayment(created.modification.razorpayOrderId, 'pay_phase3_bad_amount'),
        },
      }),
      /amount/
    );
  } finally {
    fake.restore();
  }

  await cleanup();
  const fixture3 = await createFixture({ deluxePrice: 2000 });
  const booking3 = await reservePaid(fixture3, { totalAmount: 1000 });
  fake = installFakeRazorpay({ paymentAmountPaise: 108900, currency: 'USD' });
  try {
    const created = await createModification({ bookingId: booking3._id, actor: fixture3.customer, changes: { roomTypeId: String(fixture3.deluxeRoomType._id) }, idempotencyKey: key() });
    await assert.rejects(
      verifyModificationPayment({
        bookingId: booking3._id,
        actor: fixture3.customer,
        body: {
          modificationId: String(created.modification._id),
          razorpay_order_id: created.modification.razorpayOrderId,
          razorpay_payment_id: 'pay_phase3_bad_currency',
          razorpay_signature: signPayment(created.modification.razorpayOrderId, 'pay_phase3_bad_currency'),
        },
      }),
      /amount/
    );
  } finally {
    fake.restore();
  }
});

dbTest('duplicate webhook applies modification once', async () => {
  const fixture = await createFixture({ deluxePrice: 2000 });
  const booking = await reservePaid(fixture, { totalAmount: 1000 });
  const fake = installFakeRazorpay({ paymentAmountPaise: 108900 });
  try {
    const created = await createModification({ bookingId: booking._id, actor: fixture.customer, changes: { roomTypeId: String(fixture.deluxeRoomType._id) }, idempotencyKey: key() });
    const rawBody = JSON.stringify({
      id: 'evt_phase3_duplicate',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_phase3_webhook', order_id: created.modification.razorpayOrderId, status: 'captured' } } },
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
    assert.equal((await BookingModification.findById(created.modification._id)).razorpayWebhookEventIds.length, 1);
    assert.equal((await Booking.findById(booking._id)).totalAmount, 2089);
  } finally {
    fake.restore();
  }
});

dbTest('cancellation refund calculation and duplicate admin refund request are idempotent', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture, { totalAmount: 10000 });
  const fake = installFakeRazorpay();
  try {
    await withServer(makeApp(), async (baseUrl) => {
      const cancelled = await jsonRequest(baseUrl, `/api/bookings/${booking._id}/cancel`, {
        method: 'PUT',
        token: tokenFor(fixture.customer),
        body: { reason: 'Plan changed', details: 'Phase 3 cancellation' },
      });
      assert.equal(cancelled.status, 200);
      assert.equal(cancelled.payload.data.refundableAmount, 8800);
      assert.equal(fake.calls.refunds.length, 1);
      const refundAgain = await jsonRequest(baseUrl, `/api/bookings/${booking._id}/refund`, {
        token: tokenFor(fixture.admin),
        body: {},
      });
      assert.equal(refundAgain.status, 200);
      assert.equal(fake.calls.refunds.length, 1);
    });
    assert.equal(await RoomUnitBookingDay.countDocuments({ bookingId: booking._id }), 0);
  } finally {
    fake.restore();
  }
});

dbTest('invalid lifecycle state is rejected', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture);
  await transitionBookingStatus(booking, 'checked_in', { actorRole: 'partner' });
  await booking.save();
  await assert.rejects(
    createModification({ bookingId: booking._id, actor: fixture.customer, changes: { adults: 1 }, idempotencyKey: key() }),
    /INVALID_BOOKING_STATE/
  );
});

dbTest('customer, partner, admin authorization and invalid ObjectId are enforced', async () => {
  const fixture = await createFixture();
  const booking = await reservePaid(fixture);
  await assert.rejects(
    createModification({ bookingId: booking._id, actor: fixture.otherCustomer, changes: { adults: 1 }, idempotencyKey: key() }),
    /Not authorized/
  );
  await assert.rejects(
    createModification({ bookingId: booking._id, actor: fixture.otherPartner, changes: { adults: 1 }, idempotencyKey: key() }),
    /Not authorized/
  );
  const adminResult = await createModification({ bookingId: booking._id, actor: fixture.admin, changes: { adults: 1 }, idempotencyKey: key() });
  assert.equal(adminResult.modification.status, 'completed');
  await assert.rejects(
    createModification({ bookingId: 'bad-id', actor: fixture.admin, changes: { adults: 1 }, idempotencyKey: key() }),
    /Invalid booking id/
  );
});
