const express = require('express');
const Hotel = require('../models/Hotel');
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

// Partner: Get my listings
router.get('/my-listings', protect, authorize('partner'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(1000, Math.floor(limitRaw)) : null;

    const hotelQuery = Hotel.find({ partnerId: req.user._id })
      .sort({ createdAt: -1 })
      .select('name location rating image images description amenities status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed createdAt updatedAt')
      .lean();

    if (limit) {
      hotelQuery.limit(limit);
    }

    const [hotels] = await Promise.all([hotelQuery]);
    res.json({ success: true, data: { hotels, rooms: [], cabs: [], tours: [] } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Get all partner submissions
router.get('/requests', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(2000, Math.floor(limitRaw)) : null;

    const hotelQuery = Hotel.find({ partnerSubmitted: true })
      .sort({ createdAt: -1 })
      .select('name location rating image images description amenities status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed createdAt updatedAt')
      .lean();
    if (limit) {
      hotelQuery.limit(limit);
    }

    const [hotels] = await Promise.all([hotelQuery]);
    res.json({ success: true, data: { hotels, rooms: [], cabs: [], tours: [] } });
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

module.exports = router;
