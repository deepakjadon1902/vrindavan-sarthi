/**
 * VRINDAVAN SARTHI — AUTHORITATIVE REFUND CALCULATION SERVICE
 * Phase 5.7.2: Business Policy Configuration & Snapshot Architecture
 * 
 * Rules:
 * 1. Single authoritative financial calculation engine across backend.
 * 2. Immutable policy snapshots used for confirmed bookings.
 * 3. 30% advance voluntary cancellation: 0% refund (advance deposit non-refundable).
 * 4. Hotel / Platform failure: 100% online amount paid (never includes uncollected desk balance).
 * 5. Full payment tiered policy (Platform default: >48h 75%, 24h-48h 50%, <24h 0%).
 * 6. Custom hotel policy overrides default ONLY for full-payment bookings of that hotel.
 * 7. Integer currency math (paise) avoids float precision leakage.
 */

const PlatformPolicy = require('../models/PlatformPolicy');
const { getScheduledCheckInDateTime, calculateHoursUntilCheckIn } = require('../utils/cancellationPolicy');

const DEFAULT_PLATFORM_TIERS = [
  { hoursBeforeCheckIn: 48, refundPercent: 75, description: 'More than 48 hours before check-in' },
  { hoursBeforeCheckIn: 24, refundPercent: 50, description: '24 hours to 48 hours before check-in (inclusive)' },
  { hoursBeforeCheckIn: 0, refundPercent: 0, description: 'Less than 24 hours before check-in' },
];

/**
 * Validates cancellation policy tiers.
 * Tiers must be non-empty, strictly descending by hoursBeforeCheckIn,
 * have valid refund percentages (0-100), and end at 0 hours.
 */
const validatePolicyTiers = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { valid: false, message: 'Policy tiers must be a non-empty array' };
  }

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const hours = Number(tier.hoursBeforeCheckIn);
    const percent = Number(tier.refundPercent);

    if (!Number.isFinite(hours) || hours < 0) {
      return { valid: false, message: `Tier ${i + 1} has invalid hoursBeforeCheckIn: ${tier.hoursBeforeCheckIn}` };
    }
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      return { valid: false, message: `Tier ${i + 1} has invalid refundPercent: ${tier.refundPercent}. Must be between 0 and 100.` };
    }

    if (i > 0) {
      const prevHours = Number(tiers[i - 1].hoursBeforeCheckIn);
      if (hours >= prevHours) {
        return {
          valid: false,
          message: `Tier hours must be strictly descending. Tier ${i + 1} (${hours}h) must be strictly less than Tier ${i} (${prevHours}h).`,
        };
      }
    }
  }

  const lastTier = tiers[tiers.length - 1];
  if (Number(lastTier.hoursBeforeCheckIn) !== 0) {
    return { valid: false, message: 'Final tier must terminate at 0 hours before check-in' };
  }

  return { valid: true };
};

/**
 * Retrieves the active platform default cancellation policy, seeding if missing.
 */
const getPlatformDefaultPolicy = async () => {
  try {
    let policy = await PlatformPolicy.findOne({ policyKey: 'cancellation_default', isActive: true });
    if (!policy) {
      policy = await PlatformPolicy.create({
        policyKey: 'cancellation_default',
        title: 'Platform Default Hotel Cancellation Policy',
        description: 'Standard OTA tiered cancellation policy for commercial hotels (>48h: 75%, 24h-48h: 50%, <24h: 0%)',
        tiers: DEFAULT_PLATFORM_TIERS,
        version: 1,
        history: [{
          version: 1,
          tiers: DEFAULT_PLATFORM_TIERS,
          reason: 'Initial platform default policy seed',
          updatedAt: new Date(),
        }],
      });
    }
    return policy;
  } catch (err) {
    return {
      policyKey: 'cancellation_default',
      title: 'Platform Default Hotel Cancellation Policy',
      tiers: DEFAULT_PLATFORM_TIERS,
      version: 1,
    };
  }
};

/**
 * Resolves the effective policy for a hotel (platform default vs custom).
 */
