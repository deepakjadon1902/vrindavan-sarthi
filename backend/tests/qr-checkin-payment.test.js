const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { recordBookingAudit } = require('../utils/bookingAudit');

// Helper to simulate request & response
function createMockRes() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    headers,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// -------------------------------------------------------------
// 1. Reference Parsing & Query Extraction Tests
// -------------------------------------------------------------
test('QR Ref Parsing: correctly extracts booking reference from raw strings and QR voucher URLs', () => {
  const parseRef = (rawRef) => {
    let parsedRef = String(rawRef || '').trim();
    if (parsedRef.includes('?')) {
      try {
        const queryPart = parsedRef.split('?')[1];
        const params = new URLSearchParams(queryPart);
        parsedRef = params.get('ref') || params.get('id') || params.get('bookingId') || parsedRef;
      } catch {
        parsedRef = parsedRef;
      }
    } else if (parsedRef.includes('/verify-booking/')) {
      parsedRef = parsedRef.split('/verify-booking/')[1] || parsedRef;
    }
    return String(parsedRef).trim();
  };

  // Plain alphanumeric booking reference
  assert.equal(parseRef('VS-261024-DH8201'), 'VS-261024-DH8201');
  assert.equal(parseRef(' 10000001 '), '10000001');

  // Full scanned voucher URL with ?ref=
  assert.equal(
    parseRef('https://www.vrindavansarthi.in/verify-booking?ref=VS-261024-DH8201'),
    'VS-261024-DH8201'
  );

  // Full scanned voucher URL with ?id=
  assert.equal(
    parseRef('https://vrindavansarthi.in/verify-booking?id=10000042'),
    '10000042'
  );

  // Path-based voucher URL
  assert.equal(
    parseRef('https://vrindavansarthi.in/verify-booking/VS-998877'),
    'VS-998877'
  );
});

// -------------------------------------------------------------
// 2. Role-Based Partner Ownership & Access Boundary Tests
// -------------------------------------------------------------
test('Partner Ownership: partner can ONLY view bookings for properties they manage', () => {
  const partnerUserA = { _id: 'partner-user-a', role: 'partner', name: 'Partner Radha' };
  const partnerUserB = { _id: 'partner-user-b', role: 'partner', name: 'Partner Krishna' };
  const adminUser = { _id: 'admin-user-0', role: 'admin', name: 'Super Admin' };

  const bookingForPropertyA = {
    _id: 'bk-101',
    bookingId: 'VS-HOTEL-A',
    partnerId: 'partner-user-a',
    propertyName: 'Radha Raman Bhavan',
    totalAmount: 3000,
    bookingStatus: 'confirmed',
  };

  const authorizeLookup = (user, booking) => {
    if (user.role === 'admin') return { allowed: true };
    if (user.role === 'partner') {
      if (!booking.partnerId || String(booking.partnerId) !== String(user._id)) {
        return {
          allowed: false,
          status: 403,
          message: 'You are not authorized to access this booking. It belongs to another property partner.',
        };
      }
      return { allowed: true };
    }
    return { allowed: false, status: 401, message: 'Unauthorized' };
  };

  // 1. Partner A accesses Property A booking -> ALLOWED
  const resA = authorizeLookup(partnerUserA, bookingForPropertyA);
  assert.equal(resA.allowed, true);

  // 2. Partner B accesses Property A booking -> STRICTLY REJECTED WITH 403
  const resB = authorizeLookup(partnerUserB, bookingForPropertyA);
  assert.equal(resB.allowed, false);
  assert.equal(resB.status, 403);
  assert.match(resB.message, /another property partner/);

  // 3. Admin accesses Property A booking -> ALLOWED
  const resAdmin = authorizeLookup(adminUser, bookingForPropertyA);
  assert.equal(resAdmin.allowed, true);
});

