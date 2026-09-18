const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const NotificationDelivery = require('../models/NotificationDelivery');
const {
  buildNotificationKey,
  createOrGetNotificationDelivery,
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
  } catch (err) {
    setupError = err;
  }
});

test.after(async () => {
  if (!setupError && mongoose.connection.readyState === 1) {
    await NotificationDelivery.deleteMany({ notificationKey: new RegExp(`^notification:test:${TEST_RUN}`) });
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
