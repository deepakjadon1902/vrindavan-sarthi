const express = require('express');

const ChannelInboundEvent = require('../models/ChannelInboundEvent');
const ChannelConnection = require('../models/ChannelConnection');
const ChannelMapping = require('../models/ChannelMapping');
const ChannelReconciliation = require('../models/ChannelReconciliation');
const ChannelSyncOperation = require('../models/ChannelSyncOperation');
const ExternalReservation = require('../models/ExternalReservation');
const { protect, authorize } = require('../middleware/auth');
const { rejectInvalidObjectId } = require('../utils/security');
const {
  processChannelSyncOperation,
  recordInboundEvent,
  requestInventorySync,
  requestRateSync,
  upsertChannelMapping,
  enqueueChannelSyncOperation,
  upsertChannelConnection,
  checkChannelProviderHealth,
  getProviderCapabilities,
} = require('../utils/channelManager');

const router = express.Router();

const sendError = (res, err, fallback = 'Channel manager request failed') =>
  res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : fallback });

const isTestContext = () => process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT === '1';

const requireChannelWebhookSecret = (req, res) => {
  const expected = process.env.CHANNEL_WEBHOOK_SECRET;
  if (!expected && isTestContext()) return false;
  if (!expected) {
    res.status(503).json({ success: false, message: 'Channel webhook secret is not configured' });
    return true;
  }
  if (String(req.headers['x-channel-signature'] || '') !== expected) {
    res.status(401).json({ success: false, message: 'Invalid channel webhook signature' });
    return true;
  }
  return false;
};

const scopedFilter = (req, filter = {}) => {
  if (req.user.role === 'admin') return filter;
  return { ...filter, hotelId: { $in: req.partnerHotelIds || [] } };
};

const loadPartnerHotels = async (req, _res, next) => {
  if (req.user?.role !== 'partner') return next();
  const Hotel = require('../models/Hotel');
  req.partnerHotelIds = await Hotel.find({ partnerId: req.user._id }).distinct('_id');
  next();
};

router.post('/webhooks/:provider', async (req, res) => {
  try {
    if (requireChannelWebhookSecret(req, res)) return;
    const result = await recordInboundEvent({ provider: req.params.provider, payload: req.body || {} });
    res.status(202).json({
      success: true,
      data: {
        eventId: result.event._id,
        operationId: result.operation._id,
        status: result.operation.status,
      },
    });
  } catch (err) {
    sendError(res, err, 'Channel webhook could not be recorded');
  }
});

router.use(protect, loadPartnerHotels);

router.get('/mappings', authorize('admin', 'partner'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.provider) filter.provider = String(req.query.provider).trim().toLowerCase();
    if (req.query.entityType) filter.entityType = String(req.query.entityType).trim();
    if (req.query.hotelId) {
      if (rejectInvalidObjectId(res, req.query.hotelId, 'hotelId')) return;
      filter.hotelId = req.query.hotelId;
    }
    const mappings = await ChannelMapping.find(scopedFilter(req, filter)).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data: mappings });
  } catch (err) {
    sendError(res, err, 'Channel mappings could not be loaded');
  }
});

router.get('/providers/:provider/health', authorize('admin', 'partner'), async (req, res) => {
  try {
    const health = await checkChannelProviderHealth({
      provider: req.params.provider,
      hotelId: req.query.hotelId,
      user: req.user,
    });
    res.json({ success: true, data: health });
  } catch (err) {
    sendError(res, err, 'Channel provider health could not be loaded');
  }
});

router.get('/providers/:provider/capabilities', authorize('admin', 'partner'), async (req, res) => {
  try {
    const capabilities = await getProviderCapabilities(req.params.provider);
    res.json({ success: true, data: capabilities });
  } catch (err) {
    sendError(res, err, 'Channel provider capabilities could not be loaded');
  }
});

router.get('/connections', authorize('admin', 'partner'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.provider) filter.provider = String(req.query.provider).trim().toLowerCase();
    if (req.query.hotelId) {
      if (rejectInvalidObjectId(res, req.query.hotelId, 'hotelId')) return;
      filter.hotelId = req.query.hotelId;
    }
    const connections = await ChannelConnection.find(scopedFilter(req, filter))
      .select('-credentialsReference')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: connections });
  } catch (err) {
    sendError(res, err, 'Channel connections could not be loaded');
  }
});

