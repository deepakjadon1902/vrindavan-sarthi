const express = require('express');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

const allowedStatuses = ['pending', 'processing', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const clean = (value) => String(value || '').trim();

const normalizeTrackingUrl = (value) => {
  const input = clean(value);
  if (!input) return '';
  try {
    const url = new URL(input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
};

const applyTrackingUpdate = (order, body, user) => {
  const previousStatus = order.orderStatus;
  const nextStatus = clean(body?.status || body?.orderStatus || order.orderStatus).toLowerCase();
  if (!allowedStatuses.includes(nextStatus)) {
    const err = new Error('Invalid order status');
    err.statusCode = 400;
    throw err;
  }

  const courierName = clean(body?.courierName);
  const awbNumber = clean(body?.awbNumber);
  const trackingUrl = normalizeTrackingUrl(body?.trackingUrl);
  const trackingNotes = clean(body?.trackingNotes || body?.note);

  order.orderStatus = nextStatus;
  if (typeof body?.courierName !== 'undefined') order.courierName = courierName;
  if (typeof body?.awbNumber !== 'undefined') order.awbNumber = awbNumber;
  if (typeof body?.trackingUrl !== 'undefined') order.trackingUrl = trackingUrl;
  if (typeof body?.trackingNotes !== 'undefined' || typeof body?.note !== 'undefined') order.trackingNotes = trackingNotes;
  if (nextStatus === 'shipped' && !order.shippedAt) order.shippedAt = new Date();
  if (nextStatus === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date();

  const hasTrackingDetailChange =
    typeof body?.courierName !== 'undefined' ||
    typeof body?.awbNumber !== 'undefined' ||
    typeof body?.trackingUrl !== 'undefined' ||
    typeof body?.trackingNotes !== 'undefined' ||
    typeof body?.note !== 'undefined';

  if (previousStatus !== nextStatus || hasTrackingDetailChange) {
    order.statusHistory.push({
      status: nextStatus,
      note: trackingNotes || (previousStatus !== nextStatus ? `Status changed from ${previousStatus} to ${nextStatus}` : 'Tracking details updated'),
      updatedByName: user?.name || 'Admin',
      createdAt: new Date(),
    });
  }
};

// Public tracking lookup (returns limited fields only)
router.get('/track/:trackingId', async (req, res) => {
  try {
    const trackingId = String(req.params.trackingId || '').trim();
    if (!/^\d{5}$/.test(trackingId)) {
      return res.status(400).json({ success: false, message: 'Invalid tracking id' });
    }

    const order = await Order.findOne({ trackingId }).select([
      'orderId',
      'trackingId',
      'productName',
      'productImage',
      'quantity',
      'totalAmount',
      'paymentStatus',
      'orderStatus',
      'courierName',
      'awbNumber',
      'trackingUrl',
      'trackingNotes',
      'shippedAt',
      'deliveredAt',
      'statusHistory',
      'createdAt',
      'updatedAt',
    ]);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/my', protect, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 200;
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5000, Math.floor(limitRaw)) : 1000;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    const withImages = String(req.query?.withImages || '').toLowerCase() === 'true';

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        withImages
          ? undefined
          : [
              'orderId',
              'trackingId',
              'productId',
              'productName',
              // omit productImage by default (can be large base64)
              'productPrice',
              'quantity',
              'totalAmount',
              'userId',
              'userName',
              'userEmail',
              'userPhone',
              'shippingAddress',
              'orderNotes',
              'courierName',
              'awbNumber',
              'trackingUrl',
              'trackingNotes',
              'shippedAt',
              'deliveredAt',
              'statusHistory',
              'paymentStatus',
              'orderStatus',
              'upiTransactionId',
              'createdAt',
              'updatedAt',
            ]
      )
      .lean();

    if (!withImages) {
      for (const o of orders) {
        o.productImage = '/placeholder.svg';
      }
    }
    res.json({ success: true, data: orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, async (req, res) => {
  try {
    // In the very rare case of a trackingId collision, retry a few times.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const order = await Order.create({ ...req.body, userId: req.user._id });
        return res.status(201).json({ success: true, data: order });
      } catch (err) {
        const isDup = err && err.code === 11000 && err.keyPattern && err.keyPattern.trackingId;
        if (!isDup || attempt === 4) throw err;
      }
    }
    return res.status(500).json({ success: false, message: 'Order creation failed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    const previousStatus = order.orderStatus;
    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';
    order.statusHistory.push({
      status: 'confirmed',
      note: previousStatus === 'confirmed' ? 'Payment verified' : 'Payment verified and order confirmed',
      updatedByName: req.user?.name || 'Admin',
      createdAt: new Date(),
    });
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    order.paymentStatus = 'failed';
    order.orderStatus = 'cancelled';
    order.statusHistory.push({
      status: 'cancelled',
      note: clean(req.body?.note) || 'Payment rejected and order cancelled',
      updatedByName: req.user?.name || 'Admin',
      createdAt: new Date(),
    });
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    applyTrackingUpdate(order, req.body, req.user);
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) { res.status(err.statusCode || 500).json({ success: false, message: err.message }); }
});

router.put('/:id/tracking', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    applyTrackingUpdate(order, req.body, req.user);
    await order.save();
    res.json({ success: true, data: order });
  } catch (err) { res.status(err.statusCode || 500).json({ success: false, message: err.message }); }
});

module.exports = router;
