const express = require('express');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// Get all payments (admin)
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }).select('bookingId bookingType itemName userName userPhone userEmail totalAmount paymentMethod paymentStatus bookingStatus partnerId partnerName createdAt');
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get partner payments
router.get('/partner', protect, authorize('partner'), async (req, res) => {
  try {
    const bookings = await Booking.find({ partnerId: req.user._id }).sort({ createdAt: -1 }).select('bookingId bookingType itemName userName userPhone userEmail totalAmount paymentMethod paymentStatus bookingStatus partnerName createdAt');
    res.json({ success: true, data: bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Verify payment (admin)
router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { paymentStatus: 'paid' }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Reject payment (admin)
router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { paymentStatus: 'failed' }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
