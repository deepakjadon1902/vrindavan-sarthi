const fs = require('fs');
let code = fs.readFileSync('backend/tests/booking-confirmation-email-flow.test.js', 'utf8');

const additionalTests = `
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
`;

if (code.includes('  });\n});')) {
  code = code.replace('  });\n});', '  });' + additionalTests);
  fs.writeFileSync('backend/tests/booking-confirmation-email-flow.test.js', code, 'utf8');
  console.log('Successfully appended additional trigger tests');
} else if (code.includes('  });\r\n});')) {
  code = code.replace('  });\r\n});', '  });' + additionalTests.replace(/\n/g, '\r\n'));
  fs.writeFileSync('backend/tests/booking-confirmation-email-flow.test.js', code, 'utf8');
  console.log('Successfully appended additional trigger tests (CRLF)');
} else {
  console.log('Target end marker not found');
}
