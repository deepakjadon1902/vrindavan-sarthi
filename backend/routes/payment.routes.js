const express = require('express');
const Booking = require('../models/Booking');
const RefundOperation = require('../models/RefundOperation');
const PaymentReconciliation = require('../models/PaymentReconciliation');
const { protect, authorize } = require('../middleware/auth');
const { rejectInvalidObjectId } = require('../utils/security');
const {
  markBookingPaymentPaid,
  markBookingPaymentFailed,
} = require('../utils/reservationLifecycle');
const {
  getRazorpayConfig,
  verifyPaymentSignature,
  verifyWebhookSignature,
  razorpayRequest,
} = require('../utils/razorpay');
const {
  enqueueWebhookEvent,
  markBookingFailedFromRazorpay,
  markBookingPaidFromRazorpay,
  persistRazorpayWebhookEvent,
  processWebhookEventJob,
} = require('../utils/razorpayWebhook');
const { reconcileRefundOperation } = require('../utils/refundOperations');
const { enqueuePaymentReconciliation } = require('../utils/paymentReconciliation');
const { payableAmountForBooking } = require('../utils/bookingPayable');
const router = express.Router();

router.param('id', (req, res, next, id) => {
  if (rejectInvalidObjectId(res, id, 'payment id')) return;
  next();
});

const markBookingPaid = markBookingPaidFromRazorpay;
const markBookingFailed = markBookingFailedFromRazorpay;

