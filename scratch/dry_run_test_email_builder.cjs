const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { buildBookingReceiptPdf } = require('../backend/utils/bookingReceiptPdf');

async function dryRun() {
  const testBooking = {
    bookingId: '[TEST-NOT-A-REAL-BOOKING]-VVS-TEST-20261026',
    displayBookingId: '80009999',
    bookingType: 'room_type',
    service_billing_model: 'hotel_marketplace',
    itemName: '[DIAGNOSTIC TEST - NOT A REAL BOOKING] Radha Kripa Residency - Deluxe Room',
    customerFullName: 'Vrindavan Sarthi Test Suite',
    customerEmail: 'vrindavansarthi108@gmail.com',
    customerMobile: '9999999999',
    checkIn: new Date('2026-11-10'),
    checkOut: new Date('2026-11-12'),
    roomQuantity: 1,
    totalAmount: 1,
    amountPaidOnline: 1,
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    paymentMode: 'full_online',
    additionalInfo: 'AUTOMATED DIAGNOSTIC TEST ONLY - NO ACTUAL RESERVATION OR PAYMENT WAS PROCESSED.',
  };

  console.log('Generating in-memory PDF receipt...');
  const res = buildBookingReceiptPdf(testBooking);
  console.log('Generated PDF buffer length:', res.buffer?.length, 'bytes');
  console.log('PDF Header:', res.buffer?.slice(0, 8).toString('utf8'));
}

dryRun().catch(console.error);
