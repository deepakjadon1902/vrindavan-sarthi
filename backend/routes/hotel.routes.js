const express = require('express');
const Hotel = require('../models/Hotel');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all active hotels (public)
router.get('/', async (req, res) => {
  try {
    const hotels = await Hotel.find({ status: 'active', approvalStatus: 'approved' });
    res.json({ success: true, data: hotels });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get single hotel (public)
router.get('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    res.json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Create (admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const hotel = await Hotel.create(req.body);
    res.status(201).json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update (admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Delete (admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Hotel deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
