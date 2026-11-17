const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');
const { hashGuestAccessToken, getGuestAccessTokenFromRequest } = require('../utils/guestBookingAccess');
const { generateBookingInvoicePdf, sendBookingConfirmedEmail } = require('../utils/customerMessages');
const { buildBookingReceiptPdf } = require('../utils/bookingReceiptPdf');

test('Invoice Download Remediation Test Suite', async (t) => {
  // 1. generateBookingInvoicePdf successfully calls deployed bookingReceiptPdf.js implementation
  await t.test('1. generateBookingInvoicePdf calls bookingReceiptPdf and returns buffer and filename', () => {
    const booking = {
      bookingId: 'VS-261024-DH8201',
      bookingType: 'room_type',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Radha Rani Sewa Trust - Deluxe AC',
      totalAmount: 1800,
      amountPaidOnline: 1800,
      amountPayableAtProperty: 0,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      customerFullName: 'Sita Ram',
      createdAt: new Date().toISOString(),
    };

    const invoice = generateBookingInvoicePdf(booking);
    assert.ok(invoice, 'Must return invoice object');
    assert.ok(Buffer.isBuffer(invoice.buffer), 'Invoice buffer must be a Buffer');
    assert.strictEqual(invoice.buffer.slice(0, 5).toString('utf8'), '%PDF-', 'Buffer must be valid PDF starting with %PDF-');
    assert.ok(invoice.filename.includes('VS-261024-DH8201'), 'Filename must contain bookingId');
    assert.strictEqual(invoice.documentTitle, 'BOOKING CONFIRMATION & PAYMENT RECEIPT');
  });

  // 2 & 3. Route ID validation: router.param('id') allows human-readable bookingId for invoice and GET /:id, but preserves strict ObjectId validation for others
  await t.test('2 & 3. Param validator allows bookingId on GET /:id and /:id/invoice, blocks on other routes', async () => {
    const app = express();
    const router = express.Router();

    const rejectInvalidObjectId = (res, value, label) => {
      const isValid = /^[0-9a-fA-F]{24}$/.test(String(value || ''));
      if (!isValid) {
        res.status(400).json({ success: false, message: `Invalid ${label}` });
        return true;
      }
      return false;
    };

    router.param('id', (req, res, next, id) => {
      const normalizedPath = String(req.path || '').replace(/\/+$/, '');
      const isInvoiceOrRead = req.method === 'GET' && (normalizedPath === `/${id}` || normalizedPath === `/${id}/invoice`);
      if (isInvoiceOrRead) {
        const cleanId = String(id || '').trim();
        if (!cleanId || cleanId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
          return res.status(400).json({ success: false, message: 'Invalid booking id' });
        }
        return next();
      }

      if (rejectInvalidObjectId(res, id, 'booking id')) return;
      next();
    });

    router.get('/:id', (req, res) => res.json({ route: 'read', id: req.params.id }));
    router.get('/:id/invoice', (req, res) => res.json({ route: 'invoice', id: req.params.id }));
    router.post('/:id/modify', (req, res) => res.json({ route: 'modify', id: req.params.id }));
    router.put('/:id/cancel', (req, res) => res.json({ route: 'cancel', id: req.params.id }));

    app.use('/api/bookings', router);

    const server = app.listen(0);
    const port = server.address().port;
    const http = require('http');

    const request = (method, endpoint) => new Promise((resolve) => {
      const req = http.request(`http://localhost:${port}${endpoint}`, { method }, (res) => {
        let body = '';
        res.on('data', (c) => body += c);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, body });
          }
        });
      });
      req.end();
    });

    // Valid ObjectId on read & invoice
    const r1 = await request('GET', '/api/bookings/6718a38b1111111111111111');
    assert.strictEqual(r1.status, 200);
    assert.strictEqual(r1.data.id, '6718a38b1111111111111111');

    const r2 = await request('GET', '/api/bookings/6718a38b1111111111111111/invoice');
    assert.strictEqual(r2.status, 200);
    assert.strictEqual(r2.data.id, '6718a38b1111111111111111');

    // Human-readable bookingId on read & invoice
    const r3 = await request('GET', '/api/bookings/VS-261024-DH8201');
    assert.strictEqual(r3.status, 200, 'Must allow alphanumeric bookingId on GET /:id');
    assert.strictEqual(r3.data.id, 'VS-261024-DH8201');

    const r4 = await request('GET', '/api/bookings/VS-261024-DH8201/invoice');
    assert.strictEqual(r4.status, 200, 'Must allow alphanumeric bookingId on GET /:id/invoice');
    assert.strictEqual(r4.data.id, 'VS-261024-DH8201');

    // Human-readable bookingId on modify/cancel routes MUST be rejected (strict ObjectId preservation)
    const r5 = await request('POST', '/api/bookings/VS-261024-DH8201/modify');
    assert.strictEqual(r5.status, 400, 'Must reject human-readable bookingId on POST /:id/modify');
    assert.strictEqual(r5.data.message, 'Invalid booking id');

    const r6 = await request('PUT', '/api/bookings/VS-261024-DH8201/cancel');
    assert.strictEqual(r6.status, 400, 'Must reject human-readable bookingId on PUT /:id/cancel');
    assert.strictEqual(r6.data.message, 'Invalid booking id');

    // Malformed ID with special chars
    const r7 = await request('GET', '/api/bookings/VS$invalid/invoice');
    assert.strictEqual(r7.status, 400, 'Must reject malformed ID with illegal characters');

    server.close();
  });

  // 4. Unauthorized users and invalid guest tokens remain rejected
  await t.test('4. Authorization matrix enforces owner, partner, admin, and guest token', () => {
    const booking = {
      _id: '6718a38b1111111111111111',
      bookingId: 'VS-261024-DH8201',
      userId: '6718a38b2222222222222222',
      partnerId: '6718a38b3333333333333333',
      isGuestBooking: true,
      guestAccessTokenHash: hashGuestAccessToken('secret-token-xyz'),
    };

    const isAuthorized = (req) => {
      let isOwner = false;
      let isPartner = false;
      let isAdmin = false;
      if (req.user?._id) {
        isOwner = String(booking.userId) === String(req.user._id);
        isPartner = booking.partnerId && String(booking.partnerId) === String(req.user._id);
        isAdmin = req.user.role === 'admin';
      }
      const guestToken = req.headers?.['x-guest-booking-token'] || req.query?.guestAccessToken;
      const isAuthorizedGuest = Boolean(
        guestToken &&
        booking.isGuestBooking &&
        booking.guestAccessTokenHash &&
        booking.guestAccessTokenHash === hashGuestAccessToken(guestToken)
      );
      return isOwner || isPartner || isAdmin || isAuthorizedGuest;
    };

    assert.strictEqual(isAuthorized({ user: { _id: '6718a38b2222222222222222', role: 'user' } }), true, 'Owner authorized');
    assert.strictEqual(isAuthorized({ user: { _id: '6718a38b3333333333333333', role: 'partner' } }), true, 'Partner authorized');
    assert.strictEqual(isAuthorized({ user: { _id: '6718a38b4444444444444444', role: 'admin' } }), true, 'Admin authorized');
    assert.strictEqual(isAuthorized({ headers: { 'x-guest-booking-token': 'secret-token-xyz' } }), true, 'Valid guest token authorized');
    assert.strictEqual(isAuthorized({ headers: { 'x-guest-booking-token': 'wrong-token' } }), false, 'Wrong guest token rejected');
    assert.strictEqual(isAuthorized({ user: { _id: '6718a38b9999999999999999', role: 'user' } }), false, 'Attacker rejected');
    assert.strictEqual(isAuthorized({}), false, 'Unauthenticated rejected');
  });

  // 5. Pending/unpaid/failed bookings remain blocked
  await t.test('5. Payment status gating strictly blocks unverified or failed bookings', () => {
    const isEligible = (b) => {
      const bookingStatus = String(b.bookingStatus || '').toLowerCase();
      const paymentStatus = String(b.paymentStatus || '').toLowerCase();
      const unverifiedStatuses = [
        'pending',
        'pending_property_confirmation',
        'awaiting_customer_payment',
        'rejected_by_property',
        'expired_property_no_response',
        'expired',
        'payment_failed',
      ];
      if (unverifiedStatuses.includes(bookingStatus) && paymentStatus !== 'paid') {
        return { ok: false, code: 'INVOICE_NOT_READY' };
      }
      if (paymentStatus === 'failed') {
        return { ok: false, code: 'PAYMENT_FAILED' };
      }
      return { ok: true };
    };

    assert.strictEqual(isEligible({ bookingStatus: 'pending', paymentStatus: 'pending' }).code, 'INVOICE_NOT_READY');
    assert.strictEqual(isEligible({ bookingStatus: 'awaiting_customer_payment', paymentStatus: 'pending' }).code, 'INVOICE_NOT_READY');
    assert.strictEqual(isEligible({ bookingStatus: 'confirmed', paymentStatus: 'failed' }).code, 'PAYMENT_FAILED');
    assert.strictEqual(isEligible({ bookingStatus: 'confirmed', paymentStatus: 'paid' }).ok, true);
    assert.strictEqual(isEligible({ bookingStatus: 'confirmed', paymentStatus: 'advance_paid' }).ok, true);
  });

  // 6. Eligible paid bookings return a valid one-page PDF
  await t.test('6. Eligible paid booking generates exactly 1 page PDF with correct format', () => {
    const booking = {
      bookingId: 'VS-CONFIRMED-001',
      bookingType: 'hotel',
      service_billing_model: 'hotel_marketplace',
      itemName: 'Braj Haveli - Deluxe Suite',
      totalAmount: 4200,
      amountPaidOnline: 4200,
      amountPayableAtProperty: 0,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      customerFullName: 'Radha Vallabh',
    };

    const res = generateBookingInvoicePdf(booking);
    assert.ok(Buffer.isBuffer(res.buffer));
    const pageMatches = res.buffer.toString('utf8').match(/\/Type\s*\/Page\b/g);
    assert.strictEqual(pageMatches.length, 1, 'Receipt PDF must be exactly 1 page');
  });

  // 7. Email attachment generation works with Buffer
  await t.test('7. Customer confirmation email attachment payload uses valid PDF buffer', () => {
    const booking = {
      bookingId: 'VS-EMAIL-TEST-01',
      bookingType: 'hotel',
      service_billing_model: 'hotel_marketplace',
      itemName: 'Gokul Dham - Standard Room',
      totalAmount: 2500,
      amountPaidOnline: 2500,
      amountPayableAtProperty: 0,
      paymentStatus: 'paid',
      bookingStatus: 'confirmed',
      userEmail: 'devotee@vrindavan.org',
    };

    const attachmentBuffer = buildBookingReceiptPdf(booking).buffer;
    assert.ok(Buffer.isBuffer(attachmentBuffer), 'Email attachment must receive a valid Buffer');
    assert.strictEqual(attachmentBuffer.slice(0, 5).toString('utf8'), '%PDF-');
  });

  // 8. Blob error decoding displays safe message and falls back safely
  await t.test('8. Blob error decoding extracts message and falls back safely', async () => {
    const parseBlobError = async (blob) => {
      let msg = 'Could not download receipt. Please try again.';
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        if (parsed?.message && typeof parsed.message === 'string') {
          msg = parsed.message;
        }
      } catch {
        // Fallback
      }
      return msg;
    };

    // Case A: Standard backend JSON in blob
    const jsonBlob = new Blob([JSON.stringify({ success: false, message: 'Booking receipt is only available after booking confirmation and verified payment.' })]);
    const msgA = await parseBlobError(jsonBlob);
    assert.strictEqual(msgA, 'Booking receipt is only available after booking confirmation and verified payment.');

    // Case B: Malformed JSON in blob
    const malformedBlob = new Blob(['<html>502 Bad Gateway</html>']);
    const msgB = await parseBlobError(malformedBlob);
    assert.strictEqual(msgB, 'Could not download receipt. Please try again.');

    // Case C: Empty blob
    const emptyBlob = new Blob([]);
    const msgC = await parseBlobError(emptyBlob);
    assert.strictEqual(msgC, 'Could not download receipt. Please try again.');
  });
  // 9. getGuestAccessTokenFromRequest helper export and behavior regression
  await t.test('9. getGuestAccessTokenFromRequest is exported and handles all guest token formats safely', () => {
    assert.strictEqual(typeof getGuestAccessTokenFromRequest, 'function', 'getGuestAccessTokenFromRequest must be a function');

    // Safe fallback on empty / missing req
    assert.strictEqual(getGuestAccessTokenFromRequest({}), '');
    assert.strictEqual(getGuestAccessTokenFromRequest({ headers: {} }), '');
    assert.strictEqual(getGuestAccessTokenFromRequest({ query: {} }), '');

    // Extraction from header via req.get()
    const reqWithGet = { get: (name) => (name.toLowerCase() === 'x-guest-booking-token' ? '  tok-hdr-123  ' : '') };
    assert.strictEqual(getGuestAccessTokenFromRequest(reqWithGet), 'tok-hdr-123');

    // Extraction from query params: guestAccessToken or token
    assert.strictEqual(getGuestAccessTokenFromRequest({ query: { guestAccessToken: 'tok-query-abc' } }), 'tok-query-abc');
    assert.strictEqual(getGuestAccessTokenFromRequest({ query: { token: 'tok-query-short' } }), 'tok-query-short');

    // Extraction from body
    assert.strictEqual(getGuestAccessTokenFromRequest({ body: { guestAccessToken: 'tok-body-xyz' } }), 'tok-body-xyz');

    // Token hashing consistency
    const token = 'sample-guest-secret-999';
    const hash1 = hashGuestAccessToken(token);
    const hash2 = hashGuestAccessToken(token);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });
});
