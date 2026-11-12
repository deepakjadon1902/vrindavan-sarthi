/**
 * VRINDAVAN SARTHI — FINANCIAL LEDGER & BREAKAGE ALLOCATION SERVICE
 * Phase 5.7.4: Financial Governance, Option B Breakage & Audit Integrity
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const FinancialLedgerEntry = require('../models/FinancialLedgerEntry');
const Booking = require('../models/Booking');

const generateEntryNumber = (prefix = 'FLE') => {
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${timestamp}-${randomHex}`;
};

/**
 * Records an immutable financial ledger entry.
 * Arithmetic is executed strictly in integer paise (1 INR = 100 paise) to prevent float leakage.
 */
const recordLedgerEntry = async ({
  bookingId,
  bookingCode = '',
  propertyId,
  partnerId,
  userId,
  eventType,
  direction,
  amountRupees,
  payoutStatus = 'not_applicable',
  settlementReference = '',
  idempotencyKey,
  actorId,
  actorRole = 'system',
  metadata = {},
}) => {
  const roundedRupees = Math.round(Number(amountRupees || 0));
  const amountPaise = Math.round(roundedRupees * 100);

  if (amountPaise < 0) {
    throw new Error(`Financial ledger entry amount cannot be negative. Received: ${amountRupees}`);
  }

  // Idempotency check: if an entry with this idempotency key exists, return it
  if (idempotencyKey) {
    const existing = await FinancialLedgerEntry.findOne({ idempotencyKey });
    if (existing) {
      return existing;
    }
  }

  try {
    const entry = await FinancialLedgerEntry.create({
      entryNumber: generateEntryNumber(),
      bookingId,
      bookingCode,
      propertyId,
      partnerId,
      userId,
      eventType,
      direction,
      amountPaise,
      amountRupees: roundedRupees,
      currency: 'INR',
      payoutStatus,
      settlementReference,
      idempotencyKey,
      actorId,
      actorRole,
      metadata,
    });
    return entry;
  } catch (err) {
    // If unique key collision occurred due to concurrent execution, return existing
    if (err.code === 11000 && idempotencyKey) {
      return await FinancialLedgerEntry.findOne({ idempotencyKey });
    }
    throw err;
  }
};

/**
 * Calculates Option B Cancellation Breakage Breakdown for a 30% advance booking.
 * 
 * Rules:
 * - Customer refund = 0 (advance deposit forfeited).
 * - Uncollected 70% desk balance excluded entirely.
 * - Platform retains standard 10% commission on the full eligible hotel tariff (capped by retained advance).
 * - The remaining retained advance is attributable to the hotel partner.
 * - No negative balance; partner entitlement can never exceed retained funds.
 */
const calculateOptionBBreakage = (arg) => {
  const booking = arg && arg.booking ? arg.booking : (arg || {});
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

  const convenienceFee = Math.max(
    0,
    Math.round(
      Number(
        booking.convenienceFeeAmount ||
        booking.convenienceFee ||
        booking.pricingBreakdown?.platformConvenienceFee ||
        0
      )
    )
  );
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

  // Platform commission cannot exceed actual room advance retained
  const platformBreakageCommission = Math.min(rawCommission, roomAdvancePortion);

  // Partner attributable breakage entitlement
  const partnerBreakageEntitlement = Math.max(0, roomAdvancePortion - platformBreakageCommission);

  // Total platform retained cash (commission + convenience fee)
  const platformBreakageRetained = platformBreakageCommission + convenienceFee;

  return {
    retainedOnlineAdvance: paidOnline,
    roomAdvancePortion,
    grossHotelTariff,
    convenienceFee,
    commissionPercent,
    rawCommission,
    platformCommissionAmount: platformBreakageCommission,
    partnerBreakageEntitlement,
    platformBreakageRetained,
  };
};

/**
 * Implements Option B Breakage Allocation on an advance_30 booking upon voluntary cancellation.
 * Idempotent: repeated calls return existing allocation without creating duplicate ledger entries.
 */
