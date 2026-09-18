const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
const PaymentReconciliation = require('../models/PaymentReconciliation');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { createQueue } = require('../queues/factory');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');
const { getBackoffBaseMs } = require('../config/redis');
const {
  getRazorpayPayment,
  listRazorpayPaymentsForOrder,
} = require('./razorpay');
const {
  markBookingPaymentPaid,
  markBookingPaymentFailed,
  getExpectedRoomNightLockCount,
} = require('./reservationLifecycle');
const { applyModificationPaymentFromWebhook, markModificationPaymentFailed } = require('./bookingModification');

const PROCESSING_STALE_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_RECENT_WINDOW_MINUTES = 60;

const normalize = (value) => String(value || '').trim();

const asPositiveInt = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const getPaymentReconciliationEnabled = () =>
  String(process.env.PAYMENT_RECONCILIATION_ENABLED || 'false').toLowerCase() === 'true';

const getPaymentReconciliationIntervalMs = () =>
  asPositiveInt(process.env.PAYMENT_RECONCILIATION_INTERVAL_MS, 300_000, { min: 60_000, max: 24 * 60 * 60 * 1000 });

const getPaymentReconciliationBatchSize = () =>
  asPositiveInt(process.env.PAYMENT_RECONCILIATION_BATCH_SIZE, DEFAULT_BATCH_SIZE, { min: 1, max: 200 });

const getPaymentReconciliationMaxAttempts = () =>
  asPositiveInt(process.env.PAYMENT_RECONCILIATION_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, { min: 1, max: 20 });

const getPaymentReconciliationRecentWindowMinutes = () =>
  asPositiveInt(process.env.PAYMENT_RECONCILIATION_RECENT_WINDOW_MINUTES, DEFAULT_RECENT_WINDOW_MINUTES, { min: 5, max: 24 * 60 });

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const safeErrorMessage = (err) => normalize(err?.message || err || 'Payment reconciliation failed').slice(0, 500);

const nowPlus = (ms) => new Date(Date.now() + ms);

const buildPaymentReconciliationKey = ({ targetType, targetId, orderId, paymentId }) =>
  `payment-reconcile:${normalize(targetType)}:${normalize(targetId)}:${normalize(orderId) || 'order-none'}:${normalize(paymentId) || 'payment-none'}`;

const getPaymentReconciliationJobId = ({ targetType, targetId }) =>
  `payment-reconcile:${normalize(targetType)}:${normalize(targetId)}`;

const expectedBookingAmountPaise = (booking) =>
  Math.max(0, Math.round(Number(booking?.advanceAmount || booking?.advance_paid || booking?.totalAmount || 0) * 100));

const expectedModificationAmountPaise = (modification) =>
  Math.max(0, Math.round(Number(modification?.differenceAmount || 0) * 100));

const sanitizeProviderPayment = (payment) => ({
  id: payment?.id,
  order_id: payment?.order_id,
  amount: payment?.amount,
  currency: payment?.currency,
  status: payment?.status,
  captured: payment?.captured,
  method: payment?.method,
  created_at: payment?.created_at,
});

const classifyProviderError = (err) => {
  const statusCode = Number(err?.statusCode || 0);
  const code = normalize(err?.code).toUpperCase();
  if (statusCode === 404) return 'not_found';
  if (statusCode === 429 || statusCode >= 500) return 'retryable';
  if (['ECONNREFUSED', 'ENOTFOUND'].includes(code)) return 'retryable';
  if (['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ERR_HTTP2_STREAM_CANCEL'].includes(code)) return 'uncertain';
  if (statusCode >= 400 && statusCode < 500) return 'non_retryable';
  return 'uncertain';
};

const isCapturedPayment = (payment) =>
  String(payment?.status || '') === 'captured' || payment?.captured === true;

const isFailedPayment = (payment) =>
  ['failed', 'cancelled'].includes(String(payment?.status || ''));

