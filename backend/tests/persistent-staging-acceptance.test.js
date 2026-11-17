const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { assertIsolatedStagingEnvironment } = require('../utils/stagingGuard');
const { ensureIndexesOnce } = require('../config/ensureIndexes');

// Models
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const Booking = require('../models/Booking');
const AuditLog = require('../models/AuditLog');

// Utilities
const { calculateLodgingPrice } = require('../utils/pricing');
const { calculateCancellationRefund } = require('../utils/cancellationPolicy');
const { buildBookingReceiptPdf } = require('../utils/bookingReceiptPdf');
const { parseBookingReference } = require('../routes/booking.routes');

const STAGING_URI = process.env.STAGING_MONGO_URI || 'mongodb://127.0.0.1:27018/vrindavan_sarthi_staging';

test('VRINDAVAN SARTHI — PERSISTENT STAGING OTA ACCEPTANCE SUITE', async (t) => {
  // Safety Guard: Confirm isolation before executing
  const guard = assertIsolatedStagingEnvironment(STAGING_URI);
  assert.equal(guard.isIsolated, true);
  assert.equal(guard.dbName, 'vrindavan_sarthi_staging');

  await mongoose.connect(STAGING_URI);
  await ensureIndexesOnce();

  const oid = () => new mongoose.Types.ObjectId();
  const testRunId = `run_${Date.now()}`;

  // ---------------------------------------------------------------------------
  // 1. Customer Registration & Login Persistence
  // ---------------------------------------------------------------------------
  let persistedCustomer = null;
  await t.test('1. Customer registration, password hashing & login persistence', async () => {
    const rawPassword = 'CustomerTestPass123!';

    persistedCustomer = await User.create({
      name: 'Radhe Shyam Bhakt',
      email: `customer.${testRunId}@vrindavansarthi.local`,
      phone: '+91 9898000001',
      password: rawPassword, // User.pre('save') automatically hashes with bcrypt
      role: 'user',
      isEmailVerified: true,
    });

    assert.ok(persistedCustomer._id);

    // Verify persistence by querying directly from MongoDB
    const queried = await User.findById(persistedCustomer._id).select('+password');
    assert.equal(queried.name, 'Radhe Shyam Bhakt');
    assert.equal(queried.email, `customer.${testRunId}@vrindavansarthi.local`);
    assert.notEqual(queried.password, rawPassword, 'Password must be stored as bcrypt hash');

    // Verify bcrypt password comparison method on model
    const passwordMatch = await queried.matchPassword(rawPassword);
    assert.equal(passwordMatch, true, 'Persisted password hash must authenticate successfully');
  });

  // ---------------------------------------------------------------------------
  // 2. Partner Registration & KYC Submission
  // ---------------------------------------------------------------------------
  let persistedPartner = null;
  await t.test('2. Partner registration, policy consent & KYC document persistence', async () => {
    const rawPassword = 'PartnerTestPass123!';

    persistedPartner = await User.create({
      name: 'Vrindavan Seva Kunj Partner',
      email: `partner.${testRunId}@vrindavansarthi.local`,
      phone: '+91 9898000002',
      password: rawPassword,
      role: 'partner',
      partnerStatus: 'pending',
      businessName: 'Vrindavan Seva Kunj Hospitality',
      businessType: 'trust',
      partnerPolicyConsent: { accepted: true, version: 1, timestamp: new Date() },
      bankDetails: {
        account_holder_name: 'Vrindavan Seva Kunj',
        bank_name: 'Punjab National Bank',
        account_number: '98765432101',
        ifsc_code: 'PUNB0123400',
        verified: false,
      },
    });

    assert.ok(persistedPartner._id);
    const queried = await User.findById(persistedPartner._id);
    assert.equal(queried.partnerStatus, 'pending');
    assert.equal(queried.partnerPolicyConsent.accepted, true);
    assert.equal(queried.bankDetails.bank_name, 'Punjab National Bank');
  });

  // ---------------------------------------------------------------------------
  // 3. Admin Approval & Correction Workflow
  // ---------------------------------------------------------------------------
  await t.test('3. Admin review, correction request & approval state persistence', async () => {
    // 3a. Admin requests correction
    const corrected = await User.findByIdAndUpdate(
      persistedPartner._id,
      {
        partnerStatus: 'pending',
        businessDescription: 'Admin correction: Please upload verified electricity bill',
      },
      { new: true }
    );
    assert.equal(corrected.businessDescription, 'Admin correction: Please upload verified electricity bill');

    // 3b. Admin approves partner
    const approved = await User.findByIdAndUpdate(
      persistedPartner._id,
      {
        partnerStatus: 'approved',
        'bankDetails.verified': true,
      },
      { new: true }
    );
    assert.equal(approved.partnerStatus, 'approved');
    assert.equal(approved.bankDetails.verified, true);
  });

  // ---------------------------------------------------------------------------
  // 4. Property, Room Type & Inventory Unit Creation
  // ---------------------------------------------------------------------------
  let persistedHotel = null;
  let persistedRoomType = null;
  let persistedUnit1 = null;
  let persistedUnit2 = null;

  await t.test('4. Property, room type and physical room unit persistence', async () => {
    persistedHotel = await Hotel.create({
      name: `Seva Kunj Heritage Hotel ${testRunId}`,
      propertyType: 'hotel',
      location: 'Near ISKCON Temple, Raman Reti, Vrindavan',
      nearestTemple: 'ISKCON Temple',
      googleMapLink: 'https://maps.google.com/?q=27.581,77.698',
      partnerId: persistedPartner._id,
      approvalStatus: 'approved',
      instantBookingEnabled: true,
      bookingMode: 'instant',
      startingPrice: 3000,
      amenities: ['AC', 'Free WiFi', 'Power Backup'],
    });

    persistedRoomType = await RoomType.create({
      hotelId: persistedHotel._id,
      partnerId: persistedPartner._id,
      name: 'Super Deluxe AC Room',
      pricePerNight: 3000,
      maxAdults: 2,
      maxChildren: 1,
      status: 'active',
      amenities: ['AC', 'WiFi', 'Geyser'],
    });

    persistedUnit1 = await RoomUnit.create({
      hotelId: persistedHotel._id,
      roomTypeId: persistedRoomType._id,
      number: '301',
      status: 'available',
      partnerId: persistedPartner._id,
    });

    persistedUnit2 = await RoomUnit.create({
      hotelId: persistedHotel._id,
      roomTypeId: persistedRoomType._id,
      number: '302',
      status: 'available',
      partnerId: persistedPartner._id,
    });

    assert.ok(persistedHotel._id);
    assert.ok(persistedRoomType._id);
    assert.equal(persistedUnit1.number, '301');
    assert.equal(persistedUnit2.number, '302');
  });

  // ---------------------------------------------------------------------------
  // 5. Customer Booking Creation & Physical Inventory Lock
  // ---------------------------------------------------------------------------
  let persistedBooking = null;
  const checkInDate = new Date('2026-12-15T00:00:00.000Z');
  const checkOutDate = new Date('2026-12-17T00:00:00.000Z');

  await t.test('5. Customer booking creation & atomic date-lock persistence', async () => {
    persistedBooking = await Booking.create({
      bookingId: `BK-STG-${Date.now()}`,
      numericBookingId: 20269991,
      bookingType: 'room_type',
      bookingStatus: 'pending',
      paymentStatus: 'pending',
      paymentOption: 'advance_30',
      hotelId: persistedHotel._id,
      itemId: String(persistedHotel._id),
      itemName: `${persistedHotel.name} - ${persistedRoomType.name}`,
      roomTypeId: persistedRoomType._id,
      roomUnitId: persistedUnit1._id,
      partnerId: persistedPartner._id,
      userId: persistedCustomer._id,
      userName: persistedCustomer.name,
      userEmail: persistedCustomer.email,
      userPhone: persistedCustomer.phone,
      customerFullName: persistedCustomer.name,
      customerMobile: persistedCustomer.phone,
      customerEmail: persistedCustomer.email,
      customerCity: 'Mathura',
      checkIn: checkInDate,
      checkOut: checkOutDate,
      checkInTime: '12:00',
      totalNights: 2,
      roomQuantity: 1,
      amountPaidOnline: 0,
      advanceAmount: 1880,
      amountPayableAtProperty: 4386,
      totalAmount: 6266,
      pricing: {
        baseAmount: 6000,
        totalAmount: 6266,
        advancePaymentAmount: 1880,
        amountPayableAtProperty: 4386,
      },
    });

    assert.ok(persistedBooking._id);
    assert.equal(persistedBooking.bookingStatus, 'pending');

    // Acquire atomic date locks for Dec 15 & Dec 16 on Unit 301
    const lock1 = await RoomUnitBookingDay.create({
      hotelId: persistedHotel._id,
      roomTypeId: persistedRoomType._id,
      roomUnitId: persistedUnit1._id,
      bookingId: persistedBooking._id,
      date: new Date('2026-12-15T00:00:00.000Z'),
    });
    const lock2 = await RoomUnitBookingDay.create({
      hotelId: persistedHotel._id,
      roomTypeId: persistedRoomType._id,
      roomUnitId: persistedUnit1._id,
      bookingId: persistedBooking._id,
      date: new Date('2026-12-16T00:00:00.000Z'),
    });

    assert.ok(lock1._id);
    assert.ok(lock2._id);

    // Verify Overbooking Collision: Attempting to insert duplicate date lock on Unit 301 must fail
    await assert.rejects(
      async () => {
        await RoomUnitBookingDay.create({
          hotelId: persistedHotel._id,
          roomTypeId: persistedRoomType._id,
          roomUnitId: persistedUnit1._id,
          bookingId: oid(), // Different competitor booking
          date: new Date('2026-12-15T00:00:00.000Z'),
        });
      },
      /E11000 duplicate key error/,
      'MongoDB unique compound index { roomUnitId: 1, date: 1 } must reject duplicate date reservation'
    );
  });

  // ---------------------------------------------------------------------------
  // 6. Booking Confirmation via Mock Gateway Payment
  // ---------------------------------------------------------------------------
  await t.test('6. Payment simulation, confirmation & gateway ID persistence', async () => {
    const mockPaymentId = `pay_mock_stg_${Date.now()}`;
    const confirmedBooking = await Booking.findByIdAndUpdate(
      persistedBooking._id,
      {
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        amountPaidOnline: 1880,
        razorpayPaymentId: mockPaymentId,
        confirmedAt: new Date(),
      },
      { new: true }
    );

    assert.equal(confirmedBooking.bookingStatus, 'confirmed');
    assert.equal(confirmedBooking.paymentStatus, 'paid');
    assert.equal(confirmedBooking.amountPaidOnline, 1880);
    assert.equal(confirmedBooking.razorpayPaymentId, mockPaymentId);
  });

  // ---------------------------------------------------------------------------
  // 7. Vector Voucher & PDF Receipt Generation
  // ---------------------------------------------------------------------------
  await t.test('7. Vector PDF receipt generation from persisted MongoDB booking', async () => {
    const fullBookingDoc = await Booking.findById(persistedBooking._id);
    const receipt = buildBookingReceiptPdf(fullBookingDoc);

    assert.ok(receipt && Buffer.isBuffer(receipt.buffer));
    assert.ok(receipt.buffer.length > 2000);
    assert.ok(receipt.filename.includes(fullBookingDoc.bookingId));
  });

  // ---------------------------------------------------------------------------
  // 8. Partner Reception Check-in & State Mutation
  // ---------------------------------------------------------------------------
  await t.test('8. Reception check-in state mutation & timestamp persistence', async () => {
    const checkedInBooking = await Booking.findByIdAndUpdate(
      persistedBooking._id,
      {
        bookingStatus: 'checked_in',
        checkedInAt: new Date(),
      },
      { new: true }
    );

    assert.equal(checkedInBooking.bookingStatus, 'checked_in');
    assert.ok(checkedInBooking.checkedInAt);
  });

  // ---------------------------------------------------------------------------
  // 9. Front-Desk Cash Collection & Checkout Settlement
  // ---------------------------------------------------------------------------
  await t.test('9. Front-desk cash collection, balance settlement & checkout persistence', async () => {
    const checkedOutBooking = await Booking.findByIdAndUpdate(
      persistedBooking._id,
      {
        bookingStatus: 'checked_out',
        amountPaidToProperty: 4386,
        amountPayableAtProperty: 0,
        checkedOutAt: new Date(),
        balanceCollections: [
          {
            amount: 4386,
            paymentMethod: 'cash',
            collectedAt: new Date(),
            collectedByName: persistedPartner.name,
            receiptNumber: `RCP-STG-${Date.now()}`,
          },
        ],
      },
      { new: true }
    );

    assert.equal(checkedOutBooking.bookingStatus, 'checked_out');
    assert.equal(checkedOutBooking.amountPaidToProperty, 4386);
    assert.equal(checkedOutBooking.amountPayableAtProperty, 0);
    assert.equal(checkedOutBooking.balanceCollections.length, 1);
  });

  // ---------------------------------------------------------------------------
  // 10. Cancellation & Inventory Lock Cleanup
  // ---------------------------------------------------------------------------
  await t.test('10. Inventory lock deletion upon completion/cancellation', async () => {
    // Delete room unit locks for the completed stay
    const deleteResult = await RoomUnitBookingDay.deleteMany({ bookingId: persistedBooking._id });
    assert.equal(deleteResult.deletedCount, 2, 'Must delete exactly 2 room-night date locks');

    const remainingLocks = await RoomUnitBookingDay.countDocuments({ bookingId: persistedBooking._id });
    assert.equal(remainingLocks, 0, 'Zero locks must remain for this booking');
  });

  // ---------------------------------------------------------------------------
  // 11. Persistence Across Disconnection & Reconnection
  // ---------------------------------------------------------------------------
  await t.test('11. Data persistence verified across full database reconnect', async () => {
    await mongoose.disconnect();
    assert.equal(mongoose.connection.readyState, 0, 'Connection must be closed');

    // Reconnect to staging database
    await mongoose.connect(STAGING_URI);
    assert.equal(mongoose.connection.readyState, 1, 'Connection must be restored');

    // Verify records remain intact in staging database
    const customerCheck = await User.findById(persistedCustomer._id);
    const partnerCheck = await User.findById(persistedPartner._id);
    const hotelCheck = await Hotel.findById(persistedHotel._id);
    const bookingCheck = await Booking.findById(persistedBooking._id);

    assert.ok(customerCheck);
    assert.equal(customerCheck.email, persistedCustomer.email);
    assert.ok(partnerCheck);
    assert.equal(partnerCheck.partnerStatus, 'approved');
    assert.ok(hotelCheck);
    assert.ok(bookingCheck);
    assert.equal(bookingCheck.bookingStatus, 'checked_out');
    assert.equal(bookingCheck.totalAmount, 6266);
  });

  await mongoose.disconnect();
});
