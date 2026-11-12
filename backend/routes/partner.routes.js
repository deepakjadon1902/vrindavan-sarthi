const mongoose = require('mongoose');
const express = require('express');
const Hotel = require('../models/Hotel');
const { getNextPropertyId } = require('../utils/idAllocation');
const Cab = require('../models/Cab');
const User = require('../models/User');
const Booking = require('../models/Booking');
const PartnerNotification = require('../models/PartnerNotification');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, authorizeAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/adminAuditLogger');
const { normalizeImageFields } = require('../utils/imageFields');
const { rejectInvalidObjectId } = require('../utils/security');
const { calculatePartnerOnboardingStatus } = require('../utils/partnerOnboarding');
const router = express.Router();
const PROPERTY_TYPES = ['hotel', 'dharamshala', 'home_stay', 'guest_house'];

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

for (const paramName of ['id', 'partnerId']) {
  router.param(paramName, (req, res, next, value) => {
    if (rejectInvalidObjectId(res, value, paramName)) return;
    next();
  });
}

const stripPartnerListingProtectedFields = (body) => {
  for (const key of [
    '_id',
    'id',
    'role',
    'propertyId',
    'partnerId',
    'partnerName',
    'partnerEmail',
    'partnerPhone',
    'partnerSubmitted',
    'approvalStatus',
    'adminRemarks',
    'status',
    'platform_commission_percentage',
    'dharamshalaPaymentMode',
    'dharamshalaPlatformFeeEnabled',
    'dharamshalaServiceFee',
    'dharamshalaServiceFeeVersion',
    'dharamshalaFeeApprovalStatus',
    'dharamshalaFeeConfigured',
    'dharamshalaFeeApprovedBy',
    'dharamshalaFeeApprovedByName',
    'dharamshalaFeeApprovedAt',
    'dharamshalaFeeHistory',
    'cancellationPolicyType',
    'customCancellationPolicy',
    'cancellationPolicyHistory',
    'instantBookingEnabled',
    'bookingMode',
    'createdAt',
    'updatedAt',
    'createdByUserId',
    'createdByRole',
  ]) {
    delete body[key];
  }
};

const MIN_PAYOUT_THRESHOLD = 1000;
const PAYOUT_CYCLE_DAYS = ['Monday', 'Wednesday'];
const isPayoutCycleDay = (date = new Date()) => {
  const day = date.getDay();
  return day === 1 || day === 3;
};

const applyPartnerHotelDefaults = (body, user, existingHotel = null) => {
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
  const propertyType = String(body?.propertyType || '').trim().toLowerCase();
  body.propertyType = PROPERTY_TYPES.includes(propertyType) ? propertyType : (existingHotel?.propertyType || 'hotel');
  const hasGstin = Boolean(String(body?.hotelGstin || user?.gstNumber || '').trim());
  body.hotelGstin = String(body?.hotelGstin || user?.gstNumber || '').trim().toUpperCase();
  body.taxEnabled = hasGstin && Boolean(body?.taxEnabled);
  body.gstMode = String(body?.gstMode || '').trim().toLowerCase() === 'manual' ? 'manual' : 'automatic';
  const p = Number(body?.taxPercent);
  body.taxPercent = body.gstMode === 'manual' && Number.isFinite(p) && p >= 0 ? Math.min(50, p) : 0;
  body.showPrices = typeof body?.showPrices === 'undefined' ? (existingHotel ? existingHotel.showPrices : true) : Boolean(body.showPrices);

  if (!existingHotel) {
    // Only initialize platform-level defaults on new creation; never overwrite admin-configured fields on update.
    body.platform_commission_percentage = 10;
    body.dharamshalaPaymentMode = 'pay_at_dharamshala';
    body.dharamshalaPlatformFeeEnabled = true;
    if (body.propertyType === 'dharamshala') {
      // New Dharamshala properties remain strictly unconfigured until an authorized admin configures and approves the fee.
      body.dharamshalaFeeApprovalStatus = 'unconfigured';
      body.dharamshalaFeeConfigured = false;
      body.dharamshalaServiceFeeVersion = 1;
      body.dharamshalaFeeHistory = [];
    }
  } else if (existingHotel.propertyType !== 'dharamshala' && body.propertyType === 'dharamshala') {
    // Property transitioned from commercial hotel to Dharamshala: require explicit admin fee review.
    body.dharamshalaPaymentMode = 'pay_at_dharamshala';
    body.dharamshalaFeeApprovalStatus = 'unconfigured';
    body.dharamshalaFeeConfigured = false;
    body.dharamshalaServiceFeeVersion = 1;
    body.dharamshalaFeeHistory = [];
  }

  const responseTimeout = Number(body?.dharamshalaResponseTimeoutMinutes);
  body.dharamshalaResponseTimeoutMinutes = Number.isFinite(responseTimeout) && responseTimeout > 0
    ? Math.min(7 * 24 * 60, Math.floor(responseTimeout))
    : (existingHotel?.dharamshalaResponseTimeoutMinutes || 30);
  for (const key of ['dharamshalaTerminology', 'dharamshalaCancellationPolicy', 'dharamshalaNoShowPolicy', 'dharamshalaIdRequirement']) {
    if (typeof body?.[key] !== 'undefined' || !existingHotel) {
      body[key] = String(body?.[key] || '').trim().slice(0, 2000);
    }
  }
  if (body.propertyType === 'dharamshala') {
    body.taxEnabled = false;
    body.taxPercent = 0;
    body.gstMode = 'manual';
  }
  return body;
};

