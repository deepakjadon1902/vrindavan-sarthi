const express = require('express');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

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

module.exports = router;
