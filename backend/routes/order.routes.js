const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { enqueueJob } = require('../utils/jobQueue');
const {
  notifyOrderCreated,
  sendOrderInvoice,
  sendOrderCancellationEmail,
} = require('../utils/customerMessages');
const router = express.Router();

const allowedStatuses = ['pending', 'processing', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const SHIPPING_FEE = 49;
const clean = (value) => String(value || '').trim();
const cancellationMoney = (totalAmount) => {
  const total = Math.max(0, Math.round(Number(totalAmount || 0)));
  const cancellationDeductionPercent = 12;
  const cancellationDeductionAmount = Math.round((total * cancellationDeductionPercent) / 100);
  return {
    cancellationDeductionPercent,
    cancellationDeductionAmount,
    refundableAmount: Math.max(0, total - cancellationDeductionAmount),
  };
};

const stripLargeInlineImage = (value) => {
  const image = clean(value);
  if (!image) return '';
  if (image.startsWith('data:') && image.length > 2048) return '';
  return image;
};

const getFeatureSettings = async () => {
  const settings = await Settings.findOne().select('shopEnabled trackOrderEnabled').lean();
  return {
    shopEnabled: settings?.shopEnabled !== false,
    trackOrderEnabled: settings?.trackOrderEnabled !== false,
  };
};

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
    const { trackOrderEnabled } = await getFeatureSettings();
    if (!trackOrderEnabled) {
      return res.status(503).json({ success: false, message: 'Order tracking is currently unavailable' });
    }

    const trackingId = String(req.params.trackingId || '').trim();
    if (!/^\d{5}$/.test(trackingId)) {
      return res.status(400).json({ success: false, message: 'Invalid tracking id' });
    }

    const order = await Order.findOne({ trackingId }).select([
      'orderId',
      'trackingId',
      'productName',
      'productImage',
      'subtotalAmount',
      'shippingFee',
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
      'cancellationReason',
      'cancelledByRole',
      'cancelledAt',
      'cancellationDetails',
      'cancellationDeductionPercent',
      'cancellationDeductionAmount',
      'refundableAmount',
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
              'subtotalAmount',
              'shippingFee',
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
              'invoiceSentAt',
              'cancellationReason',
              'cancelledByRole',
              'cancelledAt',
              'cancellationDetails',
              'cancellationDeductionPercent',
              'cancellationDeductionAmount',
              'refundableAmount',
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
    const { shopEnabled } = await getFeatureSettings();
    if (!shopEnabled) {
      return res.status(503).json({ success: false, message: 'Shop is currently unavailable' });
    }

    const productId = clean(req.body?.productId);
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(req.body?.quantity || 1))));
    const shippingAddress = clean(req.body?.shippingAddress);
    const orderNotes = clean(req.body?.orderNotes);
    const upiTransactionId = clean(req.body?.upiTransactionId);

    if (!productId) return res.status(400).json({ success: false, message: 'Product is required' });
    if (!Number.isFinite(quantity) || quantity < 1) return res.status(400).json({ success: false, message: 'Valid quantity is required' });
    if (!shippingAddress) return res.status(400).json({ success: false, message: 'Shipping address is required' });
    if (!upiTransactionId) return res.status(400).json({ success: false, message: 'UPI transaction ID is required' });

    const product = await Product.findById(productId).lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (!product.inStock) return res.status(400).json({ success: false, message: 'This product is currently out of stock' });

    const productPrice = Math.max(0, Math.round(Number(product.price || 0)));
    if (!productPrice) return res.status(400).json({ success: false, message: 'Product price is not available' });
    const subtotalAmount = productPrice * quantity;
    const shippingFee = SHIPPING_FEE;

    // In the very rare case of a trackingId collision, retry a few times.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const order = await Order.create({
          service_billing_model: 'ecommerce_direct',
          productId: product._id,
          productName: product.name,
          productImage: stripLargeInlineImage(product.images?.[0] || req.body?.productImage),
          productPrice,
          quantity,
          subtotalAmount,
          shippingFee,
          totalAmount: subtotalAmount + shippingFee,
          userId: req.user._id,
          userName: clean(req.body?.userName) || req.user.name,
          userEmail: clean(req.body?.userEmail) || req.user.email,
          userPhone: clean(req.body?.userPhone) || req.user.phone,
          shippingAddress,
          orderNotes,
          paymentStatus: 'pending',
          orderStatus: 'pending',
          upiTransactionId,
        });
        notifyOrderCreated(order);
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
    enqueueJob(`order-invoice:${order.orderId}`, async () => {
      await sendOrderInvoice(order);
      await Order.updateOne({ _id: order._id, invoiceSentAt: { $exists: false } }, { $set: { invoiceSentAt: new Date() } });
    });
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    order.paymentStatus = 'failed';
    order.orderStatus = 'cancelled';
    order.cancellationReason = clean(req.body?.reason || req.body?.note) || 'Payment rejected and order cancelled';
    order.cancelledByRole = 'admin';
    order.cancelledAt = new Date();
    order.cancellationDetails = clean(req.body?.details || req.body?.cancellationDetails) || 'Payment could not be verified by admin.';
    Object.assign(order, cancellationMoney(order.totalAmount));
    order.statusHistory.push({
      status: 'cancelled',
      note: order.cancellationReason,
      updatedByName: req.user?.name || 'Admin',
      createdAt: new Date(),
    });
    await order.save();
    enqueueJob(`order-cancel-email:${order.orderId}:${Date.now()}`, () => sendOrderCancellationEmail(order, order.cancellationReason));
    res.json({ success: true, data: order });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const reason = clean(req.body?.reason || req.body?.cancellationReason);
    const cancellationDetails = clean(req.body?.details || req.body?.cancellationDetails);
    if (!reason) return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    if (!cancellationDetails) return res.status(400).json({ success: false, message: 'Cancellation details are required' });
    const query = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, userId: req.user._id };
    const order = await Order.findOne(query);
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    if (order.orderStatus === 'cancelled') return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    if (req.user.role !== 'admin' && (order.orderStatus === 'shipped' || order.orderStatus === 'delivered')) {
      return res.status(400).json({ success: false, message: 'Shipped or delivered orders cannot be cancelled online. Please contact support.' });
    }
    order.orderStatus = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledByRole = req.user.role === 'admin' ? 'admin' : 'user';
    order.cancelledAt = new Date();
    order.cancellationDetails = cancellationDetails;
    Object.assign(order, cancellationMoney(order.totalAmount));
    order.statusHistory.push({
      status: 'cancelled',
      note: reason,
      updatedByName: req.user?.name || (req.user.role === 'admin' ? 'Admin' : 'Customer'),
      createdAt: new Date(),
    });
    await order.save();
    enqueueJob(`order-cancel-email:${order.orderId}:${Date.now()}`, () => sendOrderCancellationEmail(order, reason));
    res.json({ success: true, data: order, message: 'Order cancelled and customer notified.' });
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
