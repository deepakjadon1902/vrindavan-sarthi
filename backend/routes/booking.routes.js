const express = require('express');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// Create booking (authenticated user)
router.post('/', protect, async (req, res) => {
  try {
    const booking = await Booking.create({ ...req.body, userId: req.user._id, userName: req.user.name, userEmail: req.user.email, userPhone: req.user.phone });
    res.status(201).json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get user bookings
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get partner bookings
router.get('/partner', protect, authorize('partner'), async (req, res) => {
  try {
    const bookings = await Booking.find({ partnerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get all bookings (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Cancel booking
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { bookingStatus: 'cancelled' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