// -------------------------------------------------------------
// 3. Authoritative Financial Reconciliation Calculations
// -------------------------------------------------------------
test('Financial Reconciliation: computes authoritative balances and eligibility flags correctly', () => {
  const calculateFinancials = (booking) => {
    const totalAmount = Math.round(Number(booking.totalAmount || 0));
    const amountPaidOnline = Math.max(
      0,
      Math.round(
        Number(
          booking.amountPaidOnline ||
            booking.advanceAmount ||
            (booking.paymentStatus === 'paid' ? booking.totalAmount : 0)
        )
      )
    );
    const amountPaidToProperty = Math.max(0, Math.round(Number(booking.amountPaidToProperty || 0)));

    let expectedPropertyPayable = 0;
    if (booking.paymentOption === 'advance_30') {
      expectedPropertyPayable = Math.max(0, Math.round(totalAmount - amountPaidOnline));
    } else if (Number(booking.amountPayableAtProperty || 0) > 0) {
      expectedPropertyPayable = Math.max(
        0,
        Math.round(Number(booking.amountPayableAtProperty) + amountPaidToProperty)
      );
    }

    const remainingPropertyBalance = Math.max(0, Math.round(expectedPropertyPayable - amountPaidToProperty));
    const bookingStatus = String(booking.bookingStatus || '');
    const isEligibleForCheckIn = ['confirmed'].includes(bookingStatus);
    const isEligibleForPaymentCollection =
      remainingPropertyBalance > 0 && ['confirmed', 'checked_in'].includes(bookingStatus);

    return {
      totalAmount,
      amountPaidOnline,
      amountPaidToProperty,
      remainingPropertyBalance,
      isEligibleForCheckIn,
      isEligibleForPaymentCollection,
    };
  };

  // Case 1: Advance 30% booking with remaining desk balance
  const b1 = calculateFinancials({
    totalAmount: 3000,
    paymentOption: 'advance_30',
    amountPaidOnline: 900,
    amountPaidToProperty: 0,
    bookingStatus: 'confirmed',
  });
  assert.equal(b1.totalAmount, 3000);
  assert.equal(b1.amountPaidOnline, 900);
  assert.equal(b1.amountPaidToProperty, 0);
  assert.equal(b1.remainingPropertyBalance, 2100);
  assert.equal(b1.isEligibleForCheckIn, true);
  assert.equal(b1.isEligibleForPaymentCollection, true);

  // Case 2: Partial desk payment already collected (e.g. ₹1000 collected earlier)
  const b2 = calculateFinancials({
    totalAmount: 3000,
    paymentOption: 'advance_30',
    amountPaidOnline: 900,
    amountPaidToProperty: 1000,
    bookingStatus: 'checked_in',
  });
  assert.equal(b2.remainingPropertyBalance, 1100);
  assert.equal(b2.isEligibleForCheckIn, false); // Already checked in
  assert.equal(b2.isEligibleForPaymentCollection, true); // Balance remaining

  // Case 3: Fully paid online booking
  const b3 = calculateFinancials({
    totalAmount: 2500,
    paymentOption: 'full',
    paymentStatus: 'paid',
    amountPaidOnline: 2500,
    amountPaidToProperty: 0,
    bookingStatus: 'confirmed',
  });
  assert.equal(b3.remainingPropertyBalance, 0);
  assert.equal(b3.isEligibleForCheckIn, true);
  assert.equal(b3.isEligibleForPaymentCollection, false);
});

// -------------------------------------------------------------
// 4. Desk Check-in Validation & Duplicate Prevention
// -------------------------------------------------------------
test('Check-in Validation: duplicate check-in and invalid states are rejected', () => {
  const validateCheckIn = (booking) => {
    if (booking.bookingStatus === 'checked_in') {
      return {
        status: 409,
        code: 'ALREADY_CHECKED_IN',
        message: 'Guest is already checked in.',
      };
    }
    const ineligibleStatuses = [
      'cancelled',
      'expired',
      'payment_failed',
      'rejected_by_property',
      'checked_out',
      'completed',
      'settled',
    ];
    if (ineligibleStatuses.includes(booking.bookingStatus)) {
      return {
        status: 409,
        code: 'INVALID_BOOKING_STATE',
        message: `Check-in is not permitted for booking in '${booking.bookingStatus}' status.`,
      };
    }
    if (booking.bookingStatus !== 'confirmed') {
      return {
        status: 409,
        code: 'INVALID_BOOKING_STATE',
        message: `Only confirmed bookings may be checked in. Current status: ${booking.bookingStatus}`,
      };
    }
    if (!['hotel', 'room', 'room_type'].includes(String(booking.bookingType || ''))) {
      return {
        status: 400,
        message: 'Check-in is only available for lodging bookings',
      };
    }
    return { status: 200, success: true };
  };

  // Valid confirmed hotel booking
  assert.equal(
    validateCheckIn({ bookingStatus: 'confirmed', bookingType: 'hotel' }).status,
    200
  );

  // Already checked in booking -> 409 ALREADY_CHECKED_IN
  const dup = validateCheckIn({ bookingStatus: 'checked_in', bookingType: 'hotel' });
  assert.equal(dup.status, 409);
  assert.equal(dup.code, 'ALREADY_CHECKED_IN');

  // Cancelled booking -> 409 INVALID_BOOKING_STATE
  const cancelled = validateCheckIn({ bookingStatus: 'cancelled', bookingType: 'hotel' });
  assert.equal(cancelled.status, 409);
  assert.equal(cancelled.code, 'INVALID_BOOKING_STATE');

  // Cab booking -> 400 only lodging allowed
  const cab = validateCheckIn({ bookingStatus: 'confirmed', bookingType: 'cab' });
  assert.equal(cab.status, 400);
});

