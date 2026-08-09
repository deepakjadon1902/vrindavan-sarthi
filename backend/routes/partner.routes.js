const express = require('express');
const Hotel = require('../models/Hotel');
const Cab = require('../models/Cab');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PartnerNotification = require('../models/PartnerNotification');
const { protect, authorize } = require('../middleware/auth');
const { normalizeImageFields } = require('../utils/imageFields');
const router = express.Router();

const normalizeRequiredLocationFields = (body) => {
  const googleMapLink = String(body?.googleMapLink || body?.location || body?.fullAddress || '').trim();
  const nearestTemple = String(body?.nearestTemple || '').trim();
  if (!googleMapLink) return 'Location is required for the map';
  if (!nearestTemple) return 'Nearest Temple / Landmark is required';
  body.googleMapLink = googleMapLink;
  body.nearestTemple = nearestTemple;
  return '';
};

const termsSectionKeys = [
  'generalTerms',
  'checkInRequirements',
  'checkOutRules',
  'cancellationPolicy',
  'guestPolicies',
  'idVerificationRequirements',
  'ageRestrictions',
  'propertyRules',
  'additionalInstructions',
];

const normalizeTermsSections = (sections = {}) => {
  const normalized = {};
  for (const key of termsSectionKeys) normalized[key] = String(sections?.[key] || '').trim();
  return normalized;
};

const termsEqual = (a = {}, b = {}) => termsSectionKeys.every((key) => String(a?.[key] || '') === String(b?.[key] || ''));
const hasAnyTermsText = (sections = {}) => termsSectionKeys.some((key) => String(sections?.[key] || '').trim());

const normalizePropertyTermsInput = (body, user) => {
  if (!body || typeof body !== 'object' || typeof body.propertyTerms === 'undefined') return;
  const current = body.propertyTerms || {};
  const sections = normalizeTermsSections(current.sections || current);
  const isActive = typeof current.isActive === 'undefined' ? true : Boolean(current.isActive);
  body.propertyTerms = {
    currentVersion: Number(current.currentVersion || 1),
    isActive,
    sections,
    publishedAt: current.publishedAt ? new Date(current.publishedAt) : new Date(),
    history: [{
      version: Number(current.currentVersion || 1),
      isActive,
      sections,
      publishedAt: current.publishedAt ? new Date(current.publishedAt) : new Date(),
      updatedBy: user?._id,
      updatedByRole: user?.role,
    }],
  };
};

const buildNormalizedPropertyTerms = (propertyTerms, user) => {
  const holder = { propertyTerms };
  normalizePropertyTermsInput(holder, user);
  return holder.propertyTerms;
};

const getReusablePropertyTerms = async (user) => {
  const owner = await User.findById(user?._id).select('defaultPropertyTerms').lean();
  const saved = owner?.defaultPropertyTerms;
  const sections = normalizeTermsSections(saved?.sections || {});
  if (!hasAnyTermsText(sections)) return null;
  return {
    currentVersion: Number(saved?.currentVersion || 1),
    isActive: typeof saved?.isActive === 'undefined' ? true : Boolean(saved.isActive),
    sections,
    publishedAt: saved?.publishedAt || new Date(),
    history: Array.isArray(saved?.history) ? saved.history : [],
  };
};

const saveReusablePropertyTerms = async (user, propertyTerms) => {
  const sections = normalizeTermsSections(propertyTerms?.sections || propertyTerms || {});
  if (!hasAnyTermsText(sections)) return;
  const normalized = buildNormalizedPropertyTerms({ ...propertyTerms, sections }, user);
  await User.updateOne({ _id: user._id }, { $set: { defaultPropertyTerms: normalized } });
};

const resolvePropertyTermsForHotel = async (incoming, user) => {
  const normalized = typeof incoming === 'undefined' ? null : buildNormalizedPropertyTerms(incoming, user);
  if (hasAnyTermsText(normalized?.sections)) {
    await saveReusablePropertyTerms(user, normalized);
    return normalized;
  }
  const reusable = await getReusablePropertyTerms(user);
  return reusable ? buildNormalizedPropertyTerms(reusable, user) : normalized;
};

