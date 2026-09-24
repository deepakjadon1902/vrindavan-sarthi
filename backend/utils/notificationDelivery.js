const crypto = require('crypto');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Order = require('../models/Order');
const PartnerNotification = require('../models/PartnerNotification');
const NotificationDelivery = require('../models/NotificationDelivery');
const NotificationDevice = require('../models/NotificationDevice');
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const { createQueue } = require('../queues/factory');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');
const { getBackoffBaseMs } = require('../config/redis');
const {
  sendBookingInvoice,
  sendOrderInvoice,
  sendBookingCancellationEmail,
  sendOrderCancellationEmail,
  sendAdminAlert,
  sendPartnerBookingAlert,
  bookingRows,
  orderRows,
} = require('./customerMessages');
const {
  sendWebPush,
  isInvalidSubscriptionError,
  validateWebPushConfig,
  getWebPushConfig,
} = require('./webPushProvider');
const {
  sendFcmAlarm,
  isInvalidFcmTokenError,
  getFcmConfig,
} = require('./fcmProvider');

const PROCESSING_STALE_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RECOVERY_BATCH_SIZE = 50;
const BOOKING_CONFIRMED_EVENT = 'BOOKING_CONFIRMED';
const DHARAMSHALA_PROPERTY_REVIEW_EVENT = 'DHARAMSHALA_PROPERTY_REVIEW';
const BOOKING_REQUIRES_ACTION_EVENT = 'BOOKING_REQUIRES_ACTION';
const ALARM_PUSH_REPEAT_SECONDS = [30, 60, 90, 120, 150];

let notificationProvider = null;

const normalize = (value) => String(value || '').trim();

const hashValue = (value) =>
  crypto.createHash('sha256').update(normalize(value).toLowerCase()).digest('hex').slice(0, 24);

const safeErrorMessage = (err) =>
  normalize(err?.message || err || 'Notification delivery failed').slice(0, 500);

const buildNotificationKey = (...parts) =>
  ['notification', ...parts.map((part) => normalize(part).replace(/:/g, '-'))].join(':');

const notificationJobId = (notificationDeliveryId) => `notification:${notificationDeliveryId}`;

const setNotificationProvider = (provider) => {
  notificationProvider = provider;
};

const resetNotificationProvider = () => {
  notificationProvider = null;
};

const classifyNotificationError = (err) => {
  const statusCode = Number(err?.statusCode || err?.httpStatus || 0);
  const code = normalize(err?.code).toUpperCase();
  if (code === 'WEB_PUSH_NOT_CONFIGURED' || code === 'FCM_NOT_CONFIGURED') return 'permanent';
  if (['EMAIL_PROVIDER_NOT_CONFIGURED', 'RESEND_FROM_MISSING', 'RESEND_FROM_NOT_VERIFIED', 'EAUTH'].includes(code)) {
    return 'permanent';
  }
  if (['INVALID_RECIPIENT', 'INVALID_TEMPLATE', 'MALFORMED_NOTIFICATION_PAYLOAD'].includes(code)) {
    return 'permanent';
  }
  if (statusCode === 429 || statusCode >= 500) return 'transient';
  if (['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE', 'ERR_HTTP2_STREAM_CANCEL'].includes(code)) {
    return 'transient';
  }
  if (statusCode >= 400 && statusCode < 500) return 'permanent';
  if (code === 'PROVIDER_OUTCOME_UNKNOWN') return 'unknown';
  return 'unknown';
};

const createOrGetNotificationDelivery = async ({
  notificationKey,
  eventType,
  channel,
  template,
  recipient,
  recipientUserId,
  bookingId,
  orderId,
  modificationId,
  partnerId,
  hotelId,
  payload = {},
  provider = 'internal',
  nextAttemptAt,
}) => {
  const doc = {
    notificationKey,
    eventType,
    channel,
    template,
    recipient: normalize(recipient),
    recipientUserId,
    bookingId,
    orderId,
    modificationId,
    partnerId,
    hotelId,
    payload,
    provider,
    status: 'queued',
    nextAttemptAt: nextAttemptAt || new Date(),
  };

  try {
    return await NotificationDelivery.create(doc);
  } catch (err) {
    if (String(err?.code) !== '11000') throw err;
    const existing = await NotificationDelivery.findOne({ notificationKey });
    if (!existing) throw err;
    return existing;
  }
};

const enqueueNotificationDelivery = async (delivery, { queueFactory = createQueue } = {}) => {
  const queue = queueFactory(QUEUE_NAMES.notification, { required: false });
  if (!queue) return { queued: false, reason: 'redis_not_configured' };
  const delay = Math.max(0, new Date(delivery.nextAttemptAt || Date.now()).getTime() - Date.now());
  await queue.add(
    JOB_NAMES.notificationDeliverySend,
    { notificationDeliveryId: String(delivery._id) },
    {
      jobId: notificationJobId(delivery._id),
      attempts: 1,
      delay,
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
    }
  );
  return { queued: true };
};

