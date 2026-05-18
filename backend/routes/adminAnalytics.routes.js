const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const Cab = require('../models/Cab');
const Tour = require('../models/Tour');

const router = express.Router();

router.get('/analytics', protect, authorize('admin'), async (req, res) => {
  try {
    const dbReadyState = mongoose.connection.readyState;

    const [
      revenueAgg,
      totalBookings,
      activeUsers,
      hotelsCount,
      roomsCount,
      cabsCount,
      toursCount,
      recentBookings,
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Booking.countDocuments({}),
      User.countDocuments({ role: 'user' }),
      Hotel.countDocuments({ status: 'active', approvalStatus: 'approved' }),
      (async () => {
        const hotelIds = await Hotel.find({ status: 'active', approvalStatus: 'approved' }).distinct('_id');
        if (!hotelIds.length) return 0;
        return RoomType.countDocuments({ hotelId: { $in: hotelIds }, status: 'active' });
      })(),
      Cab.countDocuments({ status: 'available', approvalStatus: 'approved' }),
      Tour.countDocuments({ status: 'active', approvalStatus: 'approved' }),
      Booking.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select('bookingId bookingType itemName userName totalAmount paymentStatus bookingStatus createdAt')
        .lean(),
    ]);

    const totalRevenue = Array.isArray(revenueAgg) && revenueAgg[0]?.total ? revenueAgg[0].total : 0;
    const listedProperties = hotelsCount + roomsCount + cabsCount + toursCount;

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        dbReadyState,
        stats: {
          totalRevenue,
          totalBookings,
          activeUsers,
          listedProperties,
        },
        listings: {
          hotels: hotelsCount,
          rooms: roomsCount,
          cabs: cabsCount,
          tours: toursCount,
        },
        recentBookings,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