const classifyPaymentComparison = ({ payment, expectedAmount, expectedCurrency = 'INR', orderId }) => {
  if (!payment) return { status: 'reconciliation_required', reason: 'provider_payment_not_found' };
  if (normalize(payment.order_id) !== normalize(orderId)) {
    return { status: 'reconciliation_required', reason: 'provider_payment_order_mismatch' };
  }
  if (Number(payment.amount || 0) !== Number(expectedAmount || 0)) {
    return { status: 'reconciliation_required', reason: 'provider_amount_mismatch' };
  }
  if (normalize(payment.currency) !== expectedCurrency) {
    return { status: 'reconciliation_required', reason: 'provider_currency_mismatch' };
  }
  if (isCapturedPayment(payment)) return { status: 'captured', reason: 'provider_payment_captured' };
  if (isFailedPayment(payment)) return { status: 'failed', reason: 'provider_payment_failed' };
  return { status: 'reconciliation_required', reason: 'provider_payment_state_unknown' };
};

const classifyCapturedBookingLocalState = ({ bookingStatus, paymentStatus, inventoryComplete = true }) => {
  if (paymentStatus === 'paid') return { status: 'resolved', reason: 'provider_captured_local_already_paid' };
  if (bookingStatus === 'pending' && paymentStatus === 'pending' && inventoryComplete) {
    return { status: 'safe_to_confirm', reason: 'provider_captured_local_pending' };
  }
  if (bookingStatus === 'pending' && paymentStatus === 'pending' && !inventoryComplete) {
    return { status: 'reconciliation_required', reason: 'provider_captured_inventory_incomplete' };
  }
  return { status: 'reconciliation_required', reason: `provider_captured_local_${bookingStatus || paymentStatus || 'unknown'}` };
};

const classifyCapturedModificationLocalState = ({ status, paymentStatus }) => {
  if (status === 'completed' && paymentStatus === 'paid') {
    return { status: 'resolved', reason: 'provider_captured_modification_already_completed' };
  }
  if (status === 'pending_payment' && paymentStatus === 'pending') {
    return { status: 'safe_to_apply', reason: 'provider_captured_modification_pending' };
  }
  return { status: 'reconciliation_required', reason: `provider_captured_modification_${status || paymentStatus || 'unknown'}` };
};

const createOrGetPaymentReconciliation = async ({
  targetType,
  booking,
  modification,
  orderId,
  paymentId,
  expectedAmount,
  reason,
  status = 'pending',
}) => {
  const targetId = targetType === 'booking' ? booking?._id : modification?._id;
  const normalizedPaymentId = normalize(paymentId);
  const reconciliationKey = buildPaymentReconciliationKey({ targetType, targetId, orderId, paymentId: normalizedPaymentId });
  const targetQuery = targetType === 'booking'
    ? { bookingId: booking._id }
    : { modificationId: modification._id };
  const possibleKeys = [reconciliationKey];
  if (normalizedPaymentId) {
    possibleKeys.push(buildPaymentReconciliationKey({ targetType, targetId, orderId, paymentId: undefined }));
  }
  const existing = await PaymentReconciliation.findOne({
    provider: 'razorpay',
    ...targetQuery,
    orderId,
    reconciliationKey: { $in: possibleKeys },
  }).sort({ createdAt: 1 });
  if (existing) {
    let changed = false;
    if (normalizedPaymentId && !existing.paymentId) {
      existing.paymentId = normalizedPaymentId;
      changed = true;
    }
    if (Number(expectedAmount || 0) > 0 && !Number(existing.expectedAmount || 0)) {
      existing.expectedAmount = expectedAmount;
      changed = true;
    }
    if (changed) await existing.save();
    return existing;
  }

  try {
    return await PaymentReconciliation.create({
      provider: 'razorpay',
      reconciliationKey,
      targetType,
      bookingId: targetType === 'booking' ? booking._id : undefined,
      modificationId: targetType === 'modification' ? modification._id : undefined,
      orderId,
      paymentId: normalizedPaymentId,
      expectedAmount,
      currency: 'INR',
      localPaymentStatus: targetType === 'booking' ? booking?.paymentStatus : modification?.paymentStatus,
      localBookingStatus: targetType === 'booking' ? booking?.bookingStatus : modification?.status,
      reconciliationStatus: status,
      reason,
      nextCheckAt: new Date(),
    });
  } catch (err) {
    if (String(err?.code) !== '11000') throw err;
    return PaymentReconciliation.findOne({ reconciliationKey });
  }
};

