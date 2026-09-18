const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
const RefundOperation = require('../models/RefundOperation');
const { createQueue } = require('../queues/factory');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');
const { getBackoffBaseMs } = require('../config/redis');
const { razorpayRequest } = require('./razorpay');

const PROCESSING_STALE_MS = 15 * 60 * 1000;
const REFUND_JOB_ATTEMPTS = 3;

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const normalize = (value) => String(value || '').trim();
const safeErrorMessage = (err) => normalize(err?.message || err || 'Refund operation failed').slice(0, 500);
const nowPlus = (ms) => new Date(Date.now() + ms);
const shouldProcessInlineForTests = () =>
  process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);

const buildBookingRefundOperationKey = ({ bookingId, reason = 'booking_refund' }) =>
  `refund:booking:${bookingId}:${normalize(reason) || 'booking_refund'}`;

const buildModificationRefundOperationKey = ({ modificationId, reason = 'modification_refund' }) =>
  `refund:modification:${modificationId}:${normalize(reason) || 'modification_refund'}`;

const getRefundJobId = (refundOperationId) => `refund:operation:${refundOperationId}`;

const sanitizeProviderMetadata = (refund) => ({
  id: refund?.id,
  status: refund?.status,
  amount: refund?.amount,
  currency: refund?.currency,
  created_at: refund?.created_at,
  speed_processed: refund?.speed_processed,
  speed_requested: refund?.speed_requested,
});

const providerStatusToBusinessStatus = (status) =>
  String(status || '') === 'processed' ? 'processed' : 'pending';

const classifyRefundError = (err) => {
  const statusCode = Number(err?.statusCode || 0);
  const code = String(err?.code || '').toUpperCase();
  if (statusCode >= 400 && statusCode < 500) return 'known_failure';
  if (statusCode >= 500) return 'retryable';
  if (['ECONNREFUSED', 'ENOTFOUND'].includes(code)) return 'retryable';
  if (['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ERR_HTTP2_STREAM_CANCEL'].includes(code)) return 'uncertain';
  return 'uncertain';
};

const syncBookingRefundState = async (booking, operation) => {
  booking.refundAmount = operation.requestedAmount;
  booking.refundRequestedAt = booking.refundRequestedAt || operation.requestedAt || new Date();
  if (operation.providerRefundId) booking.refundId = operation.providerRefundId;
  if (operation.status === 'processed') {
    booking.refundStatus = providerStatusToBusinessStatus(operation.providerStatus);
    if (booking.refundStatus === 'processed') booking.refundProcessedAt = operation.processedAt || new Date();
    booking.refundReconciliationState = 'none';
    booking.refundFailureReason = undefined;
  } else if (operation.status === 'failed') {
    booking.refundStatus = 'failed';
    booking.refundFailureReason = operation.lastError;
  } else if (operation.status === 'reconciliation_required') {
    booking.refundStatus = 'failed';
    booking.refundFailureReason = operation.lastError || 'Refund outcome requires reconciliation';
    booking.refundReconciliationState = 'needs_refund_reconciliation';
  } else {
    booking.refundStatus = 'pending';
  }
  await booking.save();
};

const syncModificationRefundState = async (modification, operation) => {
  modification.refundAmount = operation.requestedAmount;
  modification.refundRequestedAt = modification.refundRequestedAt || operation.requestedAt || new Date();
  if (operation.providerRefundId) modification.refundId = operation.providerRefundId;
  if (operation.status === 'processed') {
    modification.refundStatus = providerStatusToBusinessStatus(operation.providerStatus);
    if (modification.refundStatus === 'processed') modification.refundProcessedAt = operation.processedAt || new Date();
    modification.reconciliationState = 'none';
    modification.refundFailureReason = undefined;
  } else if (operation.status === 'failed') {
    modification.refundStatus = 'failed';
    modification.refundFailureReason = operation.lastError;
  } else if (operation.status === 'reconciliation_required') {
    modification.refundStatus = 'failed';
    modification.refundFailureReason = operation.lastError || 'Refund outcome requires reconciliation';
    modification.reconciliationState = 'needs_refund_reconciliation';
  } else {
    modification.refundStatus = 'pending';
  }
  await modification.save();
};

const loadTargetForOperation = async (operation) => {
  if (operation.bookingId) {
    const booking = await Booking.findById(operation.bookingId);
    if (!booking) throw httpError('Booking not found for refund operation', 404);
    return { booking };
  }
  const modification = await BookingModification.findById(operation.modificationId);
  if (!modification) throw httpError('BookingModification not found for refund operation', 404);
  const booking = await Booking.findById(modification.bookingId);
  if (!booking) throw httpError('Booking not found for refund operation', 404);
  return { booking, modification };
};

