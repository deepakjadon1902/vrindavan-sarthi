const fs = require('fs');
const path = require('path');
const { buildBookingReceiptPdf } = require(path.resolve(__dirname, '../backend/utils/bookingReceiptPdf'));

// 1. Invoice WITH Category ID
const bookingWithCat = {
  bookingId: 'VVS-2026-CAT-2001',
  displayBookingId: '10000088',
  bookingType: 'room_type',
  service_billing_model: 'dharamshala_booking',
  itemName: 'Shri Radha Mohan Dham Dharamshala - Deluxe AC Room',
  propertyName: 'Shri Radha Mohan Dham Dharamshala',
  propertyId: '100001',
  categoryId: '2001',
  roomNumber: '102',
  roomId: '1002',
  nearestTemple: 'Prem Mandir',
  propertyLocation: 'Opposite Prem Mandir, Raman Reti, Vrindavan',
  totalAmount: 2079,
  amountPaidOnline: 79,
  amountPayableAtProperty: 2000,
  paymentStatus: 'paid',
  bookingStatus: 'confirmed',
  customerFullName: 'Ram Mohan Sharma',
  customerMobile: '9876543210',
  customerEmail: 'ram.mohan@example.com',
  checkIn: '2026-11-10T12:00:00.000Z',
  checkOut: '2026-11-12T10:00:00.000Z',
  createdAt: '2026-10-24T10:00:00.000Z',
};

const roomTypeWithCat = {
  _id: 'rt_2001',
  name: 'Deluxe AC Room',
  categoryId: '2001',
};

const hotelWithCat = {
  _id: 'h_100001',
  name: 'Shri Radha Mohan Dham Dharamshala',
  propertyId: '100001',
  nearestTemple: 'Prem Mandir',
  location: 'Vrindavan',
  propertyType: 'dharamshala',
};

const resWith = buildBookingReceiptPdf(bookingWithCat, { hotel: hotelWithCat, roomType: roomTypeWithCat });
fs.writeFileSync('scratch/invoice_with_category_id.pdf', resWith.buffer);

const textWith = resWith.buffer.toString('binary');
console.log('=== INVOICE WITH CATEGORY ID ===');
console.log('Contains "Category: Deluxe AC Room":', textWith.includes('Category: Deluxe AC Room'));
console.log('Contains "Category ID: 2001":', textWith.includes('Category ID: 2001'));
console.log('Contains "Property ID: 100001":', textWith.includes('Property ID: 100001'));
console.log('Contains "10000088":', textWith.includes('10000088'));

// 2. Invoice WITHOUT Category ID
const bookingWithoutCat = {
  bookingId: 'VVS-2026-NO-CAT',
  displayBookingId: '10000089',
  bookingType: 'room_type',
  service_billing_model: 'dharamshala_booking',
  itemName: 'Braj Seva Ashram - Non-AC Room',
  propertyName: 'Braj Seva Ashram',
  propertyId: '100002',
  categoryId: null, // deliberately null
  roomNumber: null, // unallocated
  roomId: null,
  nearestTemple: 'Kirti Mandir',
  propertyLocation: 'Barsana Marg, Near Kirti Mandir',
  totalAmount: 1579,
  amountPaidOnline: 79,
  amountPayableAtProperty: 1500,
  paymentStatus: 'paid',
  bookingStatus: 'confirmed',
  customerFullName: 'Shyam Sundar',
  customerMobile: '9876543211',
  customerEmail: 'shyam.sundar@example.com',
  checkIn: '2026-11-15T12:00:00.000Z',
  checkOut: '2026-11-17T10:00:00.000Z',
  createdAt: '2026-10-24T11:00:00.000Z',
};

const roomTypeWithoutCat = {
  _id: 'rt_no_cat',
  name: 'Non-AC Room',
  // categoryId is null/omitted
};

const hotelWithoutCat = {
  _id: 'h_100002',
  name: 'Braj Seva Ashram',
  propertyId: '100002',
  nearestTemple: 'Near Kirti Mandir',
  location: 'Barsana',
  propertyType: 'dharamshala',
};

const resWithout = buildBookingReceiptPdf(bookingWithoutCat, { hotel: hotelWithoutCat, roomType: roomTypeWithoutCat });
fs.writeFileSync('scratch/invoice_without_category_id.pdf', resWithout.buffer);

const textWithout = resWithout.buffer.toString('binary');
console.log('\n=== INVOICE WITHOUT CATEGORY ID ===');
console.log('Contains "Category: Non-AC Room":', textWithout.includes('Category: Non-AC Room'));
console.log('Contains "Category ID:":', textWithout.includes('Category ID:'));
console.log('Contains "null":', textWithout.includes('null'));
console.log('Contains "undefined":', textWithout.includes('undefined'));
console.log('Contains "Property ID: 100002":', textWithout.includes('Property ID: 100002'));
console.log('Contains "10000089":', textWithout.includes('10000089'));
console.log('Contains "Room: Allocated at Check-in":', textWithout.includes('Room: Allocated at Check-in'));
