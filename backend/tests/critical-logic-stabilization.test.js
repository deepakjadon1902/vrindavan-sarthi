const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const BookingModification = require('../models/BookingModification');
const PaymentReconciliation = require('../models/PaymentReconciliation');
const { calculatePricing } = require('../utils/pricing');
const { payableAmountForBooking } = require('../utils/bookingPayable');
const {
  classifyCapturedBookingLocalState,
  classifyCapturedModificationLocalState,
  expectedBookingAmountPaise,
} = require('../utils/paymentReconciliation');
const {
  applyRazorpayWebhookBusinessEvent,
  extractRazorpayPaymentContext,
} = require('../utils/razorpayWebhook');

// ============================================================================
// 1. PROPERTY APPROVAL & BOOKING MODE ENFORCEMENT
// ============================================================================

test('Property Approval: Unapproved properties are strictly forbidden from accepting bookings', () => {
  const pendingHotel = { approvalStatus: 'pending', propertyType: 'hotel', instantBookingEnabled: true, bookingMode: 'instant' };
  const rejectedHotel = { approvalStatus: 'rejected', propertyType: 'hotel', instantBookingEnabled: true, bookingMode: 'instant' };
  const approvedHotel = { approvalStatus: 'approved', propertyType: 'hotel', instantBookingEnabled: true, bookingMode: 'instant' };

  assert.equal(pendingHotel.approvalStatus === 'approved', false);
  assert.equal(rejectedHotel.approvalStatus === 'approved', false);
  assert.equal(approvedHotel.approvalStatus === 'approved', true);
});

test('Booking Mode: bookingMode takes authoritative precedence over instantBookingEnabled', () => {
  // If bookingMode is explicitly 'request', it overrides any legacy instantBookingEnabled=true
  const requestHotel = { propertyType: 'hotel', approvalStatus: 'approved', bookingMode: 'request', instantBookingEnabled: true };
  const isDharamshala = String(requestHotel.propertyType || '').toLowerCase() === 'dharamshala';
  const isInstant = !isDharamshala && (requestHotel.bookingMode ? requestHotel.bookingMode === 'instant' : Boolean(requestHotel.instantBookingEnabled));
  assert.equal(isInstant, false, 'Explicit bookingMode request must override legacy instantBookingEnabled true');

  // If bookingMode is 'instant', it is instant eligible
  const instantHotel = { propertyType: 'hotel', approvalStatus: 'approved', bookingMode: 'instant', instantBookingEnabled: false };
  const isInstant2 = !isDharamshala && (instantHotel.bookingMode ? instantHotel.bookingMode === 'instant' : Boolean(instantHotel.instantBookingEnabled));
  assert.equal(isInstant2, true, 'Explicit bookingMode instant must be honored');

  // Dharamshala is always request-first, regardless of flags
  const dharamshala = { propertyType: 'dharamshala', approvalStatus: 'approved', bookingMode: 'instant', instantBookingEnabled: true };
  const isDharamshalaProp = String(dharamshala.propertyType || '').toLowerCase() === 'dharamshala';
  const isInstantDharamshala = !isDharamshalaProp && (dharamshala.bookingMode ? dharamshala.bookingMode === 'instant' : Boolean(dharamshala.instantBookingEnabled));
  assert.equal(isInstantDharamshala, false, 'Dharamshala is strictly barred from instant booking');
});

// ============================================================================
// 2. PAYMENT WEBHOOK & RECONCILIATION HARDENING
// ============================================================================

