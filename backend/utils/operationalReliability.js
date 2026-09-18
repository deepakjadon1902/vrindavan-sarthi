const mongoose = require('mongoose');

const { createQueue } = require('../queues/factory');
const { QUEUE_NAMES } = require('../queues/names');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

const normalize = (value) => String(value || '').trim();

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const parsePagination = (query = {}) => {
  const pageValue = Number(query.page || 1);
  const limitValue = Number(query.limit || DEFAULT_LIMIT);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
  const limit = Number.isFinite(limitValue) && limitValue > 0
    ? Math.min(MAX_LIMIT, Math.floor(limitValue))
    : DEFAULT_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
};

const addDateRange = (filter, query = {}) => {
  const createdAt = {};
  if (query.from) {
    const from = new Date(String(query.from));
    if (Number.isNaN(from.getTime())) throw httpError('Invalid from date', 400);
    createdAt.$gte = from;
  }
  if (query.to) {
    const to = new Date(String(query.to));
    if (Number.isNaN(to.getTime())) throw httpError('Invalid to date', 400);
    createdAt.$lte = to;
  }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
};

const addObjectIdFilter = (filter, query, param, field = param) => {
  if (!query?.[param]) return;
  const value = normalize(query[param]);
  if (!mongoose.Types.ObjectId.isValid(value)) throw httpError(`Invalid ${param}`, 400);
  filter[field] = value;
};

const addStringFilter = (filter, query, param, field = param, allowed = null) => {
  if (!query?.[param]) return;
  const value = normalize(query[param]);
  if (allowed && !allowed.includes(value)) throw httpError(`Invalid ${param}`, 400);
  filter[field] = value;
};

const sanitizeWebhookEvent = (record) => {
  if (!record) return record;
  const doc = typeof record.toObject === 'function' ? record.toObject() : { ...record };
  delete doc.payload;
  return doc;
};

const sanitizeNotificationDelivery = (record) => {
  if (!record) return record;
  const doc = typeof record.toObject === 'function' ? record.toObject() : { ...record };
  if (doc.payload && typeof doc.payload === 'object') {
    const safePayload = { ...doc.payload };
    delete safePayload.secret;
    delete safePayload.token;
    delete safePayload.providerHeaders;
    doc.payload = safePayload;
  }
  return doc;
};

const countByStatus = async (Model, field, statuses) => {
  const entries = await Promise.all(statuses.map(async (status) => [status, await Model.countDocuments({ [field]: status })]));
  return Object.fromEntries(entries);
};

const getQueueHealth = async ({ queueFactory = createQueue } = {}) => {
  const queues = [];
  let redisAvailable = true;

  for (const queueName of Object.values(QUEUE_NAMES)) {
    let queue = null;
    try {
      queue = queueFactory(queueName, { required: false, connectionName: `ops:${queueName}` });
      if (!queue) {
        redisAvailable = false;
        queues.push({ queueName, available: false, error: 'redis_not_configured' });
        continue;
      }
      const counts = typeof queue.getJobCounts === 'function'
        ? await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused')
        : {};
      const paused = typeof queue.isPaused === 'function' ? await queue.isPaused() : undefined;
      queues.push({ queueName, available: true, counts, paused });
    } catch (err) {
      redisAvailable = false;
      queues.push({ queueName, available: false, error: normalize(err?.message || err).slice(0, 200) });
    } finally {
      if (queue && typeof queue.close === 'function') {
        await queue.close().catch(() => {});
      }
    }
  }

  return { redisAvailable, queues };
};

module.exports = {
  addDateRange,
  addObjectIdFilter,
  addStringFilter,
  countByStatus,
  getQueueHealth,
  httpError,
  parsePagination,
  sanitizeNotificationDelivery,
  sanitizeWebhookEvent,
};