const resolveEffectiveHotelPolicy = (hotel, defaultPolicy) => {
  if (
    hotel?.cancellationPolicyType === 'custom' &&
    Array.isArray(hotel.customCancellationPolicy?.tiers) &&
    hotel.customCancellationPolicy.tiers.length > 0
  ) {
    return {
      policyType: 'custom',
      isCustom: true,
      tiers: hotel.customCancellationPolicy.tiers,
      version: hotel.customCancellationPolicy.version || 1,
      policyName: `${hotel.name || 'Property'} Custom Policy`,
      disclaimer: `Custom hotel cancellation terms apply as configured for ${hotel.name || 'this property'}.`,
    };
  }

  const tiers = defaultPolicy?.tiers || DEFAULT_PLATFORM_TIERS;
  const version = defaultPolicy?.version || 1;
  return {
    policyType: 'platform_default',
    isCustom: false,
    tiers,
    version,
    policyName: 'Platform Default Policy',
    disclaimer: 'Standard Vrindavan Sarthi platform cancellation policy applies.',
  };
};

/**
 * Creates an immutable policy snapshot for a new booking.
 */
const createBookingPolicySnapshot = async (hotel, paymentOption) => {
  if (paymentOption === 'advance_30') {
    return {
      policyType: 'advance_30_special',
      policyVersion: 1,
      isCustom: false,
      policyName: '30% Advance Booking Policy',
      tiers: [{
        hoursBeforeCheckIn: 0,
        refundPercent: 0,
        description: 'Voluntary cancellation of 30% advance is non-refundable (0% refund). 100% refund for hotel/platform failure.',
      }],
      disclaimer: '30% advance payment is non-refundable upon customer voluntary cancellation. 100% online refund is issued if the hotel or platform fails to fulfill accommodation.',
      capturedAt: new Date(),
    };
  }

  const isDharamshala = String(hotel?.propertyType || '').trim().toLowerCase() === 'dharamshala';
  if (isDharamshala) {
    return {
      policyType: 'dharamshala_standard',
      policyVersion: 1,
      isCustom: false,
      policyName: 'Dharamshala Booking Policy',
      tiers: [{
        hoursBeforeCheckIn: 0,
        refundPercent: 0,
        description: 'Dharamshala booking cancellation as per property and platform terms.',
      }],
      disclaimer: 'Dharamshala platform service fee is subject to platform booking policies.',
      capturedAt: new Date(),
    };
  }

  const defaultPolicy = await getPlatformDefaultPolicy();
  const effective = resolveEffectiveHotelPolicy(hotel, defaultPolicy);
  return {
    policyType: effective.policyType,
    policyVersion: effective.version,
    isCustom: effective.isCustom,
    policyName: effective.policyName,
    tiers: effective.tiers,
    disclaimer: effective.disclaimer,
    capturedAt: new Date(),
  };
};

/**
 * Creates an immutable Dharamshala service fee snapshot for a new booking.
 */
const createDharamshalaFeeSnapshot = (hotel) => {
  const isDharamshala = String(hotel?.propertyType || '').trim().toLowerCase() === 'dharamshala';
  const fee = isDharamshala && hotel?.dharamshalaPlatformFeeEnabled === false
    ? 0
    : isDharamshala && Number.isFinite(Number(hotel?.dharamshalaServiceFee))
      ? Math.max(0, Math.round(Number(hotel.dharamshalaServiceFee)))
      : 0;
  const version = Number(hotel?.dharamshalaServiceFeeVersion || 1);
  const approvalStatus = String(hotel?.dharamshalaFeeApprovalStatus || '').trim() || 'unconfigured';

  return {
    fee,
    version,
    applied: isDharamshala,
    approvalStatus,
    capturedAt: new Date(),
  };
};

/**
 * Authoritative single refund calculation function.
 */