router.post('/razorpay/fail', protect, async (req, res) => {
  try {
    const bookingId = String(req.body?.bookingId || '').trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
    const status = String(req.body?.status || 'failed').trim().toLowerCase();
    const allowedStatuses = ['failed', 'cancelled', 'dismissed', 'verification_failed'];

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }
    if (rejectInvalidObjectId(res, bookingId, 'booking id')) return;

    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.paymentProvider !== 'razorpay') {
      return res.status(400).json({ success: false, message: 'Only Razorpay bookings can be auto-failed here' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Paid booking cannot be marked failed' });
    }
    if (String(booking.propertyType || '').toLowerCase() === 'dharamshala' && booking.bookingStatus !== 'awaiting_customer_payment') {
      return res.status(409).json({ success: false, message: 'Dharamshala payment is available only after property acceptance' });
    }

    if (razorpayPaymentId) booking.razorpayPaymentId = razorpayPaymentId;
    const updated = await markBookingFailed(
      booking,
      allowedStatuses.includes(status) ? status : 'failed'
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Razorpay order creation failed' });
  }
});

router.post('/razorpay/orders', protect, async (req, res) => {
  try {
    const { keyId } = getRazorpayConfig();
    const bookingMongoId = String(req.body?.bookingId || req.body?.id || '').trim();
    if (rejectInvalidObjectId(res, bookingMongoId, 'booking id')) return;
    const booking = await Booking.findOne({ _id: bookingMongoId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.paymentStatus === 'paid') return res.status(409).json({ success: false, message: 'PAYMENT_ALREADY_PROCESSED' });
    if (['cancelled', 'expired', 'payment_failed', 'rejected_by_property', 'expired_property_no_response'].includes(String(booking.bookingStatus || ''))) {
      return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    }
    if (String(booking.propertyType || '').toLowerCase() === 'dharamshala' && booking.bookingStatus !== 'awaiting_customer_payment') {
      return res.status(409).json({ success: false, message: 'Dharamshala payment is available only after property acceptance' });
    }

    const amountRupees = payableAmountForBooking(booking);
    if (!amountRupees) return res.status(400).json({ success: false, message: 'Invalid payable amount' });

    if (booking.razorpayOrderId) {
      return res.json({
        success: true,
        data: {
          keyId,
          booking,
          order: { id: booking.razorpayOrderId, amount: amountRupees * 100, currency: 'INR' },
        },
      });
    }

    const order = await razorpayRequest({
      method: 'POST',
      path: '/v1/orders',
      body: {
        amount: amountRupees * 100,
        currency: 'INR',
        receipt: booking.bookingId,
        notes: {
          bookingMongoId: String(booking._id),
          bookingId: booking.bookingId,
          service: booking.bookingType,
        },
      },
    });

    booking.paymentProvider = 'razorpay';
    booking.razorpayOrderId = order.id;
    booking.razorpayStatus = order.status || 'created';
    await booking.save();

    res.status(201).json({ success: true, data: { keyId, booking, order } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Razorpay verification failed' });
  }
});

router.post('/razorpay/verify', protect, async (req, res) => {
  try {
    const { keySecret } = getRazorpayConfig();
    const bookingId = String(req.body?.bookingId || '').trim();
    const razorpayOrderId = String(req.body?.razorpay_order_id || '').trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
    const razorpaySignature = String(req.body?.razorpay_signature || '').trim();

    if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Razorpay payment response is incomplete' });
    }
    if (rejectInvalidObjectId(res, bookingId, 'booking id')) return;

    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({ success: false, message: 'Razorpay order does not match this booking' });
    }
    if (booking.paymentStatus === 'paid') {
      if (booking.razorpayPaymentId && booking.razorpayPaymentId !== razorpayPaymentId) {
        return res.status(409).json({ success: false, message: 'PAYMENT_ALREADY_PROCESSED' });
      }
      return res.json({ success: true, data: booking, message: 'PAYMENT_ALREADY_PROCESSED' });
    }
    if (['cancelled', 'expired', 'payment_failed', 'rejected_by_property', 'expired_property_no_response'].includes(String(booking.bookingStatus || ''))) {
      return res.status(409).json({ success: false, message: 'INVALID_BOOKING_STATE' });
    }
    if (String(booking.propertyType || '').toLowerCase() === 'dharamshala' && booking.bookingStatus !== 'awaiting_customer_payment') {
      return res.status(409).json({ success: false, message: 'Dharamshala payment is available only after property acceptance' });
    }

    const signatureOk = verifyPaymentSignature({
      orderId: booking.razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret: keySecret,
    });
    if (!signatureOk) return res.status(400).json({ success: false, message: 'Razorpay payment signature mismatch' });

    const expectedPaise = payableAmountForBooking(booking) * 100;
    let payment = await razorpayRequest({ path: `/v1/payments/${encodeURIComponent(razorpayPaymentId)}` });
    if (Number(payment.amount || 0) !== expectedPaise || payment.currency !== 'INR') {
      return res.status(400).json({ success: false, message: 'Razorpay amount verification failed' });
    }
    if (String(payment.status || '') === 'authorized') {
      payment = await razorpayRequest({
        method: 'POST',
        path: `/v1/payments/${encodeURIComponent(razorpayPaymentId)}/capture`,
        body: { amount: expectedPaise, currency: 'INR' },
      });
    }
    if (String(payment.status || '') !== 'captured') {
      return res.status(400).json({ success: false, message: `Razorpay payment is ${payment.status || 'not complete'}` });
    }

    const updated = await markBookingPaid(booking, {
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      signature: razorpaySignature,
      status: payment.status,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.post('/razorpay/webhook', async (req, res) => {
  const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) return res.status(503).json({ success: false, message: 'Razorpay webhook is not configured' });

  const rawBody = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  const signature = String(req.headers['x-razorpay-signature'] || '');
  if (!verifyWebhookSignature({ rawBody, signature, secret: webhookSecret })) {
    return res.status(400).json({ success: false, message: 'Invalid Razorpay webhook signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch {
    return res.status(400).json({ success: false, message: 'Invalid webhook JSON' });
  }

  try {
    const { webhookEvent, duplicate, payloadHashChanged } = await persistRazorpayWebhookEvent({ event, rawBody });
    if (payloadHashChanged) {
      return res.status(409).json({ success: false, message: 'Duplicate Razorpay event id has a different payload' });
    }

    if (webhookEvent.status === 'processed') {
      return res.json({ success: true, duplicate: true });
    }

    const enqueueResult = await enqueueWebhookEvent(webhookEvent);
    if (!enqueueResult.queued) {
      // Compatibility path for development/tests where Redis is intentionally absent.
      // The durable MongoDB inbox record has already been persisted before processing.
      const processed = await processWebhookEventJob({
        webhookEventId: String(webhookEvent._id),
        provider: webhookEvent.provider,
        eventId: webhookEvent.eventId,
      });
      return res.json({ success: true, duplicate, queued: false, processed });
    }

    if (process.env.NODE_ENV === 'test') {
      const processed = await processWebhookEventJob({
        webhookEventId: String(webhookEvent._id),
        provider: webhookEvent.provider,
        eventId: webhookEvent.eventId,
      });
      return res.json({ success: true, duplicate, queued: true, processed });
    }

    return res.json({ success: true, duplicate, queued: true });
  } catch (err) {
    console.error('[razorpay.webhook]', err?.message || err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Razorpay webhook processing failed' });
  }
});

router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5000, Math.floor(limitRaw)) : 1000;

    const bookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('bookingId bookingType itemName userName userPhone userEmail totalAmount advanceAmount paymentMethod paymentProvider paymentStatus bookingStatus razorpayOrderId razorpayPaymentId partnerId partnerName createdAt')
      .lean();
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment verification failed' }); }
});

router.get('/partner', protect, authorize('partner'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(2000, Math.floor(limitRaw)) : 500;

    const bookings = await Booking.find({ partnerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('bookingId bookingType itemName userName userPhone userEmail totalAmount advanceAmount paymentMethod paymentProvider paymentStatus bookingStatus razorpayOrderId razorpayPaymentId partnerName createdAt')
      .lean();
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment rejection failed' }); }
});

router.get('/reconciliation', protect, authorize('admin'), async (req, res) => {
  try {
    const query = {};
    for (const [param, field] of [
      ['status', 'reconciliationStatus'],
      ['targetType', 'targetType'],
      ['provider', 'provider'],
      ['orderId', 'orderId'],
      ['paymentId', 'paymentId'],
    ]) {
      if (req.query?.[param]) query[field] = String(req.query[param]).trim();
    }
    if (req.query?.bookingId) {
      if (rejectInvalidObjectId(res, String(req.query.bookingId), 'booking id')) return;
      query.bookingId = req.query.bookingId;
    }
    if (req.query?.modificationId) {
      if (rejectInvalidObjectId(res, String(req.query.modificationId), 'modification id')) return;
      query.modificationId = req.query.modificationId;
    }
    const limitRaw = Number(req.query?.limit || 100);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(200, Math.floor(limitRaw)) : 100;
    const skipRaw = Number(req.query?.skip || 0);
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;
    const records = await PaymentReconciliation.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment reconciliation lookup failed' });
  }
});

router.get('/reconciliation/:reconciliationId', protect, authorize('admin'), async (req, res) => {
  try {
    const id = String(req.params.reconciliationId || '');
    if (rejectInvalidObjectId(res, id, 'payment reconciliation id')) return;
    const record = await PaymentReconciliation.findById(id).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Payment reconciliation not found' });
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment reconciliation lookup failed' });
  }
});

router.post('/reconciliation/:reconciliationId/retry', protect, authorize('admin'), async (req, res) => {
  try {
    const id = String(req.params.reconciliationId || '');
    if (rejectInvalidObjectId(res, id, 'payment reconciliation id')) return;
    const record = await PaymentReconciliation.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Payment reconciliation not found' });
    if (['resolved', 'processing'].includes(String(record.reconciliationStatus || ''))) {
      return res.status(409).json({ success: false, message: 'Payment reconciliation cannot be retried in its current state' });
    }
    record.reconciliationStatus = 'pending';
    record.nextCheckAt = new Date();
    record.failureReason = undefined;
    await record.save();
    const targetId = record.targetType === 'booking' ? record.bookingId : record.modificationId;
    const queued = await enqueuePaymentReconciliation({
      targetType: record.targetType,
      targetId,
      paymentId: record.paymentId,
    });
    res.json({ success: true, data: record, queued });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment reconciliation retry failed' });
  }
});

router.post('/reconciliation/:reconciliationId/resolve', protect, authorize('admin'), async (req, res) => {
  try {
    const id = String(req.params.reconciliationId || '');
    if (rejectInvalidObjectId(res, id, 'payment reconciliation id')) return;
    const action = String(req.body?.action || '').trim();
    if (!['ignore'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Unsupported reconciliation resolution action' });
    }
    const record = await PaymentReconciliation.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Payment reconciliation not found' });
    if (record.reconciliationStatus === 'resolved') {
      return res.status(409).json({ success: false, message: 'Resolved reconciliation cannot be manually changed' });
    }
    record.reconciliationStatus = 'ignored';
    record.reason = String(req.body?.reason || 'admin_ignored_reconciliation').slice(0, 300);
    record.resolvedAt = new Date();
    record.nextCheckAt = undefined;
    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Payment reconciliation resolution failed' });
  }
});

router.get('/refunds/reconciliation', protect, authorize('admin'), async (req, res) => {
  try {
    const operations = await RefundOperation.find({
      status: 'reconciliation_required',
    }).sort({ updatedAt: -1 }).limit(100).lean();
    res.json({ success: true, data: operations });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Refund reconciliation lookup failed' });
  }
});

router.post('/refunds/:refundOperationId/reconcile', protect, authorize('admin'), async (req, res) => {
  try {
    const id = String(req.params.refundOperationId || '');
    if (rejectInvalidObjectId(res, id, 'refund operation id')) return;
    const operation = await RefundOperation.findById(id);
    if (!operation) return res.status(404).json({ success: false, message: 'Refund operation not found' });
    const reconciled = await reconcileRefundOperation(operation);
    res.json({ success: true, data: reconciled });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Refund reconciliation failed' });
  }
});

router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are verified automatically by server/webhook.' });
    }
    const booking = await markBookingPaymentPaid(existing, {
      paymentProvider: 'manual_upi',
      actorId: req.user._id,
      actorRole: 'admin',
      reason: 'payment_admin_verified',
    });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are updated automatically by server/webhook.' });
    }
    const booking = await markBookingPaymentFailed(existing, {
      paymentProvider: 'manual_upi',
      status: 'rejected',
      actorId: req.user._id,
      actorRole: 'admin',
      reason: 'payment_admin_rejected',
    });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