// Partner: Submit hotel
router.post('/hotels', protect, authorize('partner'), async (req, res) => {
  try {
    const body = { ...req.body };
    stripPartnerListingProtectedFields(body);
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
    const propertyId = body.propertyId || await getNextPropertyId();
    const hotel = await Hotel.create({
      propertyId,
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
    stripPartnerListingProtectedFields(body);
    applyPartnerHotelDefaults(body, req.user, hotel);
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
    hotel.partnerId = req.user._id;
    hotel.partnerName = req.user.name;
    hotel.partnerEmail = req.user.email;
    hotel.partnerPhone = req.user.phone;
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
    stripPartnerListingProtectedFields(body);
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
    stripPartnerListingProtectedFields(body);
    const locationError = normalizeRequiredLocationFields(body);
    if (locationError) return res.status(400).json({ success: false, message: locationError });
    await normalizeImageFields(body, { folder: 'vrindavan-sarthi/cabs', single: ['image'], multi: ['images'], tags: ['cab', 'partner'] });
    Object.assign(cab, body);
    cab.partnerId = req.user._id;
    cab.partnerName = req.user.name;
    cab.partnerEmail = req.user.email;
    cab.partnerPhone = req.user.phone;
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

// Partner & Admin: Get detailed onboarding checklist status
router.get('/onboarding-status', protect, async (req, res) => {
  try {
    let targetPartnerId = req.user._id;
    if (req.user.role === 'admin' && req.query.partnerId) {
      targetPartnerId = req.query.partnerId;
    } else if (req.user.role !== 'partner' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const hotelId = req.query.hotelId || null;
    const status = await calculatePartnerOnboardingStatus(targetPartnerId, hotelId);
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: Server-side validation gate to submit property for admin review
router.post('/submit-property', protect, authorize('partner'), async (req, res) => {
  try {
    const hotelId = req.body?.hotelId || null;
    const status = await calculatePartnerOnboardingStatus(req.user._id, hotelId);
    if (!status.hotel) {
      return res.status(404).json({ success: false, message: 'No property found to submit.' });
    }
    if (!status.isReadyForSubmission) {
      const incompleteSteps = status.steps.filter((s) => s.stepNumber <= 11 && s.status !== 'completed');
      return res.status(400).json({
        success: false,
        message: 'Cannot submit property for review: onboarding checklist requirements are incomplete.',
        data: {
          incompleteSteps,
          overallProgressPercent: status.overallProgressPercent,
          nextActionStep: status.nextActionStep,
        },
      });
    }
    const hotel = await Hotel.findByIdAndUpdate(
      status.hotel._id,
      {
        partnerSubmitted: true,
        approvalStatus: 'pending',
        status: 'inactive',
      },
      { new: true }
    );
    await PartnerNotification.create({
      title: 'Property Listing Submitted for Verification',
      message: `Your property "${hotel.name}" has been successfully submitted for administrative verification. Our team will review the details.`,
      type: 'notification',
      audience: 'partner',
      recipientUserId: req.user._id,
      recipientRole: 'partner',
      partnerId: req.user._id,
      hotelId: hotel._id,
      eventType: 'partner_property_submitted',
      priority: 'normal',
    });
    const updatedStatus = await calculatePartnerOnboardingStatus(req.user._id, hotel._id);
    res.json({
      success: true,
      message: 'Property listing submitted successfully for admin review.',
      data: updatedStatus,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Request corrections on a property listing
router.put('/properties/:id/correction-request', protect, authorize('admin'), async (req, res) => {
  try {
    const reason = String(req.body?.reason || req.body?.adminRemarks || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Correction remarks/reason is required.' });
    }
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    hotel.approvalStatus = 'correction_required';
    hotel.adminRemarks = reason;
    hotel.status = 'inactive';
    await hotel.save();

    if (hotel.partnerId) {
      await PartnerNotification.create({
        title: 'Action Required: Listing Correction Requested',
        message: `Admin review has requested corrections for "${hotel.name}": ${reason}`,
        type: 'notification',
        audience: 'partner',
        recipientUserId: hotel.partnerId,
        recipientRole: 'partner',
        partnerId: hotel.partnerId,
        hotelId: hotel._id,
        eventType: 'partner_property_correction_required',
        priority: 'high',
      });
    }
    res.json({ success: true, message: 'Correction request recorded and partner notified.', data: hotel });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Overview of all partners onboarding progression
router.get('/admin/onboarding-overview', protect, authorize('admin'), async (req, res) => {
  try {
    const partners = await User.find({ role: 'partner' }).sort({ createdAt: -1 }).select('_id name email phone partnerStatus businessName createdAt').lean();
    const overview = await Promise.all(
      partners.map(async (partner) => {
        try {
          const status = await calculatePartnerOnboardingStatus(partner);
          return {
            partnerId: partner._id,
            partnerName: partner.name,
            partnerEmail: partner.email,
            partnerPhone: partner.phone,
            partnerStatus: partner.partnerStatus,
            businessName: partner.businessName,
            hotelId: status.hotel?._id || null,
            hotelName: status.hotel?.name || null,
            approvalStatus: status.hotel?.approvalStatus || 'not_created',
            partnerSubmitted: status.hotel?.partnerSubmitted || false,
            overallProgressPercent: status.overallProgressPercent,
            completedStepsCount: status.completedStepsCount,
            totalStepsCount: status.totalStepsCount,
            nextActionStep: status.nextActionStep,
            nextActionTitle: status.nextActionTitle,
            isReadyForSubmission: status.isReadyForSubmission,
            isApproved: status.isApproved,
            registeredAt: partner.createdAt,
          };
        } catch {
          return {
            partnerId: partner._id,
            partnerName: partner.name,
            partnerEmail: partner.email,
            partnerStatus: partner.partnerStatus,
            overallProgressPercent: 0,
            completedStepsCount: 0,
            totalStepsCount: 13,
            nextActionStep: 'registration',
          };
        }
      })
    );
    res.json({ success: true, data: overview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Detailed Partners Directory
router.get('/admin/partners-directory', protect, authorizeAdmin('manage_partners'), async (req, res) => {
  try {
    const { q, status = 'all', page = 1, limit = 20 } = req.query;
    const filter = { role: 'partner' };

    if (status && status !== 'all') {
      if (status === 'suspended') filter.isSuspended = true;
      else filter.partnerStatus = status;
    }

    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }, { phone: re }, { businessName: re }];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [partners, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      User.countDocuments(filter),
    ]);

    const enriched = await Promise.all(
      partners.map(async (p) => {
        const [hotels, onboarding] = await Promise.all([
          Hotel.find({ partnerId: p._id }).select('name propertyType status approvalStatus').lean(),
          calculatePartnerOnboardingStatus(p).catch(() => ({ overallProgressPercent: 0, completedStepsCount: 0 })),
        ]);

        const rawAcc = String(p.bankDetails?.account_number || '');
        const maskedAccount = rawAcc.length > 4 ? `XXXX-XXXX-${rawAcc.slice(-4)}` : (rawAcc ? 'XXXX' : 'Not Provided');

        return {
          ...p,
          bankDetails: p.bankDetails ? {
            ...p.bankDetails,
            account_number: maskedAccount,
          } : undefined,
          linkedPropertiesCount: hotels.length,
          properties: hotels,
          onboardingProgress: onboarding.overallProgressPercent || 0,
          completedStepsCount: onboarding.completedStepsCount || 0,
          kycDocumentsCount: Array.isArray(p.partnerDocuments) ? p.partnerDocuments.length : 0,
        };
      })
    );

    res.json({
      success: true,
      data: enriched,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.max(1, Math.ceil(total / parseInt(limit, 10))),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load partners directory' });
  }
});

// Admin: Partner Detail by ID
router.get('/admin/partners/:id', protect, authorizeAdmin('manage_partners'), async (req, res) => {
  try {
    const partner = await User.findOne({ _id: req.params.id, role: 'partner' }).select('-password').lean();
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    const [hotels, onboarding, auditTimeline] = await Promise.all([
      Hotel.find({ partnerId: partner._id }).lean(),
      calculatePartnerOnboardingStatus(partner).catch(() => null),
      AuditLog.find({ targetEntityId: String(partner._id) }).sort({ timestamp: -1 }).limit(10).lean(),
    ]);

    const rawAcc = String(partner.bankDetails?.account_number || '');
    const maskedAccount = rawAcc.length > 4 ? `XXXX-XXXX-${rawAcc.slice(-4)}` : (rawAcc ? 'XXXX' : 'Not Provided');

    res.json({
      success: true,
      data: {
        ...partner,
        bankDetails: partner.bankDetails ? {
          ...partner.bankDetails,
          account_number: maskedAccount,
        } : undefined,
        properties: hotels,
        onboarding,
        auditTimeline,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load partner details' });
  }
});

// Admin: Verify Partner Bank Details
router.put('/admin/partners/:id/verify-bank', protect, authorizeAdmin('manage_partners'), async (req, res) => {
  try {
    const { verified, note } = req.body;
    const partner = await User.findOne({ _id: req.params.id, role: 'partner' });
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    if (!partner.bankDetails) partner.bankDetails = {};
    const before = { verified: partner.bankDetails.verified };
    partner.bankDetails.verified = Boolean(verified);
    partner.bankDetails.updatedAt = new Date();
    await partner.save();

    await logAdminAction({
      actor: req.user,
      action: verified ? 'partner_bank_verified' : 'partner_bank_unverified',
      targetEntityType: 'partner',
      targetEntityId: partner._id,
      beforeState: before,
      afterState: { verified: partner.bankDetails.verified },
      reason: note || (verified ? 'Bank account verified by admin' : 'Bank account unverified'),
      req,
    });

    res.json({ success: true, data: partner.bankDetails });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to verify bank details' });
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
      .select('name propertyType location rating image images description amenities googleMapLink nearestTemple checkInTime checkOutTime hotelGstin status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed taxEnabled taxPercent gstMode platform_commission_percentage showPrices dharamshalaPaymentMode dharamshalaPlatformFeeEnabled dharamshalaServiceFee dharamshalaTerminology dharamshalaResponseTimeoutMinutes dharamshalaCancellationPolicy dharamshalaNoShowPolicy dharamshalaIdRequirement propertyTerms createdAt updatedAt')
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

// Partner: comprehensive operational dashboard summary
router.get('/dashboard-summary', protect, authorize('partner'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const partnerId = req.user._id;

    // 1. Properties
    const hotels = await Hotel.find({ partnerId }).lean();
    const totalProperties = hotels.length;
    const publishedProperties = hotels.filter((h) => h.approvalStatus === 'approved' && (h.status === 'active' || h.status === 'published')).length;
    const approvedProperties = hotels.filter((h) => h.approvalStatus === 'approved').length;
    const pendingProperties = hotels.filter((h) => h.approvalStatus === 'pending').length;
    const rejectedProperties = hotels.filter((h) => h.approvalStatus === 'rejected').length;

    // 2. Bookings
    const bookings = await Booking.find({ partnerId }).sort({ createdAt: -1 }).lean();
    const totalBookings = bookings.length;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let todayCheckIns = 0;
    let todayCheckOuts = 0;
    let upcomingArrivals = 0;
    let currentGuests = 0;
    let checkedOutBookings = 0;
    let cancelledBookings = 0;
    let pendingConfirmation = 0;

    let pendingDeskCollections = 0;
    let propertyDeskCollected = 0;
    let onlineCollections = 0;
    let totalGrossTariff = 0;
    let totalPlatformCommission = 0;
    let totalPartnerEarnings = 0;
    let pendingSettlement = 0;
    let paidSettlements = 0;

    for (const b of bookings) {
      const bStatus = String(b.bookingStatus || '');
      const pStatus = String(b.paymentStatus || '');
      const payoutStatus = String(b.payout_status || '');

      const ci = b.checkInDate || b.checkIn ? new Date(b.checkInDate || b.checkIn) : null;
      const co = b.checkOutDate || b.checkOut ? new Date(b.checkOutDate || b.checkOut) : null;

      if (bStatus === 'confirmed' && ci && ci >= startOfToday && ci <= endOfToday) {
        todayCheckIns += 1;
      }
      if (bStatus === 'checked_in' && co && co >= startOfToday && co <= endOfToday) {
        todayCheckOuts += 1;
      }
      if (bStatus === 'confirmed' && ci && ci > endOfToday) {
        upcomingArrivals += 1;
      }
      if (bStatus === 'checked_in') {
        currentGuests += 1;
      }
      if (['checked_out', 'completed', 'settled'].includes(bStatus)) {
        checkedOutBookings += 1;
      }
      if (bStatus === 'cancelled') {
        cancelledBookings += 1;
      }
      if (bStatus === 'pending_property_confirmation') {
        pendingConfirmation += 1;
      }

      const deskCollected = Number(b.amountPaidToProperty || 0);
      const onlinePaid = Number(b.amountPaidOnline || b.advanceAmount || 0);
      propertyDeskCollected += deskCollected;
      onlineCollections += onlinePaid;

      if (['confirmed', 'checked_in'].includes(bStatus)) {
        pendingDeskCollections += Number(b.balanceAmount || b.amountPayableAtProperty || 0);
      }

      const gross = Number(b.grossForHotel || (Number(b.baseAmount || 0) + Number(b.taxAmount || 0)) || b.totalAmount || 0);
      const commPercent = Number(b.platformCommissionPercent || 0);
      const commAmount = Number(b.platformCommissionAmount || Math.round((gross * commPercent) / 100));
      const netEarnings = Math.max(0, gross - commAmount);

      totalGrossTariff += gross;
      totalPlatformCommission += commAmount;

      if (['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(bStatus) && pStatus === 'paid') {
        totalPartnerEarnings += netEarnings;
      }

      if (bStatus === 'checked_out' && pStatus === 'paid' && payoutStatus !== 'settled') {
        const netRemittance = Math.max(0, netEarnings - deskCollected);
        pendingSettlement += netRemittance;
      }
      if (payoutStatus === 'settled') {
        const netRemittance = Math.max(0, netEarnings - deskCollected);
        paidSettlements += netRemittance;
      }
    }

    const unreadNotificationsCount = await PartnerNotification.countDocuments({
      readAt: null,
      $or: [
        { audience: 'all_partners' },
        { audience: 'partner', partnerId },
        { recipientUserId: partnerId },
      ],
    });

    const isEligibleForSettlement = pendingSettlement >= MIN_PAYOUT_THRESHOLD;

    res.json({
      success: true,
      data: {
        properties: {
          total: totalProperties,
          published: publishedProperties,
          approved: approvedProperties,
          pending: pendingProperties,
          rejected: rejectedProperties,
        },
        bookings: {
          total: totalBookings,
          todayCheckIns,
          todayCheckOuts,
          upcomingArrivals,
          currentGuests,
          checkedOut: checkedOutBookings,
          cancelled: cancelledBookings,
          pendingConfirmation,
        },
        financials: {
          pendingDeskCollections: Math.round(pendingDeskCollections),
          propertyDeskCollected: Math.round(propertyDeskCollected),
          onlineCollections: Math.round(onlineCollections),
          totalGrossTariff: Math.round(totalGrossTariff),
          totalPlatformCommission: Math.round(totalPlatformCommission),
          totalPartnerEarnings: Math.round(totalPartnerEarnings),
          pendingSettlement: Math.round(pendingSettlement),
          paidSettlements: Math.round(paidSettlements),
          settlementThreshold: MIN_PAYOUT_THRESHOLD,
          isEligibleForSettlement,
          nextPayoutCycle: 'Bi-weekly on Monday & Wednesday',
        },
        notifications: {
          unreadCount: unreadNotificationsCount,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: comprehensive financial statement and itemized ledger
router.get('/financial-statement', protect, authorize('partner'), async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const partnerId = req.user._id;
    const partnerUser = await User.findById(partnerId).select('name email businessName bankDetails payoutSettlement').lean();
    const bookings = await Booking.find({ partnerId }).sort({ createdAt: -1 }).lean();

    let grossTariff = 0;
    let gstCollected = 0;
    let platformCommission = 0;
    let onlineReceived = 0;
    let deskCollected = 0;
    let balanceAtDesk = 0;
    let completedStayEntitlement = 0;
    let breakageEntitlement = 0;
    let netPayableRemittance = 0;
    let settledAmount = 0;

    const ledger = bookings.map((b) => {
      const gross = Number(b.grossForHotel || (Number(b.baseAmount || 0) + Number(b.taxAmount || 0)) || b.totalAmount || 0);
      const tax = Number(b.taxAmount || 0);
      const commPercent = Number(b.platformCommissionPercent || 0);
      const commAmount = Number(b.platformCommissionAmount || Math.round((gross * commPercent) / 100));
      const netEntitlement = Math.max(0, gross - commAmount);
      const deskPaid = Number(b.amountPaidToProperty || 0);
      const onlinePaid = Number(b.amountPaidOnline || b.advanceAmount || 0);
      const balance = Number(b.balanceAmount || b.amountPayableAtProperty || 0);
      const netRemittance = Math.max(0, netEntitlement - deskPaid);

      grossTariff += gross;
      gstCollected += tax;
      platformCommission += commAmount;
      onlineReceived += onlinePaid;
      deskCollected += deskPaid;
      if (['confirmed', 'checked_in'].includes(b.bookingStatus)) {
        balanceAtDesk += balance;
      }
      if (b.paymentStatus === 'paid' && b.bookingStatus !== 'cancelled') {
        completedStayEntitlement += netEntitlement;
      }
      if (b.bookingStatus === 'checked_out' && b.paymentStatus === 'paid' && b.payout_status !== 'settled') {
        netPayableRemittance += netRemittance;
      }
      if (b.payout_status === 'settled' && b.bookingStatus === 'checked_out') {
        settledAmount += netRemittance;
      }

      return {
        id: b._id,
        bookingId: b.bookingId,
        customerName: b.customerFullName || b.userName || 'Guest',
        customerPhone: b.userPhone || '',
        propertyName: b.hotelName || b.propertyName || b.itemName || 'Property',
        bookingType: b.bookingType || 'hotel',
        checkIn: b.checkInDate || b.checkIn,
        checkOut: b.checkOutDate || b.checkOut,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        paymentOption: b.paymentOption || 'full_online',
        payoutStatus: b.payout_status || 'pending',
        grossTariff: Math.round(gross),
        taxAmount: Math.round(tax),
        platformCommission: Math.round(commAmount),
        onlinePaid: Math.round(onlinePaid),
        deskCollected: Math.round(deskPaid),
        balanceAtDesk: Math.round(balance),
        netEntitlement: Math.round(netEntitlement),
        netRemittance: Math.round(netRemittance),
        settledAt: b.payoutSettledAt || null,
        createdAt: b.createdAt,
      };
    });

    // Option B: Dedicated Cancellation Breakage Entitlements
    const cancellationBreakage = bookings
      .filter((b) => Number(b.cancellationBreakage?.partnerBreakageEntitlement || 0) > 0)
      .map((b) => {
        const pEntitlement = Number(b.cancellationBreakage.partnerBreakageEntitlement || 0);
        breakageEntitlement += pEntitlement;
        if (b.payout_status === 'pending_breakage_settlement' || b.cancellationBreakage.allocationStatus === 'pending_settlement') {
          netPayableRemittance += pEntitlement;
        } else if (b.payout_status === 'settled' || b.cancellationBreakage.allocationStatus === 'settled') {
          settledAmount += pEntitlement;
        }

        return {
          id: b._id,
          bookingId: b.bookingId,
          propertyName: b.propertyName || b.hotelName || b.itemName || 'Property',
          cancellationDate: b.cancelledAt || b.cancellationBreakage.allocatedAt,
          retainedOnlineAdvance: Math.round(b.cancellationBreakage.retainedOnlineAdvance || 0),
          platformCommission: Math.round(b.cancellationBreakage.platformCommissionAmount || 0),
          partnerBreakageEntitlement: Math.round(pEntitlement),
          settlementStatus: (b.payout_status === 'settled' || b.cancellationBreakage.allocationStatus === 'settled') ? 'settled' : 'pending_settlement',
          settledAt: b.cancellationBreakage.settledAt || b.payoutSettledAt || null,
          payoutReference: b.cancellationBreakage.settlementNote || b.payoutSettlementNote || null,
          policyModel: 'OPTION_B',
        };
      });

    const partnerNetEntitlement = completedStayEntitlement + breakageEntitlement;
    const isEligible = netPayableRemittance >= MIN_PAYOUT_THRESHOLD;

    res.json({
      success: true,
      data: {
        summary: {
          grossTariff: Math.round(grossTariff),
          gstCollected: Math.round(gstCollected),
          platformCommission: Math.round(platformCommission),
          onlineReceived: Math.round(onlineReceived),
          deskCollected: Math.round(deskCollected),
          balanceAtDesk: Math.round(balanceAtDesk),
          completedStayEntitlement: Math.round(completedStayEntitlement),
          breakageEntitlement: Math.round(breakageEntitlement),
          partnerNetEntitlement: Math.round(partnerNetEntitlement),
          netPayableRemittance: Math.round(netPayableRemittance),
          settledAmount: Math.round(settledAmount),
          minimumThreshold: MIN_PAYOUT_THRESHOLD,
          eligibleForPayout: isEligible,
          rolloverAmount: isEligible ? 0 : Math.round(netPayableRemittance),
          payoutCycleDays: PAYOUT_CYCLE_DAYS,
          isPayoutCycleToday: isPayoutCycleDay(),
          nextPayoutCycle: 'Bi-weekly on Monday & Wednesday',
        },
        bankDetails: partnerUser?.bankDetails || null,
        payoutSettlement: partnerUser?.payoutSettlement || null,
        ledger,
        cancellationBreakage,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
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
      .select('name propertyType location rating image images description amenities googleMapLink nearestTemple checkInTime checkOutTime hotelGstin status approvalStatus adminRemarks partnerId partnerName partnerEmail partnerPhone businessName petsAllowed taxEnabled taxPercent gstMode platform_commission_percentage showPrices dharamshalaPaymentMode dharamshalaPlatformFeeEnabled dharamshalaServiceFee dharamshalaTerminology dharamshalaResponseTimeoutMinutes dharamshalaCancellationPolicy dharamshalaNoShowPolicy dharamshalaIdRequirement propertyTerms createdAt updatedAt')
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
    if (approvalStatus === 'rejected' || approvalStatus === 'correction_required') update.status = 'inactive';
    const platformFeeEnabled = typeof req.body?.dharamshalaPlatformFeeEnabled === 'undefined'
      ? undefined
      : Boolean(req.body.dharamshalaPlatformFeeEnabled);
    const platformFee = Number(req.body?.dharamshalaServiceFee);
    if (typeof platformFeeEnabled !== 'undefined') update.dharamshalaPlatformFeeEnabled = platformFeeEnabled;
    if (Number.isFinite(platformFee) && platformFee >= 0) update.dharamshalaServiceFee = Math.min(100000, Math.round(platformFee));
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
    if (approvalStatus === 'rejected' || approvalStatus === 'correction_required') update.status = 'inactive';
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
router.get('/payouts', protect, authorize('admin'), authorizeAdmin('manage_settlements'), async (req, res) => {
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
            $or: [
              {
                paymentStatus: 'paid',
                bookingStatus: 'checked_out',
                payout_status: { $ne: 'settled' },
              },
              {
                payout_status: 'pending_breakage_settlement',
              },
            ],
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
                $cond: [
                  { $eq: ['$payout_status', 'pending_breakage_settlement'] },
                  { $ifNull: ['$cancellationBreakage.partnerBreakageEntitlement', 0] },
                  {
                    $let: {
                      vars: {
                        net: {
                          $subtract: [
                            // Net hotel entitlement: Gross tariff minus platform commission (Vrindavan Sarthi bears gateway fee)
                            {
                              $subtract: [
                                { $ifNull: ['$grossForHotel', { $add: ['$baseAmount', '$taxAmount'] }] },
                                { $multiply: ['$baseAmount', { $divide: [{ $ifNull: ['$platformCommissionPercent', 0] }, 100] }] },
                              ],
                            },
                            // Deduct balance collected directly by hotel desk from guest:
                            { $ifNull: ['$balanceAmount', 0] },
                          ],
                        },
                      },
                      in: '$net',
                    },
                  },
                ],
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
          minimumThreshold: MIN_PAYOUT_THRESHOLD,
          eligibleForPayout: Math.round(Number(ledger.netPayableRemittanceBalance || 0)) >= MIN_PAYOUT_THRESHOLD,
          rolloverAmount: Math.round(Number(ledger.netPayableRemittanceBalance || 0)) < MIN_PAYOUT_THRESHOLD
            ? Math.round(Number(ledger.netPayableRemittanceBalance || 0))
            : 0,
          excessPartnerCollection: Math.max(0, -Math.round(Number(ledger.netPayableRemittanceBalance || 0))),
          partnerLiability: Math.max(0, -Math.round(Number(ledger.netPayableRemittanceBalance || 0))),
          netPayableToPartner: Math.max(0, Math.round(Number(ledger.netPayableRemittanceBalance || 0))),
          payoutCycleDays: PAYOUT_CYCLE_DAYS,
          isPayoutCycleToday: isPayoutCycleDay(),
          isPaid: Boolean(partner.payoutSettlement?.isPaid),
          paidAt: partner.payoutSettlement?.paidAt || null,
          note: partner.payoutSettlement?.note || '',
        },
      };
    });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/payouts/:partnerId/settled', protect, authorize('admin'), authorizeAdmin('manage_settlements'), async (req, res) => {
  try {
    const isPaid = Boolean(req.body?.isPaid);
    const note = String(req.body?.note || '').trim();
    const allowOffCycle = Boolean(
      req.body?.allowOffCycle ||
      req.body?.forceCycle ||
      process.env.NODE_ENV === 'staging' ||
      process.env.NODE_ENV === 'test' ||
      !process.env.NODE_ENV ||
      process.env.NODE_ENV === 'development'
    );
    if (isPaid && !isPayoutCycleDay() && !allowOffCycle) {
      return res.status(400).json({ success: false, message: 'Payout release is allowed only on Monday and Wednesday cycles.' });
    }

    const partner = await User.findOne({ _id: req.params.partnerId, role: 'partner' })
      .select('name email phone businessName bankDetails payoutSettlement updatedAt');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    // Idempotent settlement retry: return current record if already in requested state
    if (isPaid && partner.payoutSettlement?.isPaid) {
      return res.json({ success: true, data: partner, message: 'Payout is already marked as settled.' });
    }
    if (!isPaid && !partner.payoutSettlement?.isPaid) {
      return res.json({ success: true, data: partner, message: 'Payout is already in pending state.' });
    }

    if (isPaid) {
      const [ledger] = await Booking.aggregate([
        {
          $match: {
            partnerId: new User.base.Types.ObjectId(req.params.partnerId),
            $or: [
              {
                paymentStatus: 'paid',
                bookingStatus: 'checked_out',
                payout_status: { $ne: 'settled' },
              },
              {
                payout_status: 'pending_breakage_settlement',
              },
            ],
          },
        },
        {
          $group: {
            _id: '$partnerId',
            netPayable: {
              $sum: {
                $cond: [
                  { $eq: ['$payout_status', 'pending_breakage_settlement'] },
                  { $ifNull: ['$cancellationBreakage.partnerBreakageEntitlement', 0] },
                  {
                    $let: {
                      vars: {
                        net: {
                          $subtract: [
                            // Net hotel entitlement: Gross tariff minus platform commission (Vrindavan Sarthi bears gateway fee)
                            {
                              $subtract: [
                                { $ifNull: ['$grossForHotel', { $add: ['$baseAmount', '$taxAmount'] }] },
                                { $multiply: ['$baseAmount', { $divide: [{ $ifNull: ['$platformCommissionPercent', 0] }, 100] }] },
                              ],
                            },
                            // Deduct balance collected directly by hotel desk:
                            { $ifNull: ['$balanceAmount', 0] },
                          ],
                        },
                      },
                      in: '$net',
                    },
                  },
                ],
              },
            },
          },
        },
      ]);

      const netPayable = Math.round(Number(ledger?.netPayable || 0));
      if (netPayable < MIN_PAYOUT_THRESHOLD) {
        if (netPayable < 0) {
          return res.status(400).json({
            success: false,
            message: `Cannot release payout. Partner has an excess collection / liability of Rs. ${Math.abs(netPayable)} collected directly from guests. Balance will roll over to future bookings.`,
            excessPartnerCollection: Math.abs(netPayable),
          });
        }
        return res.status(400).json({
          success: false,
          message: `Minimum payout threshold is Rs. ${MIN_PAYOUT_THRESHOLD}. Balance will roll over to the next cycle.`,
          rolloverAmount: netPayable,
        });
      }

      // Mark individual checked-out bookings as settled
      await Booking.updateMany(
        {
          partnerId: new User.base.Types.ObjectId(req.params.partnerId),
          paymentStatus: 'paid',
          bookingStatus: 'checked_out',
          payout_status: { $ne: 'settled' },
        },
        {
          $set: {
            payout_status: 'settled',
            payoutSettledAt: new Date(),
            payoutSettledBy: req.user._id,
            payoutSettlementNote: note,
          },
        }
      );

      // Mark breakage cancellation bookings as settled
      await Booking.updateMany(
        {
          partnerId: new User.base.Types.ObjectId(req.params.partnerId),
          payout_status: 'pending_breakage_settlement',
        },
        {
          $set: {
            payout_status: 'settled',
            'cancellationBreakage.allocationStatus': 'settled',
            'cancellationBreakage.settledAt': new Date(),
            'cancellationBreakage.settledBy': req.user._id,
            'cancellationBreakage.settlementNote': note,
            payoutSettledAt: new Date(),
            payoutSettledBy: req.user._id,
            payoutSettlementNote: note,
          },
        }
      );

      // Record immutable ledger entry for partner settlement release
      try {
        const { recordLedgerEntry } = require('../services/financialLedgerService');
        await recordLedgerEntry({
          partnerId: partner._id,
          eventType: 'PARTNER_SETTLEMENT',
          direction: 'debit',
          amountRupees: netPayable,
          payoutStatus: 'settled',
          settlementReference: note,
          idempotencyKey: `settlement:${partner._id}:${Date.now()}`,
          actorId: req.user._id,
          actorRole: 'admin',
          metadata: {
            note,
            settledAt: new Date(),
            recipientName: partner.name,
            businessName: partner.businessName,
          },
        });
      } catch (ledgerErr) {
        console.warn('[partner.settlement.ledger_failed]', ledgerErr?.message || ledgerErr);
      }
    } else {
      // Revert breakage cancellation bookings
      await Booking.updateMany(
        {
          partnerId: new User.base.Types.ObjectId(req.params.partnerId),
          payout_status: 'settled',
          'cancellationBreakage.partnerBreakageEntitlement': { $gt: 0 },
        },
        {
          $set: {
            payout_status: 'pending_breakage_settlement',
            'cancellationBreakage.allocationStatus': 'pending_settlement',
            'cancellationBreakage.settledAt': null,
            'cancellationBreakage.settledBy': null,
            'cancellationBreakage.settlementNote': '',
            payoutSettledAt: null,
            payoutSettledBy: null,
            payoutSettlementNote: '',
          },
        }
      );

      // Revert checked_out bookings
      await Booking.updateMany(
        {
          partnerId: new User.base.Types.ObjectId(req.params.partnerId),
          payout_status: 'settled',
          bookingStatus: 'checked_out',
        },
        {
          $set: {
            payout_status: 'checked_out',
            payoutSettledAt: null,
            payoutSettledBy: null,
            payoutSettlementNote: '',
          },
        }
      );
    }

    partner.payoutSettlement = {
      isPaid,
      paidAt: isPaid ? new Date() : null,
      paidByUserId: isPaid ? req.user._id : null,
      note,
    };
    await partner.save();
    res.json({ success: true, data: partner });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: Searchable recipient registry (properties and registered partners)
router.get('/recipients', protect, authorize('admin'), async (req, res) => {
  try {
    const [partners, hotels] = await Promise.all([
      User.find({ role: 'partner' })
        .select('_id name email phone businessName businessType partnerStatus')
        .sort({ name: 1 })
        .lean(),
      Hotel.find({})
        .select('_id name propertyType propertyId partnerId partnerName partnerEmail partnerPhone address location')
        .sort({ name: 1 })
        .lean(),
    ]);

    const partnerMap = new Map();
    for (const p of partners) {
      partnerMap.set(String(p._id), p);
    }

    const properties = hotels.map((h) => {
      const assignedPartner = h.partnerId ? partnerMap.get(String(h.partnerId)) : null;
      return {
        id: String(h._id),
        name: h.name,
        propertyType: h.propertyType || 'hotel',
        propertyId: h.propertyId || '',
        location: h.location || '',
        address: h.address || '',
        partnerId: h.partnerId ? String(h.partnerId) : null,
        partnerName: h.partnerName || assignedPartner?.name || assignedPartner?.businessName || '',
        partnerEmail: h.partnerEmail || assignedPartner?.email || '',
        partnerPhone: h.partnerPhone || assignedPartner?.phone || '',
        hasAssignedPartner: Boolean(h.partnerId),
      };
    });

    const partnerList = partners.map((p) => ({
      id: String(p._id),
      name: p.businessName ? `${p.businessName} (${p.name})` : p.name,
      contactName: p.name,
      businessName: p.businessName || '',
      businessType: p.businessType || 'Partner',
      email: p.email,
      phone: p.phone || '',
      status: p.partnerStatus || 'approved',
    }));

    res.json({
      success: true,
      data: {
        properties,
        partners: partnerList,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Notification & Notice dispatch history
router.get('/notifications/history', protect, authorize('admin'), async (req, res) => {
  try {
    const items = await PartnerNotification.find({
      $or: [
        { createdByUserId: req.user._id },
        { audience: { $in: ['all_partners', 'partner'] } },
      ],
    })
      .populate('partnerId', 'name email businessName phone')
      .populate('hotelId', 'name propertyType propertyId')
      .populate('createdByUserId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: notices (broadcast or specifically targeted to this partner)
router.get('/notices', protect, authorize('partner'), async (req, res) => {
  try {
    const notices = await PartnerNotification.find({
      type: 'notice',
      $or: [
        { audience: 'all_partners' },
        { audience: 'partner', partnerId: req.user._id },
        { recipientUserId: req.user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: notices });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Partner: notifications (broadcast or specifically targeted to this partner)
router.get('/notifications', protect, authorize('partner'), async (req, res) => {
  try {
    const notifications = await PartnerNotification.find({
      type: 'notification',
      $or: [
        { audience: 'all_partners' },
        { audience: 'partner', partnerId: req.user._id },
        { recipientUserId: req.user._id },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: notifications });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Partner: mark notification as read
router.put('/notifications/:id/read', protect, authorize('partner'), async (req, res) => {
  try {
    const notif = await PartnerNotification.findOne({
      _id: req.params.id,
      $or: [
        { audience: 'all_partners' },
        { audience: 'partner', partnerId: req.user._id },
        { recipientUserId: req.user._id },
      ],
    });
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    notif.readAt = new Date();
    await notif.save();
    res.json({ success: true, data: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Partner: mark all notifications as read
router.put('/notifications/mark-all-read', protect, authorize('partner'), async (req, res) => {
  try {
    const now = new Date();
    await PartnerNotification.updateMany(
      {
        readAt: null,
        $or: [
          { audience: 'all_partners' },
          { audience: 'partner', partnerId: req.user._id },
          { recipientUserId: req.user._id },
        ],
      },
      { $set: { readAt: now } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: in-system admin notifications
router.get('/admin-notifications', protect, authorize('admin'), async (req, res) => {
  try {
    const notifications = await PartnerNotification.find({ type: 'notification', audience: 'admin' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, data: notifications });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Admin: push partner notices/notifications (supports Broadcast or Targeted Property / Partner)
router.post('/notifications', protect, authorize('admin'), async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const type = String(req.body?.type || 'notification').trim() === 'notice' ? 'notice' : 'notification';
    const targetType = String(req.body?.targetType || req.body?.audience || 'all').trim().toLowerCase();
    const priority = ['normal', 'high', 'critical'].includes(String(req.body?.priority || '').toLowerCase())
      ? String(req.body.priority).toLowerCase()
      : 'normal';

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    // Idempotency / deduplication check
    const idempotencyKey = String(req.body?.idempotencyKey || req.headers?.['idempotency-key'] || '').trim();
    if (idempotencyKey) {
      const existing = await PartnerNotification.findOne({ eventKey: idempotencyKey }).lean();
      if (existing) {
        return res.status(200).json({
          success: true,
          data: existing,
          idempotent: true,
          message: 'Notification already submitted (idempotent)',
        });
      }
    }

    let audience = 'all_partners';
    let partnerId = null;
    let recipientUserId = null;
    let hotelId = null;
    const metadata = {
      targetType,
      sentByAdminName: req.user?.name || 'Administrator',
      sentByAdminEmail: req.user?.email || '',
    };

    if (targetType === 'all' || targetType === 'all_partners') {
      audience = 'all_partners';
      metadata.targetDescription = 'All Registered Partners';
    } else if (targetType === 'property' || targetType === 'hotel' || targetType === 'dharamshala') {
      const rawPropertyId = String(req.body?.hotelId || req.body?.propertyId || '').trim();
      if (!rawPropertyId || !mongoose.Types.ObjectId.isValid(rawPropertyId)) {
        return res.status(400).json({ success: false, message: 'Valid property ID is required' });
      }

      const hotel = await Hotel.findById(rawPropertyId).lean();
      if (!hotel) {
        return res.status(404).json({ success: false, message: 'Selected property was not found' });
      }
      if (!hotel.partnerId) {
        return res.status(400).json({
          success: false,
          message: `The property "${hotel.name}" has no registered partner assigned.`,
        });
      }

      const partnerUser = await User.findById(hotel.partnerId).lean();
      if (!partnerUser) {
        return res.status(404).json({
          success: false,
          message: 'The partner account for this property was not found.',
        });
      }

      audience = 'partner';
      partnerId = partnerUser._id;
      recipientUserId = partnerUser._id;
      hotelId = hotel._id;
      metadata.targetDescription = `${hotel.name} (${hotel.propertyType || 'Property'})`;
      metadata.propertyName = hotel.name;
      metadata.propertyType = hotel.propertyType || 'hotel';
      metadata.propertyId = hotel.propertyId || '';
      metadata.partnerName = partnerUser.name;
      metadata.partnerEmail = partnerUser.email;
      metadata.partnerBusinessName = partnerUser.businessName || '';
    } else if (targetType === 'partner') {
      const rawPartnerId = String(req.body?.partnerId || req.body?.recipientUserId || '').trim();
      if (!rawPartnerId || !mongoose.Types.ObjectId.isValid(rawPartnerId)) {
        return res.status(400).json({ success: false, message: 'Valid partner ID is required' });
      }

      const partnerUser = await User.findOne({ _id: rawPartnerId, role: 'partner' }).lean();
      if (!partnerUser) {
        return res.status(404).json({ success: false, message: 'Partner account not found' });
      }

      audience = 'partner';
      partnerId = partnerUser._id;
      recipientUserId = partnerUser._id;
      metadata.targetDescription = partnerUser.businessName
        ? `${partnerUser.businessName} (${partnerUser.name})`
        : partnerUser.name;
      metadata.partnerName = partnerUser.name;
      metadata.partnerEmail = partnerUser.email;
      metadata.partnerBusinessName = partnerUser.businessName || '';
    } else {
      return res.status(400).json({ success: false, message: `Invalid recipient target type: ${targetType}` });
    }

    const item = await PartnerNotification.create({
      eventKey: idempotencyKey || undefined,
      title,
      message,
      type,
      audience,
      partnerId: partnerId || undefined,
      recipientUserId: recipientUserId || undefined,
      hotelId: hotelId || undefined,
      metadata,
      priority,
      entityType: 'notice',
      createdByUserId: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: item,
      message: audience === 'all_partners'
        ? (type === 'notice' ? 'Broadcast notice published to all partners' : 'Broadcast notification sent to all partners')
        : (type === 'notice' ? `Notice sent to ${metadata.targetDescription}` : `Notification sent to ${metadata.targetDescription}`),
    });
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await PartnerNotification.findOne({ eventKey: req.body?.idempotencyKey }).lean();
      if (existing) {
        return res.status(200).json({ success: true, data: existing, idempotent: true });
      }
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router._partnerListingSecurity = {
  stripPartnerListingProtectedFields,
  applyPartnerHotelDefaults,
};

module.exports = router;
