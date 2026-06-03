const express = require('express');
const Tour = require('../models/Tour');
const { protect, authorize } = require('../middleware/auth');
const { normalizeImageFields } = require('../utils/imageFields');
const { normalizePublicImageSet, stripLargeInlineImage } = require('../utils/publicImages');
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

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');

    const limitRaw = Number(req.query?.limit || 0);
    const skipRaw = Number(req.query?.skip || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 200;
    const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? Math.floor(skipRaw) : 0;

    const withImages = String(req.query?.withImages || 'true').toLowerCase() !== 'false';
    const cacheKey = JSON.stringify({ limit, skip, withImages });
    const cached = getCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const q = Tour.find({ status: 'active', approvalStatus: 'approved' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(withImages ? 'name duration pricePerPerson image images includes status createdAt' : 'name duration pricePerPerson includes status createdAt');

    if (withImages) q.slice('images', 1);

    const tours = await q.lean();

    for (const t of tours) {
      if (!withImages) {
        t.image = '/placeholder.svg';
        t.images = ['/placeholder.svg'];
        continue;
      }
      Object.assign(t, normalizePublicImageSet(t, { max: 4 }));
    }

    setCache(cacheKey, tours, 30_000);
    res.json({ success: true, data: tours });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all tours (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5000, Math.floor(limitRaw)) : 2000;

    const tours = await Tour.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name duration pricePerPerson groupSize startPoint endPoint image images includes excludes highlights status partnerId partnerName partnerEmail partnerPhone businessName partnerSubmitted approvalStatus adminRemarks createdAt updatedAt')
      .lean();

    for (const t of tours) {
      t.image = stripLargeInlineImage(t.image) || '/placeholder.svg';
      t.images = [];
    }
    res.json({ success: true, data: tours });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try { const tour = await Tour.findById(req.params.id).lean(); res.json({ success: true, data: tour }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/tours', single: ['image'], multi: ['images'], tags: ['tour'] });
    const tour = await Tour.create(body);
    res.status(201).json({ success: true, data: tour });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/tours', single: ['image'], multi: ['images'], tags: ['tour'] });
    const tour = await Tour.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json({ success: true, data: tour });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try { await Tour.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Tour deleted' }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