router.post('/connections', authorize('admin', 'partner'), async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.body?.hotelId, 'hotelId')) return;
    const connection = await upsertChannelConnection({
      provider: req.body?.provider || 'ezee',
      hotelId: req.body.hotelId,
      enabled: Boolean(req.body?.enabled),
      environment: req.body?.environment || 'disabled',
      externalHotelId: req.body?.externalHotelId,
      credentialsReference: req.body?.credentialsReference,
      metadata: req.body?.metadata,
      user: req.user,
    });
    const sanitized = connection.toObject ? connection.toObject() : connection;
    delete sanitized.credentialsReference;
    res.status(201).json({ success: true, data: sanitized });
  } catch (err) {
    if (String(err?.code) === '11000') return res.status(409).json({ success: false, message: 'Channel connection already exists' });
    sendError(res, err, 'Channel connection could not be saved');
  }
});

router.post('/mappings', authorize('admin', 'partner'), async (req, res) => {
  try {
    const mapping = await upsertChannelMapping({
      provider: req.body?.provider || 'ezee',
      entityType: req.body?.entityType,
      internalEntityId: req.body?.internalEntityId,
      externalEntityId: req.body?.externalEntityId,
      externalCode: req.body?.externalCode,
      metadata: req.body?.metadata,
      user: req.user,
    });
    res.status(201).json({ success: true, data: mapping });
  } catch (err) {
    if (String(err?.code) === '11000') return res.status(409).json({ success: false, message: 'Channel mapping already exists' });
    sendError(res, err, 'Channel mapping could not be saved');
  }
});

router.get('/operations', authorize('admin', 'partner'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).trim();
    if (req.query.provider) filter.provider = String(req.query.provider).trim().toLowerCase();
    if (req.query.operation) filter.operation = String(req.query.operation).trim();
    const operations = await ChannelSyncOperation.find(scopedFilter(req, filter)).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data: operations });
  } catch (err) {
    sendError(res, err, 'Channel operations could not be loaded');
  }
});

router.post('/operations/:id/retry', authorize('admin'), async (req, res) => {
  try {
    if (rejectInvalidObjectId(res, req.params.id, 'channel operation id')) return;
    const operation = await ChannelSyncOperation.findById(req.params.id);
    if (!operation) return res.status(404).json({ success: false, message: 'Channel operation not found' });
    if (['completed', 'processing'].includes(String(operation.status || ''))) {
      return res.status(409).json({ success: false, message: 'Channel operation cannot be retried in its current state' });
    }
    operation.status = 'queued';
    operation.nextAttemptAt = new Date();
    operation.lastError = undefined;
    operation.lastErrorAt = undefined;
    await operation.save();
    const processed = req.query.inline === 'true' && isTestContext()
      ? await processChannelSyncOperation({ operationId: operation._id })
      : operation;
    const queued = processed === operation ? await enqueueChannelSyncOperation(operation) : { queued: false, reason: 'processed_inline' };
    res.json({ success: true, data: processed, queued });
  } catch (err) {
    sendError(res, err, 'Channel operation retry failed');
  }
});

router.get('/reservations', authorize('admin', 'partner'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).trim();
    if (req.query.provider) filter.provider = String(req.query.provider).trim().toLowerCase();
    const reservations = await ExternalReservation.find(scopedFilter(req, filter)).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data: reservations });
  } catch (err) {
    sendError(res, err, 'External reservations could not be loaded');
  }
});

router.get('/reconciliation', authorize('admin', 'partner'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).trim();
    if (req.query.provider) filter.provider = String(req.query.provider).trim().toLowerCase();
    if (req.query.reason) filter.reason = String(req.query.reason).trim();
    const records = await ChannelReconciliation.find(scopedFilter(req, filter)).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data: records });
  } catch (err) {
    sendError(res, err, 'Channel reconciliation records could not be loaded');
  }
});

router.get('/inbound-events', authorize('admin'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status).trim();
    if (req.query.provider) filter.provider = String(req.query.provider).trim().toLowerCase();
    const events = await ChannelInboundEvent.find(filter).select('-rawPayload').sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data: events });
  } catch (err) {
    sendError(res, err, 'Channel inbound events could not be loaded');
  }
});

router.post('/sync/inventory', authorize('admin', 'partner'), async (req, res) => {
  try {
    const result = await requestInventorySync({
      provider: req.body?.provider || 'ezee',
      roomTypeId: req.body?.roomTypeId,
      from: req.body?.from,
      to: req.body?.to,
      user: req.user,
    });
    res.status(202).json({ success: true, data: result.operation, queued: result.queued });
  } catch (err) {
    sendError(res, err, 'Inventory sync could not be queued');
  }
});

router.post('/sync/rates', authorize('admin', 'partner'), async (req, res) => {
  try {
    const result = await requestRateSync({
      provider: req.body?.provider || 'ezee',
      ratePlanId: req.body?.ratePlanId,
      from: req.body?.from,
      to: req.body?.to,
      user: req.user,
    });
    res.status(202).json({ success: true, data: result.operation, queued: result.queued });
  } catch (err) {
    sendError(res, err, 'Rate sync could not be queued');
  }
});

module.exports = router;
