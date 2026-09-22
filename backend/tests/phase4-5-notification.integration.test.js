const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const NotificationDelivery = require('../models/NotificationDelivery');
const PartnerNotification = require('../models/PartnerNotification');
const NotificationDevice = require('../models/NotificationDevice');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const {
  buildNotificationKey,
  createOrGetNotificationDelivery,
  ensureBookingConfirmedAlarmNotifications,
} = require('../utils/notificationDelivery');

const TEST_DB_NAME = 'vrindavan_sarthi_test';
const TEST_MONGO_URI = process.env.PHASE_2_1_MONGO_URI;
const TEST_CONNECT_TIMEOUT_MS = 10_000;
const TEST_SERVER_SELECTION_TIMEOUT_MS = 15_000;
const TEST_RUN = `P45-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let setupError = null;

const getConfiguredTestDbName = () => {
  if (!TEST_MONGO_URI) throw new Error('PHASE_2_1_MONGO_URI is required for Phase 4.5 Atlas integration tests');
  return new URL(TEST_MONGO_URI).pathname.replace(/^\//, '').split('?')[0];
};

const mustUseSafeTestDatabase = () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing Phase 4.5 tests with NODE_ENV=production');
  const dbName = mongoose.connection.db?.databaseName || getConfiguredTestDbName();
  if (dbName !== TEST_DB_NAME) throw new Error(`Refusing cleanup against non-test database: ${dbName}`);
};

test.before(async () => {
  try {
    mustUseSafeTestDatabase();
    await mongoose.connect(TEST_MONGO_URI, {
      serverSelectionTimeoutMS: TEST_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: TEST_CONNECT_TIMEOUT_MS,
    });
    mustUseSafeTestDatabase();
    await NotificationDelivery.createIndexes();
    await PartnerNotification.createIndexes();
    await NotificationDevice.createIndexes();
  } catch (err) {
    setupError = err;
  }
});

test.after(async () => {
  if (!setupError && mongoose.connection.readyState === 1) {
    await NotificationDelivery.deleteMany({ notificationKey: new RegExp(`^notification:test:${TEST_RUN}`) });
    await PartnerNotification.deleteMany({
      $or: [
        { title: new RegExp(TEST_RUN) },
        { 'metadata.bookingCode': new RegExp(TEST_RUN) },
      ],
    });
    await NotificationDevice.deleteMany({ deviceId: new RegExp(`^${TEST_RUN}`) });
    await Booking.deleteMany({ bookingId: new RegExp(`^${TEST_RUN}`) });
    await Hotel.deleteMany({ name: new RegExp(`^${TEST_RUN}`) });
    await User.deleteMany({ email: new RegExp(`@${TEST_RUN}\\.test$`) });
  }
  await mongoose.disconnect();
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

dbTest('concurrent create-or-get produces exactly one NotificationDelivery', async () => {
  const bookingId = new mongoose.Types.ObjectId();
  const key = buildNotificationKey('test', TEST_RUN, 'booking', bookingId, 'invoice');

  const results = await Promise.allSettled(Array.from({ length: 12 }, () =>
    createOrGetNotificationDelivery({
      notificationKey: key,
      eventType: 'booking.invoice',
      channel: 'email',
      template: 'booking_invoice',
      recipient: 'customer@example.test',
      bookingId,
      provider: 'fake',
    })
  ));

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 12);
  assert.equal(await NotificationDelivery.countDocuments({ notificationKey: key }), 1);
  const ids = new Set(results.map((result) => String(result.value._id)));
  assert.equal(ids.size, 1);
});

dbTest('confirmed booking alarm routes to admin and exact property partner idempotently', async () => {
  const [admin, partnerA, partnerB, customer] = await User.create([
    { name: 'Admin', email: `admin@${TEST_RUN}.test`, password: 'x', role: 'admin', phone: '1' },
    { name: 'Partner A', email: `partner-a@${TEST_RUN}.test`, password: 'x', role: 'partner', partnerStatus: 'approved', phone: '2' },
    { name: 'Partner B', email: `partner-b@${TEST_RUN}.test`, password: 'x', role: 'partner', partnerStatus: 'approved', phone: '3' },
    { name: 'Customer', email: `customer@${TEST_RUN}.test`, password: 'x', role: 'user', phone: '4' },
  ]);
  const [hotelA, hotelB] = await Hotel.create([{
    name: `${TEST_RUN} Hotel A`,
    location: 'Vrindavan',
    googleMapLink: 'Vrindavan',
    nearestTemple: 'Banke Bihari',
    partnerId: partnerA._id,
    partnerName: partnerA.name,
    status: 'active',
    approvalStatus: 'approved',
  }, {
    name: `${TEST_RUN} Hotel B`,
    location: 'Mathura',
    googleMapLink: 'Mathura',
    nearestTemple: 'Krishna Janmabhoomi',
    partnerId: partnerB._id,
    partnerName: partnerB.name,
    status: 'active',
    approvalStatus: 'approved',
  }]);
  const [bookingA, bookingB] = await Booking.create([{
    bookingId: `${TEST_RUN}-BOOKING-A`,
    bookingType: 'room_type',
    itemId: String(hotelA._id),
    itemName: 'Hotel A - Deluxe',
    userId: customer._id,
    userName: customer.name,
    userEmail: customer.email,
    partnerId: partnerA._id,
    hotelId: hotelA._id,
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    totalAmount: 1200,
  }, {
    bookingId: `${TEST_RUN}-BOOKING-B`,
    bookingType: 'room_type',
    itemId: String(hotelB._id),
    itemName: 'Hotel B - Deluxe',
    userId: customer._id,
    userName: customer.name,
    userEmail: customer.email,
    partnerId: partnerB._id,
    hotelId: hotelB._id,
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    totalAmount: 1400,
  }]);

  for (let i = 0; i < 10; i += 1) {
    await ensureBookingConfirmedAlarmNotifications(bookingA, { queueFactory: () => null });
  }
  await ensureBookingConfirmedAlarmNotifications(bookingB, { queueFactory: () => null });

  const adminIds = new Set((await User.find({ role: 'admin' }).select('_id').lean()).map((user) => String(user._id)));
  const bookingANotifications = await PartnerNotification.find({ bookingId: bookingA._id, eventType: 'BOOKING_CONFIRMED' }).lean();
  assert.equal(bookingANotifications.length, adminIds.size + 1);
  assert.equal(bookingANotifications.filter((n) => String(n.recipientUserId) === String(admin._id)).length, 1);
  assert.equal(bookingANotifications.filter((n) => String(n.recipientUserId) === String(partnerA._id)).length, 1);
  assert.equal(bookingANotifications.filter((n) => String(n.recipientUserId) === String(partnerB._id)).length, 0);
  assert.equal(bookingANotifications.filter((n) => n.recipientRole === 'admin' && adminIds.has(String(n.recipientUserId))).length, adminIds.size);
  assert.ok(bookingANotifications.every((n) => n.priority === 'critical'));
  assert.ok(bookingANotifications.every((n) => n.alarmStartedAt && n.alarmExpiresAt && n.alarmStatus === 'alarming'));

  const bookingBNotifications = await PartnerNotification.find({ bookingId: bookingB._id, eventType: 'BOOKING_CONFIRMED' }).lean();
  assert.equal(bookingBNotifications.length, adminIds.size + 1);
  assert.equal(bookingBNotifications.filter((n) => String(n.recipientUserId) === String(admin._id)).length, 1);
  assert.equal(bookingBNotifications.filter((n) => String(n.recipientUserId) === String(partnerA._id)).length, 0);
  assert.equal(bookingBNotifications.filter((n) => String(n.recipientUserId) === String(partnerB._id)).length, 1);
  assert.equal(bookingBNotifications.filter((n) => n.recipientRole === 'admin' && adminIds.has(String(n.recipientUserId))).length, adminIds.size);

  const bookingADeliveries = await NotificationDelivery.find({ bookingId: bookingA._id, eventType: 'booking.confirmed' }).lean();
  assert.equal(bookingADeliveries.length, (adminIds.size + 1) * 2);
  assert.equal(bookingADeliveries.filter((delivery) => delivery.channel === 'in_app').length, adminIds.size + 1);
  assert.equal(bookingADeliveries.filter((delivery) => delivery.channel === 'web_push').length, adminIds.size + 1);
  assert.equal(await NotificationDelivery.countDocuments({ bookingId: bookingA._id, recipientUserId: partnerA._id, channel: 'in_app' }), 1);
  assert.equal(await NotificationDelivery.countDocuments({ bookingId: bookingA._id, recipientUserId: partnerA._id, channel: 'web_push' }), 1);
});

dbTest('notification devices are unique per authenticated user and device id', async () => {
  const user = await User.create({
    name: 'Device Partner',
    email: `device-partner@${TEST_RUN}.test`,
    password: 'x',
    role: 'partner',
    partnerStatus: 'approved',
    phone: '5',
  });
  const first = await NotificationDevice.findOneAndUpdate(
    { userId: user._id, deviceId: `${TEST_RUN}-device` },
    { $set: { userId: user._id, role: 'partner', deviceId: `${TEST_RUN}-device`, permissionStatus: 'granted' } },
    { upsert: true, new: true }
  );
  const second = await NotificationDevice.findOneAndUpdate(
    { userId: user._id, deviceId: `${TEST_RUN}-device` },
    { $set: { userId: user._id, role: 'partner', deviceId: `${TEST_RUN}-device`, permissionStatus: 'denied' } },
    { upsert: true, new: true }
  );
  assert.equal(String(first._id), String(second._id));
  assert.equal(await NotificationDevice.countDocuments({ userId: user._id, deviceId: `${TEST_RUN}-device` }), 1);
});
