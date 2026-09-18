const crypto = require('crypto');

const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
const WebhookEvent = require('../models/WebhookEvent');
const { ensureBookingInvoiceNotification } = require('./notificationDelivery');
const {
  markBookingPaymentPaid,
  markBookingPaymentFailed,
} = require('./reservationLifecycle');
const {
  applyModificationPaymentFromWebhook,
  markModificationPaymentFailed,
} = require('./bookingModification');
const { createQueue } = require('../queues/factory');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');
const { getBackoffBaseMs } = require('../config/redis');

const RAZORPAY_PROVIDER = 'razorpay';
const STALE_PROCESSING_MS = 15 * 60 * 1000;
const WEBHOOK_JOB_ATTEMPTS = 5;

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const safeErrorMessage = (err) => String(err?.message || err || 'Webhook processing failed').slice(0, 500);

const sanitizeRazorpayEvent = (event) => ({
  id: String(event?.id || ''),
  event: String(event?.event || ''),
  payload: event?.payload || {},
  created_at: event?.created_at,
});

const validateRazorpayEventEnvelope = (event) => {
  const eventId = String(event?.id || '').trim();
  const eventType = String(event?.event || '').trim();
  if (!eventId) throw httpError('Razorpay webhook event id is required', 400);
  if (!eventType) throw httpError('Razorpay webhook event type is required', 400);
  return { eventId, eventType };
};

const extractRazorpayPaymentContext = (payload) => {
  const payment = payload?.payload?.payment?.entity || {};
  const order = payload?.payload?.order?.entity || {};
  return {
    eventName: String(payload?.event || ''),
    eventId: String(payload?.id || ''),
    payment,
    paymentId: String(payment.id || ''),
    orderId: String(payment.order_id || order.id || ''),
    status: String(payment.status || ''),
  };
};

const markBookingPaidFromRazorpay = async (booking, {
  paymentId,
  orderId,
  signature,
  status = 'captured',
} = {}) => {
  const alreadyPaid = booking?.paymentStatus === 'paid';
  const updated = alreadyPaid
    ? booking
    : await markBookingPaymentPaid(booking, {
      paymentProvider: 'razorpay',
      paymentId,
      orderId,
      signature,
      status,
      actorRole: 'system',
      reason: 'razorpay_payment_captured',
    });

  if (!booking.invoiceSentAt && !['cab', 'tour'].includes(String(booking.bookingType || ''))) {
    await ensureBookingInvoiceNotification(updated);
  }
  return updated;
};

const markBookingFailedFromRazorpay = async (booking, status = 'failed') =>
  markBookingPaymentFailed(booking, {
    paymentProvider: 'razorpay',
    status,
    actorRole: 'system',
    reason: 'razorpay_payment_failed',
  });

const applyRazorpayWebhookBusinessEvent = async (webhookEvent) => {
  const context = extractRazorpayPaymentContext(webhookEvent.payload);
  if (!context.orderId) {
    return { action: 'ignored', reason: 'missing_order_id' };
  }

  const booking = await Booking.findOne({ razorpayOrderId: context.orderId });
  if (booking) {
    if (context.eventId && booking.razorpayWebhookEventIds?.map(String).includes(context.eventId)) {
      return { action: 'duplicate_booking_event', bookingId: booking._id };
    }
    if (context.eventId) {
      booking.razorpayWebhookEventIds = [...(booking.razorpayWebhookEventIds || []), context.eventId].slice(-25);
    }

    if (context.eventName === 'payment.captured') {
      await markBookingPaidFromRazorpay(booking, {
        paymentId: context.paymentId,
        orderId: context.orderId,
        status: context.status || 'captured',
      });
      return { action: 'booking_payment_captured', bookingId: booking._id };
    }
    if (context.eventName === 'payment.failed') {
      await markBookingFailedFromRazorpay(booking, context.status || 'failed');
      return { action: 'booking_payment_failed', bookingId: booking._id };
    }
    await booking.save();
    return { action: 'unsupported_booking_event', bookingId: booking._id, eventName: context.eventName };
  }

  const modification = await BookingModification.findOne({ razorpayOrderId: context.orderId });
  if (modification) {
    if (context.eventName === 'payment.captured') {
      const updated = await applyModificationPaymentFromWebhook({
        orderId: context.orderId,
        paymentId: context.paymentId,
        eventId: context.eventId,
        status: context.status || 'captured',
      });
      return { action: 'modification_payment_captured', bookingModificationId: updated?._id || modification._id };
    }
    if (context.eventName === 'payment.failed') {
      const updated = await markModificationPaymentFailed({
        orderId: context.orderId,
        eventId: context.eventId,
        status: context.status || 'failed',
      });
      return { action: 'modification_payment_failed', bookingModificationId: updated?._id || modification._id };
    }
    return { action: 'unsupported_modification_event', bookingModificationId: modification._id, eventName: context.eventName };
  }

  return { action: 'unmatched_payment_order', orderId: context.orderId, eventName: context.eventName };
};