const ensureNotificationDelivery = async (input, options = {}) => {
  const delivery = await createOrGetNotificationDelivery(input);
  if (!['sent', 'failed', 'cancelled', 'reconciliation_required'].includes(String(delivery.status))) {
    await enqueueNotificationDelivery(delivery, options);
    if (input.channel === 'web_push' &&
        options.immediateWebPush !== false &&
        (getWebPushConfig().configured || getFcmConfig().configured)) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.web_push.immediate_failed]', err?.message || err);
      });
    }
  }
  return delivery;
};

const ensureBookingAlarmPushDeliveries = ({
  notificationKeyPrefix,
  eventType,
  recipientUserId,
  bookingId,
  partnerId,
  hotelId,
  notificationId,
  template = 'booking_alarm_web_push',
}, options = {}) =>
  bookingAlarmPushOffsets().map((offsetSeconds) => ensureNotificationDelivery({
    notificationKey: buildNotificationKey(notificationKeyPrefix, bookingId, recipientUserId, offsetSeconds ? `web-push-repeat-${offsetSeconds}` : 'web-push'),
    eventType,
    channel: 'web_push',
    template,
    recipientUserId,
    bookingId,
    partnerId,
    hotelId,
    payload: { notificationId, alarmPushOffsetSeconds: offsetSeconds },
    provider: 'web_push',
    nextAttemptAt: offsetSeconds ? new Date(Date.now() + offsetSeconds * 1000) : new Date(),
  }, offsetSeconds ? { ...options, immediateWebPush: false } : options));

