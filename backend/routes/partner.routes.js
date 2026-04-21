const express = require('express');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Cab = require('../models/Cab');
const Tour = require('../models/Tour');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// Partner: Submit hotel
router.post('/hotels', protect, authorize('partner'), async (req, res) => {
  try {
    const hotel = await Hotel.create({
      ...req.body,
      partnerId: req.user._id,
      partnerName: req.user.name,
      partnerEmail: req.user.email,
      partnerPhone: req.user.phone,
      businessName: req.user.businessName,
      partnerSubmitted: true,
      approvalStatus: 'pending',
      status: 'inactive',
    });
    res.status(201).json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Partner: Update my hotel submission (pending/rejected only)
router.put('/hotels/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    Object.assign(hotel, req.body);
    hotel.partnerSubmitted = true;
    hotel.approvalStatus = 'pending';
    hotel.status = 'inactive';
    await hotel.save();
    res.json({ success: true, data: hotel });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Delete my hotel submission (pending/rejected only)
router.delete('/hotels/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const hotel = await Hotel.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    await hotel.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Submit room
router.post('/rooms', protect, authorize('partner'), async (req, res) => {
  try {
    const room = await Room.create({
      ...req.body,
      partnerId: req.user._id,
      partnerName: req.user.name,
      partnerEmail: req.user.email,
      partnerPhone: req.user.phone,
      businessName: req.user.businessName,
      partnerSubmitted: true,
      approvalStatus: 'pending',
      status: 'inactive',
    });
    res.status(201).json({ success: true, data: room });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Partner: Update my room submission (pending/rejected only)
router.put('/rooms/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    Object.assign(room, req.body);
    room.partnerSubmitted = true;
    room.approvalStatus = 'pending';
    room.status = 'inactive';
    await room.save();
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Delete my room submission (pending/rejected only)
router.delete('/rooms/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    await room.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Submit cab
router.post('/cabs', protect, authorize('partner'), async (req, res) => {
  try {
    const cab = await Cab.create({
      ...req.body,
      partnerId: req.user._id,
      partnerName: req.user.name,
      partnerEmail: req.user.email,
      partnerPhone: req.user.phone,
      businessName: req.user.businessName,
      partnerSubmitted: true,
      approvalStatus: 'pending',
      status: 'inactive',
    });
    res.status(201).json({ success: true, data: cab });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Partner: Update my cab submission (pending/rejected only)
router.put('/cabs/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const cab = await Cab.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!cab) return res.status(404).json({ success: false, message: 'Cab not found' });

    Object.assign(cab, req.body);
    cab.partnerSubmitted = true;
    cab.approvalStatus = 'pending';
    cab.status = 'inactive';
    await cab.save();
    res.json({ success: true, data: cab });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Delete my cab submission (pending/rejected only)
router.delete('/cabs/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const cab = await Cab.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!cab) return res.status(404).json({ success: false, message: 'Cab not found' });
    await cab.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Submit tour
router.post('/tours', protect, authorize('partner'), async (req, res) => {
  try {
    const tour = await Tour.create({
      ...req.body,
      partnerId: req.user._id,
      partnerName: req.user.name,
      partnerEmail: req.user.email,
      partnerPhone: req.user.phone,
      businessName: req.user.businessName,
      partnerSubmitted: true,
      approvalStatus: 'pending',
      status: 'inactive',
    });
    res.status(201).json({ success: true, data: tour });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Partner: Update my tour submission (pending/rejected only)
router.put('/tours/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const tour = await Tour.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!tour) return res.status(404).json({ success: false, message: 'Tour not found' });

    Object.assign(tour, req.body);
    tour.partnerSubmitted = true;
    tour.approvalStatus = 'pending';
    tour.status = 'inactive';
    await tour.save();
    res.json({ success: true, data: tour });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Delete my tour submission (pending/rejected only)
router.delete('/tours/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const tour = await Tour.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!tour) return res.status(404).json({ success: false, message: 'Tour not found' });
    await tour.deleteOne();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Get my listings
router.get('/my-listings', protect, authorize('partner'), async (req, res) => {
  try {
    const hotels = await Hotel.find({ partnerId: req.user._id });
    const rooms = await Room.find({ partnerId: req.user._id });
    const cabs = await Cab.find({ partnerId: req.user._id });
    const tours = await Tour.find({ partnerId: req.user._id });
    res.json({ success: true, data: { hotels, rooms, cabs, tours } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Get all partner submissions
router.get('/requests', protect, authorize('admin'), async (req, res) => {
  try {
    const hotels = await Hotel.find({ partnerSubmitted: true });
    const rooms = await Room.find({ partnerSubmitted: true });
    const cabs = await Cab.find({ partnerSubmitted: true });
    const tours = await Tour.find({ partnerSubmitted: true });
    res.json({ success: true, data: { hotels, rooms, cabs, tours } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Approve/Reject hotel
router.put('/hotels/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { approvalStatus, adminRemarks } = req.body;
    const update = { approvalStatus, adminRemarks };
    if (approvalStatus === 'approved') update.status = 'active';
    if (approvalStatus === 'rejected') update.status = 'inactive';
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, data: hotel });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Approve/Reject room
router.put('/rooms/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { approvalStatus, adminRemarks } = req.body;
    const update = { approvalStatus, adminRemarks };
    if (approvalStatus === 'approved') update.status = 'available';
    if (approvalStatus === 'rejected') update.status = 'inactive';
    const room = await Room.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, data: room });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Approve/Reject cab
router.put('/cabs/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { approvalStatus, adminRemarks } = req.body;
    const update = { approvalStatus, adminRemarks };
    if (approvalStatus === 'approved') update.status = 'available';
    if (approvalStatus === 'rejected') update.status = 'inactive';
    const cab = await Cab.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, data: cab });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Approve/Reject tour
router.put('/tours/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const { approvalStatus, adminRemarks } = req.body;
    const update = { approvalStatus, adminRemarks };
    if (approvalStatus === 'approved') update.status = 'active';
    if (approvalStatus === 'rejected') update.status = 'inactive';
    const tour = await Tour.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, data: tour });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