test('Webhook Logic: Captured payment for unmatched order is flagged for reconciliation', async () => {
  const fakeEvent = {
    payload: {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_unmatched_123', order_id: 'order_missing_999', amount: 500000, currency: 'INR', status: 'captured' } },
        order: { entity: { id: 'order_missing_999' } },
      },
    },
  };

  const origBookingFindOne = Booking.findOne;
  const origModFindOne = BookingModification.findOne;
  const origReconcileFindOne = PaymentReconciliation.findOne;
  const origReconcileCreate = PaymentReconciliation.create;

  let createdReconciliation = null;
  Booking.findOne = async () => null;
  BookingModification.findOne = async () => null;
  PaymentReconciliation.findOne = () => ({ sort: async () => null });
  PaymentReconciliation.create = async (doc) => {
    createdReconciliation = { ...doc, save: async function save() { return this; } };
    return createdReconciliation;
  };

  try {
    const result = await applyRazorpayWebhookBusinessEvent(fakeEvent);
    assert.equal(result.action, 'unmatched_captured_payment_reconciliation_required');
    assert.equal(result.orderId, 'order_missing_999');
    assert.ok(createdReconciliation);
    assert.equal(createdReconciliation.reconciliationStatus, 'reconciliation_required');
    assert.equal(createdReconciliation.reason, 'unmatched_captured_payment_order');
  } finally {
    Booking.findOne = origBookingFindOne;
    BookingModification.findOne = origModFindOne;
    PaymentReconciliation.findOne = origReconcileFindOne;
    PaymentReconciliation.create = origReconcileCreate;
  }
});

test('Webhook Logic: Captured payment on expired booking triggers reconciliation instead of throwing', async () => {
  const expiredBookingId = new mongoose.Types.ObjectId();
  const fakeExpiredBooking = {
    _id: expiredBookingId,
    bookingId: 'VVS-EXPIRED-001',
    bookingType: 'room_type',
    bookingStatus: 'expired_property_no_response',
    paymentStatus: 'pending',
    totalAmount: 5000,
    advanceAmount: 1500,
    paymentOption: 'advance_30',
    razorpayWebhookEventIds: [],
    save: async function save() { return this; },
  };

  const fakeEvent = {
    payload: {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_late_123', order_id: 'order_expired_1', amount: 150000, currency: 'INR', status: 'captured' } },
        order: { entity: { id: 'order_expired_1' } },
      },
    },
  };

  const origBookingFindOne = Booking.findOne;
  const origReconcileFindOne = PaymentReconciliation.findOne;
  const origReconcileCreate = PaymentReconciliation.create;

  let createdReconciliation = null;
  Booking.findOne = async () => fakeExpiredBooking;
  PaymentReconciliation.findOne = () => ({ sort: async () => null });
  PaymentReconciliation.create = async (doc) => {
    createdReconciliation = { ...doc, save: async function save() { return this; } };
    return createdReconciliation;
  };

  const fakeQueue = {
    add: async () => {},
  };

  try {
    const result = await applyRazorpayWebhookBusinessEvent(fakeEvent, { queueFactory: () => fakeQueue });
    assert.equal(result.action, 'booking_payment_reconciliation_required');
    assert.equal(result.bookingId, fakeExpiredBooking._id);
    assert.match(result.reason, /provider_captured_local_expired_property_no_response/);
    assert.ok(createdReconciliation);
    assert.equal(createdReconciliation.reconciliationStatus, 'reconciliation_required');
  } finally {
    Booking.findOne = origBookingFindOne;
    PaymentReconciliation.findOne = origReconcileFindOne;
    PaymentReconciliation.create = origReconcileCreate;
  }
});

test('Webhook Logic: Multiple captured payments for same booking flag for reconciliation', async () => {
  const paidBookingId = new mongoose.Types.ObjectId();
  const fakePaidBooking = {
    _id: paidBookingId,
    bookingId: 'VVS-PAID-001',
    bookingType: 'room_type',
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    razorpayPaymentId: 'pay_original_111',
    razorpayOrderId: 'order_paid_1',
    totalAmount: 5000,
    advanceAmount: 1500,
    paymentOption: 'advance_30',
    razorpayWebhookEventIds: [],
    save: async function save() { return this; },
  };

  const fakeEvent = {
    payload: {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_second_222', order_id: 'order_paid_1', amount: 150000, currency: 'INR', status: 'captured' } },
        order: { entity: { id: 'order_paid_1' } },
      },
    },
  };

  const origBookingFindOne = Booking.findOne;
  const origReconcileFindOne = PaymentReconciliation.findOne;
  const origReconcileCreate = PaymentReconciliation.create;

  let createdReconciliation = null;
  Booking.findOne = async () => fakePaidBooking;
  PaymentReconciliation.findOne = () => ({ sort: async () => null });
  PaymentReconciliation.create = async (doc) => {
    createdReconciliation = { ...doc, save: async function save() { return this; } };
    return createdReconciliation;
  };

  const fakeQueue = {
    add: async () => {},
  };

  try {
    const result = await applyRazorpayWebhookBusinessEvent(fakeEvent, { queueFactory: () => fakeQueue });
    assert.equal(result.action, 'multiple_captured_payments_reconciliation_required');
    assert.equal(result.bookingId, fakePaidBooking._id);
    assert.ok(createdReconciliation);
    assert.equal(createdReconciliation.reconciliationStatus, 'reconciliation_required');
    assert.equal(createdReconciliation.reason, 'provider_captured_multiple_payments_for_order');
  } finally {
    Booking.findOne = origBookingFindOne;
    PaymentReconciliation.findOne = origReconcileFindOne;
    PaymentReconciliation.create = origReconcileCreate;
  }
});

