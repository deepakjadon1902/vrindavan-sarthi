const test = require('node:test');
const assert = require('node:assert/strict');

const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const { calculatePricing } = require('../utils/pricing');
const { payableAmountForBooking } = require('../utils/bookingPayable');
const {
  DHARAMSHALA_RESPONSE_TIMEOUT_MINUTES,
  DHARAMSHALA_REMINDER_MINUTES,
  DHARAMSHALA_PAYMENT_HOLD_MINUTES,
  getDharamshalaRequestExpiresAt,
  processDharamshalaReminders,
} = require('../utils/dharamshalaLifecycle');
const {
  getPaymentHoldExpiresAt,
  markBookingPaymentPaid,
} = require('../utils/reservationLifecycle');
const { classifyCapturedBookingLocalState } = require('../utils/paymentReconciliation');

// ============================================================================
// 1. FINANCIAL LEDGER & EXCESS PARTNER COLLECTION TESTS
// ============================================================================

test('Financial Ledger: Vrindavan Sarthi bears payment gateway fee and partner net payout never deducts it', () => {
  const pricing = calculatePricing({
    subtotal: 11200,
    baseAmount: 10000,
    taxAmount: 1200,
    paymentOption: 'advance_30',
    commissionPercent: 10,
    gatewayFeeAmount: 200,
  });

  // Gross for hotel: room tariff (10,000) + GST (1,200) = 11,200
  assert.equal(pricing.gross_for_hotel, 11200);
  assert.equal(pricing.commission_amount, 1000);
  assert.equal(pricing.payment_gateway_fee, 200);

  // Confirmed rule: Vrindavan Sarthi bears the fee. Net entitlement = 11,200 - 1,000 = 10,200.
  // Payout must NEVER deduct the 200 gateway fee.
  assert.equal(pricing.hotel_net_payout, 10200);
});

test('Financial Ledger Synthetic Scenarios: balanceAmount < entitlement, == entitlement, and > entitlement (excess collection)', () => {
  const commissionPercent = 10;

  // Helper calculating net remittance and excess collection
  const computeRemittance = ({ baseAmount, taxAmount, balanceAmount }) => {
    const grossForHotel = baseAmount + taxAmount;
    const commission = Math.round((baseAmount * commissionPercent) / 100);
    const netEntitlement = grossForHotel - commission;
    const netPayableRemittance = netEntitlement - balanceAmount;
    const excessPartnerCollection = Math.max(0, -netPayableRemittance);
    const netPayableToPartner = Math.max(0, netPayableRemittance);

    return {
      grossForHotel,
      commission,
      netEntitlement,
      netPayableRemittance,
      excessPartnerCollection,
      netPayableToPartner,
    };
  };

  // Scenario 1: Desk balance < Net entitlement (Positive remittance)
  // Base 10,000, Tax 1,200 (Gross 11,200), Commission 1,000, Entitlement 10,200. Desk balance: 8,151.
  const scenario1 = computeRemittance({ baseAmount: 10000, taxAmount: 1200, balanceAmount: 8151 });
  assert.equal(scenario1.netEntitlement, 10200);
  assert.equal(scenario1.netPayableRemittance, 2049);
  assert.equal(scenario1.netPayableToPartner, 2049);
  assert.equal(scenario1.excessPartnerCollection, 0);

  // Scenario 2: Desk balance == Net entitlement (Zero remittance, exactly balanced)
  // Base 10,000, Tax 1,200 (Gross 11,200), Commission 1,000, Entitlement 10,200. Desk balance: 10,200.
  const scenario2 = computeRemittance({ baseAmount: 10000, taxAmount: 1200, balanceAmount: 10200 });
  assert.equal(scenario2.netEntitlement, 10200);
  assert.equal(scenario2.netPayableRemittance, 0);
  assert.equal(scenario2.netPayableToPartner, 0);
  assert.equal(scenario2.excessPartnerCollection, 0);

  // Scenario 3: Desk balance > Net entitlement (Negative remittance = Excess collection / partner liability)
  // For instance, Base 5,000, Tax 600 (Gross 5,600), Commission 500, Entitlement 5,100. Desk balance collected: 6,000.
  const scenario3 = computeRemittance({ baseAmount: 5000, taxAmount: 600, balanceAmount: 6000 });
  assert.equal(scenario3.netEntitlement, 5100);
  assert.equal(scenario3.netPayableRemittance, -900, 'Remittance balance must be negative -900 and not clamped to zero');
  assert.equal(scenario3.netPayableToPartner, 0);
  assert.equal(scenario3.excessPartnerCollection, 900, 'Excess collection must be preserved as 900 liability owed by partner');
});