const persistRazorpayWebhookEvent = async ({ event, rawBody, EventModel = WebhookEvent }) => {
  const { eventId, eventType } = validateRazorpayEventEnvelope(event);
  const payload = sanitizeRazorpayEvent(event);
  const payloadHash = sha256(rawBody);

  try {
    const doc = await EventModel.create({
      provider: RAZORPAY_PROVIDER,
      eventId,
      eventType,
      status: 'received',
      receivedAt: new Date(),
      payloadHash,
      payload,
    });
    return { webhookEvent: doc, duplicate: false, payloadHashChanged: false };
  } catch (err) {
    if (String(err?.code) !== '11000') throw err;
    const existing = await EventModel.findOne({ provider: RAZORPAY_PROVIDER, eventId });
    if (!existing) throw err;
    const payloadHashChanged = existing.payloadHash && existing.payloadHash !== payloadHash;
    if (payloadHashChanged) {
      existing.lastError = 'Duplicate Razorpay event id received with different payload hash';
      existing.lastErrorAt = new Date();
      await existing.save();
    }
    return { webhookEvent: existing, duplicate: true, payloadHashChanged };
  }
};

const getWebhookJobId = ({ provider, eventId }) => `webhook:${provider}:${eventId}`;

const enqueueWebhookEvent = async (webhookEvent, { queueFactory = createQueue } = {}) => {
  const queue = queueFactory(QUEUE_NAMES.webhook, { required: false });
  if (!queue) {
    return { queued: false, reason: 'redis_not_configured' };
  }

  await queue.add(
    JOB_NAMES.razorpayWebhook,
    {
      webhookEventId: String(webhookEvent._id),
      provider: webhookEvent.provider,
      eventId: webhookEvent.eventId,
    },
    {
      jobId: getWebhookJobId({ provider: webhookEvent.provider, eventId: webhookEvent.eventId }),
      attempts: WEBHOOK_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: getBackoffBaseMs() },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 5000 },
    }
  );

  if (webhookEvent.status === 'received') {
    webhookEvent.status = 'queued';
    webhookEvent.queuedAt = webhookEvent.queuedAt || new Date();
    webhookEvent.lastError = undefined;
    webhookEvent.lastErrorAt = undefined;
    await webhookEvent.save();
  }

  return { queued: true };
};

const claimWebhookEventForProcessing = async ({
  webhookEventId,
  provider,
  eventId,
  now = new Date(),
  EventModel = WebhookEvent,
}) => {
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  return EventModel.findOneAndUpdate(
    {
      _id: webhookEventId,
      provider,
      eventId,
      $or: [
        { status: { $in: ['received', 'queued', 'failed'] } },
        { status: 'processing', processingStartedAt: { $lte: staleBefore } },
      ],
    },
    {
      $set: {
        status: 'processing',
        processingStartedAt: now,
      },
      $inc: { attempts: 1 },
    },
    { new: true }
  );
};

const processWebhookEventJob = async (jobData, {
  businessProcessor = applyRazorpayWebhookBusinessEvent,
  EventModel = WebhookEvent,
} = {}) => {
  const webhookEventId = String(jobData?.webhookEventId || '');
  const provider = String(jobData?.provider || '');
  const eventId = String(jobData?.eventId || '');
  if (!webhookEventId || provider !== RAZORPAY_PROVIDER || !eventId) {
    throw httpError('Invalid webhook job payload', 400);
  }

  const claimed = await claimWebhookEventForProcessing({ webhookEventId, provider, eventId, EventModel });
  if (!claimed) {
    const existing = await EventModel.findOne({ _id: webhookEventId, provider, eventId });
    if (!existing) throw httpError('WebhookEvent not found', 404);
    return { skipped: true, status: existing.status };
  }

  try {
    const result = await businessProcessor(claimed);
    claimed.status = 'processed';
    claimed.processedAt = new Date();
    claimed.failedAt = undefined;
    claimed.lastError = undefined;
    claimed.lastErrorAt = undefined;
    claimed.processingResult = result;
    if (result?.bookingId) claimed.bookingId = result.bookingId;
    if (result?.bookingModificationId) claimed.bookingModificationId = result.bookingModificationId;
    await claimed.save();
    console.log(`[webhook] provider=${provider} eventId=${eventId} status=processed`);
    return { processed: true, result };
  } catch (err) {
    claimed.status = 'failed';
    claimed.failedAt = new Date();
    claimed.lastError = safeErrorMessage(err);
    claimed.lastErrorAt = new Date();
    await claimed.save();
    console.error(`[webhook] provider=${provider} eventId=${eventId} status=failed error=${claimed.lastError}`);
    throw err;
  }
};

module.exports = {
  RAZORPAY_PROVIDER,
  WEBHOOK_JOB_ATTEMPTS,
  applyRazorpayWebhookBusinessEvent,
  claimWebhookEventForProcessing,
  enqueueWebhookEvent,
  extractRazorpayPaymentContext,
  getWebhookJobId,
  markBookingFailedFromRazorpay,
  markBookingPaidFromRazorpay,
  persistRazorpayWebhookEvent,
  processWebhookEventJob,
  sanitizeRazorpayEvent,
  validateRazorpayEventEnvelope,
};
