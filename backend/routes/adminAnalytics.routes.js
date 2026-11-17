const express = require('express');
const mongoose = require('mongoose');
const { protect, authorizeAdmin } = require('../middleware/auth');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const Cab = require('../models/Cab');
const Tour = require('../models/Tour');
const AuditLog = require('../models/AuditLog');
const SupportTicket = require('../models/SupportTicket');
const RefundOperation = require('../models/RefundOperation');
const { repairPaidAwaitingCustomerPaymentBookings } = require('../utils/reservationLifecycle');

const router = express.Router();

const calculateDateRange = (period, startDate, endDate) => {
  const now = new Date();
  let start = null;
  let end = null;

  switch (period) {
    case 'today': {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      break;
    }
    case 'last7days': {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
      break;
    }
    case 'last30days': {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = now;
      break;
    }
    case 'thisMonth': {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = now;
      break;
    }
    case 'lastMonth': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case 'custom': {
      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      break;
    }
    case 'allTime':
    default:
      start = null;
      end = null;
      break;
  }

  return { start, end };
};

// Legacy analytics endpoint (backward compatibility)
router.get('/analytics', protect, authorizeAdmin('view_reports'), async (req, res) => {
  try {
    const dbReadyState = mongoose.connection.readyState;
    await repairPaidAwaitingCustomerPaymentBookings();

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

// Comprehensive Dashboard KPIs with Date Filters
router.get('/dashboard-kpis', protect, authorizeAdmin('view_reports'), async (req, res) => {
  try {
    const { period = 'allTime', startDate, endDate } = req.query;
    const { start, end } = calculateDateRange(period, startDate, endDate);

    const bookingDateFilter = {};
    if (start || end) {
      bookingDateFilter.createdAt = {};
      if (start) bookingDateFilter.createdAt.$gte = start;
      if (end) bookingDateFilter.createdAt.$lte = end;
    }

    // Properties
    const [totalProperties, activeProperties, pendingProperties, rejectedProperties] = await Promise.all([
      Hotel.countDocuments({}),
      Hotel.countDocuments({ status: 'active', approvalStatus: 'approved' }),
      Hotel.countDocuments({ approvalStatus: 'pending' }),
      Hotel.countDocuments({ approvalStatus: 'rejected' }),
    ]);

    // Partners
    const [totalPartners, pendingPartners, verifiedPartners] = await Promise.all([
      User.countDocuments({ role: 'partner' }),
      User.countDocuments({ role: 'partner', partnerStatus: 'pending' }),
      User.countDocuments({ role: 'partner', partnerStatus: 'approved' }),
    ]);

    // Customers
    const totalCustomers = await User.countDocuments({ role: 'user' });

    // Bookings within period
    const [
      totalBookings,
      pendingBookings,
      confirmedBookings,
      checkedInBookings,
      completedBookings,
      cancelledBookings,
      financialAgg,
    ] = await Promise.all([
      Booking.countDocuments(bookingDateFilter),
      Booking.countDocuments({ ...bookingDateFilter, bookingStatus: 'pending' }),
      Booking.countDocuments({ ...bookingDateFilter, bookingStatus: 'confirmed' }),
      Booking.countDocuments({ ...bookingDateFilter, bookingStatus: 'checked_in' }),
      Booking.countDocuments({ ...bookingDateFilter, bookingStatus: { $in: ['checked_out', 'completed', 'settled'] } }),
      Booking.countDocuments({ ...bookingDateFilter, bookingStatus: 'cancelled' }),
      Booking.aggregate([
        { $match: bookingDateFilter },
        {
          $group: {
            _id: null,
            totalBookingValue: {
              $sum: {
                $cond: [
                  { $in: ['$bookingStatus', ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled']] },
                  { $ifNull: ['$totalAmount', 0] },
                  0,
                ],
              },
            },
            onlineCollections: { $sum: { $ifNull: ['$amountPaidOnline', 0] } },
            deskCollections: { $sum: { $ifNull: ['$amountPaidToProperty', 0] } },
            platformCommission: { $sum: { $ifNull: ['$platformCommissionAmount', 0] } },
            partnerNetEntitlement: { $sum: { $ifNull: ['$partnerNetPayout', 0] } },
          },
        },
      ]),
    ]);

    const fin = financialAgg[0] || {
      totalBookingValue: 0,
      onlineCollections: 0,
      deskCollections: 0,
      platformCommission: 0,
      partnerNetEntitlement: 0,
    };

    // Pending Partner Remittance (checked_in, checked_out, completed but not settled)
    const pendingRemittanceAgg = await Booking.aggregate([
      {
        $match: {
          bookingStatus: { $in: ['checked_in', 'checked_out', 'completed'] },
          payout_status: { $ne: 'settled' },
          partnerId: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          netDue: {
            $subtract: [
              { $ifNull: ['$partnerNetPayout', 0] },
              { $ifNull: ['$amountPaidToProperty', 0] },
            ],
          },
        },
      },
      {
        $match: { netDue: { $gt: 0 } },
      },
      {
        $group: { _id: null, total: { $sum: '$netDue' } },
      },
    ]);
    const pendingPartnerRemittance = pendingRemittanceAgg[0]?.total || 0;

    // Pending Refund Requests (from cancellations or RefundOperation)
    const pendingRefundRequests = await Booking.countDocuments({
      bookingStatus: 'cancelled',
      refundableAmount: { $gt: 0 },
      refundStatus: { $in: ['pending', 'requested'] },
    });

    // Open Complaints
    const openComplaints = await SupportTicket.countDocuments({
      status: { $in: ['Open', 'In Progress'] },
    });

    res.json({
      success: true,
      data: {
        period,
        dateRange: { start, end },
        properties: {
          total: totalProperties,
          active: activeProperties,
          pending: pendingProperties,
          rejected: rejectedProperties,
        },
        partners: {
          total: totalPartners,
          pending: pendingPartners,
          verified: verifiedPartners,
        },
        customers: {
          total: totalCustomers,
        },
        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          confirmed: confirmedBookings,
          checkedIn: checkedInBookings,
          completed: completedBookings,
          cancelled: cancelledBookings,
        },
        financials: {
          totalBookingValue: Math.round(fin.totalBookingValue || 0),
          onlineCollections: Math.round(fin.onlineCollections || 0),
          deskCollections: Math.round(fin.deskCollections || 0),
          platformCommission: Math.round(fin.platformCommission || 0),
          partnerNetEntitlement: Math.round(fin.partnerNetEntitlement || 0),
          pendingPartnerRemittance: Math.round(pendingPartnerRemittance),
          pendingRefundRequests,
          openComplaints,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load dashboard KPIs' });
  }
});

// Platform Revenue & Commission Overview
router.get('/revenue-summary', protect, authorizeAdmin('view_reports'), async (req, res) => {
  try {
    const { period = 'allTime', startDate, endDate } = req.query;
    const { start, end } = calculateDateRange(period, startDate, endDate);

    const match = {
      bookingStatus: { $in: ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'] },
    };
    if (start || end) {
      match.createdAt = {};
      if (start) match.createdAt.$gte = start;
      if (end) match.createdAt.$lte = end;
    }

    const [overallAgg, dharamshalaAgg, hotelAgg] = await Promise.all([
      Booking.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            grossBookingValue: { $sum: '$totalAmount' },
            onlineCollections: { $sum: '$amountPaidOnline' },
            deskCollections: { $sum: '$amountPaidToProperty' },
            platformCommission: { $sum: '$platformCommissionAmount' },
            convenienceFee: { $sum: '$convenienceFeeAmount' },
            partnerNetEntitlement: { $sum: '$partnerNetPayout' },
            absorbedGatewayFees: { $sum: '$paymentGatewayFeeAmount' },
          },
        },
      ]),
      Booking.aggregate([
        { $match: { ...match, propertyType: 'dharamshala' } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            grossBookingValue: { $sum: '$totalAmount' },
            serviceFees: { $sum: '$vrindavanSarthiServiceFee' },
            deskCollections: { $sum: '$amountPaidToProperty' },
          },
        },
      ]),
      Booking.aggregate([
        { $match: { ...match, propertyType: { $ne: 'dharamshala' } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            grossBookingValue: { $sum: '$totalAmount' },
            platformCommission: { $sum: '$platformCommissionAmount' },
            convenienceFee: { $sum: '$convenienceFeeAmount' },
            hotelPayouts: { $sum: '$partnerNetPayout' },
          },
        },
      ]),
    ]);

    const total = overallAgg[0] || {
      grossBookingValue: 0,
      onlineCollections: 0,
      deskCollections: 0,
      platformCommission: 0,
      convenienceFee: 0,
      partnerNetEntitlement: 0,
      absorbedGatewayFees: 0,
    };

    const dharamshala = dharamshalaAgg[0] || { count: 0, grossBookingValue: 0, serviceFees: 0, deskCollections: 0 };
    const commercialHotels = hotelAgg[0] || { count: 0, grossBookingValue: 0, platformCommission: 0, convenienceFee: 0, hotelPayouts: 0 };

    res.json({
      success: true,
      data: {
        period,
        dateRange: { start, end },
        totals: {
          grossBookingValue: Math.round(total.grossBookingValue || 0),
          onlineCollections: Math.round(total.onlineCollections || 0),
          deskCollections: Math.round(total.deskCollections || 0),
          platformCommission: Math.round(total.platformCommission || 0),
          convenienceFee: Math.round(total.convenienceFee || 0),
          totalPlatformRevenue: Math.round((total.platformCommission || 0) + (total.convenienceFee || 0) + (dharamshala.serviceFees || 0)),
          partnerNetEntitlement: Math.round(total.partnerNetEntitlement || 0),
          absorbedGatewayFees: Math.round(total.absorbedGatewayFees || 0),
        },
        breakdown: {
          dharamshalas: {
            bookingsCount: dharamshala.count,
            grossValue: Math.round(dharamshala.grossBookingValue),
            serviceFeesCollected: Math.round(dharamshala.serviceFees),
            deskCollections: Math.round(dharamshala.deskCollections),
          },
          commercialHotels: {
            bookingsCount: commercialHotels.count,
            grossValue: Math.round(commercialHotels.grossBookingValue),
            commissionEarned: Math.round(commercialHotels.platformCommission),
            convenienceFeeCollected: Math.round(commercialHotels.convenienceFee),
            partnerNetPayout: Math.round(commercialHotels.hotelPayouts),
          },
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load revenue summary' });
  }
});

// Reports & Analytics generator
router.get('/reports/:reportType', protect, authorizeAdmin('view_reports'), async (req, res) => {
  try {
    const { reportType } = req.params;
    const { period = 'last30days', startDate, endDate } = req.query;
    const { start, end } = calculateDateRange(period, startDate, endDate);

    const dateFilter = {};
    if (start || end) {
      dateFilter.createdAt = {};
      if (start) dateFilter.createdAt.$gte = start;
      if (end) dateFilter.createdAt.$lte = end;
    }

    let reportData = [];

    switch (reportType) {
      case 'bookings': {
        reportData = await Booking.aggregate([
          { $match: dateFilter },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              totalBookings: { $sum: 1 },
              confirmed: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'confirmed'] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $in: ['$bookingStatus', ['checked_out', 'completed', 'settled']] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$bookingStatus', 'cancelled'] }, 1, 0] } },
              totalAmount: { $sum: '$totalAmount' },
            },
          },
          { $sort: { _id: 1 } },
        ]);
        break;
      }
      case 'properties': {
        reportData = await Booking.aggregate([
          { $match: { ...dateFilter, hotelId: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$hotelId',
              propertyName: { $first: '$propertyName' },
              bookingsCount: { $sum: 1 },
              totalRevenue: { $sum: '$totalAmount' },
            },
          },
          { $sort: { totalRevenue: -1 } },
          { $limit: 25 },
        ]);
        break;
      }
      case 'partners': {
        reportData = await Booking.aggregate([
          { $match: { ...dateFilter, partnerId: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$partnerId',
              partnerName: { $first: '$partnerName' },
              partnerEmail: { $first: '$partnerEmail' },
              bookingsCount: { $sum: 1 },
              grossTariff: { $sum: '$totalAmount' },
              commissionEarned: { $sum: '$platformCommissionAmount' },
              netPayout: { $sum: '$partnerNetPayout' },
            },
          },
          { $sort: { grossTariff: -1 } },
          { $limit: 25 },
        ]);
        break;
      }
      case 'cancellations': {
        reportData = await Booking.find({
          ...dateFilter,
          bookingStatus: 'cancelled',
        })
          .select('bookingId propertyName customerFullName totalAmount amountPaidOnline refundableAmount cancellationReason cancelledAt')
          .sort({ cancelledAt: -1 })
          .limit(50)
          .lean();
        break;
      }
      default:
        return res.status(400).json({ success: false, message: `Unknown report type: ${reportType}` });
    }

    res.json({
      success: true,
      reportType,
      period,
      count: reportData.length,
      data: reportData,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to generate report' });
  }
});

// Admin Audit Logs query
router.get('/audit-logs', protect, authorizeAdmin('view_audit_logs'), async (req, res) => {
  try {
    const { action, targetEntityType, actorId, q, page = 1, limit = 25 } = req.query;
    const filter = {};

    if (action && action !== 'all') filter.action = action;
    if (targetEntityType && targetEntityType !== 'all') filter.targetEntityType = targetEntityType;
    if (actorId) filter.actorId = actorId;

    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { action: re },
        { actorName: re },
        { targetEntityId: re },
        { bookingId: re },
        { reason: re },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.max(1, Math.ceil(total / parseInt(limit, 10))),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to query audit logs' });
  }
});

module.exports = router;
