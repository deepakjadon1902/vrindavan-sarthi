const crypto = require('crypto');
const https = require('https');
const express = require('express');
const Booking = require('../models/Booking');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { protect, authorize } = require('../middleware/auth');
const { sendBookingInvoice } = require('../utils/customerMessages');
const { enqueueJob } = require('../utils/jobQueue');
const router = express.Router();

const getRazorpayConfig = () => {
  const keyId = String(process.env.RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    const err = new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    err.statusCode = 503;
    throw err;
  }
  return { keyId, keySecret };
};

const timingSafeEqualHex = (a, b) => {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const hmacSha256 = (payload, secret) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

const verifyPaymentSignature = ({ orderId, paymentId, signature, secret }) =>
  timingSafeEqualHex(hmacSha256(`${orderId}|${paymentId}`, secret), signature);

const verifyWebhookSignature = ({ rawBody, signature, secret }) =>
  timingSafeEqualHex(hmacSha256(rawBody, secret), signature);

const razorpayRequest = ({ method = 'GET', path, body }) => {
  const { keyId, keySecret } = getRazorpayConfig();
  const payload = body ? JSON.stringify(body) : '';

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path,
        method,
        auth: `${keyId}:${keySecret}`,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed = {};
          try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          const err = new Error(parsed?.error?.description || parsed?.message || 'Razorpay request failed');
          err.statusCode = res.statusCode;
          err.details = parsed;
          reject(err);
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

const payableAmountForBooking = (booking) => Math.max(0, Math.round(Number(
  booking?.advanceAmount || booking?.advance_paid || booking?.totalAmount || 0
)));

const markBookingPaid = async (booking, { paymentId, orderId, signature, status = 'captured' } = {}) => {
  if (!booking || booking.paymentStatus === 'paid') return booking;
  booking.paymentProvider = 'razorpay';
  booking.razorpayOrderId = orderId || booking.razorpayOrderId;
  booking.razorpayPaymentId = paymentId || booking.razorpayPaymentId;
  booking.razorpaySignature = signature || booking.razorpaySignature;
  booking.razorpayStatus = status;
  booking.paymentStatus = 'paid';
  booking.bookingStatus = 'confirmed';
  booking.verificationStage = 'verified';
  booking.partnerPaymentVerified = true;
  booking.partnerPaymentVerifiedAt = booking.partnerPaymentVerifiedAt || new Date();
  booking.adminPaymentVerified = true;
  booking.adminPaymentVerifiedAt = booking.adminPaymentVerifiedAt || new Date();
  booking.paidAt = booking.paidAt || new Date();
  await booking.save();
  if (!booking.invoiceSentAt && !['cab', 'tour'].includes(String(booking.bookingType || ''))) {
    enqueueJob(`invoice:${booking.bookingId}`, async () => {
      await sendBookingInvoice(booking);
      await Booking.updateOne({ _id: booking._id }, { $set: { invoiceSentAt: new Date() } });
    });
  }
  return booking;
};

const markBookingFailed = async (booking, status = 'failed') => {
  if (!booking || booking.paymentStatus === 'paid') return booking;
  booking.paymentProvider = 'razorpay';
  booking.razorpayStatus = status;
  booking.paymentStatus = 'failed';
  booking.bookingStatus = 'cancelled';
  booking.verificationStage = 'rejected';
  booking.partnerPaymentVerified = false;
  booking.adminPaymentVerified = false;
  booking.adminPaymentVerifiedAt = null;
  booking.payout_status = 'cancelled';
  await booking.save();
  await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
  return booking;
};

router.post('/razorpay/fail', protect, async (req, res) => {
  try {
    const bookingId = String(req.body?.bookingId || '').trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
    const status = String(req.body?.status || 'failed').trim().toLowerCase();
    const allowedStatuses = ['failed', 'cancelled', 'dismissed', 'verification_failed'];

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.paymentProvider !== 'razorpay') {
      return res.status(400).json({ success: false, message: 'Only Razorpay bookings can be auto-failed here' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Paid booking cannot be marked failed' });
    }

    if (razorpayPaymentId) booking.razorpayPaymentId = razorpayPaymentId;
    const updated = await markBookingFailed(
      booking,
      allowedStatuses.includes(status) ? status : 'failed'
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.post('/razorpay/orders', protect, async (req, res) => {
  try {
    const { keyId } = getRazorpayConfig();
    const bookingMongoId = String(req.body?.bookingId || req.body?.id || '').trim();
    const booking = await Booking.findOne({ _id: bookingMongoId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.paymentStatus === 'paid') return res.status(400).json({ success: false, message: 'Booking is already paid' });
    if (booking.bookingStatus === 'cancelled') return res.status(400).json({ success: false, message: 'Cancelled booking cannot be paid' });

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
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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

    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({ success: false, message: 'Razorpay order does not match this booking' });
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

  res.json({ success: true });

  setImmediate(async () => {
    try {
      const eventId = String(event?.id || '');
      const payment = event?.payload?.payment?.entity || {};
      const orderId = String(payment.order_id || event?.payload?.order?.entity?.id || '');
      if (!orderId) return;

      const booking = await Booking.findOne({ razorpayOrderId: orderId });
      if (!booking) return;
      if (eventId && booking.razorpayWebhookEventIds?.map(String).includes(eventId)) return;
      if (eventId) booking.razorpayWebhookEventIds = [...(booking.razorpayWebhookEventIds || []), eventId].slice(-25);

      const eventName = String(event?.event || '');
      if (eventName === 'payment.captured') {
        await markBookingPaid(booking, {
          paymentId: String(payment.id || ''),
          orderId,
          status: String(payment.status || 'captured'),
        });
      } else if (eventName === 'payment.failed') {
        await markBookingFailed(booking, String(payment.status || 'failed'));
      }
    } catch (err) {
      console.error('[razorpay.webhook]', err?.message || err);
    }
  });
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
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
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id).select('paymentProvider').lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are verified automatically by server/webhook.' });
    }
    const booking = await Booking.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid' }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id).select('paymentProvider').lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing.paymentProvider === 'razorpay') {
      return res.status(400).json({ success: false, message: 'Razorpay payments are updated automatically by server/webhook.' });
    }
    const booking = await Booking.findByIdAndUpdate(req.params.id, { paymentStatus: 'failed' }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
