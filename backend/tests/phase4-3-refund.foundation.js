const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const RefundOperation = require('../models/RefundOperation');
const {
  REFUND_JOB_ATTEMPTS,
  buildBookingRefundOperationKey,
  buildModificationRefundOperationKey,
  classifyRefundError,
  enqueueRefundOperation,
  getRefundJobId,
  processRefundOperationJob,
} = require('../utils/refundOperations');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');

class FakeOperationModel {
  static docs = [];

  static reset() {
    FakeOperationModel.docs = [];
  }

  static async create(doc) {
    if (FakeOperationModel.docs.some((existing) => existing.operationKey === doc.operationKey)) {
      const err = new Error('duplicate key');
      err.code = 11000;
      throw err;
    }
    const saved = {
      _id: new mongoose.Types.ObjectId(),
      attempts: 0,
      ...doc,
      save: async function save() { return this; },
    };
    FakeOperationModel.docs.push(saved);
    return saved;
  }

  static async findOne(query) {
    return FakeOperationModel.docs.find((doc) => {
      if (query.operationKey && doc.operationKey !== query.operationKey) return false;
      return true;
    }) || null;
  }

  static async findById(id) {
    return FakeOperationModel.docs.find((doc) => String(doc._id) === String(id)) || null;
  }

  static async findOneAndUpdate(query, update) {
    const doc = await FakeOperationModel.findById(query._id);
    if (!doc) return null;
    const claimable = ['requested', 'queued', 'retry_scheduled'].includes(doc.status) ||
      (doc.status === 'processing' && !doc.providerRefundId && doc.processingStartedAt <= query.$or?.[1]?.processingStartedAt?.$lte);
    if (!claimable) return null;
    Object.assign(doc, update.$set || {});
    doc.attempts = Number(doc.attempts || 0) + Number(update.$inc?.attempts || 0);
    return doc;
  }
}

test.beforeEach(() => {
  FakeOperationModel.reset();
});

test('RefundOperation schema supports controlled states and exactly one target', async () => {
  assert.ok(RefundOperation.schema.path('operationKey'));
  assert.ok(RefundOperation.schema.path('providerRefundId'));
  assert.ok(RefundOperation.schema.path('reconciliationState'));
  assert.deepEqual(RefundOperation.schema.path('status').enumValues, [
    'requested',
    'queued',
    'processing',
    'retry_scheduled',
    'processed',
    'failed',
    'reconciliation_required',
  ]);

  const invalid = new RefundOperation({
    operationKey: 'refund:invalid',
    requestedAmount: 100,
    reason: 'test',
    paymentId: 'pay_test',
  });
  await assert.rejects(invalid.validate(), /exactly one/);
});

test('refund operation keys are deterministic for booking and modification refunds', () => {
  assert.equal(
    buildBookingRefundOperationKey({ bookingId: 'booking-1', reason: 'booking_cancellation' }),
    'refund:booking:booking-1:booking_cancellation'
  );
  assert.equal(
    buildModificationRefundOperationKey({ modificationId: 'mod-1', reason: 'modification_refund' }),
    'refund:modification:mod-1:modification_refund'
  );
});

test('operationKey uniqueness prevents duplicate logical refund intent', async () => {
  const bookingId = new mongoose.Types.ObjectId();
  const operationKey = buildBookingRefundOperationKey({ bookingId, reason: 'booking_cancellation' });
  await FakeOperationModel.create({
    provider: 'razorpay',
    operationKey,
    bookingId,
    paymentId: 'pay_1',
    requestedAmount: 8800,
    currency: 'INR',
    reason: 'booking_cancellation',
    status: 'requested',
  });
  await assert.rejects(
    FakeOperationModel.create({
      provider: 'razorpay',
      operationKey,
      bookingId,
      paymentId: 'pay_1',
      requestedAmount: 8800,
      currency: 'INR',
      reason: 'booking_cancellation',
      status: 'requested',
    }),
    /duplicate key/
  );
});