const claimPaymentReconciliation = async ({ reconciliationId, now = new Date(), Model = PaymentReconciliation }) => {
  if (!mongoose.Types.ObjectId.isValid(String(reconciliationId || ''))) {
    throw httpError('Invalid payment reconciliation id', 400);
  }
  const staleBefore = new Date(now.getTime() - PROCESSING_STALE_MS);
  return Model.findOneAndUpdate(
    {
      _id: reconciliationId,
      $or: [
        { reconciliationStatus: { $in: ['pending', 'retry_scheduled'] }, nextCheckAt: { $lte: now } },
        { reconciliationStatus: 'pending', nextCheckAt: { $exists: false } },
        { reconciliationStatus: 'processing', lastCheckedAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: { reconciliationStatus: 'processing', lastCheckedAt: now },
      $inc: { attemptCount: 1 },
    },
    { new: true }
  );
};

const markReconciliationRequired = async (record, reason, extra = {}) => {
  record.reconciliationStatus = 'reconciliation_required';
  record.reason = reason;
  record.failureReason = extra.failureReason || reason;
  record.nextCheckAt = undefined;
  record.providerAmount = extra.providerAmount ?? record.providerAmount;
  record.providerStatus = extra.providerStatus || record.providerStatus;
  record.currency = extra.currency || record.currency;
  record.providerResponseMetadata = extra.providerResponseMetadata || record.providerResponseMetadata;
  await record.save();
  console.log(`[payment_reconciliation_required] id=${record._id} reason=${record.reason}`);
  return record;
};

const markResolved = async (record, reason, payment) => {
  record.reconciliationStatus = 'resolved';
  record.reason = reason;
  record.resolvedAt = new Date();
  record.nextCheckAt = undefined;
  if (payment) {
    record.paymentId = normalize(payment.id) || record.paymentId;
    record.providerAmount = Number(payment.amount || 0);
    record.providerStatus = normalize(payment.status);
    record.currency = normalize(payment.currency) || record.currency;
    record.providerResponseMetadata = sanitizeProviderPayment(payment);
  }
  await record.save();
  console.log(`[payment_reconciliation_resolved] id=${record._id} reason=${record.reason}`);
  return record;
};

const markRetryScheduled = async (record, err) => {
  const maxAttempts = getPaymentReconciliationMaxAttempts();
  if (Number(record.attemptCount || 0) >= maxAttempts) {
    return markReconciliationRequired(record, 'max_reconciliation_attempts_exceeded', { failureReason: safeErrorMessage(err) });
  }
  record.reconciliationStatus = 'retry_scheduled';
  record.failureReason = safeErrorMessage(err);
  record.nextCheckAt = nowPlus(getBackoffBaseMs() * Math.max(1, Number(record.attemptCount || 1)));
  await record.save();
  console.log(`[payment_reconciliation_retry_scheduled] id=${record._id} attempt=${record.attemptCount}`);
  return record;
};

const resolveProviderPayment = async ({ orderId, paymentId, provider = {} }) => {
  if (paymentId) {
    return provider.getPayment
      ? provider.getPayment(paymentId)
      : getRazorpayPayment(paymentId);
  }
  const response = provider.listPaymentsForOrder
    ? await provider.listPaymentsForOrder(orderId)
    : await listRazorpayPaymentsForOrder(orderId);
  const items = Array.isArray(response?.items) ? response.items : [];
  if (items.length === 1) return items[0];
  if (items.length > 1) {
    const err = httpError('Multiple Razorpay payments found for order', 409);
    err.reconciliationReason = 'multiple_provider_payments';
    err.providerPayments = items.map(sanitizeProviderPayment);
    throw err;
  }
  return null;
};

const hasCompleteInventory = async (booking) => {
  const expected = getExpectedRoomNightLockCount(booking);
  if (!expected) return true;
  return RoomUnitBookingDay.countDocuments({ bookingId: booking._id }).then((count) => count === expected);
};

const reconcileBookingPayment = async ({ bookingId, paymentId, reconciliationId, provider = {} }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    if (reconciliationId) {
      const record = await PaymentReconciliation.findById(reconciliationId);
      if (record) return markReconciliationRequired(record, 'local_target_missing');
    }
    throw httpError('Booking not found', 404);
  }
  if (!booking.razorpayOrderId) throw httpError('Booking has no Razorpay order id', 409);

  const expectedAmount = expectedBookingAmountPaise(booking);
  const record = reconciliationId
    ? await PaymentReconciliation.findById(reconciliationId)
    : await createOrGetPaymentReconciliation({
      targetType: 'booking',
      booking,
      orderId: booking.razorpayOrderId,
      paymentId: paymentId || booking.razorpayPaymentId,
      expectedAmount,
      reason: 'booking_payment_reconciliation',
    });
  if (!record) throw httpError('PaymentReconciliation not found', 404);

  let payment;
  try {
    payment = await resolveProviderPayment({ orderId: booking.razorpayOrderId, paymentId: paymentId || booking.razorpayPaymentId, provider });
  } catch (err) {
    if (err.reconciliationReason) {
      return markReconciliationRequired(record, err.reconciliationReason, { providerResponseMetadata: err.providerPayments });
    }
    const kind = classifyProviderError(err);
    if (kind === 'retryable') return markRetryScheduled(record, err);
    return markReconciliationRequired(record, kind === 'not_found' ? 'provider_payment_not_found' : 'provider_payment_unknown', { failureReason: safeErrorMessage(err) });
  }

  const comparison = classifyPaymentComparison({
    payment,
    expectedAmount,
    expectedCurrency: 'INR',
    orderId: booking.razorpayOrderId,
  });

  record.paymentId = normalize(payment?.id) || record.paymentId;
  record.providerAmount = Number(payment?.amount || 0);
  record.providerStatus = normalize(payment?.status);
  record.currency = normalize(payment?.currency) || record.currency;
  record.localPaymentStatus = booking.paymentStatus;
  record.localBookingStatus = booking.bookingStatus;
  record.providerResponseMetadata = payment ? sanitizeProviderPayment(payment) : undefined;

  if (comparison.status === 'reconciliation_required') {
    return markReconciliationRequired(record, comparison.reason, {
      providerAmount: record.providerAmount,
      providerStatus: record.providerStatus,
      currency: record.currency,
      providerResponseMetadata: record.providerResponseMetadata,
    });
  }

  if (comparison.status === 'failed') {
    if (booking.paymentStatus === 'pending' && booking.bookingStatus === 'pending') {
      await markBookingPaymentFailed(booking, {
        paymentProvider: 'razorpay',
        paymentId: normalize(payment?.id),
        status: normalize(payment?.status) || 'failed',
        actorRole: 'system',
        reason: 'razorpay_payment_reconciled_failed',
      });
      return markResolved(record, 'provider_failed_local_marked_failed', payment);
    }
    if (booking.paymentStatus === 'paid') {
      return markReconciliationRequired(record, 'provider_failed_local_paid', { providerResponseMetadata: record.providerResponseMetadata });
    }
    return markResolved(record, 'provider_failed_local_already_terminal', payment);
  }

  const localDecision = classifyCapturedBookingLocalState({
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus,
    inventoryComplete: await hasCompleteInventory(booking),
  });
  if (localDecision.status === 'resolved') {
    return markResolved(record, localDecision.reason, payment);
  }
  if (localDecision.status === 'reconciliation_required') {
    return markReconciliationRequired(record, localDecision.reason, { providerResponseMetadata: record.providerResponseMetadata });
  }

  await markBookingPaymentPaid(booking, {
    paymentProvider: 'razorpay',
    paymentId: normalize(payment?.id),
    orderId: booking.razorpayOrderId,
    status: normalize(payment?.status) || 'captured',
    actorRole: 'system',
    reason: 'razorpay_payment_reconciled_captured',
  });
  return markResolved(record, 'provider_captured_local_confirmed', payment);
};

const reconcileModificationPayment = async ({ modificationId, paymentId, reconciliationId, provider = {} }) => {
  const modification = await BookingModification.findById(modificationId);
  if (!modification) {
    if (reconciliationId) {
      const record = await PaymentReconciliation.findById(reconciliationId);
      if (record) return markReconciliationRequired(record, 'local_target_missing');
    }
    throw httpError('BookingModification not found', 404);
  }
  if (!modification.razorpayOrderId) throw httpError('Modification has no Razorpay order id', 409);

  const expectedAmount = expectedModificationAmountPaise(modification);
  const record = reconciliationId
    ? await PaymentReconciliation.findById(reconciliationId)
    : await createOrGetPaymentReconciliation({
      targetType: 'modification',
      modification,
      orderId: modification.razorpayOrderId,
      paymentId: paymentId || modification.razorpayPaymentId,
      expectedAmount,
      reason: 'modification_payment_reconciliation',
    });
  if (!record) throw httpError('PaymentReconciliation not found', 404);

  let payment;
  try {
    payment = await resolveProviderPayment({ orderId: modification.razorpayOrderId, paymentId: paymentId || modification.razorpayPaymentId, provider });
  } catch (err) {
    if (err.reconciliationReason) {
      return markReconciliationRequired(record, err.reconciliationReason, { providerResponseMetadata: err.providerPayments });
    }
    const kind = classifyProviderError(err);
    if (kind === 'retryable') return markRetryScheduled(record, err);
    return markReconciliationRequired(record, kind === 'not_found' ? 'provider_payment_not_found' : 'provider_payment_unknown', { failureReason: safeErrorMessage(err) });
  }

  const comparison = classifyPaymentComparison({
    payment,
    expectedAmount,
    expectedCurrency: 'INR',
    orderId: modification.razorpayOrderId,
  });

  record.paymentId = normalize(payment?.id) || record.paymentId;
  record.providerAmount = Number(payment?.amount || 0);
  record.providerStatus = normalize(payment?.status);
  record.currency = normalize(payment?.currency) || record.currency;
  record.localPaymentStatus = modification.paymentStatus;
  record.localBookingStatus = modification.status;
  record.providerResponseMetadata = payment ? sanitizeProviderPayment(payment) : undefined;

  if (comparison.status === 'reconciliation_required') {
    return markReconciliationRequired(record, comparison.reason, { providerResponseMetadata: record.providerResponseMetadata });
  }

  if (comparison.status === 'failed') {
    if (modification.status === 'pending_payment') {
      await markModificationPaymentFailed({
        orderId: modification.razorpayOrderId,
        status: normalize(payment?.status) || 'failed',
      });
      return markResolved(record, 'provider_failed_modification_marked_failed', payment);
    }
    if (modification.paymentStatus === 'paid') {
      return markReconciliationRequired(record, 'provider_failed_modification_paid', { providerResponseMetadata: record.providerResponseMetadata });
    }
    return markResolved(record, 'provider_failed_modification_already_terminal', payment);
  }

  const localDecision = classifyCapturedModificationLocalState({
    status: modification.status,
    paymentStatus: modification.paymentStatus,
  });
  if (localDecision.status === 'resolved') {
    return markResolved(record, localDecision.reason, payment);
  }
  if (localDecision.status === 'reconciliation_required') {
    return markReconciliationRequired(record, localDecision.reason, { providerResponseMetadata: record.providerResponseMetadata });
  }

  const updated = await applyModificationPaymentFromWebhook({
    orderId: modification.razorpayOrderId,
    paymentId: normalize(payment?.id),
    status: normalize(payment?.status) || 'captured',
  });
  if (!updated || updated.status !== 'completed') {
    return markReconciliationRequired(record, 'provider_captured_modification_not_safely_applied', { providerResponseMetadata: record.providerResponseMetadata });
  }
  return markResolved(record, 'provider_captured_modification_applied', payment);
};

const enqueuePaymentReconciliation = async ({ targetType, targetId, paymentId, queueFactory = createQueue } = {}) => {
  const queue = queueFactory(QUEUE_NAMES.payment, { required: false });
  if (!queue) return { queued: false, reason: 'redis_not_configured' };
  await queue.add(
    JOB_NAMES.razorpayPaymentReconcile,
    { targetType, targetId: String(targetId), paymentId: normalize(paymentId) || undefined },
    {
      jobId: getPaymentReconciliationJobId({ targetType, targetId }),
      attempts: 1,
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
    }
  );
  return { queued: true };
};

const processPaymentReconciliationJob = async (jobData, options = {}) => {
  const targetType = normalize(jobData?.targetType);
  const targetId = normalize(jobData?.targetId);
  const paymentId = normalize(jobData?.paymentId);
  if (!['booking', 'modification'].includes(targetType) || !mongoose.Types.ObjectId.isValid(targetId)) {
    throw httpError('Invalid payment reconciliation job payload', 400);
  }

  let target;
  if (targetType === 'booking') {
    target = await Booking.findById(targetId);
  } else {
    target = await BookingModification.findById(targetId);
  }
  if (!target) throw httpError('Payment reconciliation target not found', 404);

  const orderId = target.razorpayOrderId;
  const expectedAmount = targetType === 'booking' ? expectedBookingAmountPaise(target) : expectedModificationAmountPaise(target);
  let resolvedPaymentId = paymentId || normalize(target.razorpayPaymentId);
  if (!resolvedPaymentId && orderId) {
    try {
      const providerPayment = await resolveProviderPayment({ orderId, provider: options.provider });
      resolvedPaymentId = normalize(providerPayment?.id);
    } catch (_) {
      resolvedPaymentId = '';
    }
  }

  const record = await createOrGetPaymentReconciliation({
    targetType,
    booking: targetType === 'booking' ? target : undefined,
    modification: targetType === 'modification' ? target : undefined,
    orderId,
    paymentId: resolvedPaymentId,
    expectedAmount,
    reason: `${targetType}_payment_reconciliation`,
  });

  const claimed = await claimPaymentReconciliation({ reconciliationId: record._id });
  if (!claimed) {
    const existing = await PaymentReconciliation.findById(record._id);
    return { skipped: true, status: existing?.reconciliationStatus };
  }

  if (targetType === 'booking') {
    return reconcileBookingPayment({ bookingId: targetId, paymentId: resolvedPaymentId, reconciliationId: claimed._id, provider: options.provider });
  }
  return reconcileModificationPayment({ modificationId: targetId, paymentId: resolvedPaymentId, reconciliationId: claimed._id, provider: options.provider });
};

const sweepPaymentReconciliation = async ({ limit = getPaymentReconciliationBatchSize(), queueFactory = createQueue } = {}) => {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || DEFAULT_BATCH_SIZE));
  const recentSince = new Date(Date.now() - getPaymentReconciliationRecentWindowMinutes() * 60 * 1000);
  const bookings = await Booking.find({
    paymentProvider: 'razorpay',
    paymentStatus: 'pending',
    bookingStatus: 'pending',
    razorpayOrderId: { $exists: true, $ne: '' },
    createdAt: { $gte: recentSince },
  }).sort({ createdAt: -1 }).limit(safeLimit).select('_id razorpayPaymentId').lean();

  const remaining = Math.max(0, safeLimit - bookings.length);
  const modifications = remaining
    ? await BookingModification.find({
      status: 'pending_payment',
      paymentStatus: 'pending',
      razorpayOrderId: { $exists: true, $ne: '' },
      createdAt: { $gte: recentSince },
    }).sort({ createdAt: -1 }).limit(remaining).select('_id razorpayPaymentId').lean()
    : [];

  let enqueued = 0;
  for (const booking of bookings) {
    const result = await enqueuePaymentReconciliation({
      targetType: 'booking',
      targetId: booking._id,
      paymentId: booking.razorpayPaymentId,
      queueFactory,
    });
    if (result.queued) enqueued += 1;
  }
  for (const modification of modifications) {
    const result = await enqueuePaymentReconciliation({
      targetType: 'modification',
      targetId: modification._id,
      paymentId: modification.razorpayPaymentId,
      queueFactory,
    });
    if (result.queued) enqueued += 1;
  }

  return { scanned: bookings.length + modifications.length, enqueued };
};

module.exports = {
  buildPaymentReconciliationKey,
  classifyCapturedBookingLocalState,
  classifyCapturedModificationLocalState,
  classifyPaymentComparison,
  classifyProviderError,
  createOrGetPaymentReconciliation,
  claimPaymentReconciliation,
  enqueuePaymentReconciliation,
  expectedBookingAmountPaise,
  expectedModificationAmountPaise,
  getPaymentReconciliationBatchSize,
  getPaymentReconciliationEnabled,
  getPaymentReconciliationIntervalMs,
  getPaymentReconciliationJobId,
  getPaymentReconciliationMaxAttempts,
  getPaymentReconciliationRecentWindowMinutes,
  isCapturedPayment,
  isFailedPayment,
  markReconciliationRequired,
  processPaymentReconciliationJob,
  reconcileBookingPayment,
  reconcileModificationPayment,
  resolveProviderPayment,
  sweepPaymentReconciliation,
};
