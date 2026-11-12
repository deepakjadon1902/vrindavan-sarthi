const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Staging environment protection
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

const STAGING_URI = process.env.STAGING_MONGO_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/vrindavan_sarthi_staging';

async function seedStaging() {
  console.log('===============================================================');
  console.log('VRINDAVAN SARTHI — SEEDING REPEATABLE STAGING TEST DATA');
  console.log('===============================================================\n');

  // Strict safety check
  const guard = assertIsolatedStagingEnvironment(STAGING_URI);
  console.log(`[STAGING GUARD] Verified target database: ${guard.dbName} on ${guard.host}`);

  await mongoose.connect(STAGING_URI);
  console.log('[DATABASE] Connected to isolated staging MongoDB.');

  await ensureIndexesOnce();
  console.log('[INDEXES] All collection indexes and unique compound locks built.');

  // Clean staging collections
  console.log('\n--- Cleaning Previous Staging Records ---');
  await Promise.all([
    User.deleteMany({}),
    Hotel.deleteMany({}),
    RoomType.deleteMany({}),
    RoomUnit.deleteMany({}),
    RoomUnitBookingDay.deleteMany({}),
    Booking.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('✔ Staging collections cleared.');

  // 1. Seed Users (Admin, Approved Partner, Pending Partner, Customers)
  console.log('\n--- Seeding Synthetic User Accounts ---');
  const defaultPassword = 'StagingSecurePass2026!'; // User.pre('save') automatically handles bcrypt hashing

  const admin = await User.create({
    name: 'Vrindavan Sarthi Staging Admin',
    email: 'admin.staging@vrindavansarthi.local',
    phone: '+91 9999000001',
    password: defaultPassword,
    role: 'admin',
    isEmailVerified: true,
  });

  const approvedPartner = await User.create({
    name: 'Radha Raman Hospitality Trust',
    email: 'partner.approved@vrindavansarthi.local',
    phone: '+91 9999000002',
    password: defaultPassword,
    role: 'partner',
    partnerStatus: 'approved',
    businessName: 'Radha Raman Hospitality Trust',
    businessType: 'trust',
    businessAddress: 'Parikrama Marg, Raman Reti, Vrindavan',
    businessPhone: '+91 9999000002',
    partnerPolicyConsent: { accepted: true, version: 1, timestamp: new Date() },
    bankDetails: {
      account_holder_name: 'Radha Raman Hospitality Trust',
      bank_name: 'State Bank of India',
      account_number: '12345678901',
      ifsc_code: 'SBIN0001234',
      verified: true,
    },
  });

  const pendingPartner = await User.create({
    name: 'Govind Kripa Guest House Partner',
    email: 'partner.pending@vrindavansarthi.local',
    phone: '+91 9999000003',
    password: defaultPassword,
    role: 'partner',
    partnerStatus: 'pending',
    businessName: 'Govind Kripa Guest House',
    businessType: 'proprietorship',
    partnerPolicyConsent: { accepted: true, version: 1, timestamp: new Date() },
  });

  const customerA = await User.create({
    name: 'Sita Devi Sharma',
    email: 'customer.sita@vrindavansarthi.local',
    phone: '+91 9999000004',
    password: defaultPassword,
    role: 'user',
    isEmailVerified: true,
  });

  const customerB = await User.create({
    name: 'Ramesh Chandra Gupta',
    email: 'customer.ramesh@vrindavansarthi.local',
    phone: '+91 9999000005',
    password: defaultPassword,
    role: 'user',
    isEmailVerified: true,
  });

  console.log(`✔ Seeded 5 synthetic users (Admin, 2 Partners, 2 Customers)`);

  // 2. Seed Properties (Commercial Hotel & Non-Commercial Dharamshala)
  console.log('\n--- Seeding Properties ---');
  const hotel = await Hotel.create({
    name: 'Radha Raman Palace Hotel',
    propertyType: 'hotel',
    location: 'Raman Reti, Vrindavan, Uttar Pradesh',
    nearestTemple: 'Banke Bihari Temple',
    googleMapLink: 'https://maps.google.com/?q=27.5812,77.6987',
    partnerId: approvedPartner._id,
    approvalStatus: 'approved',
    instantBookingEnabled: true,
    bookingMode: 'instant',
    rating: 4.8,
    checkInTime: '12:00',
    checkOutTime: '11:00',
    contactPhone: '+91 9999000002',
    startingPrice: 2500,
    amenities: ['AC', 'Free WiFi', 'Power Backup', 'Room Service'],
    description: 'Clean and comfortable hotel close to ISKCON and Banke Bihari temple.',
    propertyTerms: {
      currentVersion: 1,
      versions: [{ version: 1, isActive: true, sections: { generalTerms: 'Standard property terms' } }],
    },
  });

  const dharamshala = await Hotel.create({
    name: 'Shri Krishna Sharnam Ashram & Dharamshala',
    propertyType: 'dharamshala',
    location: 'Near Banke Bihari Temple, Vrindavan',
    nearestTemple: 'Banke Bihari Temple',
    googleMapLink: 'https://maps.google.com/?q=27.5825,77.7011',
    partnerId: approvedPartner._id,
    approvalStatus: 'approved',
    instantBookingEnabled: false,
    bookingMode: 'request',
    dharamshalaServiceFee: 99,
    dharamshalaPlatformFeeEnabled: true,
    rating: 4.5,
    checkInTime: '12:00',
    checkOutTime: '10:00',
    contactPhone: '+91 9999000002',
    startingPrice: 600,
    amenities: ['Purified Water', 'Power Backup', 'Hot Water'],
    description: 'Peaceful pilgrim shelter operated for bhakts.',
  });

  console.log(`✔ Seeded 2 properties: "${hotel.name}" (Hotel) and "${dharamshala.name}" (Dharamshala)`);

  // 3. Seed Room Types & Physical Room Units
  console.log('\n--- Seeding Room Types & Physical Room Units ---');
  const deluxeRoomType = await RoomType.create({
    hotelId: hotel._id,
    partnerId: approvedPartner._id,
    name: 'Deluxe AC Room',
    pricePerNight: 2500,
    maxAdults: 2,
    maxChildren: 1,
    status: 'active',
    amenities: ['AC', 'Free WiFi', 'Geyser', 'Attached Bath'],
  });

  const suiteRoomType = await RoomType.create({
    hotelId: hotel._id,
    partnerId: approvedPartner._id,
    name: 'Executive Family Suite',
    pricePerNight: 4000,
    maxAdults: 4,
    maxChildren: 2,
    status: 'active',
    amenities: ['AC', 'Living Room', 'Free WiFi', 'Geyser'],
  });

  const ashramRoomType = await RoomType.create({
    hotelId: dharamshala._id,
    partnerId: approvedPartner._id,
    name: 'Ashram Double Room',
    pricePerNight: 600,
    maxAdults: 2,
    maxChildren: 0,
    status: 'active',
    amenities: ['Ceiling Fan', 'Attached Bath', 'Geyser'],
  });

  // Physical units for Deluxe AC
  const unit101 = await RoomUnit.create({ hotelId: hotel._id, roomTypeId: deluxeRoomType._id, number: '101', status: 'available', partnerId: approvedPartner._id });
  const unit102 = await RoomUnit.create({ hotelId: hotel._id, roomTypeId: deluxeRoomType._id, number: '102', status: 'available', partnerId: approvedPartner._id });
  const unit103 = await RoomUnit.create({ hotelId: hotel._id, roomTypeId: deluxeRoomType._id, number: '103', status: 'available', partnerId: approvedPartner._id });

  // Physical units for Suite
  const unit201 = await RoomUnit.create({ hotelId: hotel._id, roomTypeId: suiteRoomType._id, number: '201', status: 'available', partnerId: approvedPartner._id });
  const unit202 = await RoomUnit.create({ hotelId: hotel._id, roomTypeId: suiteRoomType._id, number: '202', status: 'available', partnerId: approvedPartner._id });

  // Physical units for Ashram
  const unitA1 = await RoomUnit.create({ hotelId: dharamshala._id, roomTypeId: ashramRoomType._id, number: 'A-101', status: 'available', partnerId: approvedPartner._id });
  const unitA2 = await RoomUnit.create({ hotelId: dharamshala._id, roomTypeId: ashramRoomType._id, number: 'A-102', status: 'available', partnerId: approvedPartner._id });

  console.log(`✔ Seeded 3 Room Types with 7 physical room units.`);

  // 4. Seed Representative Booking Fixtures
  console.log('\n--- Seeding Initial Booking Fixtures ---');
  const booking1 = await Booking.create({
    bookingId: 'BK-STG-2026-0001',
    numericBookingId: 20260001,
    bookingType: 'room_type',
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    paymentOption: 'advance_30',
    hotelId: hotel._id,
    itemId: String(hotel._id),
    itemName: `${hotel.name} - ${deluxeRoomType.name}`,
    roomTypeId: deluxeRoomType._id,
    roomUnitId: unit101._id,
    partnerId: approvedPartner._id,
    userId: customerA._id,
    userName: customerA.name,
    userEmail: customerA.email,
    userPhone: customerA.phone,
    customerFullName: 'Sita Devi Sharma',
    customerMobile: '+91 9999000004',
    customerEmail: 'customer.sita@vrindavansarthi.local',
    customerCity: 'New Delhi',
    checkIn: new Date('2026-11-20T00:00:00.000Z'),
    checkOut: new Date('2026-11-22T00:00:00.000Z'),
    checkInTime: '12:00',
    totalNights: 2,
    roomQuantity: 1,
    amountPaidOnline: 1566,
    advanceAmount: 1566,
    amountPayableAtProperty: 3654,
    totalAmount: 5220,
    pricing: {
      baseAmount: 5000,
      totalAmount: 5220,
      advancePaymentAmount: 1566,
      amountPayableAtProperty: 3654,
    },
    hotelSnapshot: { name: hotel.name, location: hotel.location, propertyType: hotel.propertyType },
    roomTypeSnapshot: { name: deluxeRoomType.name },
  });

  // Lock dates for unit 101 for booking 1
  await RoomUnitBookingDay.create([
    { hotelId: hotel._id, roomTypeId: deluxeRoomType._id, roomUnitId: unit101._id, bookingId: booking1._id, date: new Date('2026-11-20T00:00:00.000Z') },
    { hotelId: hotel._id, roomTypeId: deluxeRoomType._id, roomUnitId: unit101._id, bookingId: booking1._id, date: new Date('2026-11-21T00:00:00.000Z') },
  ]);

  console.log(`✔ Seeded Booking "${booking1.bookingId}" with active room-night inventory locks.`);

  await mongoose.disconnect();
  console.log('\n===============================================================');
  console.log('STAGING SEED COMPLETE: Database is fully populated and ready!');
  console.log('===============================================================\n');

  return {
    admin: admin.email,
    partner: approvedPartner.email,
    customer: customerA.email,
    hotel: hotel.name,
    dharamshala: dharamshala.name,
    unitsCount: 7,
    bookingsCount: 1,
  };
}

if (require.main === module) {
  seedStaging().catch((err) => {
    console.error('Staging seed error:', err);
    process.exit(1);
  });
}

module.exports = { seedStaging };
