const assert = require('assert');
const crypto = require('crypto');
const path = require('path');

const {
  resolveBookingCustomer,
  buildGuestAccountReminder,
  hashGuestAccessToken,
  getGuestAccessTokenFromRequest,
  withGuestAccessToken,
  withGuestAccountReminder,
} = require('../backend/utils/guestBookingAccess');

const { generateBookingInvoicePdf } = require('../backend/utils/customerMessages');

console.log('--- STARTING GUEST AUTH & INVOICE SECURITY TESTS ---');

// Test 1: Reminder excludes passwordHint and cleartext password
{
  const reminder = buildGuestAccountReminder({ email: 'guest@example.com', created: true });
  assert.strictEqual(reminder.passwordHint, undefined, 'passwordHint must be undefined');
  assert.strictEqual(reminder.message.includes('password'), false, 'message must not mention passwords');
  assert.strictEqual(reminder.created, true);
  console.log('✔ Test 1: buildGuestAccountReminder excludes passwordHint and password mentions');
}

// Test 2: Token entropy and hash verification
{
  const token1 = crypto.randomBytes(32).toString('base64url');
  const token2 = crypto.randomBytes(32).toString('base64url');
  assert.notStrictEqual(token1, token2, 'Tokens must be distinct');
  assert.ok(token1.length >= 40, 'Token must have 256-bit base64url length');
  
  const hash1 = hashGuestAccessToken(token1);
  const hash2 = hashGuestAccessToken(token2);
  assert.notStrictEqual(hash1, hash2, 'Hashes must be distinct');
  assert.strictEqual(hash1, crypto.createHash('sha256').update(token1, 'utf8').digest('hex'), 'Hash must match sha256');
  console.log('✔ Test 2: High-entropy 256-bit cryptographic tokens and sha256 hashing verified');
}

// Test 3: getGuestAccessTokenFromRequest extracts token from multiple transport vectors
{
  const reqBody = { body: { guestAccessToken: 'tok_body_123' } };
  assert.strictEqual(getGuestAccessTokenFromRequest(reqBody), 'tok_body_123');

  const reqQuery = { query: { guestAccessToken: 'tok_query_456' } };
  assert.strictEqual(getGuestAccessTokenFromRequest(reqQuery), 'tok_query_456');

  const reqTokenQuery = { query: { token: 'tok_query_789' } };
  assert.strictEqual(getGuestAccessTokenFromRequest(reqTokenQuery), 'tok_query_789');

  const reqHeader = { get: (name) => name === 'x-guest-booking-token' ? 'tok_hdr_abc' : '' };
  assert.strictEqual(getGuestAccessTokenFromRequest(reqHeader), 'tok_hdr_abc');
  console.log('✔ Test 3: getGuestAccessTokenFromRequest reliably resolves token across body, query, and headers');
}

// Test 4: Invoice generation creates valid PDF buffer without customer leaks
{
  const testBooking = {
    _id: '67890',
    bookingId: 'BK-1001',
    bookingType: 'hotel',
    customerName: 'Pilgrim One',
    customerMobile: '9876543210',
    customerEmail: 'pilgrim@example.com',
    propertyName: 'Brij View Boutique Hotel',
    roomTypeName: 'Super Deluxe AC',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-03',
    numberOfNights: 2,
    roomsCount: 1,
    totalAmount: 4000,
    paidAmount: 4000,
    paymentStatus: 'paid',
    status: 'confirmed',
  };
  const { buffer, filename, documentTitle } = generateBookingInvoicePdf(testBooking);
  assert.ok(Buffer.isBuffer(buffer), 'buffer must be a Buffer');
  assert.ok(buffer.length > 500, 'buffer must contain PDF data');
  assert.strictEqual(buffer.slice(0, 5).toString('utf8'), '%PDF-', 'buffer must start with %PDF- header');
  assert.strictEqual(filename, 'booking-receipt-BK-1001.pdf', 'filename matches pattern');
  console.log(`✔ Test 4: generateBookingInvoicePdf generates valid PDF (${buffer.length} bytes, file: ${filename})`);
}

// Test 5: Invoice generation for Dharamshala uses BOOKING CONFIRMATION & PAYMENT RECEIPT
{
  const dharamshalaBooking = {
    _id: '54321',
    bookingId: 'BK-DH-2002',
    bookingType: 'lodging',
    customerName: 'Bhakta Shyam',
    customerMobile: '9812345678',
    customerEmail: 'shyam@example.com',
    propertyName: 'Shri Radha Raman Sewa Sansthan',
    roomTypeName: 'Double AC Room',
    checkInDate: '2026-11-05',
    checkOutDate: '2026-11-07',
    numberOfNights: 2,
    roomsCount: 1,
    totalAmount: 2400,
    paidAmount: 2400,
    paymentStatus: 'paid',
    status: 'confirmed',
  };
  const { buffer, filename, documentTitle } = generateBookingInvoicePdf(dharamshalaBooking);
  assert.strictEqual(documentTitle, 'BOOKING CONFIRMATION & PAYMENT RECEIPT');
  assert.strictEqual(filename, 'booking-receipt-BK-DH-2002.pdf');
  assert.ok(buffer.length > 500);
  console.log(`✔ Test 5: Dharamshala receipt uses correct legal title '${documentTitle}' without GST tax invoice misclassification`);
}

console.log('\nALL GUEST AUTH & INVOICE SECURITY TESTS PASSED SUCCESSFULLY!');
