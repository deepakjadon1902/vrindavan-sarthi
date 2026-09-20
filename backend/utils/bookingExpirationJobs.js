const Booking = require('../models/Booking');
const { createQueue } = require('../queues/factory');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');
const { expirePendingBookings } = require('./reservationLifecycle');
const { expireDharamshalaRequests } = require('./dharamshalaLifecycle');
const {
  createOrGetPaymentReconciliation,
  expectedBookingAmountPaise,
  enqueuePaymentReconciliation,
  classifyPaymentComparison,
  resolveProviderPayment,
  markReconciliationRequired,
} = require('./paymentReconciliation');

const DEFAULT_BATCH_SIZE = 100;

const asPositiveInt = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const getBookingExpirationEnabled = () =>
  String(process.env.BOOKING_EXPIRATION_ENABLED || 'false').toLowerCase() === 'true';

const getBookingExpirationIntervalMs = () =>
  asPositiveInt(process.env.BOOKING_EXPIRATION_INTERVAL_MS, 300_000, { min: 60_000, max: 24 * 60 * 60 * 1000 });

const getBookingExpirationBatchSize = () =>
  asPositiveInt(process.env.BOOKING_EXPIRATION_BATCH_SIZE, DEFAULT_BATCH_SIZE, { min: 1, max: 500 });

const getBookingExpirationJobId = () => 'booking-expire-pending';

const enqueueBookingExpiration = async ({ queueFactory = createQueue } = {}) => {
  const queue = queueFactory(QUEUE_NAMES.booking, { required: false });
  if (!queue) return { queued: false, reason: 'redis_not_configured' };
  await queue.add(
    JOB_NAMES.bookingExpirePending,
    {},
    {
      jobId: getBookingExpirationJobId(),
      attempts: 1,
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
    }
  );
  return { queued: true };
};

const deferForPaymentReconciliation = async (booking, reason, payment, queueFactory) => {
  const record = await createOrGetPaymentReconciliation({
    targetType: 'booking',
    booking,
    orderId: booking.razorpayOrderId,
    paymentId: payment?.id || booking.razorpayPaymentId,
    expectedAmount: expectedBookingAmountPaise(booking),
    reason,
    status: 'reconciliation_required',
  });
  await markReconciliationRequired(record, reason, {
    providerAmount: Number(payment?.amount || 0),
    providerStatus: payment?.status,
    currency: payment?.currency,
    providerResponseMetadata: payment,
  });
  await enqueuePaymentReconciliation({
    targetType: 'booking',
    targetId: booking._id,
    paymentId: payment?.id || booking.razorpayPaymentId,
    queueFactory,
  });
};

const shouldExpireBookingWithProviderCheck = async (booking, { provider, queueFactory }) => {
  if (String(booking.paymentProvider || '') !== 'razorpay' || !booking.razorpayOrderId) {
    return { expire: true };
  }

  let payment;
  try {
    payment = await resolveProviderPayment({
      orderId: booking.razorpayOrderId,
      paymentId: booking.razorpayPaymentId,
      provider,
    });
  } catch (err) {
    await deferForPaymentReconciliation(booking, err.reconciliationReason || 'provider_state_unknown_before_expiration', null, queueFactory);
    return { expire: false, reason: 'provider_state_unknown_before_expiration' };
  }

  if (!payment) return { expire: true };

  const comparison = classifyPaymentComparison({
    payment,
    expectedAmount: expectedBookingAmountPaise(booking),
    expectedCurrency: 'INR',
    orderId: booking.razorpayOrderId,
  });

  if (comparison.status === 'failed') return { expire: true };

  await deferForPaymentReconciliation(booking, `expiration_deferred_${comparison.reason}`, payment, queueFactory);
  return { expire: false, reason: comparison.reason };
};

const processBookingExpirationJob = async (_jobData = {}, { provider, queueFactory = createQueue } = {}) => {
  console.log('[booking_expiration_started]');
  const result = await expirePendingBookings({
    limit: getBookingExpirationBatchSize(),
    beforeExpireBooking: (booking) => shouldExpireBookingWithProviderCheck(booking, { provider, queueFactory }),
  });
  const dharamshalaResult = await expireDharamshalaRequests({
    limit: getBookingExpirationBatchSize(),
  });
  const scanned = Number(result.scanned || 0) + Number(dharamshalaResult.scanned || 0);
  const expired = Number(result.expired || 0) + Number(dharamshalaResult.expired || 0);
  const skipped = Math.max(0, scanned - expired);
  console.log(`[booking_expiration_finished] scanned=${scanned} expired=${expired} skipped=${skipped}`);
  return { scanned, expired, skipped, paymentHolds: result, dharamshalaRequests: dharamshalaResult };
};

const sweepBookingExpiration = async ({ queueFactory = createQueue } = {}) => {
  const now = new Date();
  const staleExists = await Booking.exists({
    $or: [
      {
        bookingStatus: 'pending',
        paymentStatus: 'pending',
        paymentHoldExpiresAt: { $lte: now },
      },
      {
        propertyType: 'dharamshala',
        bookingStatus: 'pending_property_confirmation',
        requestExpiresAt: { $lte: now },
      },
    ],
  });
  if (!staleExists) return { queued: false, reason: 'no_eligible_bookings' };
  return enqueueBookingExpiration({ queueFactory });
};

module.exports = {
  enqueueBookingExpiration,
  getBookingExpirationBatchSize,
  getBookingExpirationEnabled,
  getBookingExpirationIntervalMs,
  getBookingExpirationJobId,
  processBookingExpirationJob,
  shouldExpireBookingWithProviderCheck,
  sweepBookingExpiration,
};
