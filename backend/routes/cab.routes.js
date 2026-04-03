const express = require('express');
const Cab = require('../models/Cab');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try { const cabs = await Cab.find({ status: 'available' }); res.json({ success: true, data: cabs }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try { const cab = await Cab.findById(req.params.id); res.json({ success: true, data: cab }); }
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