test('refund enqueue uses deterministic job id and minimal payload', async () => {
  const added = [];
  const operation = {
    _id: new mongoose.Types.ObjectId(),
    status: 'requested',
    save: async function save() { return this; },
  };
  const result = await enqueueRefundOperation(operation, {
    queueFactory: (queueName) => ({
      add: async (name, data, options) => added.push({ queueName, name, data, options }),
    }),
  });

  assert.equal(result.queued, true);
  assert.equal(operation.status, 'queued');
  assert.equal(added[0].queueName, QUEUE_NAMES.refund);
  assert.equal(added[0].name, JOB_NAMES.razorpayRefund);
  assert.deepEqual(added[0].data, { refundOperationId: String(operation._id) });
  assert.equal(added[0].options.jobId, getRefundJobId(operation._id));
  assert.equal(added[0].options.attempts, REFUND_JOB_ATTEMPTS);
});

test('queue unavailable leaves refund intent recoverable', async () => {
  const operation = {
    _id: new mongoose.Types.ObjectId(),
    status: 'requested',
    save: async function save() { return this; },
  };
  const result = await enqueueRefundOperation(operation, { queueFactory: () => null });
  assert.deepEqual(result, { queued: false, reason: 'redis_not_configured' });
  assert.equal(operation.status, 'requested');
});

test('refund worker atomically claims once and duplicate delivery is safe', async () => {
  const operation = await FakeOperationModel.create({
    provider: 'razorpay',
    operationKey: 'refund:booking:one:booking_cancellation',
    bookingId: new mongoose.Types.ObjectId(),
    paymentId: 'pay_1',
    requestedAmount: 8800,
    currency: 'INR',
    reason: 'booking_cancellation',
    status: 'queued',
  });
  let providerCalls = 0;
  const first = await processRefundOperationJob(
    { refundOperationId: String(operation._id) },
    {
      OperationModel: FakeOperationModel,
      providerExecutor: async (claimed) => {
        providerCalls += 1;
        claimed.status = 'processed';
        claimed.providerRefundId = 'rfnd_1';
        await claimed.save();
        return claimed;
      },
    }
  );
  const second = await processRefundOperationJob(
    { refundOperationId: String(operation._id) },
    {
      OperationModel: FakeOperationModel,
      providerExecutor: async () => {
        providerCalls += 1;
        throw new Error('should not run');
      },
    }
  );

  assert.equal(first.providerRefundId, 'rfnd_1');
  assert.deepEqual(second, { skipped: true, status: 'processed' });
  assert.equal(providerCalls, 1);
});

test('existing providerRefundId prevents a second provider refund call', async () => {
  const operation = await FakeOperationModel.create({
    provider: 'razorpay',
    operationKey: 'refund:booking:existing:booking_cancellation',
    bookingId: new mongoose.Types.ObjectId(),
    paymentId: 'pay_1',
    requestedAmount: 8800,
    currency: 'INR',
    reason: 'booking_cancellation',
    status: 'failed',
    providerRefundId: 'rfnd_existing',
  });
  let providerCalls = 0;
  const result = await processRefundOperationJob(
    { refundOperationId: String(operation._id) },
    {
      OperationModel: FakeOperationModel,
      providerExecutor: async (existing) => {
        providerCalls += 1;
        assert.equal(existing.providerRefundId, 'rfnd_existing');
        existing.status = 'processed';
        return existing;
      },
    }
  );
  assert.equal(result.status, 'processed');
  assert.equal(providerCalls, 1);
});

test('error classification avoids blind retry for uncertain outcomes', () => {
  assert.equal(classifyRefundError(Object.assign(new Error('bad request'), { statusCode: 400 })), 'known_failure');
  assert.equal(classifyRefundError(Object.assign(new Error('unavailable'), { statusCode: 503 })), 'retryable');
  assert.equal(classifyRefundError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), 'uncertain');
});
