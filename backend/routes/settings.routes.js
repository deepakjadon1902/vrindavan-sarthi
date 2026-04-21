const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

const uploadsRoot = path.join(process.cwd(), 'uploads', 'settings');
const ensureUploadsDir = () => {
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });
};

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new Error('Only image uploads are allowed'));
};

const makeStorage = (prefix) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      try {
        ensureUploadsDir();
        cb(null, uploadsRoot);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
      cb(null, `${prefix}-${Date.now()}${ext}`);
    },
  });

const uploadLogo = multer({
  storage: makeStorage('logo'),
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

const uploadFavicon = multer({
  storage: makeStorage('favicon'),
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
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create(req.body);
    else {
      Object.assign(settings, req.body);
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

    const urlPath = `/uploads/settings/${req.file.filename}`;
    settings.logoUrl = urlPath;
    if (!settings.ogImageUrl) settings.ogImageUrl = urlPath;
    await settings.save();

    res.json({ success: true, data: settings, url: urlPath });
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

    const urlPath = `/uploads/settings/${req.file.filename}`;
    settings.faviconUrl = urlPath;
    await settings.save();

    res.json({ success: true, data: settings, url: urlPath });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
