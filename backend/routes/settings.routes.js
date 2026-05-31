const express = require('express');
const multer = require('multer');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { uploadDataUri, dataUriFromBuffer, getDefaultFolder, isCloudinaryEnabled } = require('../utils/cloudinary');
const router = express.Router();

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new Error('Only image uploads are allowed'));
};

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

const uploadFavicon = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 1 * 1024 * 1024 },
});

// Get settings (public)
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json({ success: true, data: settings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update settings (admin only)
router.put('/', protect, authorize('admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (typeof body.hotelTaxPercent !== 'undefined') {
      const p = Number(body.hotelTaxPercent);
      body.hotelTaxPercent = Number.isFinite(p) ? Math.min(50, Math.max(0, p)) : 12;
    }

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create(body);
    else {
      Object.assign(settings, body);
      await settings.save();
    }
    res.json({ success: true, data: settings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Upload logo (admin only)
router.post('/logo', protect, authorize('admin'), uploadLogo.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Missing file' });

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    const folder = `${getDefaultFolder()}/settings`;
    const dataUri = dataUriFromBuffer(req.file.buffer, req.file.mimetype);
    const url = isCloudinaryEnabled() ? await uploadDataUri(dataUri, { folder, tags: ['settings', 'logo'] }) : null;

    // If Cloudinary isn't configured, keep existing value and let the admin update env later.
    if (url) {
      settings.logoUrl = url;
      if (!settings.ogImageUrl) settings.ogImageUrl = url;
    }
    await settings.save();

    res.json({ success: true, data: settings, url: url || settings.logoUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Upload favicon (admin only)
router.post('/favicon', protect, authorize('admin'), uploadFavicon.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Missing file' });

    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    const folder = `${getDefaultFolder()}/settings`;
    const dataUri = dataUriFromBuffer(req.file.buffer, req.file.mimetype);
    const url = isCloudinaryEnabled() ? await uploadDataUri(dataUri, { folder, tags: ['settings', 'favicon'] }) : null;

    if (url) settings.faviconUrl = url;
    await settings.save();

    res.json({ success: true, data: settings, url: url || settings.faviconUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
