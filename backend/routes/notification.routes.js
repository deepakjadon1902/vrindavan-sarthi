const express = require('express');

const NotificationDelivery = require('../models/NotificationDelivery');
const PartnerNotification = require('../models/PartnerNotification');
const NotificationDevice = require('../models/NotificationDevice');
const { protect, authorize } = require('../middleware/auth');
const { rejectInvalidObjectId } = require('../utils/security');
const { enqueueNotificationDelivery, getBookingAlarmDurationSeconds } = require('../utils/notificationDelivery');
const { getWebPushConfig } = require('../utils/webPushProvider');

const router = express.Router();

const publicFields = '-payload.providerHeaders -payload.secret -payload.token';
const alarmPublicFields = '-__v';

const sanitizeDeviceId = (value) => String(value || '').trim().slice(0, 128);
const sanitizeText = (value, max = 240) => String(value || '').trim().slice(0, max);
const validPermission = (value) => ['default', 'granted', 'denied', 'unsupported'].includes(String(value || ''))
  ? String(value)
  : 'default';

const sanitizePushSubscription = (value) => {
  if (!value || typeof value !== 'object') return null;
  const endpoint = sanitizeText(value.endpoint, 2000);
  const p256dh = sanitizeText(value.keys?.p256dh, 500);
  const auth = sanitizeText(value.keys?.auth, 500);
  if (!endpoint || !p256dh || !auth) return null;
  return {
    endpoint,
    expirationTime: value.expirationTime || null,
    keys: { p256dh, auth },
  };
};

const devicePublicFields = '-pushSubscription';

const notificationAccessFilter = (user) => {
  if (user.role === 'admin') {
    return {
      type: 'notification',
      $or: [
        { recipientUserId: user._id },
        { audience: 'admin', recipientUserId: { $exists: false } },
      ],
    };
  }
  if (user.role === 'partner') {
    return {
      type: 'notification',
      $or: [
        { recipientUserId: user._id },
        { audience: 'partner', partnerId: user._id },
        { audience: 'all_partners' },
      ],
    };
  }
  return { type: 'notification', recipientUserId: user._id };
};

router.param('id', (req, res, next, value) => {
  if (rejectInvalidObjectId(res, value, 'notification delivery id')) return;
  next();
});

router.get('/', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 100)));
    const notifications = await PartnerNotification.find(notificationAccessFilter(req.user))
      .select(alarmPublicFields)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({
      success: true,
      data: notifications,
      config: { bookingAlarmDurationSeconds: getBookingAlarmDurationSeconds() },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Notifications could not be loaded' });
  }
});

router.get('/push-config', protect, authorize('admin', 'partner'), async (req, res) => {
  const config = getWebPushConfig();
  res.json({
    success: true,
    data: {
      configured: config.configured,
      publicKey: config.publicKey || '',
      requiresSecureContext: true,
    },
  });
});

router.post('/devices', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const deviceId = sanitizeDeviceId(req.body?.deviceId);
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId is required' });
    const permissionStatus = validPermission(req.body?.permissionStatus);
    const hasPushSubscription = Object.prototype.hasOwnProperty.call(req.body || {}, 'pushSubscription');
    const pushSubscription = sanitizePushSubscription(req.body?.pushSubscription);
    const update = {
      userId: req.user._id,
      role: req.user.role,
      partnerId: req.user.role === 'partner' ? req.user._id : undefined,
      deviceId,
      platform: sanitizeText(req.body?.platform),
      browser: sanitizeText(req.body?.browser),
      userAgent: sanitizeText(req.body?.userAgent, 500),
      permissionStatus,
      alarmEnabled: typeof req.body?.alarmEnabled === 'undefined' ? true : Boolean(req.body.alarmEnabled),
      lastSeenAt: new Date(),
      revokedAt: null,
    };
    if (hasPushSubscription) {
      update.pushSubscription = pushSubscription;
      update.notificationEnabled = permissionStatus === 'granted' && Boolean(pushSubscription);
      update.pushSubscriptionRevokedAt = null;
      update.pushSubscriptionError = '';
    } else if (permissionStatus !== 'granted') {
      update.notificationEnabled = false;
    }
    const device = await NotificationDevice.findOneAndUpdate(
      { userId: req.user._id, deviceId },
      { $set: update, $setOnInsert: { registeredAt: new Date() } },
      { new: true, upsert: true }
    ).select(devicePublicFields).lean();
    console.log('[device_registered]', JSON.stringify({
      userId: req.user._id,
      role: req.user.role,
      deviceId,
      timestamp: new Date().toISOString(),
    }));
    res.status(201).json({ success: true, data: device });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Device could not be registered' });
  }
});

