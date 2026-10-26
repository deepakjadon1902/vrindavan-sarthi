const fs = require('fs');
const path = require('path');
const qrcode = require('../backend/node_modules/qrcode');

// Test data matching real Dharamshala booking VVS-DR-20261023-191395
const sampleBooking = {
  _id: '6adb64804d6f6cd4d284f6f3',
  bookingId: 'VVS-DR-20261023-191395',
  bookingType: 'room_type',
  service_billing_model: 'dharamshala_booking',
  propertyType: 'dharamshala',
  propertyName: 'Shri Giriraj Sewa Sadan',
  propertyAddress: 'Keshav Dham Road Opposite prem Mandir, Vrindavan, Mathura, UP 281121',
  propertyLocation: 'Keshav Dham Road Opposite prem Mandir',
  nearestTemple: 'Prem Mandir (approx 200m)',
  googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
  partnerPhone: '9927600017',
  hotelId: '6adb64804d6f6cd4d284f1023',
  roomNumber: '104',
  itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
  checkIn: '2026-10-26T00:00:00.000Z',
  checkOut: '2026-10-27T00:00:00.000Z',
  checkInTime: '12:00 PM',
  guests: 1,
  totalAdults: 1,
  totalChildren: 0,
  roomQuantity: 1,
  totalAmount: 1299,
  dharamshalaAmount: 1200,
  baseAmount: 1200,
  vrindavanSarthiServiceFee: 99,
  amountPaidOnline: 99,
  amountPayableAtProperty: 1200,
  paymentOption: 'full_100', // Persisted from user selection, but balance > 0
  paymentMode: 'pay_at_dharamshala',
  paymentMethod: 'online',
  paymentStatus: 'paid',
  bookingStatus: 'confirmed',
  razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
  paidAt: '2026-10-23T13:48:43.596Z',
  createdAt: '2026-10-23T13:43:28.185Z',
  customerFullName: 'Vrindavan Sarthi Devotee',
  customerMobile: '6396147954',
  customerEmail: 'vrindavansarthi108@gmail.com',
  customerCity: 'Vrindavan',
  customerDistrict: 'Mathura',
  customerState: 'Uttar Pradesh',
};

// Check resolvePaymentModeLabel
function resolvePaymentModeLabel(b) {
  const isDharamshala =
    b.service_billing_model === 'dharamshala_booking' ||
    String(b.propertyType || '').toLowerCase() === 'dharamshala' ||
    b.bookingType === 'dharamshala';

  const total = Number(b.totalAmount || 0);
  const paid = Number(b.amountPaidOnline ?? b.advanceAmount ?? 0);
  const balance = Number(b.amountPayableAtProperty ?? b.balanceAmount ?? Math.max(0, total - paid));
  const isCab = b.bookingType === 'cab';

  if (balance > 0) {
    if (isDharamshala) {
      return 'Platform Fee Paid Online — Balance Payable at Property';
    }
    if (isCab) {
      return 'Advance Paid Online — Balance Payable to Driver';
    }
    if (b.paymentOption === 'advance_30') {
      return '30% Advance Paid Online — 70% Balance at Check-in';
    }
    return 'Advance Paid Online — Balance Payable at Property';
  }

  if (total > 0 && paid >= total) {
    if (b.paymentMethod === 'cash' || b.paymentMode === 'cash') {
      return 'Paid in Full (Cash / Direct)';
    }
    return 'Full Online Payment';
  }

  return b.paymentMethod === 'online' ? 'Online Payment' : 'Pay at Property';
}

console.log('Resolved Payment Mode for sample Dharamshala:', resolvePaymentModeLabel(sampleBooking));
console.log('Resolved for full paid:', resolvePaymentModeLabel({ totalAmount: 4000, amountPaidOnline: 4000, amountPayableAtProperty: 0 }));
console.log('Resolved for 30% advance:', resolvePaymentModeLabel({ totalAmount: 3500, amountPaidOnline: 1050, amountPayableAtProperty: 2450, paymentOption: 'advance_30' }));
