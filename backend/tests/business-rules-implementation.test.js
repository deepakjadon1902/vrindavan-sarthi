const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const {
  getScheduledCheckInDateTime,
  calculateHoursUntilCheckIn,
  calculateCancellationRefund,
  evaluateNoShowEligibility,
  calculateNoShowSettlement,
} = require('../utils/cancellationPolicy');
const { buildMoneyFields } = require('../utils/pricing');

test('Rule A: 100% Online Booking Cancellation - Exact Boundary Evaluation', async (t) => {
  // Test reference check-in: 2026-10-25 at 12:00 PM IST (UTC+05:30)
  // 12:00 PM IST on 2026-10-25 is 2026-10-25T06:30:00.000Z in UTC
  const booking = {
    checkIn: new Date('2026-10-25T00:00:00.000Z'),
    checkInTime: '12:00',
    paymentOption: 'full_100',
    amountPaidOnline: 10000,
    totalAmount: 10000,
    paymentStatus: 'paid',
  };

  const scheduled = getScheduledCheckInDateTime(booking);
  assert.equal(scheduled.toISOString(), '2026-10-25T06:30:00.000Z');

  await t.test('Cancellation > 48 hours before check-in returns 75% refund (25% deduction)', () => {
    // 50 hours before: 2026-10-23T04:30:00.000Z
    const cancelTime = new Date(scheduled.getTime() - 50 * 3600 * 1000);
    const result = calculateCancellationRefund({ booking, cancellationTime: cancelTime });

    assert.equal(result.policyTier, 'more_than_48h');
    assert.equal(result.refundPercent, 75);
    assert.equal(result.cancellationDeductionPercent, 25);
    assert.equal(result.refundableAmount, 7500);
    assert.equal(result.cancellationDeductionAmount, 2500);
    assert.equal(result.refundableAmount + result.cancellationDeductionAmount, 10000);
  });

  await t.test('Cancellation exactly 48.000 hours before check-in returns 50% refund (boundary rule: up to and including 48h)', () => {
    // Exactly 48.000 hours before
    const cancelTime = new Date(scheduled.getTime() - 48 * 3600 * 1000);
    const result = calculateCancellationRefund({ booking, cancellationTime: cancelTime });

    assert.equal(result.policyTier, 'between_24h_and_48h');
    assert.equal(result.refundPercent, 50);
    assert.equal(result.cancellationDeductionPercent, 50);
    assert.equal(result.refundableAmount, 5000);
    assert.equal(result.cancellationDeductionAmount, 5000);
  });

  await t.test('Cancellation slightly more than 48 hours (48.001h) returns 75% refund', () => {
    // 48 hours and 1 millisecond before
    const cancelTime = new Date(scheduled.getTime() - (48 * 3600 * 1000 + 1));
    const result = calculateCancellationRefund({ booking, cancellationTime: cancelTime });

    assert.equal(result.policyTier, 'more_than_48h');
    assert.equal(result.refundPercent, 75);
    assert.equal(result.refundableAmount, 7500);
  });

  await t.test('Cancellation between 24 and 48 hours (e.g. 36h) returns 50% refund', () => {
    const cancelTime = new Date(scheduled.getTime() - 36 * 3600 * 1000);
    const result = calculateCancellationRefund({ booking, cancellationTime: cancelTime });

    assert.equal(result.policyTier, 'between_24h_and_48h');
    assert.equal(result.refundPercent, 50);
    assert.equal(result.refundableAmount, 5000);
    assert.equal(result.cancellationDeductionAmount, 5000);
  });

  await t.test('Cancellation exactly 24.000 hours before check-in returns 50% refund (boundary rule: from 24 hours)', () => {
    // Exactly 24.000 hours before
    const cancelTime = new Date(scheduled.getTime() - 24 * 3600 * 1000);
    const result = calculateCancellationRefund({ booking, cancellationTime: cancelTime });

    assert.equal(result.policyTier, 'between_24h_and_48h');
    assert.equal(result.refundPercent, 50);
    assert.equal(result.cancellationDeductionPercent, 50);
    assert.equal(result.refundableAmount, 5000);
    assert.equal(result.cancellationDeductionAmount, 5000);
  });

  await t.test('Cancellation slightly less than 24 hours (23.999h) returns 0% refund (100% deduction)', () => {
    // 23 hours, 59 minutes, 59 seconds before
    const cancelTime = new Date(scheduled.getTime() - (24 * 3600 * 1000 - 1000));
    const result = calculateCancellationRefund({ booking, cancellationTime: cancelTime });

    assert.equal(result.policyTier, 'less_than_24h');
    assert.equal(result.refundPercent, 0);
    assert.equal(result.cancellationDeductionPercent, 100);
    assert.equal(result.refundableAmount, 0);
    assert.equal(result.cancellationDeductionAmount, 10000);
  });

  await t.test('Cancellation after scheduled check-in returns 0% refund', () => {
    const cancelTime = new Date(scheduled.getTime() + 2 * 3600 * 1000);
    const result = calculateCancellationRefund({ booking, cancellationTime: cancelTime });

    assert.equal(result.policyTier, 'less_than_24h');
    assert.equal(result.refundPercent, 0);
    assert.equal(result.refundableAmount, 0);
  });

  await t.test('Property or platform failure entitles customer to 100% full refund', () => {
    const cancelTime = new Date(scheduled.getTime() - 2 * 3600 * 1000); // 2h before check-in
    const result = calculateCancellationRefund({
      booking,
      cancellationTime: cancelTime,
      isPropertyOrPlatformFailure: true,
    });

    assert.equal(result.policyTier, 'platform_or_property_failure');
    assert.equal(result.refundPercent, 100);
    assert.equal(result.cancellationDeductionPercent, 0);
    assert.equal(result.refundableAmount, 10000);
    assert.equal(result.cancellationDeductionAmount, 0);
  });

  await t.test('30% Advance online booking customer cancellation is non-refundable (0% refund)', () => {
    const advanceBooking = {
      checkIn: new Date('2026-10-25T00:00:00.000Z'),
      checkInTime: '12:00',
      paymentOption: 'advance_30',
      amountPaidOnline: 3000,
      totalAmount: 10000,
      paymentStatus: 'paid',
    };
    // Even if cancelled 100 hours in advance
    const cancelTime = new Date(scheduled.getTime() - 100 * 3600 * 1000);
    const result = calculateCancellationRefund({
      booking: advanceBooking,
      cancellationTime: cancelTime,
      isPropertyOrPlatformFailure: false,
    });

    assert.equal(result.policyTier, 'advance_30_non_refundable');
    assert.equal(result.refundPercent, 0);
    assert.equal(result.refundableAmount, 0);
    assert.equal(result.cancellationDeductionAmount, 3000);
  });

  await t.test('Refund can never exceed actual captured online funds', () => {
    const partialPaidBooking = {
      checkIn: new Date('2026-10-25T00:00:00.000Z'),
      checkInTime: '12:00',
      paymentOption: 'full_100',
      amountPaidOnline: 4000, // Captured 4000 although total was 10000
      totalAmount: 10000,
    };
    const cancelTime = new Date(scheduled.getTime() - 60 * 3600 * 1000);
    const result = calculateCancellationRefund({
      booking: partialPaidBooking,
      cancellationTime: cancelTime,
    });

    assert.equal(result.refundableAmount, 3000); // 75% of 4000
    assert.equal(result.cancellationDeductionAmount, 1000);
    assert.ok(result.refundableAmount <= partialPaidBooking.amountPaidOnline);
  });
});