router.get('/devices', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const devices = await NotificationDevice.find({ userId: req.user._id, revokedAt: null })
      .select(devicePublicFields)
      .sort({ lastSeenAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: devices });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Devices could not be loaded' });
  }
});

router.delete('/devices/:deviceId', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const deviceId = sanitizeDeviceId(req.params.deviceId);
    const device = await NotificationDevice.findOneAndUpdate(
      { userId: req.user._id, deviceId, revokedAt: null },
      { $set: { revokedAt: new Date(), alarmEnabled: false, notificationEnabled: false } },
      { new: true }
    ).select(devicePublicFields).lean();
    if (!device) return res.status(404).json({ success: false, message: 'Device not found' });
    console.log('[device_revoked]', JSON.stringify({
      userId: req.user._id,
      role: req.user.role,
      deviceId,
      timestamp: new Date().toISOString(),
    }));
    res.json({ success: true, data: device });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Device could not be revoked' });
  }
});

router.post('/:id/acknowledge', protect, authorize('admin', 'partner'), async (req, res) => {
  try {
    const filter = { _id: req.params.id, ...notificationAccessFilter(req.user) };
    const now = new Date();
    const deviceId = sanitizeDeviceId(req.body?.deviceId);
    const notification = await PartnerNotification.findOneAndUpdate(
      filter,
      {
        $set: {
          alarmStatus: 'acknowledged',
          acknowledgedAt: now,
          readAt: now,
          acknowledgedBy: req.user._id,
          acknowledgedDeviceId: deviceId || undefined,
        },
      },
      { new: true }
    ).lean();
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    console.log('[alarm_acknowledged]', JSON.stringify({
      notificationId: notification._id,
      bookingId: notification.bookingId,
      recipientUserId: req.user._id,
      recipientRole: req.user.role,
      eventType: notification.eventType,
      timestamp: now.toISOString(),
    }));
    res.json({ success: true, data: notification });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Notification could not be acknowledged' });
  }
});

router.get('/reconciliation', protect, authorize('admin'), async (req, res) => {
  try {
    const status = String(req.query?.status || '').trim();
    const filter = status ? { status } : {};
    const deliveries = await NotificationDelivery.find(filter)
      .select(publicFields)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: deliveries });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Notification deliveries could not be loaded' });
  }
});

router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const delivery = await NotificationDelivery.findById(req.params.id).select(publicFields).lean();
    if (!delivery) return res.status(404).json({ success: false, message: 'Notification delivery not found' });
    res.json({ success: true, data: delivery });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Notification delivery could not be loaded' });
  }
});

router.post('/:id/retry', protect, authorize('admin'), async (req, res) => {
  try {
    const delivery = await NotificationDelivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ success: false, message: 'Notification delivery not found' });
    if (delivery.status === 'sent') {
      return res.status(409).json({ success: false, message: 'Notification already sent' });
    }

    delivery.status = 'queued';
    delivery.nextAttemptAt = new Date();
    delivery.processingStartedAt = undefined;
    delivery.failedAt = undefined;
    delivery.lastError = undefined;
    delivery.lastErrorAt = undefined;
    await delivery.save();

    const enqueueResult = await enqueueNotificationDelivery(delivery);
    res.json({ success: true, data: delivery, enqueue: enqueueResult });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Notification retry could not be queued' });
  }
});

module.exports = router;
