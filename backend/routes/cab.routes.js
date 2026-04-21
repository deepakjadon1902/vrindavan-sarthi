const express = require('express');
const Cab = require('../models/Cab');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const cabs = await Cab.find({ status: 'available', approvalStatus: 'approved' })
      .sort({ createdAt: -1 })
      .select('vehicleName vehicleType capacity driverName routes image images status createdAt')
      .slice('images', 1)
      .lean();
    res.json({ success: true, data: cabs });
  }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all cabs (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const cabs = await Cab.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: cabs });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try { const cab = await Cab.findById(req.params.id).lean(); res.json({ success: true, data: cab }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try { const cab = await Cab.create(req.body); res.status(201).json({ success: true, data: cab }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try { const cab = await Cab.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json({ success: true, data: cab }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try { await Cab.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Cab deleted' }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