const allocateCancellationBreakageOptionB = async (arg = {}) => {
  let booking = arg.booking || (arg.paymentOption ? arg : null);
  if (!booking && (typeof arg === 'string' || mongoose.isValidObjectId(arg) || arg._id)) {
    const targetId = typeof arg === 'string' || mongoose.isValidObjectId(arg) ? arg : arg._id;
    booking = await Booking.findById(targetId);
  }
  const cancellationReason = arg.cancellationReason || 'Customer voluntary cancellation';
  const actor = arg.actor || null;

  // Option B applies exclusively to advance_30 commercial hotel bookings
  if (!booking || booking.paymentOption !== 'advance_30') {
    return null;
  }

  // Idempotency: if already allocated, return existing allocation
  if (booking.cancellationBreakage?.allocatedAt && booking.cancellationBreakage?.allocationStatus !== 'reversed') {
    return booking.cancellationBreakage;
  }

  const breakdown = calculateOptionBBreakage({ booking });
  const actorId = actor?._id || booking.userId;
  const actorRole = actor?.role || 'user';

  // Record Online Payment Received in ledger if not already recorded
  if (breakdown.retainedOnlineAdvance > 0) {
    await recordLedgerEntry({
      bookingId: booking._id,
      bookingCode: booking.bookingId,
      propertyId: booking.hotelId,
      partnerId: booking.partnerId,
      userId: booking.userId,
      eventType: 'ONLINE_PAYMENT_RECEIVED',
      direction: 'credit',
      amountRupees: breakdown.retainedOnlineAdvance,
      idempotencyKey: `pay-online:${booking._id}`,
      actorId,
      actorRole,
      metadata: { paymentProvider: booking.paymentProvider, paymentOption: booking.paymentOption },
    });
  }

  // Record Platform Breakage Commission
  if (breakdown.platformCommissionAmount > 0) {
    await recordLedgerEntry({
      bookingId: booking._id,
      bookingCode: booking.bookingId,
      propertyId: booking.hotelId,
      partnerId: booking.partnerId,
      userId: booking.userId,
      eventType: 'PLATFORM_BREAKAGE_COMMISSION',
      direction: 'credit',
      amountRupees: breakdown.platformCommissionAmount,
      idempotencyKey: `breakage-comm:${booking._id}`,
      actorId,
      actorRole,
      metadata: {
        commissionBasis: breakdown.grossHotelTariff,
        commissionRate: breakdown.commissionPercent,
        cancellationReason,
      },
    });
  }

  // Record Convenience Fee if applicable
  if (breakdown.convenienceFee > 0) {
    await recordLedgerEntry({
      bookingId: booking._id,
      bookingCode: booking.bookingId,
      propertyId: booking.hotelId,
      partnerId: booking.partnerId,
      userId: booking.userId,
      eventType: 'CONVENIENCE_FEE',
      direction: 'credit',
      amountRupees: breakdown.convenienceFee,
      idempotencyKey: `breakage-conv:${booking._id}`,
      actorId,
      actorRole,
      metadata: { feePercent: booking.convenienceFeePercent || 4.45 },
    });
  }

  // Record Partner Breakage Entitlement
  if (breakdown.partnerBreakageEntitlement > 0) {
    await recordLedgerEntry({
      bookingId: booking._id,
      bookingCode: booking.bookingId,
      propertyId: booking.hotelId,
      partnerId: booking.partnerId,
      userId: booking.userId,
      eventType: 'PARTNER_BREAKAGE_ENTITLEMENT',
      direction: 'credit',
      amountRupees: breakdown.partnerBreakageEntitlement,
      payoutStatus: 'pending',
      idempotencyKey: `breakage-partner:${booking._id}`,
      actorId,
      actorRole,
      metadata: {
        retainedOnlineAdvance: breakdown.retainedOnlineAdvance,
        platformCommissionDeducted: breakdown.platformCommissionAmount,
        payoutEligibility: 'bi_weekly_cycle_monday_wednesday',
        policyModel: 'OPTION_B',
      },
    });
  }

  // Store allocation snapshot on booking document
  booking.cancellationBreakage = {
    retainedOnlineAdvance: breakdown.retainedOnlineAdvance,
    roomAdvancePortion: breakdown.roomAdvancePortion,
    platformCommissionBasis: breakdown.grossHotelTariff,
    platformCommissionAmount: breakdown.platformCommissionAmount,
    partnerBreakageEntitlement: breakdown.partnerBreakageEntitlement,
    platformBreakageRetained: breakdown.platformBreakageRetained,
    allocatedAt: new Date(),
    allocationStatus: breakdown.partnerBreakageEntitlement > 0 ? 'pending_settlement' : 'not_applicable',
    settledAt: null,
    settledBy: null,
    settlementNote: '',
  };

  // Flag payout status specifically as pending breakage settlement so partner payout engine processes it
  if (breakdown.partnerBreakageEntitlement > 0) {
    booking.payout_status = 'pending_breakage_settlement';
  }

  return booking.cancellationBreakage;
};

/**
 * Reverses provisional Option B Breakage Allocation when fault is reclassified to hotel/platform fault.
 */
const reverseCancellationBreakage = async ({ booking, reason = 'Fault reclassified to hotel/platform failure', actor = null }) => {
  if (!booking.cancellationBreakage?.allocatedAt || booking.cancellationBreakage?.allocationStatus === 'reversed') {
    return null;
  }

  const previousPartnerEntitlement = Number(booking.cancellationBreakage.partnerBreakageEntitlement || 0);

  // If partner was previously credited with breakage, issue a REVERSAL debit ledger entry
  if (previousPartnerEntitlement > 0) {
    const revEntry = await recordLedgerEntry({
      bookingId: booking._id,
      bookingCode: booking.bookingId,
      propertyId: booking.hotelId,
      partnerId: booking.partnerId,
      userId: booking.userId,
      eventType: 'REVERSAL',
      direction: 'debit',
      amountRupees: previousPartnerEntitlement,
      idempotencyKey: `reversal-breakage:${booking._id}`,
      actorId: actor?._id,
      actorRole: actor?.role || 'admin',
      metadata: {
        reversedEventType: 'PARTNER_BREAKAGE_ENTITLEMENT',
        reversalReason: reason,
        previousPartnerEntitlement,
      },
    });

    if (revEntry) {
      await FinancialLedgerEntry.updateMany(
        { bookingId: booking._id, eventType: 'PARTNER_BREAKAGE_ENTITLEMENT' },
        { $set: { isReversed: true, reversalReferenceId: revEntry._id } }
      );
    }
  }

  booking.cancellationBreakage.allocationStatus = 'reversed';
  booking.cancellationBreakage.partnerBreakageEntitlement = 0;
  booking.cancellationBreakage.platformCommissionAmount = 0;
  booking.payout_status = 'cancelled';

  return booking.cancellationBreakage;
};

module.exports = {
  recordLedgerEntry,
  calculateOptionBBreakage,
  allocateCancellationBreakageOptionB,
  reverseCancellationBreakage,
};