const enqueueRefundOperation = async (operation, { queueFactory = createQueue } = {}) => {
  const queue = queueFactory(QUEUE_NAMES.refund, { required: false });
  if (!queue) return { queued: false, reason: 'redis_not_configured' };
  await queue.add(
    JOB_NAMES.razorpayRefund,
    { refundOperationId: String(operation._id) },
    {
      jobId: getRefundJobId(operation._id),
      attempts: REFUND_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: getBackoffBaseMs() },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
    }
  );
  if (operation.status === 'requested') {
    operation.status = 'queued';
    operation.queuedAt = operation.queuedAt || new Date();
    await operation.save();
  }
  return { queued: true };
};

const createRefundOperation = async ({
  booking,
  modification,
  amount,
  reason,
  operationKey,
  paymentId,
  orderId,
  currency = 'INR',
  queue = true,
  queueFactory = createQueue,
}) => {
  const requestedAmount = Math.max(0, Math.round(Number(amount || 0)));
  if (!requestedAmount) {
    if (booking) {
      booking.refundStatus = 'not_required';
      booking.refundAmount = 0;
      await booking.save();
    }
    if (modification) {
      modification.refundStatus = 'not_required';
      modification.refundAmount = 0;
      await modification.save();
    }
    return { operation: null, queued: false, zeroAmount: true };
  }
  if (currency !== 'INR') throw httpError('Refund currency mismatch', 400);
  if (!booking && !modification) throw httpError('Refund target is required', 400);
  if (booking && modification) throw httpError('Refund target must be booking or modification', 400);

  const targetBooking = booking || await Booking.findById(modification.bookingId);
  const providerPaymentId = normalize(paymentId || targetBooking?.razorpayPaymentId);
  const providerOrderId = normalize(orderId || targetBooking?.razorpayOrderId || modification?.razorpayOrderId);
  const key = normalize(operationKey || (
    modification
      ? buildModificationRefundOperationKey({ modificationId: modification._id, reason })
      : buildBookingRefundOperationKey({ bookingId: booking._id, reason })
  ));

  let operation;
  try {
    operation = await RefundOperation.create({
      provider: 'razorpay',
      operationKey: key,
      bookingId: booking?._id,
      modificationId: modification?._id,
      paymentId: providerPaymentId,
      orderId: providerOrderId,
      requestedAmount,
      currency,
      reason: normalize(reason) || 'refund',
      status: 'requested',
      requestedAt: new Date(),
    });
    console.log(`[refund] operation_created refundOperationId=${operation._id} status=requested`);
  } catch (err) {
    if (String(err?.code) !== '11000') throw err;
    operation = await RefundOperation.findOne({ operationKey: key });
    return { operation, queued: false, idempotent: true };
  }

  if (booking) {
    booking.refundAmount = requestedAmount;
    booking.refundStatus = 'pending';
    booking.refundRequestedAt = booking.refundRequestedAt || new Date();
    await booking.save();
  }
  if (modification) {
    modification.refundAmount = requestedAmount;
    modification.refundStatus = 'pending';
    modification.refundRequestedAt = modification.refundRequestedAt || new Date();
    await modification.save();
  }

  if (!providerPaymentId) {
    operation.status = 'reconciliation_required';
    operation.reconciliationState = 'required';
    operation.lastError = 'Missing Razorpay payment id for refund';
    operation.lastErrorAt = new Date();
    operation.nextReconciliationAt = nowPlus(6 * 60 * 60 * 1000);
    await operation.save();
    if (booking) await syncBookingRefundState(booking, operation);
    if (modification) await syncModificationRefundState(modification, operation);
    return { operation, queued: false, reconciliationRequired: true };
  }

  if (!queue) return { operation, queued: false };
  const queued = await enqueueRefundOperation(operation, { queueFactory });
  if (shouldProcessInlineForTests()) {
    await processRefundOperationJob({ refundOperationId: String(operation._id) });
  }
  return { operation, ...queued };
};

const claimRefundOperation = async ({ refundOperationId, OperationModel = RefundOperation, now = new Date() }) => {
  if (!mongoose.Types.ObjectId.isValid(String(refundOperationId || ''))) throw httpError('Invalid refund operation id', 400);
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_MS);
  return OperationModel.findOneAndUpdate(
    {
      _id: refundOperationId,
      $or: [
        { status: { $in: ['requested', 'queued', 'retry_scheduled'] } },
        { status: 'processing', processingStartedAt: { $lte: staleBefore }, providerRefundId: { $exists: false } },
      ],
    },
    {
      $set: { status: 'processing', processingStartedAt: now },
      $inc: { attempts: 1 },
    },
    { new: true }
  );
};

const markOperationFailed = async (operation, err, { retryable = false } = {}) => {
  operation.lastError = safeErrorMessage(err);
  operation.lastErrorAt = new Date();
  if (retryable && operation.attempts < REFUND_JOB_ATTEMPTS) {
    operation.status = 'retry_scheduled';
    operation.nextReconciliationAt = nowPlus(getBackoffBaseMs());
    await operation.save();
    throw err;
  }
  operation.status = 'failed';
  operation.failedAt = new Date();
  await operation.save();
};

const markOperationUncertain = async (operation, err) => {
  operation.status = 'reconciliation_required';
  operation.reconciliationState = 'required';
  operation.lastError = safeErrorMessage(err);
  operation.lastErrorAt = new Date();
  operation.nextReconciliationAt = nowPlus(60 * 60 * 1000);
  await operation.save();
};