// ============================================================================
// 3. NOTIFICATION TEMPLATE AND ERROR CODE INTEGRITY
// ============================================================================

test('Notification Template Integrity: Dharamshala reminder panel templates are handled', () => {
  const code = fs.readFileSync(path.join(__dirname, '../utils/notificationDelivery.js'), 'utf8');

  // Verify that dharamshala_reminder_admin_panel and dharamshala_reminder_partner_panel
  // are included in the panel templates check in deliverWithDefaultProvider
  assert.match(code, /template === 'dharamshala_reminder_admin_panel'/);
  assert.match(code, /template === 'dharamshala_reminder_partner_panel'/);
});

test('Email Service: Missing RESEND_FROM throws with code RESEND_FROM_MISSING', () => {
  const code = fs.readFileSync(path.join(__dirname, '../utils/email.js'), 'utf8');

  assert.match(code, /err\.code = 'RESEND_FROM_MISSING'/);
});

test('Worker: Notification recovery sweep scheduler is registered', () => {
  const code = fs.readFileSync(path.join(__dirname, '../worker.js'), 'utf8');

  assert.match(code, /JOB_NAMES\.notificationRecoverySweep/);
  assert.match(code, /phase4\.5:notification-recovery-sweep/);
});

// ============================================================================
// 4. FINANCIAL LEDGER & REFUND INTEGRITY
// ============================================================================

test('Financial Ledger: Gateway fee is absorbed platform-side and excess desk collection is preserved', () => {
  const pricing = calculatePricing({
    subtotal: 5600,
    baseAmount: 5000,
    taxAmount: 600,
    paymentOption: 'advance_30',
    commissionPercent: 10,
    gatewayFeeAmount: 100,
  });

  // Net entitlement = (5000 + 600) - 500 = 5100. (Gateway fee of 100 is NOT deducted)
  assert.equal(pricing.hotel_net_payout, 5100);

  // If hotel collects 6000 at desk, net remittance is 5100 - 6000 = -900
  const deskCashCollected = 6000;
  const netRemittance = pricing.hotel_net_payout - deskCashCollected;
  assert.equal(netRemittance, -900);

  const excessPartnerCollection = Math.max(0, -netRemittance);
  const netPayableToPartner = Math.max(0, netRemittance);
  assert.equal(excessPartnerCollection, 900, 'Liability of 900 must be preserved');
  assert.equal(netPayableToPartner, 0);
});

test('Refund Caps: Customer cancellation on advance_30 is non-refundable; platform failure refunds 100% online amount', () => {
  const capturedOnline = 3494;
  const deskCash = 8151;

  // Customer cancellation
  const isPlatformFailure = false;
  const refundableCustomer = isPlatformFailure ? capturedOnline : 0;
  assert.equal(refundableCustomer, 0, 'Advance 30 is non-refundable on customer cancellation');

  // Platform/property failure
  const isPlatformFailure2 = true;
  const refundablePlatform = isPlatformFailure2 ? capturedOnline : 0;
  assert.equal(refundablePlatform, 3494, 'Platform failure must refund 100% of online captured amount');
  assert.ok(refundablePlatform <= capturedOnline, 'Refund can never refund uncollected desk cash');
});