const calculateRefund = ({
  booking,
  cancellationTime = new Date(),
  responsibility = 'customer_voluntary',
  hotel = null,
  requestedByRole = 'user',
}) => {
  const paidOnline = Math.max(
    0,
    Math.round(
      Number(
        booking.amountPaidOnline ||
        booking.advanceAmount ||
        (booking.paymentStatus === 'paid' ? booking.totalAmount : 0)
      )
    )
  );

  const deskBalance = Math.max(0, Math.round(Number(booking.amountPayableAtProperty || 0)));

  // Role Security Gate: Customers CANNOT self-certify hotel or platform fault
  let effectiveResponsibility = 'customer_voluntary';
  if (requestedByRole === 'admin' || requestedByRole === 'partner') {
    const validRoles = ['customer_voluntary', 'hotel_fault', 'platform_fault', 'system_technical', 'administrative'];
    effectiveResponsibility = validRoles.includes(responsibility) ? responsibility : 'customer_voluntary';
  }

  const isHotelOrPlatformFailure = ['hotel_fault', 'platform_fault', 'system_technical'].includes(effectiveResponsibility);

  const { scheduledCheckIn, cancellationTime: cancelDate, hours } = calculateHoursUntilCheckIn({
    booking,
    cancellationTime,
    hotel,
  });

  let refundPercent = 0;
  let policyTier = 'less_than_24h';
  let explanation = '';
  let policyType = booking.cancellationPolicySnapshot?.policyType || (booking.paymentOption === 'advance_30' ? 'advance_30_special' : 'platform_default');
  let isCustomPolicy = Boolean(booking.cancellationPolicySnapshot?.isCustom);
  let policyVersion = booking.cancellationPolicySnapshot?.policyVersion || 1;

  if (isHotelOrPlatformFailure) {
    // 100% refund of actual online amount paid
    refundPercent = 100;
    policyTier = 'platform_or_hotel_failure';
    explanation = '100% full online refund due to hotel or platform unfulfillment';
  } else if (booking.paymentOption === 'advance_30' || policyType === 'advance_30_special') {
    // Customer voluntary cancellation of 30% advance is non-refundable
    refundPercent = 0;
    policyTier = 'advance_30_non_refundable';
    explanation = '30% advance deposit is non-refundable upon customer voluntary cancellation';
  } else {
    // Commercial hotel full online payment: evaluate against snapshot tiers (or fallback tiers)
    const tiers = Array.isArray(booking.cancellationPolicySnapshot?.tiers) && booking.cancellationPolicySnapshot.tiers.length > 0
      ? booking.cancellationPolicySnapshot.tiers
      : (Array.isArray(hotel?.customCancellationPolicy?.tiers) && hotel.cancellationPolicyType === 'custom'
          ? hotel.customCancellationPolicy.tiers
          : DEFAULT_PLATFORM_TIERS);

    // If tiers match the canonical 48h / 24h / 0h structure, apply exact boundary semantics:
    // hours > 48 => 75%
    // 24 <= hours <= 48 => 50% (inclusive)
    // hours < 24 => 0%
    const isCanonicalStructure = tiers.length === 3 &&
      Number(tiers[0].hoursBeforeCheckIn) === 48 &&
      Number(tiers[1].hoursBeforeCheckIn) === 24 &&
      Number(tiers[2].hoursBeforeCheckIn) === 0;

    if (isCanonicalStructure) {
      if (hours > 48) {
        refundPercent = Number(tiers[0].refundPercent);
        policyTier = 'more_than_48h';
        explanation = `${refundPercent}% refund: cancelled > 48 hours prior to check-in`;
      } else if (hours >= 24 && hours <= 48) {
        refundPercent = Number(tiers[1].refundPercent);
        policyTier = 'between_24h_and_48h';
        explanation = `${refundPercent}% refund: cancelled between 24 and 48 hours prior to check-in (inclusive)`;
      } else {
        refundPercent = Number(tiers[2].refundPercent);
        policyTier = 'less_than_24h';
        explanation = `${refundPercent}% refund: cancelled < 24 hours prior to check-in`;
      }
    } else {
      // General custom tiers evaluation: sorted descending by hoursBeforeCheckIn
      const sortedTiers = [...tiers].sort((a, b) => Number(b.hoursBeforeCheckIn) - Number(a.hoursBeforeCheckIn));
      let matched = false;

      for (let i = 0; i < sortedTiers.length; i++) {
        const tier = sortedTiers[i];
        const tierHours = Number(tier.hoursBeforeCheckIn);

        // For non-bottom tiers: check if hours > tierHours (or hours >= tierHours for boundary tier)
        if (i < sortedTiers.length - 1) {
          const nextTierHours = Number(sortedTiers[i + 1].hoursBeforeCheckIn);
          if (hours > tierHours) {
            refundPercent = Number(tier.refundPercent);
            policyTier = `tier_gt_${tierHours}h`;
            explanation = `${refundPercent}% refund: cancelled > ${tierHours} hours prior to check-in`;
            matched = true;
            break;
          } else if (hours >= nextTierHours && hours <= tierHours) {
            refundPercent = Number(sortedTiers[i + 1].refundPercent);
            policyTier = `tier_${nextTierHours}h_to_${tierHours}h`;
            explanation = `${refundPercent}% refund: cancelled between ${nextTierHours}h and ${tierHours}h prior to check-in`;
            matched = true;
            break;
          }
        } else {
          // Bottom tier
          refundPercent = Number(tier.refundPercent);
          policyTier = `tier_lt_${tierHours}h`;
          explanation = `${refundPercent}% refund: cancelled < ${sortedTiers[0].hoursBeforeCheckIn} hours prior to check-in`;
          matched = true;
        }
      }

      if (!matched) {
        refundPercent = 0;
        policyTier = 'default_no_refund';
        explanation = '0% refund under property custom policy';
      }
    }
  }

  // Integer paise arithmetic
  const paidOnlinePaise = Math.round(paidOnline * 100);
  const rawRefundablePaise = Math.round((paidOnlinePaise * refundPercent) / 100);
  const refundableAmount = Math.max(0, Math.min(paidOnline, Math.round(rawRefundablePaise / 100)));
  const cancellationDeductionAmount = Math.max(0, paidOnline - refundableAmount);
  const cancellationDeductionPercent = 100 - refundPercent;

  // Option B Breakage Breakdown (for voluntary advance_30 cancellations)
  let breakage = null;
  if (!isHotelOrPlatformFailure && (booking.paymentOption === 'advance_30' || policyType === 'advance_30_special')) {
    const convenienceFee = Math.max(0, Math.round(Number(booking.convenienceFeeAmount || 0)));
    const roomAdvancePortion = Math.max(0, paidOnline - convenienceFee);
    const grossHotelTariff = Math.max(
      0,
      Math.round(
        Number(
          booking.grossForHotel ||
          (Number(booking.baseAmount || 0) + Number(booking.taxAmount || 0)) ||
          booking.totalAmount ||
          0
        )
      )
    );
    const commissionPercent = Number(booking.platformCommissionPercent || 10);
    const rawCommission = Math.round(
      Number(
        booking.platformCommissionAmount ||
        (grossHotelTariff * commissionPercent) / 100
      )
    );
    const platformCommissionAmount = Math.min(rawCommission, roomAdvancePortion);
    const partnerBreakageEntitlement = Math.max(0, roomAdvancePortion - platformCommissionAmount);
    const platformBreakageRetained = platformCommissionAmount + convenienceFee;

    breakage = {
      retainedOnlineAdvance: paidOnline,
      roomAdvancePortion,
      grossHotelTariff,
      convenienceFee,
      commissionPercent,
      platformCommissionAmount,
      partnerBreakageEntitlement,
      platformBreakageRetained,
    };
  }

  return {
    paidOnline,
    refundableAmount,
    cancellationDeductionAmount,
    cancellationDeductionPercent,
    refundPercent,
    policyTier,
    policyType,
    isCustomPolicy,
    policyVersion,
    cancellationResponsibility: effectiveResponsibility,
    hoursBeforeCheckIn: hours,
    scheduledCheckIn,
    cancellationTime: cancelDate,
    deskBalanceExcluded: deskBalance,
    explanation,
    breakage,
  };
};

module.exports = {
  DEFAULT_PLATFORM_TIERS,
  validatePolicyTiers,
  getPlatformDefaultPolicy,
  resolveEffectiveHotelPolicy,
  createBookingPolicySnapshot,
  createDharamshalaFeeSnapshot,
  calculateRefund,
};
