const express = require('express');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const PaymentReconciliation = require('../models/PaymentReconciliation');
const RefundOperation = require('../models/RefundOperation');
const WebhookEvent = require('../models/WebhookEvent');
const NotificationDelivery = require('../models/NotificationDelivery');
const ChannelSyncOperation = require('../models/ChannelSyncOperation');
const ChannelReconciliation = require('../models/ChannelReconciliation');
const { protect, authorize } = require('../middleware/auth');
const { rejectInvalidObjectId } = require('../utils/security');
const { enqueuePaymentReconciliation } = require('../utils/paymentReconciliation');
const { enqueueRefundOperation, reconcileRefundOperation } = require('../utils/refundOperations');
const { enqueueWebhookEvent } = require('../utils/razorpayWebhook');
const { enqueueNotificationDelivery } = require('../utils/notificationDelivery');
const { enqueueChannelSyncOperation } = require('../utils/channelManager');
const {
  addDateRange,
  addObjectIdFilter,
  addStringFilter,
  countByStatus,
  getQueueHealth,
  httpError,
  parsePagination,
  sanitizeNotificationDelivery,
  sanitizeWebhookEvent,
} = require('../utils/operationalReliability');

const router = express.Router();

router.use(protect, authorize('admin'));

const sendError = (res, err, fallback = 'Operational request failed') =>
  res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : fallback });

const listResponse = async ({ req, res, Model, filter, select, sort = { updatedAt: -1 }, mapper = (x) => x }) => {
  const { page, limit, skip } = parsePagination(req.query);
  const [items, total] = await Promise.all([
    Model.find(filter).select(select || '').sort(sort).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: items.map(mapper),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
};

router.get('/summary', async (_req, res) => {
  try {
    const now = new Date();
    const [
      pendingBookings,
      stalePendingBookings,
      bookingStatus,
      paymentReconciliation,
      refunds,
      webhooks,
      notifications,
      channelSync,
      channelReconciliation,
      queueHealth,
    ] = await Promise.all([
      Booking.countDocuments({ bookingStatus: 'pending' }),
      Booking.countDocuments({ bookingStatus: 'pending', paymentStatus: 'pending', paymentHoldExpiresAt: { $lte: now } }),
      countByStatus(Booking, 'bookingStatus', ['pending', 'confirmed', 'payment_failed', 'expired', 'cancelled']),
      countByStatus(PaymentReconciliation, 'reconciliationStatus', ['pending', 'processing', 'retry_scheduled', 'reconciliation_required', 'failed', 'resolved']),
      countByStatus(RefundOperation, 'status', ['requested', 'queued', 'processing', 'retry_scheduled', 'failed', 'reconciliation_required', 'processed']),
      countByStatus(WebhookEvent, 'status', ['received', 'queued', 'processing', 'failed', 'processed']),
      countByStatus(NotificationDelivery, 'status', ['queued', 'processing', 'retry_scheduled', 'failed', 'reconciliation_required', 'sent']),
      countByStatus(ChannelSyncOperation, 'status', ['queued', 'processing', 'retry_scheduled', 'failed', 'reconciliation_required', 'completed']),
      countByStatus(ChannelReconciliation, 'status', ['open', 'reviewing', 'resolved', 'dismissed']),
      getQueueHealth(),
    ]);

    res.json({
      success: true,
      data: {
        generatedAt: new Date(),
        bookings: { pending: pendingBookings, expiredCandidates: stalePendingBookings, byStatus: bookingStatus },
        paymentReconciliation,
        refunds,
        webhooks,
        notifications,
        channelSync,
        channelReconciliation,
        queues: queueHealth,
        actionRequired: {
          paymentReconciliations: (paymentReconciliation.reconciliation_required || 0) + (paymentReconciliation.failed || 0),
          refunds: (refunds.reconciliation_required || 0) + (refunds.failed || 0),
          webhooks: webhooks.failed || 0,
          notifications: (notifications.reconciliation_required || 0) + (notifications.failed || 0),
          channelSync: (channelSync.reconciliation_required || 0) + (channelSync.failed || 0),
          channelReconciliation: (channelReconciliation.open || 0) + (channelReconciliation.reviewing || 0),
          expiredBookingCandidates: stalePendingBookings,
        },
      },
    });
  } catch (err) {
    sendError(res, err, 'Operational summary failed');
  }
});

router.get('/health', async (_req, res) => {
  try {
    const queueHealth = await getQueueHealth();
    const mongoConnected = mongoose.connection.readyState === 1;
    res.json({
      success: true,
      data: {
        api: 'healthy',
        mongo: mongoConnected ? 'healthy' : 'degraded',
        redis: queueHealth.redisAvailable ? 'healthy' : 'degraded',
        bullmq: queueHealth.queues.some((q) => q.available) ? 'operational' : 'degraded',
        worker: 'not_directly_observable',
        queues: queueHealth.queues,
      },
    });
  } catch (err) {
    sendError(res, err, 'Operational health failed');
  }
});

router.get('/payment-reconciliations', async (req, res) => {
  try {
    const filter = {};
    addStringFilter(filter, req.query, 'status', 'reconciliationStatus');
    addStringFilter(filter, req.query, 'provider');
    addStringFilter(filter, req.query, 'targetType');
    addStringFilter(filter, req.query, 'orderId');
    addStringFilter(filter, req.query, 'paymentId');
    addObjectIdFilter(filter, req.query, 'bookingId');
    addObjectIdFilter(filter, req.query, 'modificationId');
    addDateRange(filter, req.query);
    await listResponse({
      req,
      res,
      Model: PaymentReconciliation,
      filter,
      select: '-providerResponseMetadata',
      sort: { updatedAt: -1 },
    });
  } catch (err) {
    sendError(res, err, 'Payment reconciliation list failed');
  }
});

router.get('/payment-reconciliations/:id', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'payment reconciliation id')) return;
    const record = await PaymentReconciliation.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Payment reconciliation not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    sendError(res, err, 'Payment reconciliation detail failed');
  }
});

