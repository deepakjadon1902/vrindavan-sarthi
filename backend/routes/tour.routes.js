const express = require('express');
const Tour = require('../models/Tour');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try { const tours = await Tour.find({ status: 'active' }); res.json({ success: true, data: tours }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try { const tour = await Tour.findById(req.params.id); res.json({ success: true, data: tour }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try { const tour = await Tour.create(req.body); res.status(201).json({ success: true, data: tour }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try { const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json({ success: true, data: tour }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try { await Tour.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Tour deleted' }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