test('Rule B: 100% Online Prepaid No-Show - Grace Period & Settlement', async (t) => {
  const booking = {
    checkIn: new Date('2026-10-25T00:00:00.000Z'),
    checkInTime: '12:00',
    paymentOption: 'full_100',
    totalAmount: 10445,
    baseAmount: 9000,
    taxAmount: 1000,
    grossForHotel: 10000,
    platformCommissionPercent: 10,
    platformCommissionAmount: 900,
    paymentGatewayFeeAmount: 180,
    amountPaidOnline: 10445,
    paymentStatus: 'paid',
  };

  const scheduled = getScheduledCheckInDateTime(booking);

  await t.test('Grace period check blocks premature no-show marking (e.g. 3 hours after check-in)', () => {
    // 3 hours after check-in, default grace period is 6 hours
    const testTime = new Date(scheduled.getTime() + 3 * 3600 * 1000);
    const eligibility = evaluateNoShowEligibility({
      booking,
      currentTime: testTime,
      gracePeriodHours: 6,
    });

    assert.equal(eligibility.isGracePeriodActive, true, 'Grace period should still be active');
    assert.equal(eligibility.noShowDeadline.getTime(), scheduled.getTime() + 6 * 3600 * 1000);
  });

  await t.test('Grace period expiration permits no-show marking (e.g. 7 hours after check-in)', () => {
    // 7 hours after check-in (past 6h grace period)
    const testTime = new Date(scheduled.getTime() + 7 * 3600 * 1000);
    const eligibility = evaluateNoShowEligibility({
      booking,
      currentTime: testTime,
      gracePeriodHours: 6,
    });

    assert.equal(eligibility.isGracePeriodActive, false, 'Grace period should be expired');
  });

  await t.test('100% Online Prepaid no-show settlement entitles hotel to room tariff minus commission and absorbs gateway fee', () => {
    const settlement = calculateNoShowSettlement({ booking });

    assert.equal(settlement.refundableAmount, 0, 'Customer receives 0% refund');
    assert.equal(settlement.cancellationDeductionAmount, 10445, '100% online amount deducted');
    assert.equal(settlement.payout_status, 'checked_out', 'Hotel is eligible for payout');

    // Agreed tariff: grossForHotel (10000) - platformCommission (900) = 9100
    // Gateway fee (180) is NOT deducted from partner payout
    assert.equal(settlement.hotelNetPayout, 9100);
    assert.equal(settlement.grossForHotel - settlement.platformCommissionAmount, settlement.hotelNetPayout);
  });

  await t.test('No-show tracking fields are fully supported by Booking schema', () => {
    const doc = new Booking({
      bookingId: 'VVS-TEST-NOSHOW',
      userId: new mongoose.Types.ObjectId(),
      hotelId: new mongoose.Types.ObjectId(),
      checkIn: new Date('2026-10-25'),
      checkInTime: '12:00',
      bookingStatus: 'no_show',
      noShowMarkedAt: new Date(),
      noShowMarkedBy: new mongoose.Types.ObjectId(),
      noShowMarkedByName: 'Desk Manager',
      noShowMarkedByRole: 'partner',
      noShowReason: 'Guest flight cancelled, did not arrive',
      noShowGracePeriodHours: 6,
      noShowDisputed: true,
      noShowDisputeReason: 'I arrived at 7 PM but the reception was locked',
      noShowDisputedAt: new Date(),
      noShowDisputeReviewedByAdmin: false,
    });

    assert.equal(doc.bookingStatus, 'no_show');
    assert.equal(doc.noShowMarkedByName, 'Desk Manager');
    assert.equal(doc.noShowGracePeriodHours, 6);
    assert.equal(doc.noShowDisputed, true);
    assert.equal(doc.noShowDisputeReviewedByAdmin, false);
  });
});