const claimNotificationDelivery = async ({ notificationDeliveryId, now = new Date(), Model = NotificationDelivery }) => {
  if (!mongoose.Types.ObjectId.isValid(String(notificationDeliveryId || ''))) {
    const err = new Error('Invalid notification delivery id');
    err.statusCode = 400;
    throw err;
  }
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_MS);
  return Model.findOneAndUpdate(
    {
      _id: notificationDeliveryId,
      $or: [
        { status: 'queued', nextAttemptAt: { $lte: now } },
        { status: 'queued', nextAttemptAt: { $exists: false } },
        { status: 'retry_scheduled', nextAttemptAt: { $lte: now } },
        { status: 'processing', processingStartedAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: { status: 'processing', processingStartedAt: now },
      $inc: { attempts: 1 },
    },
    { new: true }
  );
};

const markNotificationSent = async (delivery, result = {}) => {
  delivery.status = 'sent';
  delivery.sentAt = new Date();
  delivery.nextAttemptAt = undefined;
  delivery.processingStartedAt = undefined;
  delivery.lastError = undefined;
  delivery.lastErrorAt = undefined;
  if (result.provider) delivery.provider = result.provider;
  if (result.providerMessageId) delivery.providerMessageId = result.providerMessageId;
  await delivery.save();
  return delivery;
};

const markNotificationRetry = async (delivery, err) => {
  if (Number(delivery.attempts || 0) >= DEFAULT_MAX_ATTEMPTS) {
    delivery.status = 'failed';
    delivery.failedAt = new Date();
    delivery.nextAttemptAt = undefined;
  } else {
    delivery.status = 'retry_scheduled';
    delivery.nextAttemptAt = new Date(Date.now() + getBackoffBaseMs() * Math.max(1, Number(delivery.attempts || 1)));
  }
  delivery.processingStartedAt = undefined;
  delivery.lastError = safeErrorMessage(err);
  delivery.lastErrorAt = new Date();
  await delivery.save();
  return delivery;
};

const markNotificationFailed = async (delivery, err) => {
  delivery.status = 'failed';
  delivery.failedAt = new Date();
  delivery.nextAttemptAt = undefined;
  delivery.processingStartedAt = undefined;
  delivery.lastError = safeErrorMessage(err);
  delivery.lastErrorAt = new Date();
  await delivery.save();
  return delivery;
};

const markNotificationUnknown = async (delivery, err) => {
  delivery.status = 'reconciliation_required';
  delivery.nextAttemptAt = undefined;
  delivery.processingStartedAt = undefined;
  delivery.lastError = safeErrorMessage(err);
  delivery.lastErrorAt = new Date();
  await delivery.save();
  return delivery;
};

const createPanelNotification = async ({ delivery, booking, order, audience, partnerId }) => {
  const isBooking = Boolean(booking);
  const entityId = String((booking || order)?._id || '');
  const title = isBooking
    ? `New booking ${booking.bookingId}`
    : `New order ${order.orderId}`;
  const message = isBooking
    ? `${booking.itemName} by ${booking.customerFullName || booking.userName}. Amount INR ${Number(booking.totalAmount || 0).toLocaleString('en-IN')}.`
    : `${order.productName} by ${order.userName}. Amount INR ${Number(order.totalAmount || 0).toLocaleString('en-IN')}.`;

  const query = {
    type: 'notification',
    audience,
    entityType: isBooking ? 'booking' : 'order',
    entityId,
    ...(partnerId ? { partnerId } : {}),
  };
  await PartnerNotification.updateOne(
    query,
    {
      $setOnInsert: {
        title,
        message,
        ...query,
      },
    },
    { upsert: true }
  );
  return { provider: 'mongodb', providerMessageId: String(delivery._id) };
};

const getBookingAlarmDurationSeconds = () => {
  const configured = Number(process.env.BOOKING_ALARM_DURATION_SECONDS || 180);
  if (!Number.isFinite(configured) || configured <= 0) return 180;
  return Math.min(10 * 60, Math.floor(configured));
};

const bookingAlarmPushOffsets = () => {
  const duration = getBookingAlarmDurationSeconds();
  return [0, ...ALARM_PUSH_REPEAT_SECONDS.filter((seconds) => seconds < duration)];
};

const resolveBookingPartnerId = async (booking) => {
  if (booking?.hotelId) {
    const hotel = await Hotel.findById(booking.hotelId).select('partnerId').lean();
    if (hotel?.partnerId) return hotel.partnerId;
  }
  return booking?.partnerId || null;
};

const bookingConfirmedMessage = (booking) => {
  const guest = booking.customerFullName || booking.userName || 'Guest';
  const item = booking.itemName || 'Booking';
  const amount = Number(booking.totalAmount || booking.customer_total || 0);
  return `${item} confirmed for ${guest}. Amount INR ${amount.toLocaleString('en-IN')}.`;
};

const dharamshalaPropertyReviewMessage = (booking) => {
  const guest = booking.customerFullName || booking.userName || 'Guest';
  const item = booking.itemName || 'Dharamshala booking';
  const checkIn = booking.checkIn ? new Date(booking.checkIn).toISOString().slice(0, 10) : '';
  return `${item} needs property review for ${guest}${checkIn ? `, check-in ${checkIn}` : ''}.`;
};

const bookingRequiresActionMessage = (booking) => {
  const guest = booking.customerFullName || booking.userName || 'Guest';
  const item = booking.itemName || 'Booking';
  const status = String(booking.bookingStatus || 'pending').replace(/_/g, ' ');
  return `${item} needs review for ${guest}. Current status: ${status}.`;
};

const terminalBookingStatuses = new Set([
  'cancelled',
  'completed',
  'checked_out',
  'expired',
  'rejected',
  'rejected_by_property',
  'expired_property_no_response',
  'payment_failed',
  'refund_completed',
]);

const isBookingActionAlarmEligible = (booking) => {
  if (!booking) return false;
  const status = String(booking.bookingStatus || '').trim().toLowerCase();
  if (!status || status === 'confirmed' || terminalBookingStatuses.has(status)) return false;
  const propertyType = String(booking.propertyType || '').trim().toLowerCase();
  if (propertyType === 'dharamshala' && status === 'pending_property_confirmation') return false;
  return true;
};

const bookingNotificationDeepLink = (recipientRole) =>
  recipientRole === 'partner' ? '/partner/bookings' : '/admin/bookings';

const buildPushPayload = ({ notification, booking }) => ({
  version: 1,
  notificationId: String(notification._id),
  type: notification.eventType || BOOKING_CONFIRMED_EVENT,
  priority: notification.priority || 'critical',
  title: notification.title || `Booking confirmed ${booking?.bookingId || ''}`.trim(),
  body: notification.message || bookingConfirmedMessage(booking),
  bookingId: String(notification.bookingId || booking?._id || ''),
  deepLink: bookingNotificationDeepLink(notification.recipientRole),
});

const markDevicePushSuccess = (device) =>
  NotificationDevice.updateOne(
    { _id: device._id },
    {
      $set: { lastPushSuccessAt: new Date(), pushSubscriptionError: '' },
    }
  );

const markDevicePushFailure = (device, err) =>
  NotificationDevice.updateOne(
    { _id: device._id },
    {
      $set: { lastPushFailureAt: new Date(), pushSubscriptionError: safeErrorMessage(err) },
      $inc: { failureCount: 1 },
    }
  );

const revokeInvalidPushSubscription = (device, err) =>
  NotificationDevice.updateOne(
    { _id: device._id },
    {
      $set: {
        notificationEnabled: false,
        pushSubscription: null,
        pushSubscriptionRevokedAt: new Date(),
        lastPushFailureAt: new Date(),
        pushSubscriptionError: safeErrorMessage(err),
      },
      $inc: { failureCount: 1 },
    }
  );

const revokeInvalidFcmToken = (device, err) =>
  NotificationDevice.updateOne(
    { _id: device._id },
    {
      $set: {
        notificationEnabled: false,
        fcmToken: '',
        lastPushFailureAt: new Date(),
        pushSubscriptionError: safeErrorMessage(err),
      },
      $inc: { failureCount: 1 },
    }
  );

const deliverBookingConfirmedWebPush = async (delivery) => {
  const notificationId = delivery.payload?.notificationId;
  const notification = notificationId
    ? await PartnerNotification.findById(notificationId).lean()
    : null;
  if (!notification) {
    const err = new Error('PartnerNotification not found for Web Push delivery');
    err.code = 'MALFORMED_NOTIFICATION_PAYLOAD';
    throw err;
  }

  if (notification.acknowledgedAt || notification.alarmStatus === 'acknowledged') {
    return { provider: 'web_push', providerMessageId: 'already-acknowledged', deviceResults: [] };
  }

  const booking = await Booking.findById(delivery.bookingId).lean();
  const devices = await NotificationDevice.find({
    userId: delivery.recipientUserId,
    revokedAt: null,
    notificationEnabled: true,
    permissionStatus: 'granted',
    $or: [
      { 'pushSubscription.endpoint': { $exists: true, $ne: '' } },
      { fcmToken: { $exists: true, $ne: '' } },
    ],
  }).lean();

  const payload = buildPushPayload({ notification, booking });
  const results = [];
  for (const device of devices) {
    try {
      let result;
      if (device.fcmToken) {
        if (!getFcmConfig().configured) {
          const err = new Error('FCM is not configured for native Android alarm delivery');
          err.code = 'FCM_NOT_CONFIGURED';
          throw err;
        }
        result = await sendFcmAlarm(device.fcmToken, {
          ...payload,
          ttl: Math.max(30, getBookingAlarmDurationSeconds()),
        });
      } else {
        validateWebPushConfig({ required: true });
        result = await sendWebPush(device.pushSubscription, payload, {
          ttl: Math.max(30, getBookingAlarmDurationSeconds()),
          urgency: 'high',
        });
      }
      await markDevicePushSuccess(device);
      results.push({ deviceId: device.deviceId, status: 'accepted', provider: result.provider, providerMessageId: result.providerMessageId });
      console.log('[notification_push_sent]', JSON.stringify({
        notificationId: notification._id,
        bookingId: delivery.bookingId,
        recipientUserId: delivery.recipientUserId,
        recipientRole: notification.recipientRole,
        deviceId: device.deviceId,
        channel: device.fcmToken ? 'fcm' : 'web_push',
        timestamp: new Date().toISOString(),
      }));
    } catch (err) {
      if (isInvalidSubscriptionError(err)) {
        await revokeInvalidPushSubscription(device, err);
        results.push({ deviceId: device.deviceId, status: 'revoked', error: safeErrorMessage(err) });
      } else if (isInvalidFcmTokenError(err)) {
        await revokeInvalidFcmToken(device, err);
        results.push({ deviceId: device.deviceId, status: 'revoked', provider: 'fcm', error: safeErrorMessage(err) });
      } else {
        await markDevicePushFailure(device, err);
        results.push({ deviceId: device.deviceId, status: 'failed', error: safeErrorMessage(err) });
      }
    }
  }

  delivery.payload = { ...(delivery.payload || {}), deviceResults: results, deviceAttemptedCount: results.length };
  await delivery.save();
  return {
    provider: 'web_push',
    providerMessageId: results.length ? `devices:${results.length}` : 'no-active-devices',
  };
};

const createBookingAlarmNotification = async ({
  booking,
  recipientUserId,
  recipientRole,
  partnerId,
  eventType = BOOKING_CONFIRMED_EVENT,
  title,
  message,
}) => {
  const now = new Date();
  const alarmExpiresAt = new Date(now.getTime() + getBookingAlarmDurationSeconds() * 1000);
  const eventKey = `${eventType}:${booking._id}:${recipientUserId}`;
  const doc = {
    eventKey,
    title,
    message,
    type: 'notification',
    audience: recipientRole === 'admin' ? 'admin' : 'partner',
    recipientUserId,
    recipientRole,
    partnerId: partnerId || booking.partnerId,
    hotelId: booking.hotelId,
    bookingId: booking._id,
    eventType,
    priority: 'critical',
    entityType: 'booking',
    entityId: String(booking._id),
    alarmStatus: 'alarming',
    alarmStartedAt: now,
    alarmExpiresAt,
    metadata: {
      bookingCode: booking.bookingId,
      bookingType: booking.bookingType,
      propertyType: booking.propertyType,
      itemName: booking.itemName,
      guestName: booking.customerFullName || booking.userName,
      guestPhone: booking.customerMobile || booking.userPhone,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalAmount: booking.totalAmount,
      bookingStatus: booking.bookingStatus,
      paymentMode: booking.paymentMode,
      requestExpiresAt: booking.requestExpiresAt,
    },
  };

  try {
    const created = await PartnerNotification.create(doc);
    console.log('[notification_created]', JSON.stringify({
      notificationId: created._id,
      bookingId: booking._id,
      recipientUserId,
      recipientRole,
      eventType,
      timestamp: now.toISOString(),
    }));
    return created;
  } catch (err) {
    if (String(err?.code) !== '11000') throw err;
    return PartnerNotification.findOne({ eventKey });
  }
};

const ensureBookingConfirmedAlarmNotifications = async (booking, options = {}) => {
  if (!booking || String(booking.bookingStatus || '') !== 'confirmed') return [];
  if (mongoose.connection.readyState !== 1) {
    console.warn('[booking.confirmed.notification_skipped]', JSON.stringify({
      bookingId: booking._id,
      reason: 'database_not_connected',
      eventType: BOOKING_CONFIRMED_EVENT,
      timestamp: new Date().toISOString(),
    }));
    return [];
  }
  const partnerId = await resolveBookingPartnerId(booking);
  const admins = await User.find({ role: 'admin' }).select('_id role email').lean();
  const recipients = admins.map((admin) => ({
    recipientUserId: admin._id,
    recipientRole: 'admin',
  }));

  if (partnerId) {
    recipients.push({
      recipientUserId: partnerId,
      recipientRole: 'partner',
      partnerId,
    });
  }

  const notifications = await Promise.all(recipients.map((recipient) =>
    createBookingAlarmNotification({
      booking,
      ...recipient,
      eventType: BOOKING_CONFIRMED_EVENT,
      title: `Booking confirmed ${booking.bookingId}`,
      message: bookingConfirmedMessage(booking),
    })
  ));

  const deliveries = [];
  for (const notification of notifications.filter(Boolean)) {
    deliveries.push(ensureNotificationDelivery({
      notificationKey: buildNotificationKey('booking-confirmed', booking._id, notification.recipientUserId, 'panel'),
      eventType: 'booking.confirmed',
      channel: 'in_app',
      template: notification.recipientRole === 'admin' ? 'booking_confirmed_admin_panel' : 'booking_confirmed_partner_panel',
      recipientUserId: notification.recipientUserId,
      bookingId: booking._id,
      partnerId,
      hotelId: booking.hotelId,
      payload: { notificationId: notification._id },
    }, options));
    deliveries.push(...ensureBookingAlarmPushDeliveries({
      notificationKeyPrefix: 'booking-confirmed',
      eventType: 'booking.confirmed',
      recipientUserId: notification.recipientUserId,
      bookingId: booking._id,
      partnerId,
      hotelId: booking.hotelId,
      notificationId: notification._id,
      template: 'booking_confirmed_web_push',
    }, options));
  }

  await Promise.all(deliveries);
  return notifications;
};

const ensureDharamshalaPropertyReviewAlarmNotifications = async (booking, options = {}) => {
  if (!booking ||
      String(booking.propertyType || '').toLowerCase() !== 'dharamshala' ||
      String(booking.bookingStatus || '') !== 'pending_property_confirmation') {
    return [];
  }
  if (mongoose.connection.readyState !== 1) {
    console.warn('[dharamshala.review.notification_skipped]', JSON.stringify({
      bookingId: booking._id,
      reason: 'database_not_connected',
      eventType: DHARAMSHALA_PROPERTY_REVIEW_EVENT,
      timestamp: new Date().toISOString(),
    }));
    return [];
  }

  const partnerId = await resolveBookingPartnerId(booking);
  const admins = await User.find({ role: 'admin' }).select('_id role email').lean();
  const recipients = admins.map((admin) => ({
    recipientUserId: admin._id,
    recipientRole: 'admin',
  }));
  if (partnerId) {
    recipients.push({
      recipientUserId: partnerId,
      recipientRole: 'partner',
      partnerId,
    });
  }

  const notifications = await Promise.all(recipients.map((recipient) =>
    createBookingAlarmNotification({
      booking,
      ...recipient,
      eventType: DHARAMSHALA_PROPERTY_REVIEW_EVENT,
      title: `Dharamshala review ${booking.bookingId}`,
      message: dharamshalaPropertyReviewMessage(booking),
    })
  ));

  const deliveries = [];
  for (const notification of notifications.filter(Boolean)) {
    deliveries.push(ensureNotificationDelivery({
      notificationKey: buildNotificationKey('dharamshala-review', booking._id, notification.recipientUserId, 'panel'),
      eventType: 'dharamshala.property_review',
      channel: 'in_app',
      template: notification.recipientRole === 'admin' ? 'dharamshala_review_admin_panel' : 'dharamshala_review_partner_panel',
      recipientUserId: notification.recipientUserId,
      bookingId: booking._id,
      partnerId,
      hotelId: booking.hotelId,
      payload: { notificationId: notification._id },
    }, options));
    deliveries.push(...ensureBookingAlarmPushDeliveries({
      notificationKeyPrefix: 'dharamshala-review',
      eventType: 'dharamshala.property_review',
      recipientUserId: notification.recipientUserId,
      bookingId: booking._id,
      partnerId,
      hotelId: booking.hotelId,
      notificationId: notification._id,
    }, options));
  }

  await Promise.all(deliveries);
  return notifications;
};

const ensureBookingRequiresActionAlarmNotifications = async (booking, options = {}) => {
  if (!isBookingActionAlarmEligible(booking)) return [];
  if (mongoose.connection.readyState !== 1) {
    console.warn('[booking.requires_action.notification_skipped]', JSON.stringify({
      bookingId: booking._id,
      reason: 'database_not_connected',
      eventType: BOOKING_REQUIRES_ACTION_EVENT,
      timestamp: new Date().toISOString(),
    }));
    return [];
  }

  const partnerId = await resolveBookingPartnerId(booking);
  const admins = await User.find({ role: 'admin' }).select('_id role email').lean();
  const recipients = admins.map((admin) => ({
    recipientUserId: admin._id,
    recipientRole: 'admin',
  }));
  if (partnerId) {
    recipients.push({
      recipientUserId: partnerId,
      recipientRole: 'partner',
      partnerId,
    });
  }

  const notifications = await Promise.all(recipients.map((recipient) =>
    createBookingAlarmNotification({
      booking,
      ...recipient,
      eventType: BOOKING_REQUIRES_ACTION_EVENT,
      title: `Booking needs review ${booking.bookingId}`,
      message: bookingRequiresActionMessage(booking),
    })
  ));

  const deliveries = [];
  for (const notification of notifications.filter(Boolean)) {
    deliveries.push(ensureNotificationDelivery({
      notificationKey: buildNotificationKey('booking-requires-action', booking._id, notification.recipientUserId, 'panel'),
      eventType: 'booking.requires_action',
      channel: 'in_app',
      template: notification.recipientRole === 'admin' ? 'booking_action_required_admin_panel' : 'booking_action_required_partner_panel',
      recipientUserId: notification.recipientUserId,
      bookingId: booking._id,
      partnerId,
      hotelId: booking.hotelId,
      payload: { notificationId: notification._id },
    }, options));
    deliveries.push(...ensureBookingAlarmPushDeliveries({
      notificationKeyPrefix: 'booking-requires-action',
      eventType: 'booking.requires_action',
      recipientUserId: notification.recipientUserId,
      bookingId: booking._id,
      partnerId,
      hotelId: booking.hotelId,
      notificationId: notification._id,
    }, options));
  }

  await Promise.all(deliveries);
  return notifications;
};

const deliverWithDefaultProvider = async (delivery) => {
  const template = String(delivery.template || '');
  if (template.startsWith('booking_')) {
    const booking = await Booking.findById(delivery.bookingId);
    if (!booking) {
      const err = new Error('Booking not found for notification');
      err.code = 'MALFORMED_NOTIFICATION_PAYLOAD';
      throw err;
    }
    if (template === 'booking_invoice') {
      if (booking.invoiceSentAt) return { provider: 'internal', providerMessageId: 'already-sent' };
      const result = await sendBookingInvoice(booking);
      await Booking.updateOne({ _id: booking._id, invoiceSentAt: { $exists: false } }, { $set: { invoiceSentAt: new Date() } });
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }
    if (template === 'booking_cancelled') {
      const result = await sendBookingCancellationEmail(booking, delivery.payload?.reason || booking.cancellationReason || 'Cancelled');
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }
    if (template === 'booking_partner_email') {
      const result = await sendPartnerBookingAlert(booking);
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }
    if (template === 'booking_admin_email') {
      const result = await sendAdminAlert({
        subject: `New booking ${booking.bookingId}`,
        title: 'New booking received',
        intro: 'A customer has submitted a booking. Admin confirmation may be required.',
        rows: bookingRows(booking),
      });
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }
    if (template === 'booking_admin_panel') {
      return createPanelNotification({ delivery, booking, audience: 'admin' });
    }
    if (template === 'booking_partner_panel') {
      return createPanelNotification({ delivery, booking, audience: 'partner', partnerId: booking.partnerId });
    }
    if (template === 'booking_confirmed_admin_panel' ||
        template === 'booking_confirmed_partner_panel' ||
        template === 'booking_action_required_admin_panel' ||
        template === 'booking_action_required_partner_panel' ||
        template === 'dharamshala_review_admin_panel' ||
        template === 'dharamshala_review_partner_panel') {
      return { provider: 'mongodb', providerMessageId: String(delivery.payload?.notificationId || delivery._id) };
    }
    if (template === 'booking_confirmed_web_push' || template === 'booking_alarm_web_push') {
      return deliverBookingConfirmedWebPush(delivery);
    }
  }

  if (template.startsWith('order_')) {
    const order = await Order.findById(delivery.orderId);
    if (!order) {
      const err = new Error('Order not found for notification');
      err.code = 'MALFORMED_NOTIFICATION_PAYLOAD';
      throw err;
    }
    if (template === 'order_invoice') {
      if (order.invoiceSentAt) return { provider: 'internal', providerMessageId: 'already-sent' };
      const result = await sendOrderInvoice(order);
      await Order.updateOne({ _id: order._id, invoiceSentAt: { $exists: false } }, { $set: { invoiceSentAt: new Date() } });
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }
    if (template === 'order_cancelled') {
      const result = await sendOrderCancellationEmail(order, delivery.payload?.reason || order.cancellationReason || 'Cancelled');
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }
    if (template === 'order_admin_email') {
      const result = await sendAdminAlert({
        subject: `New order ${order.orderId}`,
        title: 'New shop order received',
        intro: 'A customer has submitted a product order. Admin confirmation may be required.',
        rows: orderRows(order),
      });
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }
    if (template === 'order_admin_panel') {
      return createPanelNotification({ delivery, order, audience: 'admin' });
    }
  }

  const err = new Error(`Unsupported notification template: ${template}`);
  err.code = 'INVALID_TEMPLATE';
  throw err;
};

const processNotificationDeliveryJob = async (jobData, options = {}) => {
  const notificationDeliveryId = normalize(jobData?.notificationDeliveryId);
  const claimed = await claimNotificationDelivery({ notificationDeliveryId });
  if (!claimed) {
    const existing = await NotificationDelivery.findById(notificationDeliveryId);
    if (!existing) {
      const err = new Error('NotificationDelivery not found');
      err.statusCode = 404;
      throw err;
    }
    return { skipped: true, status: existing.status };
  }

  try {
    const provider = options.provider || notificationProvider;
    const result = provider?.deliver
      ? await provider.deliver(claimed)
      : await deliverWithDefaultProvider(claimed);
    return markNotificationSent(claimed, result || {});
  } catch (err) {
    const kind = classifyNotificationError(err);
    if (kind === 'transient') return markNotificationRetry(claimed, err);
    if (kind === 'unknown') return markNotificationUnknown(claimed, err);
    return markNotificationFailed(claimed, err);
  }
};

const recoverNotificationDeliveries = async ({ limit = DEFAULT_RECOVERY_BATCH_SIZE, queueFactory = createQueue } = {}) => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_MS);
  const records = await NotificationDelivery.find({
    $or: [
      { status: 'queued' },
      { status: 'retry_scheduled', nextAttemptAt: { $lte: now } },
      { status: 'processing', processingStartedAt: { $lte: staleBefore } },
    ],
  }).sort({ createdAt: 1 }).limit(Math.max(1, Math.min(200, Number(limit) || DEFAULT_RECOVERY_BATCH_SIZE)));

  let queued = 0;
  for (const delivery of records) {
    const result = await enqueueNotificationDelivery(delivery, { queueFactory });
    if (result.queued) queued += 1;
  }
  return { scanned: records.length, queued };
};

