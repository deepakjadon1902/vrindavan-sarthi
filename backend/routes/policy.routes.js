/**
 * VRINDAVAN SARTHI — BUSINESS POLICY CONFIGURATION ROUTES
 * Phase 5.7.2: Platform Default Policies, Custom Overrides, Dharamshala Service Fees & Snapshots
 */

const express = require('express');
const mongoose = require('mongoose');
const { protect, authorizeAdmin } = require('../middleware/auth');
const PlatformPolicy = require('../models/PlatformPolicy');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const { logAdminAction } = require('../utils/adminAuditLogger');
const {
  DEFAULT_PLATFORM_TIERS,
  validatePolicyTiers,
  getPlatformDefaultPolicy,
  resolveEffectiveHotelPolicy,
  calculateRefund,
} = require('../services/refundCalculationService');
const { getDharamshalaFeeApprovalDisplay } = require('../utils/dharamshalaLifecycle');

const router = express.Router();

// ============================================================================
// 1. PLATFORM DEFAULT CANCELLATION POLICY
// ============================================================================

// GET /api/policies/cancellation/platform-default
// Public / Authenticated read of current active platform default policy
router.get('/cancellation/platform-default', async (req, res) => {
  try {
    const policy = await getPlatformDefaultPolicy();
    res.json({ success: true, data: policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/policies/cancellation/platform-default
// Admin only: Update platform default cancellation policy
router.put(
  '/cancellation/platform-default',
  protect,
  authorizeAdmin('manage_properties'),
  async (req, res) => {
    try {
      const { tiers, reason, title, description } = req.body;
      const trimmedReason = String(reason || '').trim();

      if (!trimmedReason) {
        return res.status(400).json({
          success: false,
          message: 'A mandatory justification reason is required to update platform policies.',
        });
      }

      const validation = validatePolicyTiers(tiers);
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.message });
      }

      let policy = await PlatformPolicy.findOne({ policyKey: 'cancellation_default' });
      if (!policy) {
        policy = new PlatformPolicy({
          policyKey: 'cancellation_default',
          title: title || 'Platform Default Hotel Cancellation Policy',
          description: description || 'Standard OTA tiered cancellation policy',
          tiers: DEFAULT_PLATFORM_TIERS,
          version: 1,
          history: [],
        });
      }

      const beforeState = {
        version: policy.version,
        tiers: policy.tiers,
        title: policy.title,
      };

      const newVersion = (policy.version || 1) + 1;
      const historyEntry = {
        version: newVersion,
        tiers,
        updatedBy: req.user._id,
        updatedByName: req.user.name,
        reason: trimmedReason,
        updatedAt: new Date(),
      };

      policy.tiers = tiers;
      policy.version = newVersion;
      if (title) policy.title = title;
      if (description) policy.description = description;
      policy.updatedBy = req.user._id;
      policy.updatedByName = req.user.name;
      policy.history.push(historyEntry);

      await policy.save();

      await logAdminAction({
        actor: req.user,
        action: 'platform_policy_updated',
        targetEntityType: 'policy',
        targetEntityId: policy._id,
        beforeState,
        afterState: {
          version: policy.version,
          tiers: policy.tiers,
        },
        reason: trimmedReason,
        req,
      });

      res.json({
        success: true,
        message: 'Platform default cancellation policy updated successfully.',
        data: policy,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/policies/cancellation/history
// Read platform default policy version history
router.get(
  '/cancellation/history',
  protect,
  authorizeAdmin('view_reports'),
  async (req, res) => {
    try {
      const policy = await PlatformPolicy.findOne({ policyKey: 'cancellation_default' });
      res.json({ success: true, data: policy?.history || [] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// 2. PROPERTY-SPECIFIC HOTEL CANCELLATION POLICIES
// ============================================================================

// GET /api/policies/hotels/:hotelId
// Read effective policy for a hotel (indicates whether custom or platform default)
router.get('/hotels/:hotelId', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId)
      .select('name propertyId propertyType cancellationPolicyType customCancellationPolicy cancellationPolicyHistory dharamshalaServiceFee dharamshalaServiceFeeVersion')
      .lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

    const defaultPolicy = await getPlatformDefaultPolicy();
    const effective = resolveEffectiveHotelPolicy(hotel, defaultPolicy);

    res.json({
      success: true,
      data: {
        hotelId: hotel._id,
        hotelName: hotel.name,
        propertyType: hotel.propertyType,
        cancellationPolicyType: hotel.cancellationPolicyType || 'platform_default',
        effectivePolicy: effective,
        customCancellationPolicy: hotel.customCancellationPolicy || null,
        history: hotel.cancellationPolicyHistory || [],
        dharamshalaServiceFee: hotel.dharamshalaServiceFee ?? 79,
        dharamshalaServiceFeeVersion: hotel.dharamshalaServiceFeeVersion ?? 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/policies/hotels/:hotelId/cancellation
// Admin/Operations: Configure custom cancellation policy for a commercial hotel
router.put(
  '/hotels/:hotelId/cancellation',
  protect,
  authorizeAdmin('manage_properties'),
  async (req, res) => {
    try {
      const hotel = await Hotel.findById(req.params.hotelId);
      if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

      // Guard: Dharamshalas cannot have custom commercial cancellation policies
      if (hotel.propertyType === 'dharamshala') {
        return res.status(400).json({
          success: false,
          message: 'Dharamshala properties follow non-profit pilgrimage terms and cannot have commercial hotel cancellation tiers.',
        });
      }

      const { policyType, tiers, reason } = req.body;
      const trimmedReason = String(reason || '').trim();

      if (!trimmedReason) {
        return res.status(400).json({
          success: false,
          message: 'A mandatory justification reason is required to update hotel cancellation policies.',
        });
      }

      if (policyType !== 'platform_default' && policyType !== 'custom') {
        return res.status(400).json({
          success: false,
          message: 'policyType must be either "platform_default" or "custom".',
        });
      }

      const beforeState = {
        cancellationPolicyType: hotel.cancellationPolicyType,
        customCancellationPolicy: hotel.customCancellationPolicy,
      };

      if (policyType === 'custom') {
        const validation = validatePolicyTiers(tiers);
        if (!validation.valid) {
          return res.status(400).json({ success: false, message: validation.message });
        }

        const newVersion = (hotel.customCancellationPolicy?.version || 0) + 1;
        hotel.cancellationPolicyType = 'custom';
        hotel.customCancellationPolicy = {
          tiers,
          version: newVersion,
          updatedAt: new Date(),
          updatedBy: req.user._id,
          updatedByName: req.user.name,
          reason: trimmedReason,
        };

        hotel.cancellationPolicyHistory = hotel.cancellationPolicyHistory || [];
        hotel.cancellationPolicyHistory.push({
          version: newVersion,
          policyType: 'custom',
          tiers,
          updatedBy: req.user._id,
          updatedByName: req.user.name,
          reason: trimmedReason,
          updatedAt: new Date(),
        });
      } else {
        // Reset to platform default
        const newVersion = (hotel.customCancellationPolicy?.version || 0) + 1;
        hotel.cancellationPolicyType = 'platform_default';
        hotel.cancellationPolicyHistory = hotel.cancellationPolicyHistory || [];
        hotel.cancellationPolicyHistory.push({
          version: newVersion,
          policyType: 'platform_default',
          tiers: [],
          updatedBy: req.user._id,
          updatedByName: req.user.name,
          reason: trimmedReason,
          updatedAt: new Date(),
        });
      }

      await hotel.save();

      await logAdminAction({
        actor: req.user,
        action: 'hotel_cancellation_policy_updated',
        targetEntityType: 'hotel',
        targetEntityId: hotel._id,
        beforeState,
        afterState: {
          cancellationPolicyType: hotel.cancellationPolicyType,
          customCancellationPolicy: hotel.customCancellationPolicy,
        },
        reason: trimmedReason,
        req,
      });

      res.json({
        success: true,
        message: `Hotel cancellation policy set to ${hotel.cancellationPolicyType}.`,
        data: {
          hotelId: hotel._id,
          cancellationPolicyType: hotel.cancellationPolicyType,
          customCancellationPolicy: hotel.customCancellationPolicy,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PUT /api/policies/hotels/:hotelId/cancellation/reset-default
// Reset a hotel's cancellation policy to platform default for future reservations
router.put(
  '/hotels/:hotelId/cancellation/reset-default',
  protect,
  authorizeAdmin('manage_properties'),
  async (req, res) => {
    try {
      const hotel = await Hotel.findById(req.params.hotelId);
      if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });

      const reason = String(req.body?.reason || 'Reverted to platform default cancellation policy').trim();

      const beforeState = {
        cancellationPolicyType: hotel.cancellationPolicyType,
        customCancellationPolicy: hotel.customCancellationPolicy,
      };

      const newVersion = (hotel.customCancellationPolicy?.version || 0) + 1;
      hotel.cancellationPolicyType = 'platform_default';
      hotel.cancellationPolicyHistory = hotel.cancellationPolicyHistory || [];
      hotel.cancellationPolicyHistory.push({
        version: newVersion,
        policyType: 'platform_default',
        tiers: [],
        updatedBy: req.user._id,
        updatedByName: req.user.name,
        reason,
        updatedAt: new Date(),
      });

      await hotel.save();

      await logAdminAction({
        actor: req.user,
        action: 'hotel_cancellation_policy_reset_default',
        targetEntityType: 'hotel',
        targetEntityId: hotel._id,
        beforeState,
        afterState: {
          cancellationPolicyType: 'platform_default',
        },
        reason,
        req,
      });

      res.json({
        success: true,
        message: 'Hotel cancellation policy reverted to platform default for future bookings.',
        data: {
          hotelId: hotel._id,
          cancellationPolicyType: 'platform_default',
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// 3. DHARAMSHALA INDIVIDUAL SERVICE FEES
// ============================================================================

// PUT /api/policies/dharamshalas/:hotelId/fee
// Admin: Configure individual service fee for a Dharamshala
router.put(
  '/dharamshalas/:hotelId/fee',
  protect,
  authorizeAdmin('manage_properties'),
  async (req, res) => {
    try {
      const hotel = await Hotel.findById(req.params.hotelId);
      if (!hotel) return res.status(404).json({ success: false, message: 'Dharamshala not found' });
      if (hotel.propertyType !== 'dharamshala') {
        return res.status(400).json({
          success: false,
          message: 'The selected property is not a Dharamshala. Service fees apply only to Dharamshalas.',
        });
      }

      const fee = Number(req.body?.fee);
      const trimmedReason = String(req.body?.reason || '').trim();

      if (!trimmedReason) {
        return res.status(400).json({
          success: false,
          message: 'A mandatory justification reason is required to update Dharamshala service fee.',
        });
      }

      if (!Number.isFinite(fee) || fee < 0) {
        return res.status(400).json({
          success: false,
          message: 'Service fee must be a non-negative number (0 or greater).',
        });
      }

      const roundedFee = Math.round(fee);
      const beforeState = {
        dharamshalaServiceFee: hotel.dharamshalaServiceFee,
        dharamshalaServiceFeeVersion: hotel.dharamshalaServiceFeeVersion,
      };

      const newVersion = (hotel.dharamshalaServiceFeeVersion || 1) + 1;
      const approvalStatus = roundedFee === 0 ? 'explicitly_free' : 'approved';
      hotel.dharamshalaServiceFee = roundedFee;
      hotel.dharamshalaServiceFeeVersion = newVersion;
      hotel.dharamshalaFeeApprovalStatus = approvalStatus;
      hotel.dharamshalaFeeConfigured = true;
      hotel.dharamshalaFeeApprovedBy = req.user._id;
      hotel.dharamshalaFeeApprovedByName = req.user.name;
      hotel.dharamshalaFeeApprovedAt = new Date();
      hotel.dharamshalaFeeHistory = hotel.dharamshalaFeeHistory || [];
      hotel.dharamshalaFeeHistory.push({
        version: newVersion,
        fee: roundedFee,
        updatedBy: req.user._id,
        updatedByName: req.user.name,
        reason: trimmedReason,
        updatedAt: new Date(),
      });

      await hotel.save();

      await logAdminAction({
        actor: req.user,
        action: 'dharamshala_fee_updated',
        targetEntityType: 'hotel',
        targetEntityId: hotel._id,
        beforeState,
        afterState: {
          dharamshalaServiceFee: roundedFee,
          dharamshalaServiceFeeVersion: newVersion,
        },
        reason: trimmedReason,
        req,
      });

      res.json({
        success: true,
        message: `Dharamshala service fee updated to ₹${roundedFee}.`,
        data: {
          hotelId: hotel._id,
          dharamshalaServiceFee: roundedFee,
          dharamshalaServiceFeeVersion: newVersion,
          dharamshalaFeeApprovalStatus: approvalStatus,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// 4. REFUND CALCULATION PREVIEW & AUDIT LOGS
// ============================================================================

// POST /api/policies/preview-refund
// Previews refund calculation given a booking ID or booking attributes
router.post('/preview-refund', protect, async (req, res) => {
  try {
    const { bookingId, cancellationTime, responsibility } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }

    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Customer can only preview their own booking unless user is admin or partner
    if (req.user.role === 'user' && String(booking.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to inspect this reservation' });
    }

    const hotel = booking.hotelId ? await Hotel.findById(booking.hotelId).lean() : null;

    const preview = calculateRefund({
      booking,
      cancellationTime: cancellationTime ? new Date(cancellationTime) : new Date(),
      responsibility: req.user.role === 'admin' ? responsibility : 'customer_voluntary',
      hotel,
      requestedByRole: req.user.role,
    });

    res.json({ success: true, data: preview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/policies/audit-logs
// Audit trail of all policy and service fee modifications
router.get(
  '/audit-logs',
  protect,
  authorizeAdmin('view_audit_logs'),
  async (req, res) => {
    try {
      const logs = await AuditLog.find({
        action: {
          $in: [
            'platform_policy_updated',
            'hotel_cancellation_policy_updated',
            'hotel_cancellation_policy_reset_default',
            'dharamshala_fee_updated',
            'cancellation_fault_overridden',
          ],
        },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json({ success: true, data: logs });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ============================================================================
// 5. DHARAMSHALA INDIVIDUAL FEE AUDIT & FINANCIAL LEDGER (Phase 5.7.4)
// ============================================================================

const formatDharamshalaPolicyListItem = (d) => {
  const approvalDisplay = getDharamshalaFeeApprovalDisplay(d);
  const hasHistory = Array.isArray(d.dharamshalaFeeHistory) && d.dharamshalaFeeHistory.length > 0;
  return {
    _id: d._id,
    propertyId: d.propertyId || '-',
    name: d.name,
    location: d.location || '',
    partner: d.partnerId ? {
      _id: d.partnerId._id,
      name: d.partnerId.businessName || d.partnerId.name,
      email: d.partnerId.email,
    } : null,
    dharamshalaServiceFee: d.dharamshalaServiceFee ?? 79,
    dharamshalaServiceFeeVersion: d.dharamshalaServiceFeeVersion || 1,
    dharamshalaFeeConfigured: Boolean(d.dharamshalaFeeConfigured),
    dharamshalaFeeApprovalStatus: approvalDisplay.status,
    feeApprovalStatus: approvalDisplay.status,
    feeApprovalLabel: approvalDisplay.label,
    isValidForBooking: approvalDisplay.isValidForBooking,
    feeHistory: d.dharamshalaFeeHistory || [],
    approvedAt: approvalDisplay.isValidForBooking
      ? (d.dharamshalaFeeApprovedAt || (hasHistory ? d.dharamshalaFeeHistory[d.dharamshalaFeeHistory.length - 1].updatedAt : null))
      : null,
    approvedByName: approvalDisplay.isValidForBooking
      ? (d.dharamshalaFeeApprovedByName || (hasHistory ? d.dharamshalaFeeHistory[d.dharamshalaFeeHistory.length - 1].updatedByName : ''))
      : '',
    status: d.status,
  };
};

// GET /api/policies/dharamshalas
// Admin: list all Dharamshala properties with individual fee review & approval status
router.get('/dharamshalas', protect, authorizeAdmin('manage_properties'), async (req, res) => {
  try {
    const dharams = await Hotel.find({ propertyType: 'dharamshala' })
      .populate('partnerId', 'name email phone businessName')
      .sort({ createdAt: -1 })
      .lean();

    const data = dharams.map(formatDharamshalaPolicyListItem);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/policies/ledger
// Admin: query immutable financial ledger entries with filters
router.get('/ledger', protect, authorizeAdmin('manage_refunds'), async (req, res) => {
  try {
    const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
    const { partnerId, bookingCode, eventType, payoutStatus, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (partnerId) filter.partnerId = partnerId;
    if (bookingCode) filter.bookingCode = bookingCode;
    if (eventType) filter.eventType = eventType;
    if (payoutStatus) filter.payoutStatus = payoutStatus;

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [entries, total] = await Promise.all([
      FinancialLedgerEntry.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      FinancialLedgerEntry.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.max(1, Math.ceil(total / parseInt(limit, 10))),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router._formatDharamshalaPolicyListItem = formatDharamshalaPolicyListItem;

module.exports = router;