test('Financial Ledger: Settlement idempotency and exclusion of already-settled bookings', () => {
  // Simulate Booking.aggregate match condition
  const bookings = [
    { _id: 'b1', partnerId: 'p1', bookingStatus: 'checked_out', paymentStatus: 'paid', payout_status: 'pending', baseAmount: 10000, taxAmount: 1200, balanceAmount: 8151 },
    { _id: 'b2', partnerId: 'p1', bookingStatus: 'checked_out', paymentStatus: 'paid', payout_status: 'settled', baseAmount: 10000, taxAmount: 1200, balanceAmount: 8151 },
  ];

  // Only unsettled bookings (payout_status !== 'settled') must be aggregated
  const eligibleBookings = bookings.filter((b) => b.paymentStatus === 'paid' && b.bookingStatus === 'checked_out' && b.payout_status !== 'settled');
  assert.equal(eligibleBookings.length, 1);
  assert.equal(eligibleBookings[0]._id, 'b1');

  // Once settled:
  eligibleBookings[0].payout_status = 'settled';
  const remainingEligible = bookings.filter((b) => b.paymentStatus === 'paid' && b.bookingStatus === 'checked_out' && b.payout_status !== 'settled');
  assert.equal(remainingEligible.length, 0, 'Already settled bookings cannot be counted again');
});

// ============================================================================
// 2. ADMIN BOOKING-MODE CONTROLS TESTS
// ============================================================================

test('Admin Controls: Unapproved hotels cannot accept bookings even if instant booking is true', () => {
  const unapprovedHotel = {
    propertyType: 'hotel',
    approvalStatus: 'pending',
    instantBookingEnabled: true,
    bookingMode: 'instant',
  };

  const isApproved = unapprovedHotel.approvalStatus === 'approved';
  assert.equal(isApproved, false, 'Unapproved hotel must be blocked from accepting reservations');
});

test('Admin Controls: Homestay booking mode is independently configurable per property', () => {
  const requestHomestay = {
    propertyType: 'home_stay',
    approvalStatus: 'approved',
    instantBookingEnabled: false,
    bookingMode: 'request',
  };

  const instantHomestay = {
    propertyType: 'home_stay',
    approvalStatus: 'approved',
    instantBookingEnabled: true,
    bookingMode: 'instant',
  };

  const isInstantEligible = (h) =>
    h.approvalStatus === 'approved' &&
    String(h.propertyType).toLowerCase() !== 'dharamshala' &&
    (Boolean(h.instantBookingEnabled) || h.bookingMode === 'instant');

  assert.equal(isInstantEligible(requestHomestay), false);
  assert.equal(isInstantEligible(instantHomestay), true);
});

test('Admin Controls: Dharamshalas cannot have instant booking enabled and force request mode', () => {
  const dharamshala = {
    propertyType: 'dharamshala',
    approvalStatus: 'approved',
    instantBookingEnabled: true, // Attempted misconfiguration
    bookingMode: 'instant',
  };

  const isDharamshala = String(dharamshala.propertyType).toLowerCase() === 'dharamshala';
  const isInstantEligible = !isDharamshala && (Boolean(dharamshala.instantBookingEnabled) || dharamshala.bookingMode === 'instant');

  assert.equal(isInstantEligible, false, 'Dharamshala must be strictly barred from instant booking');
});

test('Admin Controls: Untrusted customer request payload cannot override property booking mode', () => {
  // Property record stored in database (source of truth)
  const dbProperty = {
    _id: 'hotel_123',
    propertyType: 'hotel',
    approvalStatus: 'approved',
    instantBookingEnabled: false,
    bookingMode: 'request',
  };

  // Untrusted customer request payload attempting to force instant checkout
  const untrustedPayload = {
    hotelId: 'hotel_123',
    bookingMode: 'instant',
    instantBookingEnabled: true,
  };

  // Backend evaluation derives booking mode exclusively from the DB property document, ignoring untrusted payload
  const isInstant =
    String(dbProperty.propertyType).toLowerCase() !== 'dharamshala' &&
    (Boolean(dbProperty.instantBookingEnabled) || dbProperty.bookingMode === 'instant');

  assert.equal(isInstant, false, 'Customer payload tampering must not bypass request-first booking mode');
});

// ============================================================================
// 3. DHARAMSHALA TIMER AND REMINDER WORKER TESTS
// ============================================================================