const processNotificationRecoveryJob = async (_jobData, options = {}) =>
  recoverNotificationDeliveries(options);

const ensureBookingInvoiceNotification = (booking, options) =>
  ensureNotificationDelivery({
    notificationKey: buildNotificationKey('booking', booking._id, 'invoice'),
    eventType: 'booking.invoice',
    channel: 'email',
    template: 'booking_invoice',
    recipient: booking.customerEmail || booking.userEmail,
    recipientUserId: booking.userId,
    bookingId: booking._id,
    partnerId: booking.partnerId,
    hotelId: booking.hotelId,
    provider: 'email',
  }, options);

const ensureBookingCancellationNotification = (booking, reason, options) =>
  ensureNotificationDelivery({
    notificationKey: buildNotificationKey('booking', booking._id, 'cancelled'),
    eventType: 'booking.cancelled',
    channel: 'email',
    template: 'booking_cancelled',
    recipient: booking.customerEmail || booking.userEmail,
    recipientUserId: booking.userId,
    bookingId: booking._id,
    partnerId: booking.partnerId,
    hotelId: booking.hotelId,
    provider: 'email',
    payload: { reason },
  }, options);

const ensureBookingCreatedNotifications = async (booking, { partnerAlert = true } = {}, options) => {
  if (!partnerAlert) return [];
  const tasks = [
    ensureNotificationDelivery({
      notificationKey: buildNotificationKey('booking', booking._id, 'admin-panel'),
      eventType: 'booking.created',
      channel: 'in_app',
      template: 'booking_admin_panel',
      bookingId: booking._id,
      partnerId: booking.partnerId,
      hotelId: booking.hotelId,
    }, options),
    ensureNotificationDelivery({
      notificationKey: buildNotificationKey('booking', booking._id, 'admin-email'),
      eventType: 'booking.created',
      channel: 'email',
      template: 'booking_admin_email',
      bookingId: booking._id,
      partnerId: booking.partnerId,
      hotelId: booking.hotelId,
      provider: 'email',
    }, options),
  ];
  if (booking.partnerId) {
    tasks.push(ensureNotificationDelivery({
      notificationKey: buildNotificationKey('booking', booking._id, 'partner-panel'),
      eventType: 'booking.created',
      channel: 'in_app',
      template: 'booking_partner_panel',
      bookingId: booking._id,
      partnerId: booking.partnerId,
      hotelId: booking.hotelId,
    }, options));
    tasks.push(ensureNotificationDelivery({
      notificationKey: buildNotificationKey('booking', booking._id, 'partner-email'),
      eventType: 'booking.created',
      channel: 'email',
      template: 'booking_partner_email',
      bookingId: booking._id,
      partnerId: booking.partnerId,
      hotelId: booking.hotelId,
      provider: 'email',
    }, options));
  }
  return Promise.all(tasks);
};