router.post('/payment-reconciliations/:id/retry', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'payment reconciliation id')) return;
    const record = await PaymentReconciliation.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Payment reconciliation not found' });
    if (['resolved', 'processing'].includes(String(record.reconciliationStatus || ''))) {
      throw httpError('Payment reconciliation cannot be retried in its current state', 409);
    }
    record.reconciliationStatus = 'pending';
    record.nextCheckAt = new Date();
    record.failureReason = undefined;
    await record.save();
    const targetId = record.targetType === 'booking' ? record.bookingId : record.modificationId;
    const queued = await enqueuePaymentReconciliation({ targetType: record.targetType, targetId, paymentId: record.paymentId });
    console.log(`[operations] admin=${req.user._id} action=payment_reconciliation_retry id=${record._id}`);
    res.json({ success: true, data: record, queued });
  } catch (err) {
    sendError(res, err, 'Payment reconciliation retry failed');
  }
});

router.get('/refunds', async (req, res) => {
  try {
    const filter = {};
    addStringFilter(filter, req.query, 'status');
    addStringFilter(filter, req.query, 'provider');
    addStringFilter(filter, req.query, 'operationKey');
    addObjectIdFilter(filter, req.query, 'bookingId');
    addObjectIdFilter(filter, req.query, 'modificationId');
    addDateRange(filter, req.query);
    await listResponse({ req, res, Model: RefundOperation, filter, select: '-providerResponseMetadata', sort: { updatedAt: -1 } });
  } catch (err) {
    sendError(res, err, 'Refund operation list failed');
  }
});

router.get('/refunds/:id', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'refund operation id')) return;
    const record = await RefundOperation.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Refund operation not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    sendError(res, err, 'Refund operation detail failed');
  }
});

