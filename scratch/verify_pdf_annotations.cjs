const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildBookingReceiptPdf } = require('./test_single_page_builder.cjs');

function testAnnotations() {
  console.log('Testing PDF Link Annotations and QR URL encoding...');
  const booking = {
    bookingId: 'VVS-DR-20261023-191395',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    propertyName: 'Shri Giriraj Sewa Sadan',
    propertyAddress: 'Keshav Dham Road Opposite prem Mandir, Vrindavan',
    googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    totalAmount: 1299,
    amountPaidOnline: 99,
    amountPayableAtProperty: 1200,
  };

  const { buffer } = buildBookingReceiptPdf(booking);
  const pdfStr = buffer.toString('utf8');

  // Verify link annotations
  assert.ok(pdfStr.includes('/Type /Annot /Subtype /Link'), 'Must contain PDF link annotations');
  assert.ok(pdfStr.includes('/URI (https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6)'), 'Must contain Google Maps URI annotation');
  assert.ok(pdfStr.includes('/URI (https://wa.me/918679820256?text=Namaste%20Vrindavan%20Sarthi%20Support)'), 'Must contain WhatsApp URI annotation');
  assert.ok(pdfStr.includes('/URI (https://www.vrindavansarthi.in/verify-booking?ref=VVS-DR-20261023-191395)'), 'Must contain QR verification URI annotation');

  console.log('  PASS: All 3 interactive link annotations are verified and active.\n');
}

testAnnotations();
