const assert = require('node:assert/strict');
const test = require('node:test');

const {
  RAZORPAY_PROVIDER,
  WEBHOOK_JOB_ATTEMPTS,
  enqueueWebhookEvent,
  extractRazorpayPaymentContext,
  getWebhookJobId,
  persistRazorpayWebhookEvent,
  processWebhookEventJob,
  sanitizeRazorpayEvent,
  validateRazorpayEventEnvelope,
} = require('../utils/razorpayWebhook');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');

const makeEvent = (overrides = {}) => ({
  id: 'evt_phase42_foundation',
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_phase42_foundation',
        order_id: 'order_phase42_foundation',
        status: 'captured',
      },
    },
  },
  ...overrides,
});

class FakeWebhookEventModel {
  static docs = [];

  static reset() {
    FakeWebhookEventModel.docs = [];
  }

  static async create(doc) {
    if (FakeWebhookEventModel.docs.some((existing) =>
      existing.provider === doc.provider && existing.eventId === doc.eventId)) {
      const err = new Error('duplicate key');
      err.code = 11000;
      throw err;
    }
    const saved = {
      _id: `webhook-${FakeWebhookEventModel.docs.length + 1}`,
      ...doc,
      save: async function save() {
        return this;
      },
    };
    FakeWebhookEventModel.docs.push(saved);
    return saved;
  }

  static async findOne(query) {
    return FakeWebhookEventModel.docs.find((doc) =>
      (!query._id || doc._id === query._id) &&
      (!query.provider || doc.provider === query.provider) &&
      (!query.eventId || doc.eventId === query.eventId)
    ) || null;
  }

  static async findOneAndUpdate(query, update) {
    const candidates = FakeWebhookEventModel.docs.filter((doc) =>
      doc._id === query._id &&
      doc.provider === query.provider &&
      doc.eventId === query.eventId
    );
    const doc = candidates.find((candidate) => {
      if (['received', 'queued', 'failed'].includes(candidate.status)) return true;
      if (candidate.status !== 'processing') return false;
      const staleBefore = query.$or?.find((item) => item.status === 'processing')?.processingStartedAt?.$lte;
      return staleBefore && candidate.processingStartedAt <= staleBefore;
    });
    if (!doc) return null;
    Object.assign(doc, update.$set || {});
    doc.attempts = Number(doc.attempts || 0) + Number(update.$inc?.attempts || 0);
    return doc;
  }
}

test.beforeEach(() => {
  FakeWebhookEventModel.reset();
});

test('valid Razorpay envelope is accepted and sanitized without headers or secrets', () => {
  const event = makeEvent({ account_id: 'acct_should_not_be_required' });
  assert.deepEqual(validateRazorpayEventEnvelope(event), {
    eventId: 'evt_phase42_foundation',
    eventType: 'payment.captured',
  });
  assert.deepEqual(Object.keys(sanitizeRazorpayEvent(event)), ['id', 'event', 'payload', 'created_at']);
});

test('missing event ID or type is rejected before persistence', () => {
  assert.throws(() => validateRazorpayEventEnvelope(makeEvent({ id: '' })), /event id is required/);
  assert.throws(() => validateRazorpayEventEnvelope(makeEvent({ event: '' })), /event type is required/);
});

test('payment context extracts only provider identifiers needed for processing', () => {
  const context = extractRazorpayPaymentContext(makeEvent());
  assert.equal(context.eventName, 'payment.captured');
  assert.equal(context.eventId, 'evt_phase42_foundation');
  assert.equal(context.paymentId, 'pay_phase42_foundation');
  assert.equal(context.orderId, 'order_phase42_foundation');
  assert.equal(context.status, 'captured');
});

test('WebhookEvent persistence is unique by provider and event id', async () => {
  const rawBody = JSON.stringify(makeEvent());
  const first = await persistRazorpayWebhookEvent({
    event: makeEvent(),
    rawBody,
    EventModel: FakeWebhookEventModel,
  });
  const duplicate = await persistRazorpayWebhookEvent({
    event: makeEvent(),
    rawBody,
    EventModel: FakeWebhookEventModel,
  });

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(FakeWebhookEventModel.docs.length, 1);
  assert.equal(duplicate.payloadHashChanged, false);
});