test('Rule C: Hotel Balance Collection & Excess Discrepancy Safeguards', async (t) => {
  await t.test('For 100% online payment, payable-at-property balance is strictly 0', () => {
    const money = buildMoneyFields({
      subtotal: 5000,
      baseAmount: 5000,
      taxAmount: 600,
      paymentOption: 'full_100',
      commissionPercent: 10,
    });

    assert.equal(money.paymentOption, 'full_100');
    assert.equal(money.balanceAmount, 0);
    assert.equal(money.balance_at_property, 0);
    assert.equal(money.amountPayableAtProperty, 0);
  });

  await t.test('For 30% advance, balance is calculated server-side from total and advance paid', () => {
    const money = buildMoneyFields({
      subtotal: 10000,
      baseAmount: 10000,
      taxAmount: 1200,
      paymentOption: 'advance_30',
      commissionPercent: 10,
    });

    // subtotal = 10000, roomAmount = 10000, convenience fee (4.45%) = 445
    // totalAmount = 10000 + 445 = 10445
    // Advance 30%: round(10445 * 0.3) = 3134
    // Balance: 10445 - 3134 = 7311
    assert.equal(money.paymentOption, 'advance_30');
    assert.equal(money.totalAmount, 10445);
    assert.equal(money.advanceAmount, 3134);
    assert.equal(money.balanceAmount, 7311);
    assert.equal(money.amountPayableAtProperty, 7311);
    assert.equal(money.advanceAmount + money.balanceAmount, money.totalAmount);
  });

  await t.test('Excess balance collection records discrepancy without zeroing or silently discarding', () => {
    const expectedBalance = 5000;
    const collectedAmount = 6500; // Excess of 1500

    const booking = new Booking({
      bookingId: 'VVS-TEST-BALANCE',
      userId: new mongoose.Types.ObjectId(),
      hotelId: new mongoose.Types.ObjectId(),
      paymentOption: 'advance_30',
      totalAmount: 10000,
      amountPaidOnline: 5000,
      amountPaidToProperty: collectedAmount,
      balanceAmount: Math.max(0, expectedBalance - collectedAmount),
      amountPayableAtProperty: Math.max(0, expectedBalance - collectedAmount),
      collectionDiscrepancy: {
        detected: collectedAmount > expectedBalance,
        expectedAmount: expectedBalance,
        collectedAmount,
        excessAmount: collectedAmount - expectedBalance,
        detectedAt: new Date(),
        reportedToAdmin: true,
        notes: 'Excess collection of ₹1500 detected at check-in desk',
      },
      balanceCollections: [{
        collectedAt: new Date(),
        amount: collectedAmount,
        paymentMethod: 'cash',
        receiptNumber: 'REC-001',
        idempotencyKey: 'idemp-coll-001',
      }],
    });

    assert.equal(booking.amountPaidToProperty, 6500);
    assert.equal(booking.collectionDiscrepancy.detected, true);
    assert.equal(booking.collectionDiscrepancy.excessAmount, 1500);
    assert.equal(booking.balanceCollections.length, 1);
    assert.equal(booking.balanceCollections[0].idempotencyKey, 'idemp-coll-001');
  });
});
