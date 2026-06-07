const express = require('express');
const Hotel = require('../models/Hotel');
const Cab = require('../models/Cab');
const User = require('../models/User');
const PartnerNotification = require('../models/PartnerNotification');
const { protect, authorize } = require('../middleware/auth');
const { normalizeImageFields } = require('../utils/imageFields');
const router = express.Router();

const normalizeRequiredLocationFields = (body) => {
  const googleMapLink = String(body?.googleMapLink || '').trim();
  const nearestTemple = String(body?.nearestTemple || '').trim();
  if (!googleMapLink) return 'Google Map Location/Link is required';
  if (!nearestTemple) return 'Nearest Temple / Landmark is required';
  body.googleMapLink = googleMapLink;
  body.nearestTemple = nearestTemple;
  return '';
};

const normalizeBankDetails = (body) => {
  const account_holder_name = String(body?.account_holder_name || '').trim();
  const bank_name = String(body?.bank_name || '').trim();
  const account_number = String(body?.account_number || '').trim();
  const confirm_account_number = String(body?.confirm_account_number || '').trim();
  const ifsc_code = String(body?.ifsc_code || '').trim().toUpperCase();
  if (!account_holder_name || !bank_name || !account_number || !confirm_account_number || !ifsc_code) {
    return { error: 'All bank details fields are required' };
  }
  if (account_number !== confirm_account_number) return { error: 'Account number and confirm account number must match' };
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code)) return { error: 'Invalid IFSC code' };
  return { data: { account_holder_name, bank_name, account_number, ifsc_code, verified: true, updatedAt: new Date() } };
};

// Partner: Submit hotel
router.post('/hotels', protect, authorize('partner'), async (req, res) => {
  try {
    const body = { ...req.body };
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/hotels', single: ['image'], multi: ['images'], tags: ['hotel', 'partner'] });
    const hotel = await Hotel.create({
      ...body,
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

    const body = { ...req.body };
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/hotels', single: ['image'], multi: ['images'], tags: ['hotel', 'partner'] });
    Object.assign(hotel, body);
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

// Partner: Submit cab
router.post('/cabs', protect, authorize('partner'), async (req, res) => {
  try {
    const body = { ...req.body };
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/cabs', single: ['image'], multi: ['images'], tags: ['cab', 'partner'] });
    const cab = await Cab.create({
      ...body,
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

// Partner: Update my cab submission
router.put('/cabs/:id', protect, authorize('partner'), async (req, res) => {
  try {
    const cab = await Cab.findOne({ _id: req.params.id, partnerId: req.user._id });
    if (!cab) return res.status(404).json({ success: false, message: 'Cab not found' });

    const body = { ...req.body };
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/cabs', single: ['image'], multi: ['images'], tags: ['cab', 'partner'] });
    Object.assign(cab, body);
    cab.partnerSubmitted = true;
    cab.approvalStatus = 'pending';
    cab.status = 'inactive';
    await cab.save();
    res.json({ success: true, data: cab });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Delete my cab submission
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

// Partner: Get my listings
router.get('/my-listings', protect, authorize('partner'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(2000, Math.floor(limitRaw)) : 1000;

    const hotelQuery = Hotel.find({ partnerId: req.user._id })
      .sort({ createdAt: -1 })
      // Keep listing payload small; images may be stored as huge base64 strings.
      .select('name location rating image images description amenities googleMapLink nearestTemple status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed platform_commission_percentage createdAt updatedAt')
      .lean();

    hotelQuery.limit(limit);

    const cabQuery = Cab.find({ partnerId: req.user._id })
      .sort({ createdAt: -1 })
      .select('vehicleName vehicleType vehicleNumber capacity driverName driverPhone driverEmail routes basePrice pricePerKm image images description googleMapLink nearestTemple features status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName createdAt updatedAt')
      .lean();
    cabQuery.limit(limit);

    const [hotels, cabs] = await Promise.all([hotelQuery, cabQuery]);
    res.json({ success: true, data: { hotels, rooms: [], cabs, tours: [] } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Get all partner submissions
router.get('/requests', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5000, Math.floor(limitRaw)) : 2000;

    const hotelQuery = Hotel.find({ partnerSubmitted: true })
      .sort({ createdAt: -1 })
      // Keep listing payload small; images may be stored as huge base64 strings.
      .select('name location rating image images description amenities googleMapLink nearestTemple status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed platform_commission_percentage createdAt updatedAt')
      .lean();
    hotelQuery.limit(limit);

    const cabQuery = Cab.find({ partnerSubmitted: true })
      .sort({ createdAt: -1 })
      .select('vehicleName vehicleType vehicleNumber capacity driverName driverPhone driverEmail routes basePrice pricePerKm image images description googleMapLink nearestTemple features status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName createdAt updatedAt')
      .lean();
    cabQuery.limit(limit);

    const [hotels, cabs] = await Promise.all([hotelQuery, cabQuery]);
    res.json({ success: true, data: { hotels, rooms: [], cabs, tours: [] } });
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

// Partner: get/update bank details
router.get('/bank-details', protect, authorize('partner'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('bankDetails').lean();
    res.json({ success: true, data: user?.bankDetails || null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/bank-details', protect, authorize('partner'), async (req, res) => {
  try {
    const normalized = normalizeBankDetails(req.body);
    if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { bankDetails: normalized.data },
      { new: true }
    ).select('bankDetails');
    res.json({ success: true, data: user?.bankDetails || null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: partner payout bank detail list
router.get('/payouts', protect, authorize('admin'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const partners = await User.find({
      role: 'partner',
      partnerStatus: 'approved',
      'bankDetails.account_number': { $exists: true, $ne: '' },
      'bankDetails.verified': true,
    })
      .sort({ updatedAt: -1 })
      .select('name email phone businessName bankDetails updatedAt')
      .lean();
    res.json({ success: true, data: partners });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Partner: notices and notifications
router.get('/notices', protect, authorize('partner'), async (req, res) => {
  try {
    const notices = await PartnerNotification.find({ type: 'notice', audience: 'all_partners' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: notices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/notifications', protect, authorize('partner'), async (req, res) => {
  try {
    const notifications = await PartnerNotification.find({ type: 'notification', audience: 'all_partners' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: notifications });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: push partner notices/notifications
router.post('/notifications', protect, authorize('admin'), async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const type = String(req.body?.type || 'notification').trim() === 'notice' ? 'notice' : 'notification';
    if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required' });
    const item = await PartnerNotification.create({
      title,
      message,
      type,
      audience: 'all_partners',
      createdByUserId: req.user._id,
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
