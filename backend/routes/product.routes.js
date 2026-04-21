const express = require('express');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Keep this endpoint fast for the Shop page:
    // - by default return all products (Shop can show Out of Stock)
    // - optional filter: ?inStock=true to only show in-stock items
    // - only send 1 image for list cards (detail endpoint returns full product)
    // - lean() to reduce Mongoose overhead
    res.set('Cache-Control', 'no-store');
    const inStockOnly = String(req.query?.inStock || '').toLowerCase() === 'true';
    const query = inStockOnly ? { $or: [{ inStock: true }, { inStock: { $exists: false } }] } : {};

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .select('name description price category images inStock createdAt')
      .slice('images', 1)
      .lean();
    res.json({ success: true, data: products });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: products });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
