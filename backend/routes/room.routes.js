const express = require('express');
const Room = require('../models/Room');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Optimize payload for public listing pages.
    res.set('Cache-Control', 'no-store');
    const rooms = await Room.find({ status: 'available', approvalStatus: 'approved' })
      .sort({ createdAt: -1 })
      .select('name hotelName pricePerNight status image images amenities createdAt')
      .slice('images', 1)
      .lean();
    res.json({ success: true, data: rooms });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all rooms (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rooms });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).lean();
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try { const room = await Room.create(req.body); res.status(201).json({ success: true, data: room }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try { const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json({ success: true, data: room }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try { await Room.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Room deleted' }); }
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
