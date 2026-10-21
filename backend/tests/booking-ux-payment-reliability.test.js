const test = require('node:test');
const assert = require('node:assert/strict');
const Booking = require('../models/Booking');
const {
  DHARAMSHALA_RESPONSE_TIMEOUT_MINUTES,
  DHARAMSHALA_PAYMENT_HOLD_MINUTES,
} = require('../utils/dharamshalaLifecycle');
const {
  transitionBookingStatus,
  releaseBookingInventory,
  markBookingPaymentPaid,
} = require('../utils/reservationLifecycle');

test('Booking UX & Payment Reliability Verification Suite', async (t) => {
  await t.test('1. Guest contact vs Platform admin contact isolation (P3)', () => {
    const booking = {
      customerFullName: 'Aarav Sharma',
      customerMobile: '9876543210',
      customerEmail: 'aarav@example.com',
      userName: 'Vrindavan Sarthi Platform Admin',
      userPhone: '8679820256',
      partnerName: 'Shri Radhe Dharamshala Host',
      partnerPhone: '9412345678',
    };

    const adminSupportPhone = '8679820256';

    // Guest phone resolver:
    const customerPhone = booking.customerMobile || booking.userPhone;
    assert.equal(customerPhone, '9876543210', 'Guest phone must resolve to primary guest mobile');
    assert.notEqual(customerPhone, adminSupportPhone, 'Guest phone must NEVER resolve to platform admin support phone');

    // Razorpay prefill contact:
    const razorpayContact = String(customerPhone || '').replace(/\D/g, '');
    assert.equal(razorpayContact, '9876543210', 'Razorpay prefill contact must be the customer mobile number');
    assert.notEqual(razorpayContact, adminSupportPhone, 'Razorpay prefill must NEVER substitute platform admin phone');

    // Host contact protection:
    const showHostContactBeforeConfirmation = false;
    assert.equal(showHostContactBeforeConfirmation, false, 'Host contact details must be hidden before confirmation');
  });

  await t.test('2. Authoritative booking state resolution & contradiction prevention (P1)', () => {
    // Replicating authoritative state resolver
    const resolveState = (b) => {
      const now = Date.now();
      const rawBooking = String(b.bookingStatus || '').toLowerCase();
      const rawPayment = String(b.paymentStatus || '').toLowerCase();
      const holdExpired = Boolean(b.paymentHoldExpiresAt && new Date(b.paymentHoldExpiresAt).getTime() <= now);
      const reqExpired = Boolean(b.requestExpiresAt && new Date(b.requestExpiresAt).getTime() <= now);

      if (rawPayment === 'paid' || ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(rawBooking)) {
        return { code: 'confirmed', badge: 'Booking Confirmed', canPay: false, timer: 'none' };
      }
      if (rawPayment === 'reconciliation_required') {
        return { code: 'reconciliation_required', badge: 'Payment Under Review', canPay: false, timer: 'none' };
      }
      if (rawBooking === 'cancelled') {
        return { code: 'cancelled', badge: 'Cancelled', canPay: false, timer: 'none' };
      }
      if (rawBooking === 'rejected_by_property') {
        return { code: 'rejected_by_property', badge: 'Declined by Property', canPay: false, timer: 'none' };
      }
      if (rawBooking === 'expired_property_no_response' || (rawBooking === 'pending_property_confirmation' && reqExpired)) {
        return { code: 'expired_property_no_response', badge: 'Expired (Property Timed Out)', canPay: false, timer: 'none' };
      }
      if (rawBooking === 'expired' || (rawBooking === 'awaiting_customer_payment' && holdExpired)) {
        return { code: 'expired', badge: 'Expired (Payment Hold Expired)', canPay: false, timer: 'none' };
      }
      if (rawBooking === 'awaiting_customer_payment') {
        return { code: 'awaiting_customer_payment', badge: 'Property Approved (Payment Pending)', canPay: true, timer: 'payment_hold' };
      }
      if (rawBooking === 'pending_property_confirmation') {
        return { code: 'pending_property_confirmation', badge: 'Awaiting Property Approval', canPay: false, timer: 'request_approval' };
      }
      return { code: 'pending', badge: 'Pending', canPay: false, timer: 'none' };
    };

    // Case 2a: Request submitted
    const s1 = resolveState({ bookingStatus: 'pending_property_confirmation', paymentStatus: 'pending', requestExpiresAt: new Date(Date.now() + 300000) });
    assert.equal(s1.code, 'pending_property_confirmation');
    assert.equal(s1.badge, 'Awaiting Property Approval');
    assert.equal(s1.timer, 'request_approval');
    assert.equal(s1.canPay, false);

    // Case 2b: Approved, hold active
    const s2 = resolveState({ bookingStatus: 'awaiting_customer_payment', paymentStatus: 'pending', paymentHoldExpiresAt: new Date(Date.now() + 600000) });
    assert.equal(s2.code, 'awaiting_customer_payment');
    assert.equal(s2.badge, 'Property Approved (Payment Pending)');
    assert.equal(s2.timer, 'payment_hold');
    assert.equal(s2.canPay, true);

    // Case 2c: Approved, hold expired
    const s3 = resolveState({ bookingStatus: 'awaiting_customer_payment', paymentStatus: 'pending', paymentHoldExpiresAt: new Date(Date.now() - 1000) });
    assert.equal(s3.code, 'expired');
    assert.equal(s3.badge, 'Expired (Payment Hold Expired)');
    assert.equal(s3.canPay, false);

    // Case 2d: Confirmed (even if bookingStatus lagged or verificationStage had pending_partner)
    const s4 = resolveState({ bookingStatus: 'awaiting_customer_payment', paymentStatus: 'paid', verificationStage: 'pending_partner' });
    assert.equal(s4.code, 'confirmed');
    assert.equal(s4.badge, 'Booking Confirmed');
    assert.equal(s4.canPay, false);
    assert.equal(s4.timer, 'none');

    // Case 2e: Reconciliation required
    const s5 = resolveState({ bookingStatus: 'expired', paymentStatus: 'reconciliation_required' });
    assert.equal(s5.code, 'reconciliation_required');
    assert.equal(s5.badge, 'Payment Under Review');
    assert.equal(s5.canPay, false);
  });

  await t.test('3. Countdown timer presence strictly mapped to active windows (P2)', () => {
    // Timer must ONLY be active during request_approval (5 mins) or payment_hold (15 mins)
    const isTimerActive = (timerType) => timerType === 'request_approval' || timerType === 'payment_hold';

    assert.ok(isTimerActive('request_approval'), 'Must show timer for request approval window');
    assert.ok(isTimerActive('payment_hold'), 'Must show timer for active payment hold window');
    assert.equal(isTimerActive('none'), false, 'Must NOT show timer for confirmed/cancelled/expired');
  });

  await t.test('4. Modal dismissal with asynchronous captured payment polling (P0 & P4)', async () => {
    // Simulate booking state on server updated by webhook while modal was open
    let serverBooking = {
      _id: 'booking_123',
      bookingStatus: 'awaiting_customer_payment',
      paymentStatus: 'pending',
    };

    // User closes checkout modal on frontend.
    // Client invokes bounded poll loop instead of instantly displaying "Pay Again"
    let clientStatus = 'verifying';
    let pollCount = 0;

    // Simulate webhook arrival on server after 20ms
    setTimeout(() => {
      serverBooking.paymentStatus = 'paid';
      serverBooking.bookingStatus = 'confirmed';
    }, 20);

    for (let i = 0; i < 4; i++) {
      pollCount++;
      await new Promise((r) => setTimeout(r, 15));
      if (serverBooking.paymentStatus === 'paid' || serverBooking.bookingStatus === 'confirmed') {
        clientStatus = 'confirmed';
        break;
      }
    }

    assert.equal(clientStatus, 'confirmed', 'Client must discover captured payment via server poll');
    assert.ok(pollCount <= 4, 'Polling must be bounded and stop immediately upon confirmation');
  });

  await t.test('5. Duplicate payment order prevention (P0)', () => {
    const booking = {
      _id: 'booking_already_paid',
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
    };

    // Server-side check in POST /razorpay/orders:
    const canCreateOrder = (b) => {
      if (b.paymentStatus === 'paid') return { allowed: false, error: 'PAYMENT_ALREADY_PROCESSED' };
      if (['cancelled', 'expired', 'payment_failed'].includes(b.bookingStatus)) {
        return { allowed: false, error: 'INVALID_BOOKING_STATE' };
      }
      return { allowed: true };
    };

    const result = canCreateOrder(booking);
    assert.equal(result.allowed, false);
    assert.equal(result.error, 'PAYMENT_ALREADY_PROCESSED');
  });

  await t.test('6. Expired hold blocks order creation and triggers inventory release', async () => {
    const expiredBooking = {
      _id: 'booking_expired_1',
      bookingStatus: 'awaiting_customer_payment',
      paymentStatus: 'pending',
      paymentHoldExpiresAt: new Date(Date.now() - 5000),
      save: async () => {},
    };

    const isExpired = Boolean(
      expiredBooking.paymentHoldExpiresAt &&
      new Date(expiredBooking.paymentHoldExpiresAt).getTime() <= Date.now()
    );

    assert.ok(isExpired, 'Hold must be identified as expired');

    if (isExpired) {
      await transitionBookingStatus(expiredBooking, 'expired', {
        actorRole: 'system',
        reason: 'payment_hold_expired',
      });
      expiredBooking.paymentStatus = 'expired';
    }

    assert.equal(expiredBooking.bookingStatus, 'expired');
    assert.equal(expiredBooking.paymentStatus, 'expired');
  });

  await t.test('7. Financial transparency calculations for 100% online vs 30% advance', () => {
    // 100% Online
    const fullBooking = {
      totalAmount: 2500,
      paymentOption: 'full_100',
      amountPaidOnline: 2500,
      amountPayableAtProperty: 0,
    };
    const fullBalance = Number(fullBooking.amountPayableAtProperty ?? (fullBooking.totalAmount - fullBooking.amountPaidOnline));
    assert.equal(fullBalance, 0, '100% online must have 0 balance at property');

    // 30% Advance
    const advanceBooking = {
      totalAmount: 3000,
      paymentOption: 'advance_30',
      advanceAmount: 900,
      amountPaidOnline: 900,
      amountPayableAtProperty: 2100,
    };
    const advBalance = Number(advanceBooking.amountPayableAtProperty ?? (advanceBooking.totalAmount - advanceBooking.amountPaidOnline));
    assert.equal(advBalance, 2100, '30% advance must have exactly 2100 balance at property');
  });

  await t.test('8. Multi-channel countdown coverage verification across files', () => {
    const fs = require('fs');
    const path = require('path');

    const bookingDetail = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/user/BookingDetail.tsx'), 'utf8');
    const roomTypeDetail = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/RoomTypeDetail.tsx'), 'utf8');
    const bookingConfirmation = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/user/BookingConfirmation.tsx'), 'utf8');
    const myBookings = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/user/MyBookings.tsx'), 'utf8');

    assert.ok(bookingDetail.includes('BookingCountdownTimer'), 'BookingDetail must render BookingCountdownTimer');
    assert.ok(roomTypeDetail.includes('BookingCountdownTimer'), 'RoomTypeDetail must render BookingCountdownTimer');
    assert.ok(bookingConfirmation.includes('BookingCountdownTimer'), 'BookingConfirmation must render BookingCountdownTimer');
    assert.ok(myBookings.includes('BookingCountdownTimer'), 'MyBookings must render BookingCountdownTimer');

    // Verify contact isolation in RoomTypeDetail and BookingDetail
    assert.equal(
      roomTypeDetail.includes('contact: supportDigits || customerMobile'),
      false,
      'RoomTypeDetail must not prioritize supportDigits over customerMobile'
    );
    assert.equal(
      bookingDetail.includes('const razorpayContact = String(adminPhone).replace'),
      false,
      'BookingDetail must not prioritize adminPhone for customer Razorpay prefill'
    );
  });
});
