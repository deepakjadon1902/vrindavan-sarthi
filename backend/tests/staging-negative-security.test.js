/**
 * VRINDAVAN SARTHI — STAGING NEGATIVE & SECURITY TEST SUITE
 * 
 * Tests cross-tenant isolation, unauthorized admin route access,
 * incomplete onboarding submission rejections, and overbooking prevention.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { assertIsolatedStagingEnvironment } = require('../utils/stagingGuard');
const { calculatePartnerOnboardingStatus } = require('../utils/partnerOnboarding');
const {
  validateDharamshalaFeeApproval,
  getDharamshalaFeeApprovalDisplay,
  acceptDharamshalaRequest,
  buildDharamshalaAccounting,
} = require('../utils/dharamshalaLifecycle');
const { payableAmountForBooking } = require('../utils/bookingPayable');
const { calculateRefund } = require('../services/refundCalculationService');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');
const { ADMIN_ROLE_PERMISSIONS } = require('../middleware/auth');
const partnerRoutes = require('../routes/partner.routes');
const policyRoutes = require('../routes/policy.routes');
const bookingRoutes = require('../routes/booking.routes');
const paymentRoutes = require('../routes/payment.routes');

const STAGING_URI = process.env.STAGING_MONGO_URI || 'mongodb://127.0.0.1:27018/vrindavan_sarthi_staging';

describe('Staging Negative & Security Test Suite', () => {
  let dbConnection = null;
  let httpServer = null;
  let baseUrl = '';
  let partnerA = null;
  let partnerB = null;
  let dharamPartner = null;
  let superAdmin = null;
  let hotelA = null;
  let hotelB = null;
  let customerUser = null;
  const createdHotelIds = [];
  const createdUserIds = [];
  const createdRoomTypeIds = [];
  const createdRoomUnitIds = [];
  const createdBookingIds = [];
  const createdAuditIds = [];
  let prevJwtSecret;
  let prevRzpKey;
  let prevRzpSecret;

  const signToken = (userId) => jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const jsonFetch = async (urlPath, { method = 'GET', token = '', body = undefined } = {}) => {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: typeof body === 'undefined' ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, data: json };
  };

  before(async () => {
    assertIsolatedStagingEnvironment(STAGING_URI);
    prevJwtSecret = process.env.JWT_SECRET;
    prevRzpKey = process.env.RAZORPAY_KEY_ID;
    prevRzpSecret = process.env.RAZORPAY_KEY_SECRET;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'staging_test_jwt_secret_key_592';
    process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_staging_mock_592';
    process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'staging_mock_secret_592';

    dbConnection = await mongoose.connect(STAGING_URI);

    const app = express();
    app.use(express.json());
    app.use('/api/partner', partnerRoutes);
    app.use('/api/policies', policyRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/payments', paymentRoutes);

    httpServer = http.createServer(app);
    await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const addr = httpServer.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    partnerA = await User.create({
      name: 'Tenant Partner A',
      email: `tenant_a_${Date.now()}@staging.local`,
      password: 'StagingPartner@123',
      phone: '+919876500001',
      role: 'partner',
      partnerStatus: 'approved',
    });

    partnerB = await User.create({
      name: 'Tenant Partner B',
      email: `tenant_b_${Date.now()}@staging.local`,
      password: 'StagingPartner@123',
      phone: '+919876500002',
      role: 'partner',
      partnerStatus: 'pending',
    });

    customerUser = await User.create({
      name: 'Test Customer',
      email: `customer_neg_${Date.now()}@staging.local`,
      password: 'CustomerPass@123',
      phone: '+919876500003',
      role: 'user',
    });

    hotelA = await Hotel.create({
      name: 'Hotel Tenant A',
      propertyType: 'hotel',
      location: 'Vrindavan',
      nearestTemple: 'Bankey Bihari',
      googleMapLink: 'https://maps.google.com/?q=27.58,77.70',
      contactPhone: '+919876500001',
      description: 'Exclusive Hotel A',
      partnerId: partnerA._id,
      partnerSubmitted: true,
      approvalStatus: 'approved',
      status: 'active',
    });

    hotelB = await Hotel.create({
      name: 'Hotel Tenant B',
      propertyType: 'hotel',
      location: 'Vrindavan',
      nearestTemple: 'Prem Mandir',
      googleMapLink: 'https://maps.google.com/?q=27.57,77.67',
      contactPhone: '+919876500002',
      description: 'Draft Hotel B',
      partnerId: partnerB._id,
      partnerSubmitted: false,
      approvalStatus: 'draft',
      status: 'inactive',
    });

    dharamPartner = await User.create({
      name: 'Dharamshala Partner Security Test',
      email: `dharam_partner_${Date.now()}@staging.local`,
      password: 'StagingPartner@123',
      phone: '+919876500009',
      role: 'partner',
      partnerStatus: 'approved',
      businessName: 'Govind Seva Sadan',
      businessAddress: 'Raman Reti, Vrindavan',
    });
    createdUserIds.push(dharamPartner._id);

    superAdmin = await User.create({
      name: 'Super Admin Security Test',
      email: `superadmin_${Date.now()}@staging.local`,
      password: 'StagingAdmin@123',
      phone: '+919876500010',
      role: 'admin',
      adminRole: 'super_admin',
    });
    createdUserIds.push(superAdmin._id);
  });

  after(async () => {
    const allHotelIds = [hotelA?._id, hotelB?._id, ...createdHotelIds].filter(Boolean);
    const allUserIds = [partnerA?._id, partnerB?._id, customerUser?._id, ...createdUserIds].filter(Boolean);
    await Booking.deleteMany({ $or: [{ _id: { $in: createdBookingIds } }, { hotelId: { $in: allHotelIds } }] });
    await AuditLog.deleteMany({ $or: [{ _id: { $in: createdAuditIds } }, { propertyId: { $in: allHotelIds } }, { targetEntityId: { $in: allHotelIds.map(String) } }] });
    await RoomUnitBookingDay.deleteMany({ hotelId: { $in: allHotelIds } });
    await RoomUnit.deleteMany({ $or: [{ _id: { $in: createdRoomUnitIds } }, { hotelId: { $in: allHotelIds } }] });
    await RoomType.deleteMany({ $or: [{ _id: { $in: createdRoomTypeIds } }, { hotelId: { $in: allHotelIds } }] });
    await Hotel.deleteMany({ _id: { $in: allHotelIds } });
    await User.deleteMany({ _id: { $in: allUserIds } });
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    if (dbConnection) {
      await mongoose.disconnect();
    }
    if (typeof prevJwtSecret === 'undefined') delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prevJwtSecret;
    if (typeof prevRzpKey === 'undefined') delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = prevRzpKey;
    if (typeof prevRzpSecret === 'undefined') delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = prevRzpSecret;
  });

  it('1. Cross-tenant isolation: Partner B status calculation does not see Partner A hotel', async () => {
    const statusB = await calculatePartnerOnboardingStatus(partnerB._id);
    assert.equal(String(statusB.hotel._id), String(hotelB._id));
    assert.notEqual(String(statusB.hotel._id), String(hotelA._id));
    assert.equal(statusB.hotel.name, 'Hotel Tenant B');
  });

  it('2. Incomplete onboarding gate: Incomplete property cannot be submitted', async () => {
    // Hotel B has no room types, physical units, pricing or photos
    const statusB = await calculatePartnerOnboardingStatus(partnerB._id);
    assert.equal(statusB.isReadyForSubmission, false);
    const incomplete = statusB.steps.filter((s) => s.stepNumber <= 11 && s.status !== 'completed');
    assert.ok(incomplete.length > 0, 'Must have incomplete prerequisite steps');
  });

  it('3. Overbooking prevention: Concurrent room-night lock acquisition rejects double-booking', async () => {
    const roomType = await RoomType.create({
      hotelId: hotelA._id,
      name: 'Deluxe Suite',
      pricePerNight: 2999,
      maxGuests: 2,
    });

    const roomUnit = await RoomUnit.create({
      hotelId: hotelA._id,
      roomTypeId: roomType._id,
      number: '201',
      status: 'available',
    });

    const targetDate = '2026-12-25';
    const fakeBookingId1 = new mongoose.Types.ObjectId();
    const fakeBookingId2 = new mongoose.Types.ObjectId();

    // First lock acquisition succeeds
    const lock1 = await RoomUnitBookingDay.create({
      roomUnitId: roomUnit._id,
      date: targetDate,
      bookingId: fakeBookingId1,
      hotelId: hotelA._id,
      roomTypeId: roomType._id,
    });
    assert.ok(lock1._id);

    // Second lock acquisition for the same physical room and same date must fail with duplicate key E11000
    let secondLockFailed = false;
    try {
      await RoomUnitBookingDay.create({
        roomUnitId: roomUnit._id,
        date: targetDate,
        bookingId: fakeBookingId2,
        hotelId: hotelA._id,
        roomTypeId: roomType._id,
      });
    } catch (err) {
      secondLockFailed = true;
      assert.equal(err.code, 11000, 'Must fail with unique compound index constraint error');
    }
    assert.equal(secondLockFailed, true, 'Second lock MUST fail to prevent double booking');
  });

  it('4. Role boundary: Regular customer cannot be queried as a valid partner onboarding entity', async () => {
    const statusCustomer = await calculatePartnerOnboardingStatus(customerUser._id);
    // Regular customer has no hotel, no partner KYC
    assert.equal(statusCustomer.hotel, null);
    assert.equal(statusCustomer.isApproved, false);
    assert.equal(statusCustomer.isReadyForSubmission, false);
  });

  // ---------------------------------------------------------------------------
  // PHASE 5.9.2: DHARAMSHALA FEE INTEGRITY & PARTNER SECURITY TESTS
  // ---------------------------------------------------------------------------

  it('5. Partner POST forged approvalStatus, dharamshalaFeeApprovalStatus, dharamshalaFeeConfigured, and fake history/version are stripped; new Dharamshala stays unconfigured', async () => {
    const partnerToken = signToken(dharamPartner._id);
    const res = await jsonFetch('/api/partner/hotels', {
      method: 'POST',
      token: partnerToken,
      body: {
        name: 'Govind Seva Sadan Dharamshala',
        propertyType: 'dharamshala',
        location: 'Raman Reti, Vrindavan',
        nearestTemple: 'ISKCON Vrindavan',
        googleMapLink: 'https://maps.google.com/?q=27.572,77.679',
        propertyTerms: {
          sections: { generalTerms: 'Peaceful ashram rules apply.' },
        },
        // Forged protected fields:
        approvalStatus: 'approved',
        status: 'active',
        dharamshalaFeeApprovalStatus: 'approved',
        dharamshalaFeeConfigured: true,
        dharamshalaServiceFee: 0,
        dharamshalaServiceFeeVersion: 99,
        dharamshalaPlatformFeeEnabled: false,
        platform_commission_percentage: 0,
        dharamshalaFeeHistory: [{ version: 99, fee: 0, reason: 'Forged history' }],
      },
    });

    assert.equal(res.status, 201);
    const created = res.data?.data;
    assert.ok(created?._id);
    createdHotelIds.push(created._id);

    assert.equal(created.approvalStatus, 'pending');
    assert.equal(created.status, 'inactive');
    assert.equal(created.dharamshalaFeeApprovalStatus, 'unconfigured');
    assert.equal(created.dharamshalaFeeConfigured, false);
    assert.equal(created.dharamshalaServiceFeeVersion, 1);
    assert.equal(Array.isArray(created.dharamshalaFeeHistory) ? created.dharamshalaFeeHistory.length : 0, 0);
    assert.equal(created.dharamshalaPlatformFeeEnabled, true);
    assert.equal(created.platform_commission_percentage, 10);

    // Even though schema default holds 79, new unconfigured Dharamshala must fail closed at booking gate.
    assert.throws(
      () => validateDharamshalaFeeApproval(created),
      (err) => err.statusCode === 400 && /pending owner review and approval/i.test(err.message)
    );
  });

  it('6. Partner PUT preserves previously admin-configured custom service fee, approval status, version, and history', async () => {
    const hotelId = createdHotelIds[0];
    assert.ok(hotelId, 'Dharamshala from previous test must exist');
    const adminToken = signToken(superAdmin._id);
    const partnerToken = signToken(dharamPartner._id);

    // Authorized admin configures custom ₹125 fee
    const adminFeeRes = await jsonFetch(`/api/policies/dharamshalas/${hotelId}/fee`, {
      method: 'PUT',
      token: adminToken,
      body: { fee: 125, reason: 'Authorized trust maintenance fee' },
    });
    assert.equal(adminFeeRes.status, 200);
    assert.equal(adminFeeRes.data?.data?.dharamshalaServiceFee, 125);
    assert.equal(adminFeeRes.data?.data?.dharamshalaFeeApprovalStatus, 'approved');

    // Partner updates description and tries to overwrite fee & approval fields via PUT
    const putRes = await jsonFetch(`/api/partner/hotels/${hotelId}`, {
      method: 'PUT',
      token: partnerToken,
      body: {
        name: 'Govind Seva Sadan Dharamshala',
        propertyType: 'dharamshala',
        location: 'Raman Reti, Vrindavan',
        nearestTemple: 'ISKCON Vrindavan',
        googleMapLink: 'https://maps.google.com/?q=27.572,77.679',
        description: 'Updated partner bio without altering fee governance.',
        propertyTerms: {
          sections: { generalTerms: 'Peaceful ashram rules apply.' },
        },
        dharamshalaServiceFee: 10,
        dharamshalaFeeApprovalStatus: 'explicitly_free',
        dharamshalaFeeConfigured: false,
        dharamshalaServiceFeeVersion: 1,
        dharamshalaFeeHistory: [],
        platform_commission_percentage: 1,
      },
    });

    assert.equal(putRes.status, 200);
    const updated = putRes.data?.data;
    assert.equal(updated.description, 'Updated partner bio without altering fee governance.');
    assert.equal(updated.dharamshalaServiceFee, 125, 'Partner PUT must preserve custom fee ₹125 instead of resetting to ₹79');
    assert.equal(updated.dharamshalaFeeApprovalStatus, 'approved');
    assert.equal(updated.dharamshalaFeeConfigured, true);
    assert.equal(updated.dharamshalaServiceFeeVersion, 2);
    assert.equal(updated.dharamshalaFeeHistory.length, 1);
    assert.equal(updated.platform_commission_percentage, 10);
  });

  it('7. Fail-closed gate rejects missing/null/unknown legacy approval states, pending_review+configured=true, and unconfigured state', () => {
    const baseHotel = {
      _id: new mongoose.Types.ObjectId(),
      propertyType: 'dharamshala',
      dharamshalaServiceFee: 79,
      dharamshalaPlatformFeeEnabled: true,
    };

    // Missing / null / unknown legacy states
    for (const badStatus of [undefined, null, '', 'legacy_approved', 'random_state']) {
      assert.throws(
        () => validateDharamshalaFeeApproval({
          ...baseHotel,
          dharamshalaFeeApprovalStatus: badStatus,
          dharamshalaFeeConfigured: true,
          dharamshalaFeeApprovedAt: new Date(),
        }),
        (err) => err.statusCode === 400
      );
    }

    // pending_review + configured=true + version > 1 must still reject
    assert.throws(
      () => validateDharamshalaFeeApproval({
        ...baseHotel,
        dharamshalaFeeApprovalStatus: 'pending_review',
        dharamshalaFeeConfigured: true,
        dharamshalaServiceFeeVersion: 3,
        dharamshalaFeeHistory: [{ version: 2, fee: 79, reason: 'old' }],
        dharamshalaFeeApprovedAt: new Date(),
      }),
      (err) => err.statusCode === 400
    );

    // unconfigured state rejects
    assert.throws(
      () => validateDharamshalaFeeApproval({
        ...baseHotel,
        dharamshalaFeeApprovalStatus: 'unconfigured',
        dharamshalaFeeConfigured: false,
      }),
      (err) => err.statusCode === 400
    );

    // Inconsistent explicitly_free (non-zero fee or unconfigured or no approval metadata) rejects
    assert.throws(
      () => validateDharamshalaFeeApproval({
        ...baseHotel,
        dharamshalaServiceFee: 79,
        dharamshalaFeeApprovalStatus: 'explicitly_free',
        dharamshalaFeeConfigured: true,
        dharamshalaFeeApprovedAt: new Date(),
      }),
      (err) => err.statusCode === 400
    );
    assert.throws(
      () => validateDharamshalaFeeApproval({
        ...baseHotel,
        dharamshalaServiceFee: 0,
        dharamshalaFeeApprovalStatus: 'explicitly_free',
        dharamshalaFeeConfigured: true,
      }),
      (err) => err.statusCode === 400
    );

    // Inconsistent approved (fee=0 or unconfigured or missing approval metadata) rejects
    assert.throws(
      () => validateDharamshalaFeeApproval({
        ...baseHotel,
        dharamshalaServiceFee: 0,
        dharamshalaFeeApprovalStatus: 'approved',
        dharamshalaFeeConfigured: true,
        dharamshalaFeeApprovedAt: new Date(),
      }),
      (err) => err.statusCode === 400
    );
    assert.throws(
      () => validateDharamshalaFeeApproval({
        ...baseHotel,
        dharamshalaServiceFee: 99,
        dharamshalaFeeApprovalStatus: 'approved',
        dharamshalaFeeConfigured: true,
      }),
      (err) => err.statusCode === 400
    );
  });

  it('8. Authorized explicitly_free (₹0) and approved Dharamshala properties proceed end-to-end while acceptance and payment gates block withdrawn approval or changed fee', async () => {
    const adminToken = signToken(superAdmin._id);
    const partnerToken = signToken(dharamPartner._id);
    const customerToken = signToken(customerUser._id);

    // Create an explicitly free Dharamshala authorized by admin endpoint
    const freeDharam = await Hotel.create({
      name: `Free Seva Dharamshala ${Date.now()}`,
      propertyType: 'dharamshala',
      location: 'Vrindavan',
      nearestTemple: 'Banke Bihari',
      googleMapLink: 'https://maps.google.com/?q=27.58,77.70',
      partnerId: dharamPartner._id,
      partnerName: dharamPartner.name,
      approvalStatus: 'approved',
      status: 'active',
      dharamshalaFeeApprovalStatus: 'unconfigured',
      dharamshalaFeeConfigured: false,
      propertyTerms: {
        currentVersion: 1,
        isActive: true,
        sections: { generalTerms: 'Free seva terms' },
      },
    });
    createdHotelIds.push(freeDharam._id);

    const freeRt = await RoomType.create({
      hotelId: freeDharam._id,
      name: 'Seva Hall',
      pricePerNight: 500,
      maxAdults: 2,
      maxChildren: 0,
      status: 'active',
    });
    createdRoomTypeIds.push(freeRt._id);
    const freeUnit = await RoomUnit.create({
      hotelId: freeDharam._id,
      roomTypeId: freeRt._id,
      number: 'S-1',
      status: 'available',
    });
    createdRoomUnitIds.push(freeUnit._id);

    // Booking must fail while unconfigured
    const blockedBookRes = await jsonFetch('/api/bookings/room-type', {
      method: 'POST',
      token: customerToken,
      body: {
        hotelId: String(freeDharam._id),
        roomTypeId: String(freeRt._id),
        checkIn: '2027-01-10',
        checkOut: '2027-01-11',
        roomQuantity: 1,
        totalAdults: 1,
        totalChildren: 0,
        customerFullName: customerUser.name,
        customerMobile: '9876500003',
        customerEmail: customerUser.email,
        propertyTermsAccepted: true,
        acceptedPropertyTermsVersion: 1,
      },
    });
    assert.equal(blockedBookRes.status, 400);
    assert.match(blockedBookRes.data?.message || '', /pending owner review and approval/i);

    // Authorize ₹0 via admin policy endpoint -> succeeds & confirms on acceptance
    const setFreeRes = await jsonFetch(`/api/policies/dharamshalas/${freeDharam._id}/fee`, {
      method: 'PUT',
      token: adminToken,
      body: { fee: 0, reason: 'Verified charitable seva ashram' },
    });
    assert.equal(setFreeRes.status, 200);
    assert.equal(setFreeRes.data?.data?.dharamshalaFeeApprovalStatus, 'explicitly_free');

    const freeBookRes = await jsonFetch('/api/bookings/room-type', {
      method: 'POST',
      token: customerToken,
      body: {
        hotelId: String(freeDharam._id),
        roomTypeId: String(freeRt._id),
        checkIn: '2027-01-10',
        checkOut: '2027-01-11',
        roomQuantity: 1,
        totalAdults: 1,
        totalChildren: 0,
        customerFullName: customerUser.name,
        customerMobile: '9876500003',
        customerEmail: customerUser.email,
        propertyTermsAccepted: true,
        acceptedPropertyTermsVersion: 1,
        idempotencyKey: `free_book_${Date.now()}`,
      },
    });
    assert.equal(freeBookRes.status, 201);
    const freeBookingId = freeBookRes.data?.data?._id;
    createdBookingIds.push(freeBookingId);

    const freeAcceptRes = await jsonFetch(`/api/bookings/${freeBookingId}/dharamshala/accept`, {
      method: 'PUT',
      token: partnerToken,
      body: { paymentMode: 'pay_at_dharamshala' },
    });
    assert.equal(freeAcceptRes.status, 200);
    assert.equal(freeAcceptRes.data?.data?.bookingStatus, 'confirmed');
    assert.equal(freeAcceptRes.data?.data?.vrindavanSarthiServiceFee, 0);

    // Now test Approved Dharamshala + withdrawal / snapshot mismatch / payment order gate
    const paidDharam = await Hotel.create({
      name: `Approved Paid Dharamshala ${Date.now()}`,
      propertyType: 'dharamshala',
      location: 'Vrindavan',
      nearestTemple: 'Prem Mandir',
      googleMapLink: 'https://maps.google.com/?q=27.57,77.67',
      partnerId: dharamPartner._id,
      partnerName: dharamPartner.name,
      approvalStatus: 'approved',
      status: 'active',
      dharamshalaFeeApprovalStatus: 'unconfigured',
      dharamshalaFeeConfigured: false,
      propertyTerms: {
        currentVersion: 1,
        isActive: true,
        sections: { generalTerms: 'Approved dharamshala rules' },
      },
    });
    createdHotelIds.push(paidDharam._id);

    const paidRt = await RoomType.create({
      hotelId: paidDharam._id,
      name: 'Pilgrim Deluxe',
      pricePerNight: 800,
      maxAdults: 2,
      maxChildren: 0,
      status: 'active',
    });
    createdRoomTypeIds.push(paidRt._id);
    const paidUnit = await RoomUnit.create({
      hotelId: paidDharam._id,
      roomTypeId: paidRt._id,
      number: 'P-1',
      status: 'available',
    });
    createdRoomUnitIds.push(paidUnit._id);

    const approveFeeRes = await jsonFetch(`/api/policies/dharamshalas/${paidDharam._id}/fee`, {
      method: 'PUT',
      token: adminToken,
      body: { fee: 110, reason: 'Verified maintenance fee' },
    });
    assert.equal(approveFeeRes.status, 200);

    // Booking A: approval withdrawn BEFORE acceptance -> acceptance fails 400 + AuditLog recorded + booking untouched
    const bookARes = await jsonFetch('/api/bookings/room-type', {
      method: 'POST',
      token: customerToken,
      body: {
        hotelId: String(paidDharam._id),
        roomTypeId: String(paidRt._id),
        checkIn: '2027-02-01',
        checkOut: '2027-02-02',
        roomQuantity: 1,
        totalAdults: 1,
        totalChildren: 0,
        customerFullName: customerUser.name,
        customerMobile: '9876500003',
        customerEmail: customerUser.email,
        propertyTermsAccepted: true,
        acceptedPropertyTermsVersion: 1,
        idempotencyKey: `paid_a_${Date.now()}`,
      },
    });
    assert.equal(bookARes.status, 201);
    const bookingAId = bookARes.data?.data?._id;
    createdBookingIds.push(bookingAId);

    // Withdraw approval
    await Hotel.findByIdAndUpdate(paidDharam._id, {
      dharamshalaFeeApprovalStatus: 'unconfigured',
      dharamshalaFeeConfigured: false,
    });

    const withdrawnAcceptRes = await jsonFetch(`/api/bookings/${bookingAId}/dharamshala/accept`, {
      method: 'PUT',
      token: partnerToken,
      body: { paymentMode: 'pay_at_dharamshala' },
    });
    assert.equal(withdrawnAcceptRes.status, 400);

    const bookingAAfter = await Booking.findById(bookingAId).lean();
    assert.equal(bookingAAfter.bookingStatus, 'pending_property_confirmation');
    assert.equal(bookingAAfter.paymentStatus, 'pending');

    const auditBlocked = await AuditLog.findOne({
      action: 'dharamshala_acceptance_blocked',
      bookingObjectId: bookingAAfter._id,
    }).lean();
    assert.ok(auditBlocked, 'Blocked acceptance attempt must write an AuditLog entry');
    createdAuditIds.push(auditBlocked._id);

    // Fee changed BEFORE acceptance (110 -> 160) -> acceptance fails 409 (snapshot mismatch) without silently altering charge
    await Hotel.findByIdAndUpdate(paidDharam._id, {
      dharamshalaFeeApprovalStatus: 'approved',
      dharamshalaFeeConfigured: true,
    });
    const bumpFeeRes = await jsonFetch(`/api/policies/dharamshalas/${paidDharam._id}/fee`, {
      method: 'PUT',
      token: adminToken,
      body: { fee: 160, reason: 'Updated fee mid-flight' },
    });
    assert.equal(bumpFeeRes.status, 200);
    const mismatchAcceptRes = await jsonFetch(`/api/bookings/${bookingAId}/dharamshala/accept`, {
      method: 'PUT',
      token: partnerToken,
      body: { paymentMode: 'pay_at_dharamshala' },
    });
    assert.equal(mismatchAcceptRes.status, 409);

    // Restore matching hotel state for Booking A (110, version 2) -> acceptance succeeds -> awaiting_customer_payment
    await Hotel.findByIdAndUpdate(paidDharam._id, {
      dharamshalaServiceFee: 110,
      dharamshalaServiceFeeVersion: 2,
      dharamshalaFeeApprovalStatus: 'approved',
      dharamshalaFeeConfigured: true,
    });
    const okAcceptRes = await jsonFetch(`/api/bookings/${bookingAId}/dharamshala/accept`, {
      method: 'PUT',
      token: partnerToken,
      body: { paymentMode: 'pay_at_dharamshala' },
    });
    assert.equal(okAcceptRes.status, 200);
    assert.equal(okAcceptRes.data?.data?.bookingStatus, 'awaiting_customer_payment');
    assert.equal(okAcceptRes.data?.data?.vrindavanSarthiServiceFee, 110);

    // Withdraw approval while booking is awaiting_customer_payment -> /api/payments/razorpay/orders must reject
    await Hotel.findByIdAndUpdate(paidDharam._id, {
      dharamshalaFeeApprovalStatus: 'pending_review',
      dharamshalaFeeConfigured: false,
    });
    const orderBlockedRes = await jsonFetch('/api/payments/razorpay/orders', {
      method: 'POST',
      token: customerToken,
      body: { bookingId: bookingAId },
    });
    assert.equal(orderBlockedRes.status, 400);

    // Restore approval with cached mock razorpayOrderId -> /api/payments/razorpay/orders returns existing order cleanly
    await Hotel.findByIdAndUpdate(paidDharam._id, {
      dharamshalaFeeApprovalStatus: 'approved',
      dharamshalaFeeConfigured: true,
    });
    await Booking.findByIdAndUpdate(bookingAId, { razorpayOrderId: 'order_mock_valid_592' });
    const orderAllowedRes = await jsonFetch('/api/payments/razorpay/orders', {
      method: 'POST',
      token: customerToken,
      body: { bookingId: bookingAId },
    });
    assert.equal(orderAllowedRes.status, 200);
    assert.equal(orderAllowedRes.data?.data?.order?.id, 'order_mock_valid_592');
    assert.equal(orderAllowedRes.data?.data?.order?.amount, 11000);
  });

  it('9. Non-Dharamshala hotel booking behavior and validation remain unchanged', async () => {
    const adminHotel = await Hotel.findById(hotelA._id).lean();
    assert.equal(validateDharamshalaFeeApproval(adminHotel), true);

    const customerToken = signToken(customerUser._id);
    const rt = await RoomType.findOne({ hotelId: hotelA._id }).lean();
    assert.ok(rt, 'Hotel A RoomType must exist from earlier test');

    const reqRes = await jsonFetch('/api/bookings/room-type', {
      method: 'POST',
      token: customerToken,
      body: {
        hotelId: String(hotelA._id),
        roomTypeId: String(rt._id),
        checkIn: '2027-03-10',
        checkOut: '2027-03-11',
        roomQuantity: 1,
        totalAdults: 1,
        totalChildren: 0,
        customerFullName: customerUser.name,
        customerMobile: '9876500003',
        customerEmail: customerUser.email,
        idempotencyKey: `hotel_non_dhar_${Date.now()}`,
      },
    });
    assert.equal(reqRes.status, 201);
    const bId = reqRes.data?.data?._id;
    createdBookingIds.push(bId);
    assert.equal(reqRes.data?.data?.propertyType, 'hotel');

    const bDoc = await Booking.findById(bId);
    const acceptResult = await acceptDharamshalaRequest({
      booking: bDoc,
      actor: partnerA,
    });
    assert.equal(acceptResult.booking.bookingStatus, 'awaiting_customer_payment');
  });

  it('10. Admin list status display derives from authoritative approval state without stale version/history override', () => {
    const formatItem = policyRoutes._formatDharamshalaPolicyListItem;
    const staleHistory = [{ version: 2, fee: 120, updatedByName: 'Old Admin', reason: 'Legacy', updatedAt: new Date() }];

    // pending_review with stale version > 1 and history -> must display Pending Review
    const pendingWithHistory = formatItem({
      _id: new mongoose.Types.ObjectId(),
      name: 'Withdrawn Pending Dharamshala',
      dharamshalaServiceFee: 120,
      dharamshalaServiceFeeVersion: 4,
      dharamshalaFeeApprovalStatus: 'pending_review',
      dharamshalaFeeConfigured: true,
      dharamshalaFeeHistory: staleHistory,
      dharamshalaFeeApprovedAt: new Date(),
      status: 'active',
    });
    assert.equal(pendingWithHistory.feeApprovalStatus, 'pending_review');
    assert.equal(pendingWithHistory.dharamshalaFeeApprovalStatus, 'pending_review');
    assert.equal(pendingWithHistory.feeApprovalLabel, 'Pending Review');
    assert.equal(pendingWithHistory.isValidForBooking, false);
    assert.equal(pendingWithHistory.approvedAt, null);

    // unconfigured with stale version > 1 and history -> must display Unconfigured
    const unconfiguredWithHistory = formatItem({
      _id: new mongoose.Types.ObjectId(),
      name: 'Withdrawn Unconfigured Dharamshala',
      dharamshalaServiceFee: 79,
      dharamshalaServiceFeeVersion: 3,
      dharamshalaFeeApprovalStatus: 'unconfigured',
      dharamshalaFeeConfigured: false,
      dharamshalaFeeHistory: staleHistory,
      status: 'active',
    });
    assert.equal(unconfiguredWithHistory.feeApprovalStatus, 'unconfigured');
    assert.equal(unconfiguredWithHistory.feeApprovalLabel, 'Unconfigured');
    assert.equal(unconfiguredWithHistory.isValidForBooking, false);

    // approved without configured=true or metadata -> fails closed to Unconfigured
    const invalidApproved = formatItem({
      _id: new mongoose.Types.ObjectId(),
      name: 'Broken Approved Dharamshala',
      dharamshalaServiceFee: 99,
      dharamshalaServiceFeeVersion: 1,
      dharamshalaFeeApprovalStatus: 'approved',
      dharamshalaFeeConfigured: false,
      status: 'active',
    });
    assert.equal(invalidApproved.feeApprovalStatus, 'unconfigured');
    assert.equal(invalidApproved.feeApprovalLabel, 'Unconfigured');
    assert.equal(invalidApproved.isValidForBooking, false);

    // Valid approved -> Approved
    const validApproved = formatItem({
      _id: new mongoose.Types.ObjectId(),
      name: 'Valid Approved Dharamshala',
      dharamshalaServiceFee: 120,
      dharamshalaServiceFeeVersion: 2,
      dharamshalaFeeApprovalStatus: 'approved',
      dharamshalaFeeConfigured: true,
      dharamshalaFeeHistory: staleHistory,
      dharamshalaFeeApprovedAt: new Date(),
      dharamshalaFeeApprovedByName: 'Super Admin',
      status: 'active',
    });
    assert.equal(validApproved.feeApprovalStatus, 'approved');
    assert.equal(validApproved.feeApprovalLabel, 'Approved');
    assert.equal(validApproved.isValidForBooking, true);
    assert.equal(validApproved.approvedByName, 'Super Admin');

    // Valid explicitly_free -> Explicitly Free
    const validFree = formatItem({
      _id: new mongoose.Types.ObjectId(),
      name: 'Valid Free Seva Dharamshala',
      dharamshalaServiceFee: 0,
      dharamshalaServiceFeeVersion: 2,
      dharamshalaFeeApprovalStatus: 'explicitly_free',
      dharamshalaFeeConfigured: true,
      dharamshalaFeeHistory: [{ version: 2, fee: 0, reason: 'Seva' }],
      dharamshalaFeeApprovedAt: new Date(),
      status: 'active',
    });
    assert.equal(validFree.feeApprovalStatus, 'explicitly_free');
    assert.equal(validFree.feeApprovalLabel, 'Explicitly Free');
    assert.equal(validFree.isValidForBooking, true);
  });

  it('11. Already-paid bookings cannot be repriced at acceptance and uncollected desk balance is excluded from online payment and refund math', async () => {
    const rt = await RoomType.findOne({ hotelId: hotelA._id }).lean();
    assert.ok(rt);

    // Paid booking still in pending_property_confirmation cannot be repriced at acceptance
    const paidMockBooking = {
      _id: new mongoose.Types.ObjectId(),
      bookingType: 'room_type',
      propertyType: 'dharamshala',
      bookingStatus: 'pending_property_confirmation',
      paymentStatus: 'paid',
      hotelId: hotelA._id,
      roomTypeId: rt._id,
      amountPaidOnline: 110,
      amountPayableAtProperty: 1000,
    };
    await assert.rejects(
      () => acceptDharamshalaRequest({ booking: paidMockBooking, actor: partnerA }),
      (err) => err.statusCode === 409 && /already been settled/i.test(err.message)
    );
    assert.equal(paidMockBooking.amountPaidOnline, 110);

    // Uncollected desk balance (1500) is strictly excluded from payable online amount and online refund calculation
    assert.equal(payableAmountForBooking({
      propertyType: 'dharamshala',
      paymentMode: 'pay_at_dharamshala',
      amountPaidOnline: 99,
      amountPayableAtProperty: 1500,
      totalAmount: 1599,
    }), 99);

    const refundEval = calculateRefund({
      booking: {
        propertyType: 'hotel',
        paymentOption: 'full_100',
        paymentStatus: 'paid',
        amountPaidOnline: 500,
        amountPayableAtProperty: 1500,
        totalAmount: 2000,
        checkIn: new Date('2027-06-10T00:00:00.000Z'),
      },
      cancellationTime: new Date('2027-06-01T00:00:00.000Z'),
      responsibility: 'hotel_fault',
      requestedByRole: 'admin',
    });
    assert.equal(refundEval.refundableAmount, 500, 'Online refund must never include uncollected desk balance');
  });

  it('12. GET /api/policies/dharamshalas enforces manage_properties least-privilege RBAC and serves formatted approval status without shadowing', async () => {
    // 1. Verify permission matrix consistency (no phantom manage_business_policies key)
    assert.equal(ADMIN_ROLE_PERMISSIONS.super_admin.includes('manage_properties'), true);
    assert.equal(ADMIN_ROLE_PERMISSIONS.operations_admin.includes('manage_properties'), true);
    assert.equal(ADMIN_ROLE_PERMISSIONS.finance_admin.includes('manage_properties'), false);
    assert.equal(ADMIN_ROLE_PERMISSIONS.support_admin.includes('manage_properties'), false);
    for (const perms of Object.values(ADMIN_ROLE_PERMISSIONS)) {
      assert.equal(perms.includes('manage_business_policies'), false);
    }

    const ts = Date.now();
    const opsAdmin = await User.create({
      name: 'Ops Admin RBAC Test',
      email: `ops_rbac_${ts}@staging.local`,
      password: 'StagingAdmin@123',
      phone: '+919876500021',
      role: 'admin',
      adminRole: 'operations_admin',
    });
    const financeAdmin = await User.create({
      name: 'Finance Admin RBAC Test',
      email: `fin_rbac_${ts}@staging.local`,
      password: 'StagingAdmin@123',
      phone: '+919876500022',
      role: 'admin',
      adminRole: 'finance_admin',
    });
    const supportAdmin = await User.create({
      name: 'Support Admin RBAC Test',
      email: `sup_rbac_${ts}@staging.local`,
      password: 'StagingAdmin@123',
      phone: '+919876500023',
      role: 'admin',
      adminRole: 'support_admin',
    });
    createdUserIds.push(opsAdmin._id, financeAdmin._id, supportAdmin._id);

    const rbacDharam = await Hotel.create({
      name: `RBAC Test Dharamshala ${ts}`,
      propertyType: 'dharamshala',
      location: 'Raman Reti, Vrindavan',
      nearestTemple: 'ISKCON Temple',
      googleMapLink: 'https://maps.google.com/?q=27.57,77.68',
      contactPhone: '+919876500024',
      partnerId: dharamPartner._id,
      partnerName: dharamPartner.name,
      approvalStatus: 'approved',
      status: 'active',
      dharamshalaServiceFee: 115,
      dharamshalaServiceFeeVersion: 3,
      dharamshalaFeeApprovalStatus: 'pending_review',
      dharamshalaFeeConfigured: true,
      dharamshalaFeeHistory: [{
        version: 2,
        fee: 115,
        updatedByName: 'Previous Admin',
        reason: 'Historical entry prior to withdrawal',
        updatedAt: new Date(),
      }],
    });
    createdHotelIds.push(rbacDharam._id);

    // 2. Denied callers: unauthenticated (401), customer/partner (403), finance_admin (403), support_admin (403)
    const unauthRes = await jsonFetch('/api/policies/dharamshalas');
    assert.equal(unauthRes.status, 401);

    const custRes = await jsonFetch('/api/policies/dharamshalas', { token: signToken(customerUser._id) });
    assert.equal(custRes.status, 403);

    const partnerRes = await jsonFetch('/api/policies/dharamshalas', { token: signToken(partnerA._id) });
    assert.equal(partnerRes.status, 403);

    const financeRes = await jsonFetch('/api/policies/dharamshalas', { token: signToken(financeAdmin._id) });
    assert.equal(financeRes.status, 403);
    assert.match(financeRes.data?.message || '', /Required permission: manage_properties/);

    const supportRes = await jsonFetch('/api/policies/dharamshalas', { token: signToken(supportAdmin._id) });
    assert.equal(supportRes.status, 403);
    assert.match(supportRes.data?.message || '', /Required permission: manage_properties/);

    // Unknown/invalid adminRole must fail closed even if role === 'admin'
    const unknownAdminRes = await jsonFetch('/api/policies/dharamshalas', {
      token: signToken(opsAdmin._id),
    });
    assert.equal(unknownAdminRes.status, 200);
    await User.updateOne({ _id: opsAdmin._id }, { $set: { adminRole: 'unmapped_role' } });
    const unmappedRes = await jsonFetch('/api/policies/dharamshalas', { token: signToken(opsAdmin._id) });
    assert.equal(unmappedRes.status, 403);
    await User.updateOne({ _id: opsAdmin._id }, { $set: { adminRole: 'operations_admin' } });

    // 3. Authorized roles: super_admin & operations_admin receive 200 with formatted fields (no legacy route shadow)
    const superRes = await jsonFetch('/api/policies/dharamshalas', { token: signToken(superAdmin._id) });
    assert.equal(superRes.status, 200);
    assert.equal(superRes.data?.success, true);
    const listedSuper = (superRes.data?.data || []).find((item) => String(item._id) === String(rbacDharam._id));
    assert.ok(listedSuper, 'super_admin response must include the Dharamshala item');
    assert.equal(listedSuper.feeApprovalStatus, 'pending_review');
    assert.equal(listedSuper.dharamshalaFeeApprovalStatus, 'pending_review');
    assert.equal(listedSuper.feeApprovalLabel, 'Pending Review');
    assert.equal(listedSuper.isValidForBooking, false);
    assert.equal(listedSuper.approvedAt, null);
    assert.equal(listedSuper.approvedByName, '');
    assert.equal(listedSuper.partner?.name, dharamPartner.businessName);

    const opsRes = await jsonFetch('/api/policies/dharamshalas', { token: signToken(opsAdmin._id) });
    assert.equal(opsRes.status, 200);
    assert.equal(opsRes.data?.success, true);
    const listedOps = (opsRes.data?.data || []).find((item) => String(item._id) === String(rbacDharam._id));
    assert.ok(listedOps, 'operations_admin response must include the Dharamshala item');
    assert.equal(listedOps.feeApprovalStatus, 'pending_review');

    // 4. Fee update endpoint keeps identical least-privilege boundary (denies finance_admin & support_admin)
    const finPutRes = await jsonFetch(`/api/policies/dharamshalas/${rbacDharam._id}/fee`, {
      method: 'PUT',
      token: signToken(financeAdmin._id),
      body: { fee: 99, reason: 'Unauthorized finance update attempt' },
    });
    assert.equal(finPutRes.status, 403);

    const supPutRes = await jsonFetch(`/api/policies/dharamshalas/${rbacDharam._id}/fee`, {
      method: 'PUT',
      token: signToken(supportAdmin._id),
      body: { fee: 99, reason: 'Unauthorized support update attempt' },
    });
    assert.equal(supPutRes.status, 403);
  });
});
