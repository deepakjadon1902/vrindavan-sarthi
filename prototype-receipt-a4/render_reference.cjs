const path = require('path');
const { renderReceiptToFiles } = require('./generate.cjs');

const referenceBookingData = {
  bookingId: 'VVS-DR-20261023-191395',
  bookingType: 'dharamshala',
  service_billing_model: 'dharamshala_booking',
  propertyName: 'Shri Giriraj Sewa Sadan',
  partnerName: 'Shri Giriraj Sewa Sadan',
  propertyId: 'VVS-P-1023',
  partnerId: 'VVS-P-1023',
  roomType: 'Double Bed',
  roomNumber: '203',
  roomId: '203',
  propertyAddress: 'Keshav Dham Road, Opposite Prem Mandir, Vrindavan',
  nearestTemple: 'Near Prem Mandir',
  checkIn: '2026-10-26T00:00:00.000Z',
  checkOut: '2026-10-27T00:00:00.000Z',
  checkInTime: '12:00 PM',
  checkOutTime: '11:00 AM',
  nights: 1,
  totalNights: 1,
  guests: '1 Guest(s)',
  totalAdults: 1,
  rooms: 1,
  customerFullName: 'Vrindavan Sarthi',
  guestId: 'VVS-G-191395',
  customerMobile: '6396147954',
  customerEmail: 'vrindavansarthi108@gmail.com',
  customerCity: 'Vrindavan',
  customerDistrict: 'Mathura',
  customerState: 'Uttar Pradesh',
  dharamshalaAmount: 1200,
  baseAmount: 1200,
  vrindavanSarthiServiceFee: 99,
  totalAmount: 1299,
  amountPaidOnline: 99,
  amountPayableAtProperty: 1200,
  paymentStatus: 'paid',
  bookingStatus: 'confirmed',
  paymentMethod: 'online',
  razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
  paidAt: '2026-10-23T13:48:43.596Z',
  createdAt: '2026-10-23T13:43:28.185Z',
  googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
  partnerPhone: '+91 9927600017',
  verificationUrl: 'https://www.vrindavansarthi.in/verify-booking?ref=VVS-DR-20261023-191395'
};

(async () => {
  const outHtml = path.join(__dirname, 'reference_booking.html');
  const outPdf = path.join(__dirname, 'reference_booking.pdf');
  const outPng = path.join(__dirname, 'reference_booking.png');

  console.log('Rendering reference booking prototype...');
  const res = await renderReceiptToFiles(referenceBookingData, outHtml, outPdf, outPng);
  console.log('Done! Generated:');
  console.log('- HTML:', outHtml);
  console.log(`- PDF:  ${outPdf} (${res.pdfSize} bytes)`);
  console.log(`- PNG:  ${outPng} (${res.pngSize} bytes)`);
})().catch(err => {
  console.error('Error generating receipt:', err);
  process.exit(1);
});