router.post('/refunds/:id/retry', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'refund operation id')) return;
    const operation = await RefundOperation.findById(req.params.id);
    if (!operation) return res.status(404).json({ success: false, message: 'Refund operation not found' });
    if (['processed', 'processing'].includes(String(operation.status || ''))) {
      throw httpError('Refund operation cannot be retried in its current state', 409);
    }
    operation.status = 'requested';
    operation.lastError = undefined;
    operation.lastErrorAt = undefined;
    await operation.save();
    const queued = await enqueueRefundOperation(operation);
    console.log(`[operations] admin=${req.user._id} action=refund_retry id=${operation._id}`);
    res.json({ success: true, data: operation, queued });
  } catch (err) {
    sendError(res, err, 'Refund retry failed');
  }
});

router.post('/refunds/:id/reconcile', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'refund operation id')) return;
    const operation = await RefundOperation.findById(req.params.id);
    if (!operation) return res.status(404).json({ success: false, message: 'Refund operation not found' });
    const reconciled = await reconcileRefundOperation(operation);
    console.log(`[operations] admin=${req.user._id} action=refund_reconcile id=${operation._id}`);
    res.json({ success: true, data: reconciled });
  } catch (err) {
    sendError(res, err, 'Refund reconciliation failed');
  }
});

router.get('/webhooks', async (req, res) => {
  try {
    const filter = {};
    addStringFilter(filter, req.query, 'status');
    addStringFilter(filter, req.query, 'provider');
    addStringFilter(filter, req.query, 'eventId');
    addStringFilter(filter, req.query, 'eventType');
    addObjectIdFilter(filter, req.query, 'bookingId');
    addObjectIdFilter(filter, req.query, 'bookingModificationId');
    addDateRange(filter, req.query);
    await listResponse({ req, res, Model: WebhookEvent, filter, select: '-payload -processingResult', sort: { updatedAt: -1 } });
  } catch (err) {
    sendError(res, err, 'Webhook list failed');
  }
});

router.get('/webhooks/:id', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'webhook event id')) return;
    const record = await WebhookEvent.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Webhook event not found' });
    res.json({ success: true, data: sanitizeWebhookEvent(record) });
  } catch (err) {
    sendError(res, err, 'Webhook detail failed');
  }
});

router.post('/webhooks/:id/retry', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'webhook event id')) return;
    const event = await WebhookEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Webhook event not found' });
    if (event.status === 'processed') throw httpError('Processed webhook cannot be retried', 409);
    event.status = 'received';
    event.lastError = undefined;
    event.lastErrorAt = undefined;
    await event.save();
    const queued = await enqueueWebhookEvent(event);
    console.log(`[operations] admin=${req.user._id} action=webhook_retry id=${event._id}`);
    res.json({ success: true, data: sanitizeWebhookEvent(event), queued });
  } catch (err) {
    sendError(res, err, 'Webhook retry failed');
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const filter = {};
    addStringFilter(filter, req.query, 'status');
    addStringFilter(filter, req.query, 'channel');
    addStringFilter(filter, req.query, 'eventType');
    addStringFilter(filter, req.query, 'template');
    addStringFilter(filter, req.query, 'notificationKey');
    addObjectIdFilter(filter, req.query, 'bookingId');
    addObjectIdFilter(filter, req.query, 'orderId');
    addObjectIdFilter(filter, req.query, 'partnerId');
    addDateRange(filter, req.query);
    await listResponse({
      req,
      res,
      Model: NotificationDelivery,
      filter,
      select: '-payload',
      sort: { updatedAt: -1 },
      mapper: sanitizeNotificationDelivery,
    });
  } catch (err) {
    sendError(res, err, 'Notification delivery list failed');
  }
});

router.get('/notifications/:id', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'notification delivery id')) return;
    const record = await NotificationDelivery.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Notification delivery not found' });
    res.json({ success: true, data: sanitizeNotificationDelivery(record) });
  } catch (err) {
    sendError(res, err, 'Notification delivery detail failed');
  }
});

