const express = require('express');

const NotificationDelivery = require('../models/NotificationDelivery');
const { protect, authorize } = require('../middleware/auth');
const { rejectInvalidObjectId } = require('../utils/security');
const { enqueueNotificationDelivery } = require('../utils/notificationDelivery');

const router = express.Router();

const publicFields = '-payload.providerHeaders -payload.secret -payload.token';

router.param('id', (req, res, next, value) => {
  if (rejectInvalidObjectId(res, value, 'notification delivery id')) return;
  next();
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