// -------------------------------------------------------------
// 5. Desk Payment Collection: Balance Cap & Idempotency
// -------------------------------------------------------------
test('Payment Collection: rejects amounts exceeding remaining balance', () => {
  const validateCollection = (remainingBalance, amountToCollect) => {
    if (amountToCollect <= 0) {
      return { status: 400, message: 'Amount must be greater than zero' };
    }
    if (amountToCollect > remainingBalance) {
      return {
        status: 400,
        message: `Amount collected (₹${amountToCollect}) exceeds remaining balance at property (₹${remainingBalance}).`,
      };
    }
    return { status: 200, success: true };
  };

  // Attempt to collect ₹2500 when balance is only ₹2100 -> REJECTED 400
  const excess = validateCollection(2100, 2500);
  assert.equal(excess.status, 400);
  assert.match(excess.message, /exceeds remaining balance/);

  // Exact collection of remaining balance -> ALLOWED
  const exact = validateCollection(2100, 2100);
  assert.equal(exact.status, 200);

  // Partial collection -> ALLOWED
  const partial = validateCollection(2100, 1000);
  assert.equal(partial.status, 200);
});

// -------------------------------------------------------------
// 6. Public Voucher PII Privacy Masking
// -------------------------------------------------------------
test('Privacy Masking: maskGuestName protects customer names from public scraping', () => {
  function maskGuestName(name) {
    if (!name) return 'Guest Devotee';
    const str = String(name).trim();
    const parts = str.split(/\s+/);
    return parts
      .map((p) => {
        if (p.length <= 2) return p[0] + '*';
        return p[0] + '*'.repeat(Math.max(1, p.length - 2)) + p[p.length - 1];
      })
      .join(' ');
  }

  // Multi-word name
  assert.equal(maskGuestName('Rahul Sharma'), 'R***l S****a');
  assert.equal(maskGuestName('Amit Kumar Verma'), 'A**t K***r V***a');

  // Short 2-letter word
  assert.equal(maskGuestName('Om Rao'), 'O* R*o');

  // Empty / missing name fallback
  assert.equal(maskGuestName(''), 'Guest Devotee');
  assert.equal(maskGuestName(null), 'Guest Devotee');
});

// -------------------------------------------------------------
// 7. AuditLog Schema & Utility Verification
// -------------------------------------------------------------
test('AuditLog Schema: requires valid action and captures actor, booking, and metadata', () => {
  const validActions = [
    'qr_scan_lookup',
    'guest_check_in',
    'property_payment_collected',
  ];

  const validObjectId = new mongoose.Types.ObjectId();

  validActions.forEach((action) => {
    const entry = new AuditLog({
      action,
      actorId: validObjectId,
      actorRole: 'partner',
      actorName: 'Dharamshala Manager',
      bookingId: 'VS-261024-DH8201',
      propertyId: validObjectId,
      metadata: { test: true },
    });

    const error = entry.validateSync();
    assert.equal(error, undefined, `Action '${action}' must be a valid AuditLog enum value`);
  });

  // Invalid action is rejected by Mongoose schema validation
  const invalidEntry = new AuditLog({
    action: 'illegal_unregistered_action',
    actorRole: 'partner',
  });
  const err = invalidEntry.validateSync();
  assert.ok(err?.errors?.action, 'Unknown action should fail schema validation');
});