router.post('/notifications/:id/retry', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'notification delivery id')) return;
    const delivery = await NotificationDelivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ success: false, message: 'Notification delivery not found' });
    if (delivery.status === 'sent') throw httpError('Sent notification cannot be retried', 409);
    delivery.status = 'queued';
    delivery.nextAttemptAt = new Date();
    delivery.processingStartedAt = undefined;
    delivery.failedAt = undefined;
    delivery.lastError = undefined;
    delivery.lastErrorAt = undefined;
    await delivery.save();
    const queued = await enqueueNotificationDelivery(delivery);
    console.log(`[operations] admin=${req.user._id} action=notification_retry id=${delivery._id}`);
    res.json({ success: true, data: sanitizeNotificationDelivery(delivery), queued });
  } catch (err) {
    sendError(res, err, 'Notification retry failed');
  }
});

router.get('/channel-sync', async (req, res) => {
  try {
    const filter = {};
    addStringFilter(filter, req.query, 'status');
    addStringFilter(filter, req.query, 'provider');
    addStringFilter(filter, req.query, 'operation');
    addStringFilter(filter, req.query, 'idempotencyKey');
    addObjectIdFilter(filter, req.query, 'hotelId');
    addObjectIdFilter(filter, req.query, 'roomTypeId');
    addObjectIdFilter(filter, req.query, 'ratePlanId');
    addObjectIdFilter(filter, req.query, 'bookingId');
    addDateRange(filter, req.query);
    await listResponse({
      req,
      res,
      Model: ChannelSyncOperation,
      filter,
      select: '-metadata',
      sort: { updatedAt: -1 },
    });
  } catch (err) {
    sendError(res, err, 'Channel sync list failed');
  }
});

router.get('/channel-sync/:id', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'channel sync operation id')) return;
    const record = await ChannelSyncOperation.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Channel sync operation not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    sendError(res, err, 'Channel sync detail failed');
  }
});

router.post('/channel-sync/:id/retry', async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'channel sync operation id')) return;
    const record = await ChannelSyncOperation.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'Channel sync operation not found' });
    if (['completed', 'processing'].includes(String(record.status || ''))) {
      throw httpError('Channel sync operation cannot be retried in its current state', 409);
    }
    record.status = 'queued';
    record.nextAttemptAt = new Date();
    record.lastError = undefined;
    record.lastErrorAt = undefined;
    await record.save();
    const queued = await enqueueChannelSyncOperation(record);
    console.log(`[operations] admin=${req.user._id} action=channel_sync_retry id=${record._id}`);
    res.json({ success: true, data: record, queued });
  } catch (err) {
    sendError(res, err, 'Channel sync retry failed');
  }
});

router.get('/bookings', async (req, res) => {
  try {
    const filter = {};
    addStringFilter(filter, req.query, 'bookingStatus');
    addStringFilter(filter, req.query, 'paymentStatus');
    addStringFilter(filter, req.query, 'paymentProvider');
    addObjectIdFilter(filter, req.query, 'partnerId');
    addObjectIdFilter(filter, req.query, 'hotelId');
    addDateRange(filter, req.query);
    if (req.query.expirationCandidate === 'true') {
      filter.bookingStatus = 'pending';
      filter.paymentStatus = 'pending';
      filter.paymentHoldExpiresAt = { $lte: new Date() };
    }
    await listResponse({
      req,
      res,
      Model: Booking,
      filter,
      select: 'bookingId bookingType itemName partnerId hotelId paymentProvider paymentStatus bookingStatus paymentHoldExpiresAt totalAmount createdAt updatedAt',
      sort: { updatedAt: -1 },
    });
  } catch (err) {
    sendError(res, err, 'Operational booking list failed');
  }
});

module.exports = router;
