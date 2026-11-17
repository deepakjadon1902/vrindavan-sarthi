const fs = require('fs');
let content = fs.readFileSync('backend/tests/booking-confirmation-email-flow.test.js', 'utf8');

const additionalTests = 
`  await t.test('8. Cab booking confirmation formats cab details and attaches cab receipt', async () => {
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
      assert.match(capturedPayload.attachments[0].filename, /booking-receipt-VVS-CAB-9921\.pdf/);
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
      assert.match(capturedPayload.attachments[0].filename, /booking-receipt-VVS-TOUR-5512\.pdf/);
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
});
`;

// Replace closing `});`
const lastClosing = content.lastIndexOf('});');
content = content.slice(0, lastClosing) + additionalTests;
fs.writeFileSync('backend/tests/booking-confirmation-email-flow.test.js', content, 'utf8');
console.log('Successfully appended tests to booking-confirmation-email-flow.test.js');
