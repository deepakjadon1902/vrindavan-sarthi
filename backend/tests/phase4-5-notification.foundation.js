const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const NotificationDelivery = require('../models/NotificationDelivery');
const PartnerNotification = require('../models/PartnerNotification');
const NotificationDevice = require('../models/NotificationDevice');
const { JOB_NAMES, QUEUE_NAMES } = require('../queues/names');
const {
  buildNotificationKey,
  claimNotificationDelivery,
  classifyNotificationError,
  enqueueNotificationDelivery,
  getBookingAlarmDurationSeconds,
  notificationJobId,
  processNotificationDeliveryJob,
  resetNotificationProvider,
  setNotificationProvider,
} = require('../utils/notificationDelivery');

test('NotificationDelivery schema supports controlled durable states and unique key', () => {
  assert.ok(NotificationDelivery.schema.path('notificationKey').options.unique);
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('queued'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('processing'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('retry_scheduled'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('sent'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('failed'));
});

test('booking alarm model fields and device uniqueness are explicit', () => {
  assert.ok(PartnerNotification.schema.path('eventKey').options.unique);
  assert.ok(PartnerNotification.schema.path('recipientUserId'));
  assert.ok(PartnerNotification.schema.path('bookingId'));
  assert.ok(PartnerNotification.schema.path('alarmExpiresAt'));
  assert.ok(PartnerNotification.schema.path('alarmStatus').enumValues.includes('acknowledged'));
  assert.ok(NotificationDevice.schema.indexes().some(([fields, opts]) =>
    fields.userId === 1 && fields.deviceId === 1 && opts.unique === true
  ));
});

test('booking alarm duration is centralized, defaults to 180 seconds, and is bounded', () => {
  const original = process.env.BOOKING_ALARM_DURATION_SECONDS;
  try {
    delete process.env.BOOKING_ALARM_DURATION_SECONDS;
    assert.equal(getBookingAlarmDurationSeconds(), 180);
    process.env.BOOKING_ALARM_DURATION_SECONDS = '45';
    assert.equal(getBookingAlarmDurationSeconds(), 45);
    process.env.BOOKING_ALARM_DURATION_SECONDS = '99999';
    assert.equal(getBookingAlarmDurationSeconds(), 600);
    process.env.BOOKING_ALARM_DURATION_SECONDS = '-1';
    assert.equal(getBookingAlarmDurationSeconds(), 180);
  } finally {
    if (typeof original === 'undefined') delete process.env.BOOKING_ALARM_DURATION_SECONDS;
    else process.env.BOOKING_ALARM_DURATION_SECONDS = original;
  }
});

test('notification keys are deterministic and scoped by event', () => {
  const id = new mongoose.Types.ObjectId();
  assert.equal(buildNotificationKey('booking', id, 'invoice'), buildNotificationKey('booking', id, 'invoice'));
  assert.notEqual(buildNotificationKey('booking', id, 'invoice'), buildNotificationKey('booking', id, 'cancelled'));
});

test('notification queue job id is deterministic and minimal', async () => {
  const id = new mongoose.Types.ObjectId();
  const calls = [];
  const delivery = { _id: id };
  const result = await enqueueNotificationDelivery(delivery, {
    queueFactory: (queueName) => ({
      add: async (jobName, data, opts) => calls.push({ queueName, jobName, data, opts }),
    }),
  });
  assert.equal(result.queued, true);
  assert.equal(calls[0].queueName, QUEUE_NAMES.notification);
  assert.equal(calls[0].jobName, JOB_NAMES.notificationDeliverySend);
  assert.deepEqual(calls[0].data, { notificationDeliveryId: String(id) });
  assert.equal(calls[0].opts.jobId, notificationJobId(id));
});

test('queue unavailable leaves durable notification recoverable', async () => {
  const result = await enqueueNotificationDelivery({ _id: new mongoose.Types.ObjectId() }, { queueFactory: () => null });
  assert.equal(result.queued, false);
  assert.equal(result.reason, 'redis_not_configured');
});

test('error classification separates transient and permanent provider failures', () => {
  assert.equal(classifyNotificationError({ httpStatus: 500 }), 'transient');
  assert.equal(classifyNotificationError({ httpStatus: 429 }), 'transient');
  assert.equal(classifyNotificationError({ code: 'EMAIL_PROVIDER_NOT_CONFIGURED' }), 'permanent');
  assert.equal(classifyNotificationError({ code: 'INVALID_TEMPLATE' }), 'permanent');
  assert.equal(classifyNotificationError({ code: 'PROVIDER_OUTCOME_UNKNOWN' }), 'unknown');
});

test('worker claim atomically moves queued notification to processing', async () => {
  const id = new mongoose.Types.ObjectId();
  const calls = [];
  const Model = {
    findOneAndUpdate: async (query, update, options) => {
      calls.push({ query, update, options });
      return { _id: id, status: 'processing' };
    },
  };
  const claimed = await claimNotificationDelivery({ notificationDeliveryId: id, Model });
  assert.equal(String(claimed._id), String(id));
  assert.equal(calls[0].query._id, id);
  assert.equal(calls[0].update.$set.status, 'processing');
  assert.equal(calls[0].update.$inc.attempts, 1);
});

test('worker duplicate delivery skips already sent records', async () => {
  const id = new mongoose.Types.ObjectId();
  let providerCalls = 0;
  setNotificationProvider({
    deliver: async () => {
      providerCalls += 1;
      return { provider: 'fake', providerMessageId: 'msg_fake' };
    },
  });
  const originalFindOneAndUpdate = NotificationDelivery.findOneAndUpdate;
  const originalFindById = NotificationDelivery.findById;
  NotificationDelivery.findOneAndUpdate = async () => null;
  NotificationDelivery.findById = async () => ({ _id: id, status: 'sent' });
  try {
    const result = await processNotificationDeliveryJob({ notificationDeliveryId: String(id) });
    assert.equal(result.skipped, true);
    assert.equal(result.status, 'sent');
    assert.equal(providerCalls, 0);
  } finally {
    NotificationDelivery.findOneAndUpdate = originalFindOneAndUpdate;
    NotificationDelivery.findById = originalFindById;
    resetNotificationProvider();
  }
});
