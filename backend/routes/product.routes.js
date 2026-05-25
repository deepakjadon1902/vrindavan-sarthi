const express = require('express');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { normalizeImageFields } = require('../utils/imageFields');
const router = express.Router();

const memCache = new Map();
const getCache = (key) => {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return hit.value;
};
const setCache = (key, value, ttlMs) => {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const stripLargeInlineImage = (value) => {
  const v = typeof value === 'string' ? value : '';
  if (!v) return '';
  // Base64 data URLs stored in Mongo can be massive and slow down every list page.
  if (v.startsWith('data:') && v.length > 2048) return '';
  return v;
};

router.get('/', async (req, res) => {
  try {
    // Keep this endpoint fast for the Shop page:
    // - by default return all products (Shop can show Out of Stock)
    // - optional filter: ?inStock=true to only show in-stock items
    // - only send 1 image for list cards (detail endpoint returns full product)
    // - lean() to reduce Mongoose overhead
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 200;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    // Product images are frequently stored as huge base64 strings; sending them in list responses
    // can make the endpoint take tens of seconds. Default to placeholders for fast loads.
    const withImages = String(req.query?.withImages || '').toLowerCase() === 'true';

    const inStockOnly = String(req.query?.inStock || '').toLowerCase() === 'true';
    const query = inStockOnly ? { $or: [{ inStock: true }, { inStock: { $exists: false } }] } : {};

    const cacheKey = JSON.stringify({ inStockOnly, limit, skip, withImages });
    const cached = getCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const q = Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      // Keep list payload small. Detail endpoint returns full product.
      .select(withImages ? 'name description price category images inStock createdAt' : 'name description price category inStock createdAt');

    if (withImages) {
      q.slice('images', 1);
    }

    const products = await q.lean();

    for (const p of products) {
      if (!withImages) {
        p.images = ['/placeholder.svg'];
        continue;
      }
      if (Array.isArray(p.images)) p.images = p.images.map((img) => stripLargeInlineImage(img)).filter(Boolean);
      if (!p.images?.length) p.images = ['/placeholder.svg'];
    }

    setCache(cacheKey, products, 30_000);
    res.json({ success: true, data: products });
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

    const q = Product.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(withImages ? undefined : 'name description price category inStock createdAt updatedAt');

    if (withImages) q.slice('images', 1);

    const products = await q.lean();

    if (!withImages) {
      for (const p of products) {
        p.images = ['/placeholder.svg'];
      }
    } else {
      for (const p of products) {
        if (Array.isArray(p.images)) p.images = p.images.map((img) => stripLargeInlineImage(img)).filter(Boolean);
        if (!p.images?.length) p.images = ['/placeholder.svg'];
      }
    }
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
    const body = { ...req.body };
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/products', multi: ['images'], tags: ['product'] });
    const product = await Product.create(body);
    res.status(201).json({ success: true, data: product });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/products', multi: ['images'], tags: ['product'] });
    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true });
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
