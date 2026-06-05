const express = require('express');
const Cab = require('../models/Cab');
const { protect, authorize } = require('../middleware/auth');
const { normalizeImageFields } = require('../utils/imageFields');
const { normalizePublicImageSet, stripLargeInlineImage } = require('../utils/publicImages');
const router = express.Router();

const normalizeRequiredLocationFields = (body) => {
  const googleMapLink = String(body?.googleMapLink || '').trim();
  const nearestTemple = String(body?.nearestTemple || '').trim();
  if (!googleMapLink) return 'Google Map Location/Link is required';
  if (!nearestTemple) return 'Nearest Temple / Landmark is required';
  body.googleMapLink = googleMapLink;
  body.nearestTemple = nearestTemple;
  return '';
};

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

    const cacheKey = JSON.stringify({ limit, skip });
    const cached = getCache(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const cabs = await Cab.find({ status: 'available', approvalStatus: 'approved' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      // Do not expose driver contact details publicly (shown only after admin confirms booking).
      .select('vehicleName vehicleType capacity routes image images status nearestTemple googleMapLink createdAt')
      .slice('images', 1)
      .lean();

    for (const c of cabs) {
      Object.assign(c, normalizePublicImageSet(c, { max: 4 }));
    }

    setCache(cacheKey, cabs, 30_000);
    res.json({ success: true, data: cabs });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all cabs (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5000, Math.floor(limitRaw)) : 2000;

    const cabs = await Cab.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('vehicleName vehicleType vehicleNumber capacity driverName driverPhone driverEmail routes image images description googleMapLink nearestTemple status partnerId partnerName partnerEmail partnerPhone businessName partnerSubmitted approvalStatus adminRemarks createdAt updatedAt')
      .lean();

    for (const c of cabs) {
      c.image = stripLargeInlineImage(c.image) || '/placeholder.svg';
      // Do not ship large images arrays in list view.
      c.images = [];
    }
    res.json({ success: true, data: cabs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    // Public detail: hide driver contact details until booking is confirmed.
    const cab = await Cab.findOne({ _id: req.params.id, status: 'available', approvalStatus: 'approved' })
      .select('vehicleName vehicleType vehicleNumber capacity routes image images description features status nearestTemple googleMapLink createdAt updatedAt')
      .lean();
    if (!cab) return res.status(404).json({ success: false, message: 'Cab not found' });
    res.json({ success: true, data: cab });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    body.approvalStatus = 'approved';
    body.status = body.status === 'inactive' ? 'inactive' : 'available';
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/cabs', single: ['image'], multi: ['images'], tags: ['cab'] });
    const cab = await Cab.create(body);
    res.status(201).json({ success: true, data: cab });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/cabs', single: ['image'], multi: ['images'], tags: ['cab'] });
    const cab = await Cab.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json({ success: true, data: cab });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try { await Cab.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Cab deleted' }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