const applyProviderRefundResult = async (operation, refund) => {
  operation.providerRefundId = refund.id || operation.providerRefundId;
  operation.providerStatus = refund.status || operation.providerStatus || 'created';
  operation.providerResponseMetadata = sanitizeProviderMetadata(refund);
  operation.status = 'processed';
  operation.reconciliationState = 'none';
  operation.processedAt = new Date();
  operation.lastError = undefined;
  operation.lastErrorAt = undefined;
  await operation.save();

  const { booking, modification } = await loadTargetForOperation(operation);
  if (modification) await syncModificationRefundState(modification, operation);
  else await syncBookingRefundState(booking, operation);
  console.log(`[refund] provider_success refundOperationId=${operation._id} providerRefundId=${operation.providerRefundId}`);
  return operation;
};

const executeProviderRefund = async (operation) => {
  if (operation.providerRefundId) return applyProviderRefundResult(operation, {
    id: operation.providerRefundId,
    status: operation.providerStatus || 'processed',
  });
  if (operation.currency !== 'INR') throw httpError('Refund currency mismatch', 400);
  if (!operation.paymentId) throw httpError('Missing Razorpay payment id for refund', 409);
  if (!Number.isInteger(operation.requestedAmount) || operation.requestedAmount <= 0) {
    throw httpError('Invalid refund amount', 400);
  }
  console.log(`[refund] provider_request_started refundOperationId=${operation._id} attempt=${operation.attempts}`);
  const refund = await razorpayRequest({
    method: 'POST',
    path: `/v1/payments/${encodeURIComponent(operation.paymentId)}/refund`,
    body: {
      amount: operation.requestedAmount * 100,
      speed: 'normal',
      receipt: `refund-${String(operation._id).slice(-16)}`,
      notes: {
        refundOperationId: String(operation._id),
        operationKey: operation.operationKey,
        reason: operation.reason,
      },
    },
  });
  if (!refund?.id) throw httpError('Razorpay refund response missing refund id', 502);
  return applyProviderRefundResult(operation, refund);
};

const processRefundOperationJob = async ({ refundOperationId }, {
  OperationModel = RefundOperation,
  providerExecutor = executeProviderRefund,
} = {}) => {
  const claimed = await claimRefundOperation({ refundOperationId, OperationModel });
  if (!claimed) {
    const existing = await OperationModel.findById(refundOperationId);
    if (!existing) throw httpError('RefundOperation not found', 404);
    if (existing.providerRefundId && existing.status !== 'processed') {
      return providerExecutor(existing);
    }
    return { skipped: true, status: existing.status };
  }
  try {
    return await providerExecutor(claimed);
  } catch (err) {
    const kind = classifyRefundError(err);
    if (kind === 'uncertain') {
      await markOperationUncertain(claimed, err);
      const { booking, modification } = await loadTargetForOperation(claimed);
      if (modification) await syncModificationRefundState(modification, claimed);
      else await syncBookingRefundState(booking, claimed);
      return { reconciliationRequired: true, refundOperationId: String(claimed._id) };
    }
    await markOperationFailed(claimed, err, { retryable: kind === 'retryable' });
    const { booking, modification } = await loadTargetForOperation(claimed);
    if (modification) await syncModificationRefundState(modification, claimed);
    else await syncBookingRefundState(booking, claimed);
    throw err;
  }
};

const reconcileRefundOperation = async (operation) => {
  if (operation.providerRefundId) {
    return applyProviderRefundResult(operation, {
      id: operation.providerRefundId,
      status: operation.providerStatus || 'processed',
    });
  }
  if (!operation.paymentId) throw httpError('Missing Razorpay payment id for reconciliation', 409);
  const response = await razorpayRequest({ path: `/v1/payments/${encodeURIComponent(operation.paymentId)}/refunds` });
  const refunds = Array.isArray(response?.items) ? response.items : [];
  const match = refunds.find((refund) =>
    String(refund?.notes?.refundOperationId || '') === String(operation._id) ||
    String(refund?.notes?.operationKey || '') === String(operation.operationKey)
  );
  operation.reconciliationAttempts = Number(operation.reconciliationAttempts || 0) + 1;
  operation.lastReconciledAt = new Date();
  if (!match) {
    operation.reconciliationState = 'manual_review';
    operation.nextReconciliationAt = nowPlus(6 * 60 * 60 * 1000);
    await operation.save();
    return operation;
  }
  return applyProviderRefundResult(operation, match);
};

module.exports = {
  REFUND_JOB_ATTEMPTS,
  buildBookingRefundOperationKey,
  buildModificationRefundOperationKey,
  claimRefundOperation,
  classifyRefundError,
  createRefundOperation,
  enqueueRefundOperation,
  executeProviderRefund,
  getRefundJobId,
  processRefundOperationJob,
  reconcileRefundOperation,
  syncBookingRefundState,
  syncModificationRefundState,
};