test('duplicate event id with different payload hash is detected', async () => {
  await persistRazorpayWebhookEvent({
    event: makeEvent(),
    rawBody: JSON.stringify(makeEvent()),
    EventModel: FakeWebhookEventModel,
  });
  const duplicate = await persistRazorpayWebhookEvent({
    event: makeEvent({ event: 'payment.failed' }),
    rawBody: JSON.stringify(makeEvent({ event: 'payment.failed' })),
    EventModel: FakeWebhookEventModel,
  });

  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.payloadHashChanged, true);
  assert.match(FakeWebhookEventModel.docs[0].lastError, /different payload hash/);
});

test('webhook enqueue uses deterministic BullMQ job id and minimal payload', async () => {
  const added = [];
  const webhookEvent = {
    _id: 'webhook-1',
    provider: RAZORPAY_PROVIDER,
    eventId: 'evt_phase42_foundation',
    status: 'received',
    save: async function save() { return this; },
  };
  const queueFactory = (queueName) => ({
    add: async (name, data, options) => {
      added.push({ queueName, name, data, options });
    },
  });

  const result = await enqueueWebhookEvent(webhookEvent, { queueFactory });

  assert.equal(result.queued, true);
  assert.equal(added[0].queueName, QUEUE_NAMES.webhook);
  assert.equal(added[0].name, JOB_NAMES.razorpayWebhook);
  assert.deepEqual(added[0].data, {
    webhookEventId: 'webhook-1',
    provider: RAZORPAY_PROVIDER,
    eventId: 'evt_phase42_foundation',
  });
  assert.equal(added[0].options.jobId, getWebhookJobId({ provider: RAZORPAY_PROVIDER, eventId: 'evt_phase42_foundation' }));
  assert.equal(added[0].options.attempts, WEBHOOK_JOB_ATTEMPTS);
  assert.equal(webhookEvent.status, 'queued');
});

test('webhook enqueue leaves event recoverable when queue is unavailable', async () => {
  const webhookEvent = {
    _id: 'webhook-1',
    provider: RAZORPAY_PROVIDER,
    eventId: 'evt_phase42_foundation',
    status: 'received',
  };
  const result = await enqueueWebhookEvent(webhookEvent, { queueFactory: () => null });

  assert.deepEqual(result, { queued: false, reason: 'redis_not_configured' });
  assert.equal(webhookEvent.status, 'received');
});

test('worker processing atomically claims event and marks it processed once', async () => {
  const event = await FakeWebhookEventModel.create({
    provider: RAZORPAY_PROVIDER,
    eventId: 'evt_phase42_foundation',
    eventType: 'payment.captured',
    status: 'queued',
    attempts: 0,
    payloadHash: 'hash',
    payload: makeEvent(),
  });
  let businessCalls = 0;
  const first = await processWebhookEventJob(
    { webhookEventId: event._id, provider: RAZORPAY_PROVIDER, eventId: event.eventId },
    {
      EventModel: FakeWebhookEventModel,
      businessProcessor: async () => {
        businessCalls += 1;
        return { action: 'processed_for_test' };
      },
    }
  );
  const second = await processWebhookEventJob(
    { webhookEventId: event._id, provider: RAZORPAY_PROVIDER, eventId: event.eventId },
    {
      EventModel: FakeWebhookEventModel,
      businessProcessor: async () => {
        businessCalls += 1;
        return { action: 'should_not_run' };
      },
    }
  );

  assert.equal(first.processed, true);
  assert.equal(second.skipped, true);
  assert.equal(second.status, 'processed');
  assert.equal(businessCalls, 1);
  assert.equal(event.status, 'processed');
  assert.equal(event.attempts, 1);
});

test('worker failure records attempt and sanitized error for retry visibility', async () => {
  const event = await FakeWebhookEventModel.create({
    provider: RAZORPAY_PROVIDER,
    eventId: 'evt_phase42_foundation',
    eventType: 'payment.captured',
    status: 'queued',
    attempts: 0,
    payloadHash: 'hash',
    payload: makeEvent(),
  });

  await assert.rejects(
    processWebhookEventJob(
      { webhookEventId: event._id, provider: RAZORPAY_PROVIDER, eventId: event.eventId },
      {
        EventModel: FakeWebhookEventModel,
        businessProcessor: async () => {
          throw new Error('temporary database outage');
        },
      }
    ),
    /temporary database outage/
  );

  assert.equal(event.status, 'failed');
  assert.equal(event.attempts, 1);
  assert.match(event.lastError, /temporary database outage/);
  assert.ok(event.lastErrorAt instanceof Date);
});
