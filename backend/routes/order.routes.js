const express = require('express');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

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
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
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
    const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid', orderStatus: 'confirmed' }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus: 'failed', orderStatus: 'cancelled' }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { orderStatus: req.body.status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