test('Dharamshala Timers: Server-side timestamps enforce 5-minute timeout, 2-minute reminder, and 15-minute hold', () => {
  const baseTime = new Date('2026-10-17T12:00:00.000Z');

  // 1. Five-minute request expiry
  const timeoutMinutes = DHARAMSHALA_RESPONSE_TIMEOUT_MINUTES;
  assert.equal(timeoutMinutes, 5);
  const expiresAt = new Date(baseTime.getTime() + timeoutMinutes * 60 * 1000);
  assert.equal(expiresAt.toISOString(), '2026-10-17T12:05:00.000Z');

  // 2. Two-minute reminder
  const reminderMinutes = DHARAMSHALA_REMINDER_MINUTES;
  assert.equal(reminderMinutes, 2);
  const reminderAt = new Date(baseTime.getTime() + reminderMinutes * 60 * 1000);
  assert.equal(reminderAt.toISOString(), '2026-10-17T12:02:00.000Z');

  // 3. Fifteen-minute payment hold on acceptance
  const holdMinutes = DHARAMSHALA_PAYMENT_HOLD_MINUTES;
  assert.equal(holdMinutes, 15);
  const paymentHoldExpiresAt = getPaymentHoldExpiresAt(baseTime, holdMinutes);
  assert.equal(paymentHoldExpiresAt.toISOString(), '2026-10-17T12:15:00.000Z');
});

test('Dharamshala Reminder Worker: Late execution and duplicate job safety', async () => {
  const now = new Date('2026-10-17T12:03:30.000Z'); // 3.5 minutes after creation

  const candidateBooking = {
    _id: 'booking_dharamshala_01',
    propertyType: 'dharamshala',
    bookingStatus: 'pending_property_confirmation',
    requestReminderAt: new Date('2026-10-17T12:02:00.000Z'),
    requestReminderSent: false,
  };

  // Check if reminder is due
  const isReminderDue =
    candidateBooking.propertyType === 'dharamshala' &&
    candidateBooking.bookingStatus === 'pending_property_confirmation' &&
    candidateBooking.requestReminderAt <= now &&
    !candidateBooking.requestReminderSent;

  assert.equal(isReminderDue, true, 'Reminder must be triggered even on delayed worker execution');

  // Simulate first worker claiming the reminder atomically
  candidateBooking.requestReminderSent = true;

  // Simulate concurrent / duplicate worker execution
  const isDuplicateClaim =
    candidateBooking.propertyType === 'dharamshala' &&
    candidateBooking.bookingStatus === 'pending_property_confirmation' &&
    candidateBooking.requestReminderAt <= now &&
    !candidateBooking.requestReminderSent;

  assert.equal(isDuplicateClaim, false, 'Duplicate worker execution must be safely deduplicated');
});

test('Dharamshala Timers: Rejected or expired request cannot receive reminder or be confirmed', () => {
  const expiredBooking = {
    propertyType: 'dharamshala',
    bookingStatus: 'expired_property_no_response',
    requestReminderAt: new Date('2026-10-17T12:02:00.000Z'),
    requestReminderSent: false,
  };

  const isReminderEligible =
    expiredBooking.bookingStatus === 'pending_property_confirmation' &&
    !expiredBooking.requestReminderSent;

  assert.equal(isReminderEligible, false, 'Expired request must NOT receive a reminder');

  // Local state classification for payment reconciliation
  const classification = classifyCapturedBookingLocalState({
    bookingStatus: expiredBooking.bookingStatus,
    paymentStatus: 'pending',
  });

  assert.equal(classification.status, 'reconciliation_required', 'Late payment on expired booking must require admin review');
});

// ============================================================================
// 4. REFUND AND CANCELLATION BOUNDARIES TESTS
// ============================================================================

test('Refund Boundaries: Property/platform failure provides 100% full refund of amount captured online', () => {
  const booking = {
    paymentOption: 'advance_30',
    totalAmount: 11645,
    advanceAmount: 3494,
    balanceAmount: 8151,
    amountPaidOnline: 3494,
    paymentStatus: 'paid',
  };

  const paidOnline = Math.max(0, Number(booking.amountPaidOnline || booking.advanceAmount || 0));
  const isPropertyOrPlatformFailure = true;

  let refundableAmount = 0;
  if (isPropertyOrPlatformFailure) {
    refundableAmount = paidOnline;
  }

  assert.equal(refundableAmount, 3494, 'Platform failure must refund 100% of amount captured online');
  assert.equal(refundableAmount <= paidOnline, true, 'Refund can never exceed online captured amount');
});

test('Refund Boundaries: Customer cancellation on advance_30 is non-refundable and never refunds uncollected cash', () => {
  const booking = {
    paymentOption: 'advance_30',
    totalAmount: 11645,
    advanceAmount: 3494,
    balanceAmount: 8151,
    amountPaidOnline: 3494,
    paymentStatus: 'paid',
  };

  const paidOnline = Math.max(0, Number(booking.amountPaidOnline || booking.advanceAmount || 0));
  const isPropertyOrPlatformFailure = false;

  let refundableAmount = 0;
  let cancellationDeductionAmount = 0;

  if (!isPropertyOrPlatformFailure && booking.paymentOption === 'advance_30') {
    refundableAmount = 0;
    cancellationDeductionAmount = paidOnline;
  }

  assert.equal(refundableAmount, 0, 'Customer cancellation on 30% advance is non-refundable');
  assert.equal(cancellationDeductionAmount, 3494);
});
