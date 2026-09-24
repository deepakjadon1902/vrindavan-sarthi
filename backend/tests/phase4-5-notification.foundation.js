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
const { getWebPushConfig, validateWebPushConfig, isInvalidSubscriptionError } = require('../utils/webPushProvider');
const { getFcmConfig, validateFcmConfig } = require('../utils/fcmProvider');

test('NotificationDelivery schema supports controlled durable states and unique key', () => {
  assert.ok(NotificationDelivery.schema.path('notificationKey').options.unique);
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('queued'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('processing'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('retry_scheduled'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('sent'));
  assert.ok(NotificationDelivery.schema.path('status').enumValues.includes('failed'));
  assert.ok(NotificationDelivery.schema.path('channel').enumValues.includes('web_push'));
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
  assert.ok(NotificationDevice.schema.path('pushSubscription'));
  assert.ok(NotificationDevice.schema.path('notificationEnabled'));
  assert.ok(NotificationDevice.schema.path('lastPushSuccessAt'));
  assert.ok(NotificationDevice.schema.path('failureCount'));
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
  assert.equal(calls[0].opts.jobId.includes(':'), false);
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
  assert.equal(classifyNotificationError({ code: 'WEB_PUSH_NOT_CONFIGURED' }), 'permanent');
  assert.equal(classifyNotificationError({ code: 'FCM_NOT_CONFIGURED' }), 'permanent');
});

test('web push configuration is explicit and stable', () => {
  const originalPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const originalPrivate = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const originalSubject = process.env.WEB_PUSH_VAPID_SUBJECT;
  try {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.WEB_PUSH_VAPID_SUBJECT;
    assert.equal(getWebPushConfig().configured, false);
    assert.throws(() => validateWebPushConfig({ required: true }), /WEB_PUSH_VAPID_PUBLIC_KEY/);
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'public';
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'private';
    process.env.WEB_PUSH_VAPID_SUBJECT = 'mailto:test@example.com';
    const config = getWebPushConfig();
    assert.equal(config.configured, true);
    assert.equal(config.publicKey, 'public');
  } finally {
    if (typeof originalPublic === 'undefined') delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    else process.env.WEB_PUSH_VAPID_PUBLIC_KEY = originalPublic;
    if (typeof originalPrivate === 'undefined') delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    else process.env.WEB_PUSH_VAPID_PRIVATE_KEY = originalPrivate;
    if (typeof originalSubject === 'undefined') delete process.env.WEB_PUSH_VAPID_SUBJECT;
    else process.env.WEB_PUSH_VAPID_SUBJECT = originalSubject;
  }
});

test('invalid push subscription errors are recognized for revocation', () => {
  assert.equal(isInvalidSubscriptionError({ statusCode: 404 }), true);
  assert.equal(isInvalidSubscriptionError({ statusCode: 410 }), true);
  assert.equal(isInvalidSubscriptionError({ statusCode: 500 }), false);
});

test('native Android FCM configuration is independent from browser Web Push', () => {
  const originalFcmProject = process.env.FCM_PROJECT_ID;
  const originalFcmEmail = process.env.FCM_CLIENT_EMAIL;
  const originalFcmKey = process.env.FCM_PRIVATE_KEY;
  const originalWebPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const originalWebPrivate = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const originalWebSubject = process.env.WEB_PUSH_VAPID_SUBJECT;
  try {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.WEB_PUSH_VAPID_SUBJECT;
    delete process.env.FCM_PROJECT_ID;
    delete process.env.FCM_CLIENT_EMAIL;
    delete process.env.FCM_PRIVATE_KEY;

    assert.equal(getWebPushConfig().configured, false);
    assert.equal(getFcmConfig().configured, false);
    assert.throws(() => validateFcmConfig({ required: true }), /FCM_PROJECT_ID/);

    process.env.FCM_PROJECT_ID = 'vrindavan-test';
    process.env.FCM_CLIENT_EMAIL = 'firebase-adminsdk@example.iam.gserviceaccount.com';
    process.env.FCM_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n';

    const fcmConfig = getFcmConfig();
    assert.equal(getWebPushConfig().configured, false);
    assert.equal(fcmConfig.configured, true);
    assert.equal(fcmConfig.privateKey.includes('\\n'), false);
    assert.doesNotThrow(() => validateFcmConfig({ required: true }));
  } finally {
    if (typeof originalFcmProject === 'undefined') delete process.env.FCM_PROJECT_ID;
    else process.env.FCM_PROJECT_ID = originalFcmProject;
    if (typeof originalFcmEmail === 'undefined') delete process.env.FCM_CLIENT_EMAIL;
    else process.env.FCM_CLIENT_EMAIL = originalFcmEmail;
    if (typeof originalFcmKey === 'undefined') delete process.env.FCM_PRIVATE_KEY;
    else process.env.FCM_PRIVATE_KEY = originalFcmKey;
    if (typeof originalWebPublic === 'undefined') delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    else process.env.WEB_PUSH_VAPID_PUBLIC_KEY = originalWebPublic;
    if (typeof originalWebPrivate === 'undefined') delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    else process.env.WEB_PUSH_VAPID_PRIVATE_KEY = originalWebPrivate;
    if (typeof originalWebSubject === 'undefined') delete process.env.WEB_PUSH_VAPID_SUBJECT;
    else process.env.WEB_PUSH_VAPID_SUBJECT = originalWebSubject;
  }
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