const applyPropertyTermsUpdate = (hotel, propertyTerms, user) => {
  if (typeof propertyTerms === 'undefined') return;
  const incoming = propertyTerms || {};
  const sections = normalizeTermsSections(incoming.sections || incoming);
  const isActive = typeof incoming.isActive === 'undefined' ? true : Boolean(incoming.isActive);
  const previous = hotel.propertyTerms || {};
  const previousSections = normalizeTermsSections(previous.sections || {});
  const currentVersion = Number(previous.currentVersion || 0) || 0;
  const shouldVersion = !termsEqual(sections, previousSections) || Boolean(previous.isActive) !== isActive;
  const nextVersion = shouldVersion ? currentVersion + 1 : currentVersion || 1;
  hotel.propertyTerms = {
    currentVersion: nextVersion,
    isActive,
    sections,
    publishedAt: shouldVersion ? new Date() : previous.publishedAt || new Date(),
    history: Array.isArray(previous.history) ? previous.history : [],
  };
  if (shouldVersion || hotel.propertyTerms.history.length === 0) {
    hotel.propertyTerms.history.push({
      version: nextVersion,
      isActive,
      sections,
      publishedAt: hotel.propertyTerms.publishedAt,
      updatedBy: user?._id,
      updatedByRole: user?.role,
    });
  }
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

const applyPartnerHotelDefaults = (body, user) => {
  const businessName = String(user?.businessName || '').trim();
  const businessAddress = String(user?.businessAddress || '').trim();
  const businessDescription = String(user?.businessDescription || '').trim();
  const businessPhone = String(user?.businessPhone || user?.phone || '').trim();
  const businessEmail = String(user?.businessEmail || user?.email || '').trim();

  body.name = String(body?.name || businessName || user?.name || '').trim();
  body.location = String(body?.location || businessAddress || '').trim();
  body.description = String(body?.description || businessDescription || '').trim();
  body.contactPhone = String(body?.contactPhone || businessPhone || '').trim();
  body.contactEmail = String(body?.contactEmail || businessEmail || '').trim();
  body.fullAddress = String(body?.fullAddress || businessAddress || body.location || '').trim();
  body.googleMapLink = String(body?.googleMapLink || body.fullAddress || body.location || '').trim();
  body.businessName = businessName;
  body.propertyType = String(body?.propertyType || '').trim().toLowerCase() === 'dharamshala' ? 'dharamshala' : 'hotel';
  if (body.propertyType === 'dharamshala') {
    body.taxEnabled = false;
    body.taxPercent = 0;
    body.platform_commission_percentage = 0;
  }
  return body;
};

// Partner: Submit hotel
router.post('/hotels', protect, authorize('partner'), async (req, res) => {
  try {
    const body = { ...req.body };
    const existingHotel = await Hotel.findOne({ partnerId: req.user._id }).select('_id name').lean();
    if (existingHotel) {
      return res.status(409).json({ success: false, message: 'Only one hotel or dharamshala can be listed per partner. Add unlimited room types and room numbers from Inventory.' });
    }
    applyPartnerHotelDefaults(body, req.user);
    if (!body.name || !body.location) return res.status(400).json({ success: false, message: 'Property name and location are required' });
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    body.propertyTerms = await resolvePropertyTermsForHotel(body.propertyTerms, req.user);
    if (!hasAnyTermsText(body.propertyTerms?.sections)) {
      return res.status(400).json({ success: false, message: 'Property terms and booking policies are required for every hotel/dharamshala.' });
    }
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
    applyPartnerHotelDefaults(body, req.user);
    if (!body.name || !body.location) return res.status(400).json({ success: false, message: 'Property name and location are required' });
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    let propertyTerms = body.propertyTerms;
    delete body.propertyTerms;
    if (typeof propertyTerms !== 'undefined') {
      propertyTerms = await resolvePropertyTermsForHotel(propertyTerms, req.user);
      if (!hasAnyTermsText(propertyTerms?.sections || propertyTerms)) {
        return res.status(400).json({ success: false, message: 'Property terms and booking policies are required for every hotel/dharamshala.' });
      }
    }
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/hotels', single: ['image'], multi: ['images'], tags: ['hotel', 'partner'] });
    Object.assign(hotel, body);
    applyPropertyTermsUpdate(hotel, propertyTerms, req.user);
    if (typeof propertyTerms !== 'undefined') await saveReusablePropertyTerms(req.user, propertyTerms);
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
      .select('name propertyType location rating image images description amenities googleMapLink nearestTemple checkInTime checkOutTime hotelGstin status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed taxEnabled taxPercent platform_commission_percentage propertyTerms createdAt updatedAt')
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
      .select('name propertyType location rating image images description amenities googleMapLink nearestTemple checkInTime checkOutTime hotelGstin status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed taxEnabled taxPercent platform_commission_percentage propertyTerms createdAt updatedAt')
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
      .select('name email phone businessName bankDetails payoutSettlement updatedAt')
      .lean();

    const partnerIds = partners.map((p) => p._id);
    const ledgerAgg = partnerIds.length
      ? await Booking.aggregate([
        {
          $match: {
            partnerId: { $in: partnerIds },
            paymentStatus: 'paid',
            bookingStatus: 'checked_out',
            payout_status: { $ne: 'settled' },
          },
        },
        {
          $group: {
            _id: '$partnerId',
            hotelRoomAmount: { $sum: '$baseAmount' },
            hotelGstCollected: { $sum: '$taxAmount' },
            platformConvenienceFee: { $sum: '$convenienceFeeAmount' },
            totalIngestedVolume: { $sum: '$totalAmount' },
            grossForHotel: { $sum: { $ifNull: ['$grossForHotel', { $add: ['$baseAmount', '$taxAmount'] }] } },
            deductedPlatformCommission: {
              $sum: {
                $multiply: [
                  '$baseAmount',
                  { $divide: [{ $ifNull: ['$platformCommissionPercent', 0] }, 100] },
                ],
              },
            },
            paymentGatewayCharges: {
              $sum: {
                $ifNull: ['$paymentGatewayFeeAmount', { $multiply: ['$baseAmount', 0.02] }],
              },
            },
            advanceReceived: { $sum: '$advanceAmount' },
            balanceAtProperty: { $sum: '$balanceAmount' },
            netPayableRemittanceBalance: {
              $sum: {
                $let: {
                  vars: {
                    net: {
                      $subtract: [
                        { $ifNull: ['$grossForHotel', { $add: ['$baseAmount', '$taxAmount'] }] },
                        {
                          $add: [
                            { $multiply: ['$baseAmount', { $divide: [{ $ifNull: ['$platformCommissionPercent', 0] }, 100] }] },
                            { $ifNull: ['$paymentGatewayFeeAmount', { $multiply: ['$baseAmount', 0.02] }] },
                          ],
                        },
                      ],
                    },
                  },
                  in: { $cond: [{ $gt: ['$$net', 0] }, '$$net', 0] },
                },
              },
            },
            refunds: { $sum: { $ifNull: ['$refundableAmount', 0] } },
            tdsTcs: { $sum: 0 },
            bookingCount: { $sum: 1 },
          },
        },
      ])
      : [];

    const ledgerByPartner = new Map(ledgerAgg.map((row) => [String(row._id), row]));
    const data = partners.map((partner) => {
      const ledger = ledgerByPartner.get(String(partner._id)) || {};
      return {
        ...partner,
        ledger: {
          hotelRoomAmount: Math.round(Number(ledger.hotelRoomAmount || 0)),
          hotelGstCollected: Math.round(Number(ledger.hotelGstCollected || 0)),
          platformConvenienceFee: Math.round(Number(ledger.platformConvenienceFee || 0)),
          totalIngestedVolume: Math.round(Number(ledger.totalIngestedVolume || 0)),
          grossForHotel: Math.round(Number(ledger.grossForHotel || 0)),
          deductedPlatformCommission: Math.round(Number(ledger.deductedPlatformCommission || 0)),
          paymentGatewayCharges: Math.round(Number(ledger.paymentGatewayCharges || 0)),
          advanceReceived: Math.round(Number(ledger.advanceReceived || 0)),
          balanceAtProperty: Math.round(Number(ledger.balanceAtProperty || 0)),
          netPayableRemittanceBalance: Math.round(Number(ledger.netPayableRemittanceBalance || 0)),
          refunds: Math.round(Number(ledger.refunds || 0)),
          tdsTcs: Math.round(Number(ledger.tdsTcs || 0)),
          bookingCount: Number(ledger.bookingCount || 0),
          isPaid: Boolean(partner.payoutSettlement?.isPaid),
          paidAt: partner.payoutSettlement?.paidAt || null,
          note: partner.payoutSettlement?.note || '',
        },
      };
    });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/payouts/:partnerId/settled', protect, authorize('admin'), async (req, res) => {
  try {
    const isPaid = Boolean(req.body?.isPaid);
    const note = String(req.body?.note || '').trim();
    const partner = await User.findOneAndUpdate(
      { _id: req.params.partnerId, role: 'partner' },
      {
        payoutSettlement: {
          isPaid,
          paidAt: isPaid ? new Date() : null,
          paidByUserId: isPaid ? req.user._id : null,
          note,
        },
      },
      { new: true }
    ).select('name email phone businessName bankDetails payoutSettlement updatedAt');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });
    res.json({ success: true, data: partner });
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
    const notifications = await PartnerNotification.find({
      type: 'notification',
      $or: [
        { audience: 'all_partners' },
        { audience: 'partner', partnerId: req.user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: notifications });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/admin-notifications', protect, authorize('admin'), async (req, res) => {
  try {
    const notifications = await PartnerNotification.find({ type: 'notification', audience: 'admin' })
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
