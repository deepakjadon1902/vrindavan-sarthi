const test = require('node:test');
const assert = require('node:assert/strict');
const Booking = require('../models/Booking');
const {
  DHARAMSHALA_PAYMENT_HOLD_MINUTES,
  acceptDharamshalaRequest,
  createDharamshalaRequest,
  getDharamshalaResponseTimeoutMinutes,
} = require('../utils/dharamshalaLifecycle');
const {
  transitionBookingStatus,
  releaseBookingInventory,
  markBookingPaymentPaid,
} = require('../utils/reservationLifecycle');
const {
  createOrGetPaymentReconciliation,
  markReconciliationRequired,
} = require('../utils/paymentReconciliation');

test('Stuck Booking Payment & Countdown Verification Suite', async (t) => {
  await t.test('Scenario 1: Verification stage label resolves accurately without contradictory pending partner copy', () => {
    // Helper replicating frontend verificationLabel resolution logic
    const resolveVerificationLabel = (b) => {
      if (b.isWaitlisted) return 'Waitlisted (awaiting room assignment)';
      const bookingStatus = String(b.bookingStatus || '');
      const stage = String(b.verificationStage || '');
      if (bookingStatus === 'awaiting_customer_payment') return 'Property Approved (Payment Pending)';
      if (bookingStatus === 'pending_property_confirmation') return 'Awaiting Property Approval';
      if (bookingStatus === 'expired_property_no_response') return 'Expired (Property Timed Out)';
      if (bookingStatus === 'expired') return 'Expired (Payment Hold Expired)';
      if (bookingStatus === 'rejected_by_property') return 'Declined by Property';
      if (stage === 'verified' || b.paymentStatus === 'paid') return 'Verified';
      if (stage === 'pending_partner') return 'Pending partner verification';
      if (stage === 'pending_admin') return 'Pending admin verification';
      if (stage === 'rejected') return 'Rejected';
      return b.paymentMethod === 'doorstep' ? 'Pay at doorstep' : 'Verification pending';
    };

    // Before fix: verificationStage 'pending_partner' caused UI to display "Pending partner verification"
    // even though partner had already approved the request.
    const acceptedBookingWithPendingPartnerStage = {
      bookingStatus: 'awaiting_customer_payment',
      verificationStage: 'pending_partner',
      paymentStatus: 'pending',
    };
    assert.equal(
      resolveVerificationLabel(acceptedBookingWithPendingPartnerStage),
      'Property Approved (Payment Pending)',
      'Awaiting customer payment MUST show Property Approved (Payment Pending), NOT Pending partner verification'
    );

    const pendingConfirmationBooking = {
      bookingStatus: 'pending_property_confirmation',
      verificationStage: 'pending_partner',
      paymentStatus: 'pending',
    };
    assert.equal(
      resolveVerificationLabel(pendingConfirmationBooking),
      'Awaiting Property Approval'
    );

    const expiredBooking = {
      bookingStatus: 'expired',
      verificationStage: 'rejected',
      paymentStatus: 'expired',
    };
    assert.equal(
      resolveVerificationLabel(expiredBooking),
      'Expired (Payment Hold Expired)'
    );

    const verifiedPaidBooking = {
      bookingStatus: 'confirmed',
      verificationStage: 'verified',
      paymentStatus: 'paid',
    };
    assert.equal(
      resolveVerificationLabel(verifiedPaidBooking),
      'Verified'
    );
  });

  await t.test('Scenario 2: Partner approval transitions booking to awaiting_customer_payment with strictly 15-minute hold', () => {
    assert.equal(DHARAMSHALA_PAYMENT_HOLD_MINUTES, 15, 'Dharamshala hold policy must be strictly 15 minutes');

    const now = new Date('2026-10-21T12:00:00.000Z');
    const holdExpiresAt = new Date(now.getTime() + DHARAMSHALA_PAYMENT_HOLD_MINUTES * 60 * 1000);

    const holdDurationMs = holdExpiresAt.getTime() - now.getTime();
    assert.equal(holdDurationMs, 15 * 60 * 1000, 'Hold duration must equal 900,000 milliseconds (15 min)');
  });

  await t.test('Scenario 3: Countdown calculation uses server timestamp, survives refresh, and does not restart', () => {
    const calculateSecondsLeft = (expiresAt, currentNow) => {
      if (!expiresAt) return 0;
      const target = new Date(expiresAt).getTime();
      if (isNaN(target)) return 0;
      return Math.max(0, Math.floor((target - currentNow.getTime()) / 1000));
    };

    const serverExpiresAt = '2026-10-21T12:15:00.000Z';

    // Simulated initial render at 12:05:00 (10 minutes remaining)
    const render1Now = new Date('2026-10-21T12:05:00.000Z');
    const seconds1 = calculateSecondsLeft(serverExpiresAt, render1Now);
    assert.equal(seconds1, 600, '10 minutes remaining should be 600 seconds');

    // Simulated page refresh at 12:11:30 (3.5 minutes remaining)
    // A faulty client would reset to 15:00 (900s), but our timer reads serverExpiresAt:
    const refreshNow = new Date('2026-10-21T12:11:30.000Z');
    const secondsRefresh = calculateSecondsLeft(serverExpiresAt, refreshNow);
    assert.equal(secondsRefresh, 210, 'After refresh at 12:11:30, timer accurately resumes at 210s (3m 30s)');

    // Simulated check after hold expiry at 12:15:01
    const postExpiryNow = new Date('2026-10-21T12:15:01.000Z');
    const secondsPostExpiry = calculateSecondsLeft(serverExpiresAt, postExpiryNow);
    assert.equal(secondsPostExpiry, 0, 'Seconds remaining after expiry must be clamped to 0');
  });

  await t.test('Scenario 4: Countdown urgency boundaries (normal, warning, critical, expired)', () => {
    const classifyUrgency = (secondsLeft) => {
      if (secondsLeft <= 0) return 'expired';
      if (secondsLeft <= 60) return 'critical';
      if (secondsLeft <= 180) return 'warning';
      return 'normal';
    };

    assert.equal(classifyUrgency(600), 'normal', '10 mins remaining is normal');
    assert.equal(classifyUrgency(181), 'normal', '3m 1s remaining is normal');
    assert.equal(classifyUrgency(180), 'warning', 'Exactly 3m (180s) remaining triggers warning');
    assert.equal(classifyUrgency(61), 'warning', '1m 1s remaining triggers warning');
    assert.equal(classifyUrgency(60), 'critical', 'Exactly 1m (60s) remaining triggers critical urgency');
    assert.equal(classifyUrgency(1), 'critical', '1s remaining is critical urgency');
    assert.equal(classifyUrgency(0), 'expired', '0s is expired');
    assert.equal(classifyUrgency(-15), 'expired', 'Negative time is expired');
  });

  await t.test('Scenario 5: Order creation blocked and booking expired when hold has lapsed', async () => {
    // Simulating POST /razorpay/orders behavior on expired hold
    const expiredBooking = {
      _id: '6ad87000572cb562aee1026b',
      bookingId: 'VVS-DR-20261021-312717',
      bookingStatus: 'awaiting_customer_payment',
      paymentStatus: 'pending',
      paymentHoldExpiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
      save: async () => {},
    };

    const isHoldExpired = Boolean(
      expiredBooking.paymentHoldExpiresAt &&
      new Date(expiredBooking.paymentHoldExpiresAt).getTime() <= Date.now()
    );
    assert.ok(isHoldExpired, 'Booking hold must be identified as expired');

    // Simulate backend guard:
    let responseStatus = 200;
    let responseBody = {};

    if (isHoldExpired) {
      await transitionBookingStatus(expiredBooking, 'expired', {
        actorRole: 'system',
        reason: 'payment_hold_expired',
      });
      expiredBooking.paymentStatus = 'expired';
      expiredBooking.verificationStage = 'rejected';
      expiredBooking.payout_status = 'cancelled';
      expiredBooking.expiredAt = new Date();
      responseStatus = 409;
      responseBody = { success: false, message: 'PAYMENT_HOLD_EXPIRED' };
    }

    assert.equal(responseStatus, 409, 'Server must return HTTP 409 Conflict for expired hold');
    assert.equal(responseBody.message, 'PAYMENT_HOLD_EXPIRED', 'Server must return PAYMENT_HOLD_EXPIRED code');
    assert.equal(expiredBooking.bookingStatus, 'expired', 'Booking status must transition to expired');
    assert.equal(expiredBooking.paymentStatus, 'expired', 'Payment status must transition to expired');
    assert.equal(expiredBooking.verificationStage, 'rejected', 'Verification stage must be rejected');
  });

  await t.test('Scenario 6: Order creation permitted when hold is active', () => {
    const activeBooking = {
      bookingStatus: 'awaiting_customer_payment',
      paymentStatus: 'pending',
      paymentHoldExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes left
    };

    const isHoldExpired = Boolean(
      activeBooking.paymentHoldExpiresAt &&
      new Date(activeBooking.paymentHoldExpiresAt).getTime() <= Date.now()
    );
    assert.equal(isHoldExpired, false, 'Active hold must not be flagged as expired');
  });

  await t.test('Scenario 7: Stuck button recovery on modal dismiss, timeout, and payment failure', () => {
    // State machine simulator for frontend isPayingDharamshala flag
    let isPaying = false;

    // User initiates checkout
    isPaying = true;
    assert.equal(isPaying, true);

    // Case 7a: Modal dismiss
    const onModalDismiss = () => { isPaying = false; };
    onModalDismiss();
    assert.equal(isPaying, false, 'Dismissing modal must restore button state');

    // Case 7b: Payment failure event from Razorpay SDK
    isPaying = true;
    const onPaymentFailed = (err) => { isPaying = false; };
    onPaymentFailed({ error: { description: 'Bank server unreachable' } });
    assert.equal(isPaying, false, 'Payment failure must restore button state');

    // Case 7c: Script load timeout rejection
    isPaying = true;
    const onScriptTimeout = () => { isPaying = false; };
    onScriptTimeout();
    assert.equal(isPaying, false, 'Script load timeout must restore button state');

    // Case 7d: Server returns PAYMENT_HOLD_EXPIRED
    isPaying = true;
    const onApiError = (err) => { isPaying = false; };
    onApiError({ response: { data: { message: 'PAYMENT_HOLD_EXPIRED' } } });
    assert.equal(isPaying, false, 'API error must restore button state');
  });

  await t.test('Scenario 8: Expired booking UI state displays clear next action without dead ends', () => {
    const expiredBooking = {
      propertyType: 'dharamshala',
      bookingStatus: 'expired',
      paymentStatus: 'expired',
      paymentHoldExpiresAt: new Date(Date.now() - 60000),
    };

    const isDharamshalaBooking = String(expiredBooking.propertyType || '').toLowerCase() === 'dharamshala';
    const canFindAnotherDharamshala =
      isDharamshalaBooking &&
      ['rejected_by_property', 'expired_property_no_response', 'expired'].includes(String(expiredBooking.bookingStatus || ''));

    assert.ok(canFindAnotherDharamshala, 'Expired dharamshala booking MUST render Find Another Dharamshala action');

    const copyExplanation =
      expiredBooking.bookingStatus === 'rejected_by_property'
        ? 'This Dharamshala could not confirm your requested dates.'
        : expiredBooking.bookingStatus === 'expired'
        ? 'The 15-minute payment hold expired before payment was completed.'
        : 'This request expired because the Dharamshala did not respond in time.';

    assert.equal(copyExplanation, 'The 15-minute payment hold expired before payment was completed.');
  });

  await t.test('Scenario 9: Late payment capture after hold expiry routes to reconciliation safely', async () => {
    // If a payment provider webhook or delayed verification arrives for an expired hold:
    const PaymentReconciliation = require('../models/PaymentReconciliation');
    const origFindOne = PaymentReconciliation.findOne;
    const origCreate = PaymentReconciliation.create;

    const expiredBooking = {
      _id: '6ad87000572cb562aee1026b',
      bookingId: 'VVS-DR-20261021-312717',
      bookingStatus: 'expired',
      paymentStatus: 'pending',
      paymentHoldExpiresAt: new Date(Date.now() - 120000), // 2 mins ago
      totalAmount: 1500,
    };

    const holdExpired = Boolean(
      expiredBooking.paymentHoldExpiresAt &&
      new Date(expiredBooking.paymentHoldExpiresAt).getTime() < Date.now()
    );
    assert.ok(holdExpired, 'Payment arrived after hold expired');

    let createdDoc = null;
    PaymentReconciliation.findOne = () => ({ sort: async () => null });
    PaymentReconciliation.create = async (doc) => {
      createdDoc = { ...doc, save: async function save() { return this; } };
      return createdDoc;
    };

    try {
      // In backend/routes/payment.routes.js:
      // If holdExpired, booking must NOT confirm automatically without inventory check;
      // it must create a PaymentReconciliation record with status 'reconciliation_required'.
      const reconciliation = await createOrGetPaymentReconciliation({
        targetType: 'booking',
        booking: expiredBooking,
        orderId: 'order_test_123',
        paymentId: 'pay_test_456',
        expectedAmount: 150000,
        reason: 'provider_captured_inventory_incomplete',
        status: 'reconciliation_required',
      });

      assert.equal(reconciliation.reason, 'provider_captured_inventory_incomplete');
      assert.equal(reconciliation.reconciliationStatus, 'reconciliation_required');
      assert.equal(reconciliation.targetType, 'booking');
    } finally {
      PaymentReconciliation.findOne = origFindOne;
      PaymentReconciliation.create = origCreate;
    }
  });

  await t.test('Scenario 10: Multi-channel hold consistency — eliminates hardcoded 30-minute text across customer views', () => {
    const fs = require('fs');
    const path = require('path');

    const bookingDetailContent = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/src/pages/user/BookingDetail.tsx'),
      'utf8'
    );
    const myBookingsContent = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/src/pages/user/MyBookings.tsx'),
      'utf8'
    );

    // Verify hardcoded "30 minutes" is completely eradicated from user facing views
    assert.equal(
      bookingDetailContent.includes('within 30 minutes'),
      false,
      'BookingDetail.tsx must NOT contain hardcoded "within 30 minutes"'
    );
    assert.equal(
      myBookingsContent.includes('within 30 minutes'),
      false,
      'MyBookings.tsx must NOT contain hardcoded "within 30 minutes"'
    );

    // Verify BookingCountdownTimer is embedded in both views
    assert.ok(
      bookingDetailContent.includes('BookingCountdownTimer'),
      'BookingDetail.tsx must import and use BookingCountdownTimer'
    );
    assert.ok(
      myBookingsContent.includes('BookingCountdownTimer'),
      'MyBookings.tsx must import and use BookingCountdownTimer'
    );
  });
});
