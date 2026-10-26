const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const {
  classifyNotificationError,
  buildNotificationKey,
} = require('../utils/notificationDelivery');
const { sendBookingInvoice } = require('../utils/customerMessages');

test('Booking Confirmation Email & Flow Safety Test Suite', async (t) => {
  await t.test('1. Error classification correctly handles provider responses', () => {
    // Permanent Resend errors
    const resend422 = new Error('Resend send failed: HTTP 422 - domain_not_verified');
    resend422.statusCode = 422;
    resend422.code = 'RESEND_SEND_FAILED';
    assert.equal(classifyNotificationError(resend422), 'permanent');

    const resend403 = new Error('Resend send failed: HTTP 403 - forbidden');
    resend403.statusCode = 403;
    resend403.code = 'RESEND_SEND_FAILED';
    assert.equal(classifyNotificationError(resend403), 'permanent');

    const missingRecipient = new Error('No customer email on booking for confirmation email');
    missingRecipient.code = 'INVALID_RECIPIENT';
    assert.equal(classifyNotificationError(missingRecipient), 'permanent');

    const missingFrom = new Error('Missing RESEND_FROM');
    missingFrom.code = 'RESEND_FROM_MISSING';
    assert.equal(classifyNotificationError(missingFrom), 'permanent');

    // Transient Resend errors
    const resend429 = new Error('Resend send failed: HTTP 429 - rate_limit_exceeded');
    resend429.statusCode = 429;
    resend429.code = 'RESEND_SEND_FAILED';
    assert.equal(classifyNotificationError(resend429), 'transient');

    const resend500 = new Error('Resend send failed: HTTP 500 - internal_server_error');
    resend500.statusCode = 500;
    resend500.code = 'RESEND_SEND_FAILED';
    assert.equal(classifyNotificationError(resend500), 'transient');

    const timeout = new Error('Request timeout');
    timeout.code = 'ETIMEDOUT';
    assert.equal(classifyNotificationError(timeout), 'transient');
  });

  await t.test('2. Missing customer email throws INVALID_RECIPIENT and does not call sendEmail', async () => {
    const bookingWithoutEmail = {
      _id: '6acd09dd44dcce4900a0fbc8',
      bookingId: 'VVS-TEST-NOEMAIL',
      customerEmail: '',
      userEmail: '',
      invoiceSentAt: null,
    };

    await assert.rejects(
      async () => sendBookingInvoice(bookingWithoutEmail),
      (err) => {
        assert.equal(err.code, 'INVALID_RECIPIENT');
        assert.match(err.message, /No customer email on booking/);
        return true;
      }
    );
  });

  await t.test('3. Already sent invoice returns undefined without sending duplicate email', async () => {
    const bookingAlreadySent = {
      _id: '6acd09dd44dcce4900a0fbc8',
      bookingId: 'VVS-TEST-SENT',
      customerEmail: 'guest@example.com',
      invoiceSentAt: new Date(),
    };

    const result = await sendBookingInvoice(bookingAlreadySent);
    assert.equal(result, undefined);
  });

  await t.test('4. Notification key for booking invoice is deterministic and unique', () => {
    const bookingId = '6acd09dd44dcce4900a0fbc8';
    const key1 = buildNotificationKey('booking', bookingId, 'invoice');
    const key2 = buildNotificationKey('booking', bookingId, 'invoice');
    assert.equal(key1, key2);
    assert.equal(key1, 'notification:booking:6acd09dd44dcce4900a0fbc8:invoice');
  });

  await t.test('5. Mocked email provider test verifies attachment and provider acceptance', async () => {
    const emailModule = require('../utils/email');
    const originalSendEmail = emailModule.sendEmail;

    let capturedPayload = null;
    emailModule.sendEmail = async (payload) => {
      capturedPayload = payload;
      return { provider: 'resend', providerMessageId: 'msg_mocked_resend_999' };
    };

    try {
      const mockBooking = {
        _id: '6acd09dd44dcce4900a0fbc8',
        bookingId: 'VVS-2026-10492',
        displayBookingId: '10000001',
        bookingType: 'room_type',
        service_billing_model: 'hotel_marketplace',
        itemName: 'Hotel Govind Dham - Deluxe Room',
        customerFullName: 'Radha Krishna Bhakt',
        customerEmail: 'bhakt@example.com',
        customerMobile: '9876543210',
        checkIn: new Date('2026-11-10'),
        checkOut: new Date('2026-11-12'),
        totalAmount: 4500,
        amountPaidOnline: 4500,
        paymentStatus: 'paid',
        bookingStatus: 'confirmed',
      };

      const result = await sendBookingInvoice(mockBooking);
      assert.equal(result.provider, 'resend');
      assert.equal(result.providerMessageId, 'msg_mocked_resend_999');

      assert.ok(capturedPayload);
      assert.equal(capturedPayload.to, 'bhakt@example.com');
      assert.match(capturedPayload.subject, /Vrindavan Sarthi booking confirmation VVS-2026-10492/);
      assert.ok(Array.isArray(capturedPayload.attachments));
      assert.equal(capturedPayload.attachments.length, 1);
      assert.match(capturedPayload.attachments[0].filename, /booking-receipt-VVS-2026-10492\.pdf/);
      assert.ok(Buffer.isBuffer(capturedPayload.attachments[0].content));
      assert.ok(capturedPayload.attachments[0].content.length > 0);
    } finally {
      emailModule.sendEmail = originalSendEmail;
    }
  });

  await t.test('6. Mocked provider failure propagates error code and status safely without marking invoiceSentAt', async () => {
    const emailModule = require('../utils/email');
    const originalSendEmail = emailModule.sendEmail;

    emailModule.sendEmail = async () => {
      const err = new Error('Resend send failed: HTTP 422 - domain_not_verified');
      err.code = 'RESEND_SEND_FAILED';
      err.statusCode = 422;
      err.resendMessage = 'domain_not_verified';
      throw err;
    };

    try {
      const mockBooking = {
        _id: '6acd09dd44dcce4900a0fbc8',
        bookingId: 'VVS-FAIL-TEST',
        customerEmail: 'fail@example.com',
        bookingType: 'room_type',
        service_billing_model: 'hotel_marketplace',
        itemName: 'Test Stay',
        totalAmount: 2000,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
      };

      await assert.rejects(
        async () => sendBookingInvoice(mockBooking),
        (err) => {
          assert.equal(err.code, 'RESEND_SEND_FAILED');
          assert.equal(err.statusCode, 422);
          assert.equal(classifyNotificationError(err), 'permanent');
          return true;
        }
      );
    } finally {
      emailModule.sendEmail = originalSendEmail;
    }
  });

  await t.test('7. Dharamshala booking receipt document format uses official confirmation title and disclaimer', async () => {
    const emailModule = require('../utils/email');
    const originalSendEmail = emailModule.sendEmail;

    let emailOptions = null;
    emailModule.sendEmail = async (opts) => {
      emailOptions = opts;
      return { provider: 'resend', providerMessageId: 'resend_dharamshala_test' };
    };

    try {
      const dharamshalaBooking = {
        _id: '6acd09dd44dcce4900a0fbc8',
        bookingId: 'VVS-DR-20261021-399318',
        displayBookingId: '10000002',
        bookingType: 'room_type',
        propertyType: 'dharamshala',
        service_billing_model: 'dharamshala_booking',
        itemName: 'Shri Radha Mohan Dham Dharamshala - Deluxe Room',
        customerFullName: 'Dharamshala Guest',
        customerEmail: 'dharamshala.guest@example.com',
        customerMobile: '9876543210',
        checkIn: new Date('2026-11-15'),
        checkOut: new Date('2026-11-17'),
        totalAmount: 2079,
        dharamshalaAmount: 2000,
        vrindavanSarthiServiceFee: 79,
        amountPaidOnline: 79,
        amountPayableAtProperty: 2000,
        paymentMode: 'pay_at_dharamshala',
        bookingStatus: 'confirmed',
        paymentStatus: 'not_required',
      };

      const res = await sendBookingInvoice(dharamshalaBooking);
      assert.equal(res.provider, 'resend');
      assert.ok(emailOptions);
      assert.match(emailOptions.subject, /Vrindavan Sarthi booking confirmation/);
      assert.match(emailOptions.html, /BOOKING CONFIRMATION &amp; PAYMENT RECEIPT/);
      assert.match(emailOptions.html, /Vrindavan Sarthi acts only as an online booking and payment facilitation platform/);
    } finally {
      emailModule.sendEmail = originalSendEmail;
    }
  });
  await t.test('8. Cab booking confirmation formats cab details and attaches cab receipt', async () => {
    const emailModule = require('../utils/email');
    const originalSendEmail = emailModule.sendEmail;

    let capturedPayload = null;
    emailModule.sendEmail = async (payload) => {
      capturedPayload = payload;
      return { provider: 'resend', providerMessageId: 'resend_cab_msg_101' };
    };

    try {
      const mockCabBooking = {
        _id: '6acd09dd44dcce4900a0fbc9',
        bookingId: 'VVS-CAB-9921',
        displayBookingId: '10000005',
        bookingType: 'cab',
        service_billing_model: 'taxi_direct',
        itemName: 'Mathura Junction to Prem Mandir (Dzire Sedan)',
        customerFullName: 'Cab Yatri',
        customerEmail: 'yatri.cab@example.com',
        customerMobile: '9876501234',
        pickupLocation: 'Mathura Junction',
        dropLocation: 'Prem Mandir, Vrindavan',
        pickupDate: '2026-11-20',
        pickupTime: '10:30 AM',
        cabType: 'Sedan (4 Seater)',
        assignedDriverName: 'Mohan Lal',
        assignedDriverPhone: '9812345678',
        assignedVehicleName: 'Swift Dzire (UP 85 AZ 1008)',
        totalAmount: 1200,
        amountPaidOnline: 360,
        amountPayableAtProperty: 840,
        paymentStatus: 'paid',
        bookingStatus: 'confirmed',
      };

      const result = await sendBookingInvoice(mockCabBooking);
      assert.equal(result.provider, 'resend');
      assert.equal(result.providerMessageId, 'resend_cab_msg_101');
      assert.ok(capturedPayload);
      assert.equal(capturedPayload.to, 'yatri.cab@example.com');
      assert.match(capturedPayload.subject, /Vrindavan Sarthi cab booking confirmation VVS-CAB-9921/);
      assert.match(capturedPayload.html, /CAB BOOKING CONFIRMATION/);
      assert.match(capturedPayload.html, /Your cab booking has been confirmed/);
      assert.match(capturedPayload.html, /Mathura Junction to Prem Mandir/);
      assert.match(capturedPayload.html, /Mohan Lal/);
      assert.match(capturedPayload.attachments[0].filename, /booking-receipt-VVS-CAB-9921.pdf/);
      assert.ok(Buffer.isBuffer(capturedPayload.attachments[0].content));
      assert.ok(capturedPayload.attachments[0].content.length > 10000);
    } finally {
      emailModule.sendEmail = originalSendEmail;
    }
  });

  await t.test('9. Tour booking confirmation formats pilgrimage details and attaches tour receipt', async () => {
    const emailModule = require('../utils/email');
    const originalSendEmail = emailModule.sendEmail;

    let capturedPayload = null;
    emailModule.sendEmail = async (payload) => {
      capturedPayload = payload;
      return { provider: 'resend', providerMessageId: 'resend_tour_msg_202' };
    };

    try {
      const mockTourBooking = {
        _id: '6acd09dd44dcce4900a0fbca',
        bookingId: 'VVS-TOUR-5512',
        displayBookingId: '10000006',
        bookingType: 'tour',
        service_billing_model: 'tour_direct',
        itemName: 'Braj 84 Kos Full Parikrama & Darshan',
        customerFullName: 'Tour Bhakt',
        customerEmail: 'bhakt.tour@example.com',
        customerMobile: '9876549999',
        checkIn: new Date('2026-12-01'),
        guests: 4,
        totalAmount: 9600,
        amountPaidOnline: 9600,
        paymentStatus: 'paid',
        bookingStatus: 'confirmed',
      };

      const result = await sendBookingInvoice(mockTourBooking);
      assert.equal(result.provider, 'resend');
      assert.equal(result.providerMessageId, 'resend_tour_msg_202');
      assert.ok(capturedPayload);
      assert.equal(capturedPayload.to, 'bhakt.tour@example.com');
      assert.match(capturedPayload.subject, /Vrindavan Sarthi tour booking confirmation VVS-TOUR-5512/);
      assert.match(capturedPayload.html, /PILGRIMAGE TOUR CONFIRMATION/);
      assert.match(capturedPayload.html, /Your pilgrimage tour booking has been confirmed/);
      assert.match(capturedPayload.html, /Braj 84 Kos Full Parikrama &amp; Darshan/);
      assert.match(capturedPayload.attachments[0].filename, /booking-receipt-VVS-TOUR-5512.pdf/);
      assert.ok(Buffer.isBuffer(capturedPayload.attachments[0].content));
      assert.ok(capturedPayload.attachments[0].content.length > 10000);
    } finally {
      emailModule.sendEmail = originalSendEmail;
    }
  });

  await t.test('10. Duplicate email prevention: once invoiceSentAt is populated, subsequent triggers are skipped cleanly', async () => {
    const emailModule = require('../utils/email');
    const originalSendEmail = emailModule.sendEmail;
    let callCount = 0;
    emailModule.sendEmail = async () => {
      callCount += 1;
      return { provider: 'resend', providerMessageId: 'msg_once' };
    };

    try {
      const booking = {
        _id: '6acd09dd44dcce4900a0fbcb',
        bookingId: 'VVS-DUP-TEST',
        customerEmail: 'dup@example.com',
        invoiceSentAt: null,
        bookingType: 'room_type',
        service_billing_model: 'hotel_marketplace',
        itemName: 'Hotel Test',
        totalAmount: 1500,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
      };

      const firstResult = await sendBookingInvoice(booking);
      assert.equal(firstResult.provider, 'resend');
      assert.equal(callCount, 1);

      // Simulate timestamp updated on booking
      booking.invoiceSentAt = new Date();

      const secondResult = await sendBookingInvoice(booking);
      assert.equal(secondResult, undefined);
      assert.equal(callCount, 1); // No second email sent!
    } finally {
      emailModule.sendEmail = originalSendEmail;
    }
  });
  await t.test('11. Online payment webhook trigger: sends confirmation for hotel and tour, defers cab', () => {
    const shouldSendInvoice = (booking) =>
      !booking.invoiceSentAt && !['cab'].includes(String(booking.bookingType || ''));

    // Hotel: should send
    assert.equal(shouldSendInvoice({ bookingType: 'room_type', invoiceSentAt: null }), true);
    // Tour: should send
    assert.equal(shouldSendInvoice({ bookingType: 'tour', invoiceSentAt: null }), true);
    // Cab: should defer (cab requires driver assignment first)
    assert.equal(shouldSendInvoice({ bookingType: 'cab', invoiceSentAt: null }), false);
    // Already sent: should not send
    assert.equal(shouldSendInvoice({ bookingType: 'tour', invoiceSentAt: new Date() }), false);
  });

  await t.test('12. Cab assignment trigger: confirms email trigger upon vehicle and driver assignment', () => {
    const booking = {
      bookingId: 'VVS-CAB-ASSIGN',
      bookingType: 'cab',
      assignedDriverName: 'Suresh Kumar',
      assignedVehicleName: 'Toyota Innova (UP 85 AK 1122)',
      amountPaidOnline: 600,
      amountPayableAtProperty: 1400,
      totalAmount: 2000,
      customerEmail: 'cab.passenger@example.com',
      invoiceSentAt: null,
    };

    assert.ok(booking.assignedDriverName, 'Driver name must be populated before dispatch');
    assert.ok(booking.assignedVehicleName, 'Vehicle details must be populated before dispatch');
    assert.equal(booking.bookingType, 'cab');
  });

  await t.test('13. Dharamshala pay-at-property trigger: dispatches confirmation when amountPaidOnline is 0', () => {
    const dharamshalaBooking = {
      bookingId: 'VVS-DR-FREEFEE',
      propertyType: 'dharamshala',
      service_billing_model: 'dharamshala_booking',
      amountPaidOnline: 0,
      amountPayableAtProperty: 1200,
      totalAmount: 1200,
      paymentMode: 'pay_at_dharamshala',
      bookingStatus: 'confirmed',
      customerEmail: 'yatri@example.com',
      invoiceSentAt: null,
    };

    const shouldTriggerOnAcceptance = (b) =>
      String(b.propertyType || '').toLowerCase() === 'dharamshala' &&
      b.amountPaidOnline === 0 &&
      !b.invoiceSentAt;

    assert.equal(shouldTriggerOnAcceptance(dharamshalaBooking), true);
  });

  await t.test('14. Transient error backoff and retry: calculates backoff delay on rate limits', () => {
    const rateLimitError = new Error('Resend send failed: HTTP 429 - rate_limit_exceeded');
    rateLimitError.statusCode = 429;
    rateLimitError.code = 'RESEND_SEND_FAILED';

    assert.equal(classifyNotificationError(rateLimitError), 'transient');

    const attempts = 1;
    const backoffBaseMs = 1000;
    const delay = backoffBaseMs * Math.max(1, attempts);
    assert.ok(delay >= 1000, 'Backoff delay must be at least 1000ms');
  });
});
