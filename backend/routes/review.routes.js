const express = require('express');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/hotel/:hotelId', async (req, res) => {
  try {
    if (!Review.base.Types.ObjectId.isValid(req.params.hotelId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotelId' });
    }
    const reviews = await Review.find({ hotelId: req.params.hotelId })
      .sort({ createdAt: -1 })
      .limit(100)
      .select('rating text createdAt')
      .lean();
    const stats = await Review.aggregate([
      { $match: { hotelId: new Review.base.Types.ObjectId(req.params.hotelId) } },
      { $group: { _id: '$hotelId', reviewCount: { $sum: 1 }, rating: { $avg: '$rating' } } },
    ]);
    res.json({
      success: true,
      data: {
        reviews,
        reviewCount: Number(stats[0]?.reviewCount || 0),
        rating: stats[0]?.rating ? Math.round(Number(stats[0].rating) * 10) / 10 : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const bookingId = String(req.body?.bookingId || '').trim();
    const rating = Number(req.body?.rating || 0);
    const text = String(req.body?.text || '').trim();
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId is required' });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const booking = await Booking.findOne({ _id: bookingId, userId: req.user._id }).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['confirmed', 'completed'].includes(String(booking.bookingStatus))) {
      return res.status(400).json({ success: false, message: 'Only confirmed or completed bookings can be reviewed' });
    }
    if (!booking.hotelId) return res.status(400).json({ success: false, message: 'This booking cannot be reviewed as a hotel stay' });

    const hotel = await Hotel.findById(booking.hotelId).select('_id').lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const review = await Review.create({
      bookingId: booking._id,
      userId: req.user._id,
      hotelId: booking.hotelId,
      roomTypeId: booking.roomTypeId || undefined,
      rating,
      text,
    });
    res.status(201).json({ success: true, data: review });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(409).json({ success: false, message: 'You have already reviewed this booking' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