const ensureOrderInvoiceNotification = (order, options) =>
  ensureNotificationDelivery({
    notificationKey: buildNotificationKey('order', order._id, 'invoice'),
    eventType: 'order.invoice',
    channel: 'email',
    template: 'order_invoice',
    recipient: order.userEmail,
    recipientUserId: order.userId,
    orderId: order._id,
    provider: 'email',
  }, options);

const ensureOrderCancellationNotification = (order, reason, options) =>
  ensureNotificationDelivery({
    notificationKey: buildNotificationKey('order', order._id, 'cancelled'),
    eventType: 'order.cancelled',
    channel: 'email',
    template: 'order_cancelled',
    recipient: order.userEmail,
    recipientUserId: order.userId,
    orderId: order._id,
    provider: 'email',
    payload: { reason },
  }, options);

const ensureOrderCreatedNotifications = (order, options) =>
  Promise.all([
    ensureNotificationDelivery({
      notificationKey: buildNotificationKey('order', order._id, 'admin-panel'),
      eventType: 'order.created',
      channel: 'in_app',
      template: 'order_admin_panel',
      orderId: order._id,
    }, options),
    ensureNotificationDelivery({
      notificationKey: buildNotificationKey('order', order._id, 'admin-email'),
      eventType: 'order.created',
      channel: 'email',
      template: 'order_admin_email',
      orderId: order._id,
      provider: 'email',
    }, options),
  ]);

module.exports = {
  DEFAULT_MAX_ATTEMPTS,
  buildNotificationKey,
  claimNotificationDelivery,
  classifyNotificationError,
  createOrGetNotificationDelivery,
  enqueueNotificationDelivery,
  ensureBookingCancellationNotification,
  ensureBookingConfirmedAlarmNotifications,
  ensureBookingRequiresActionAlarmNotifications,
  ensureDharamshalaPropertyReviewAlarmNotifications,
  ensureBookingCreatedNotifications,
  ensureBookingInvoiceNotification,
  ensureNotificationDelivery,
  getBookingAlarmDurationSeconds,
  ensureOrderCancellationNotification,
  ensureOrderCreatedNotifications,
  ensureOrderInvoiceNotification,
  hashValue,
  notificationJobId,
  processNotificationDeliveryJob,
  processNotificationRecoveryJob,
  recoverNotificationDeliveries,
  resetNotificationProvider,
  setNotificationProvider,
};
