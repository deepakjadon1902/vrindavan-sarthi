const express = require('express');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// Create booking (authenticated user)
router.post('/', protect, async (req, res) => {
  try {
    const partnerId = req.body?.partnerId || undefined;
    const isOnline = (req.body?.paymentMethod || 'online') === 'online';

    const payload = {
      ...req.body,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone,
      bookingStatus: isOnline ? 'confirmed' : (req.body?.bookingStatus || 'confirmed'),
      paymentStatus: isOnline ? 'pending' : (req.body?.paymentStatus || 'pending'),
      verificationStage: isOnline ? (partnerId ? 'pending_partner' : 'pending_admin') : 'verified',
      partnerPaymentVerified: false,
      adminPaymentVerified: false,
    };

    const booking = await Booking.create(payload);
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

// Get single booking (owner/admin/partner)
router.get('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isOwner = String(booking.userId) === String(req.user._id);
    const isPartner = booking.partnerId && String(booking.partnerId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isPartner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
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

// Submit payment transaction id (user)
router.put('/:id/payment', protect, async (req, res) => {
  try {
    const { upiTransactionId } = req.body || {};
    if (!upiTransactionId || typeof upiTransactionId !== 'string') {
      return res.status(400).json({ success: false, message: 'UPI transaction ID is required' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.upiTransactionId = upiTransactionId.trim();
    booking.paymentStatus = 'pending';
    booking.bookingStatus = 'pending';
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify payment (admin)
router.put('/:id/verify', protect, authorize('admin'), async (req, res) => {
  try {
    const bookingExisting = await Booking.findById(req.params.id);
    if (!bookingExisting) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (bookingExisting.paymentMethod === 'online' && bookingExisting.partnerId && !bookingExisting.partnerPaymentVerified) {
      return res.status(400).json({ success: false, message: 'Partner verification required before admin verification' });
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, {
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      verificationStage: 'verified',
      adminPaymentVerified: true,
      adminPaymentVerifiedAt: new Date(),
    }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject payment (admin)
router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      {
        paymentStatus: 'failed',
        bookingStatus: 'cancelled',
        verificationStage: 'rejected',
        adminPaymentVerified: false,
        adminPaymentVerifiedAt: new Date(),
      },
      { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify payment (partner - first step)
router.put('/:id/partner-verify', protect, authorize('partner'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.partnerId || String(booking.partnerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.paymentMethod !== 'online') {
      return res.status(400).json({ success: false, message: 'Partner verification is only for online payments' });
    }

    booking.partnerPaymentVerified = true;
    booking.partnerPaymentVerifiedAt = new Date();
    booking.verificationStage = 'pending_admin';
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject payment (partner)
router.put('/:id/partner-reject', protect, authorize('partner'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.partnerId || String(booking.partnerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.paymentMethod !== 'online') {
      return res.status(400).json({ success: false, message: 'Partner rejection is only for online payments' });
    }

    booking.partnerPaymentVerified = false;
    booking.partnerPaymentVerifiedAt = new Date();
    booking.adminPaymentVerified = false;
    booking.adminPaymentVerifiedAt = null;
    booking.paymentStatus = 'failed';
    booking.bookingStatus = 'cancelled';
    booking.verificationStage = 'rejected';
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
