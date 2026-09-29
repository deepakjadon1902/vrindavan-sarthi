const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const {
  acceptDharamshalaRequest,
  buildDharamshalaAccounting,
  getDharamshalaPlatformFee,
} = require('../utils/dharamshalaLifecycle');
const { payableAmountForBooking } = require('../utils/bookingPayable');

const oid = () => new mongoose.Types.ObjectId();

const saveableDharamshalaBooking = (fields = {}) => ({
  _id: oid(),
  bookingType: 'room_type',
  propertyType: 'dharamshala',
  bookingStatus: 'pending_property_confirmation',
  paymentStatus: 'pending',
  verificationStage: 'pending_partner',
  checkIn: new Date('2026-10-10T00:00:00.000Z'),
  checkOut: new Date('2026-10-12T00:00:00.000Z'),
  roomQuantity: 1,
  hasPet: false,
  statusHistory: [],
  saveCount: 0,
  async save() {
    this.saveCount += 1;
    return this;
  },
  ...fields,
});

const withAcceptMocks = async ({ hotel, roomType, units, lockedUnitIds = [], fn }) => {
  const originalHotelFindById = Hotel.findById;
  const originalRoomTypeFindById = RoomType.findById;
  const originalRoomUnitFind = RoomUnit.find;
  const originalRoomUnitBlockDistinct = RoomUnitBlock.distinct;
  const originalRoomUnitBookingDayDistinct = RoomUnitBookingDay.distinct;
  const originalRoomUnitBookingDayInsertMany = RoomUnitBookingDay.insertMany;
  const originalRoomUnitBookingDayDeleteMany = RoomUnitBookingDay.deleteMany;
  const insertedLocks = [];

  Hotel.findById = () => ({ lean: async () => hotel });
  RoomType.findById = () => ({ lean: async () => roomType });
  RoomUnit.find = () => ({ sort: () => ({ lean: async () => units }) });
  RoomUnitBlock.distinct = async () => [];
  RoomUnitBookingDay.distinct = async () => lockedUnitIds;
  RoomUnitBookingDay.insertMany = async (rows) => {
    insertedLocks.push(...rows);
    return rows;
  };
  RoomUnitBookingDay.deleteMany = async () => ({ deletedCount: 0 });

  try {
    const result = await fn({ insertedLocks });
    return { result, insertedLocks };
  } finally {
    Hotel.findById = originalHotelFindById;
    RoomType.findById = originalRoomTypeFindById;
    RoomUnit.find = originalRoomUnitFind;
    RoomUnitBlock.distinct = originalRoomUnitBlockDistinct;
    RoomUnitBookingDay.distinct = originalRoomUnitBookingDayDistinct;
    RoomUnitBookingDay.insertMany = originalRoomUnitBookingDayInsertMany;
    RoomUnitBookingDay.deleteMany = originalRoomUnitBookingDayDeleteMany;
  }
};

test('Dharamshala schema supports partner payment choice and request states', () => {
  assert.ok(Booking.schema.path('bookingStatus').enumValues.includes('pending_property_confirmation'));
  assert.ok(Booking.schema.path('bookingStatus').enumValues.includes('awaiting_customer_payment'));
  assert.ok(Booking.schema.path('propertyPaymentChoice').enumValues.includes('pay_at_dharamshala'));
  assert.ok(Booking.schema.path('propertyPaymentChoice').enumValues.includes('full_online'));
  assert.ok(Hotel.schema.path('dharamshalaPlatformFeeEnabled'));
  assert.equal(Hotel.schema.path('dharamshalaServiceFee').defaultValue, 79);
});

test('Dharamshala accounting applies configurable platform fee for check-in payment', () => {
  const hotel = { dharamshalaPlatformFeeEnabled: true, dharamshalaServiceFee: 125 };
  const roomType = { pricePerNight: 700 };
  const money = buildDharamshalaAccounting({
    hotel,
    roomType,
    nights: 2,
    roomQuantity: 2,
    paymentMode: 'pay_at_dharamshala',
  });

  assert.equal(getDharamshalaPlatformFee(hotel), 125);
  assert.equal(money.dharamshalaAmount, 2800);
  assert.equal(money.vrindavanSarthiServiceFee, 125);
  assert.equal(money.amountPaidOnline, 125);
  assert.equal(money.amountPayableAtProperty, 2800);
  assert.equal(money.totalAmount, 2925);
  assert.equal(money.customer_total, 2925);
});

test('Dharamshala full-online acceptance charges platform fee plus contribution online', async () => {
  const hotel = { _id: oid(), dharamshalaPlatformFeeEnabled: true, dharamshalaServiceFee: 79, petsAllowed: false };
  const roomType = { _id: oid(), pricePerNight: 1000, petsAllowed: false };
  const unit = { _id: oid(), hotelId: hotel._id, roomTypeId: roomType._id, number: 'A101' };
  const booking = saveableDharamshalaBooking({
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    roomQuantity: 1,
  });

  await withAcceptMocks({
    hotel,
    roomType,
    units: [unit],
    fn: async () => acceptDharamshalaRequest({
      booking,
      actor: { _id: oid(), role: 'partner', paymentMode: 'full_online' },
    }),
  });

  assert.equal(booking.bookingStatus, 'awaiting_customer_payment');
  assert.equal(booking.paymentStatus, 'pending');
  assert.equal(booking.paymentMode, 'full_online');
  assert.equal(booking.propertyPaymentChoice, 'full_online');
  assert.equal(booking.dharamshalaAmount, 2000);
  assert.equal(booking.vrindavanSarthiServiceFee, 79);
  assert.equal(booking.amountPaidOnline, 2079);
  assert.equal(booking.amountPayableAtProperty, 0);
  assert.equal(booking.totalAmount, 2079);
  assert.ok(booking.paymentHoldExpiresAt instanceof Date);
  assert.equal(booking.roomNumber, 'A101');
  assert.equal(booking.statusHistory.at(-1).to, 'awaiting_customer_payment');
});

test('Dharamshala check-in acceptance charges only platform fee online', async () => {
  const hotel = { _id: oid(), dharamshalaPlatformFeeEnabled: true, dharamshalaServiceFee: 99, petsAllowed: false };
  const roomType = { _id: oid(), pricePerNight: 500, petsAllowed: false };
  const unit = { _id: oid(), hotelId: hotel._id, roomTypeId: roomType._id, number: 'B202' };
  const booking = saveableDharamshalaBooking({
    hotelId: hotel._id,
    roomTypeId: roomType._id,
  });

  await withAcceptMocks({
    hotel,
    roomType,
    units: [unit],
    fn: async () => acceptDharamshalaRequest({
      booking,
      actor: { _id: oid(), role: 'partner', paymentMode: 'pay_at_dharamshala' },
    }),
  });

  assert.equal(booking.bookingStatus, 'awaiting_customer_payment');
  assert.equal(booking.paymentStatus, 'pending');
  assert.equal(booking.paymentMode, 'pay_at_dharamshala');
  assert.equal(booking.propertyPaymentChoice, 'pay_at_dharamshala');
  assert.equal(booking.dharamshalaAmount, 1000);
  assert.equal(booking.vrindavanSarthiServiceFee, 99);
  assert.equal(booking.amountPaidOnline, 99);
  assert.equal(booking.amountPayableAtProperty, 1000);
  assert.equal(booking.totalAmount, 1099);
  assert.ok(booking.paymentHoldExpiresAt instanceof Date);
});

test('Dharamshala check-in acceptance confirms immediately when platform fee is disabled', async () => {
  const hotel = { _id: oid(), dharamshalaPlatformFeeEnabled: false, dharamshalaServiceFee: 79, petsAllowed: false };
  const roomType = { _id: oid(), pricePerNight: 600, petsAllowed: false };
  const unit = { _id: oid(), hotelId: hotel._id, roomTypeId: roomType._id, number: 'C303' };
  const booking = saveableDharamshalaBooking({
    hotelId: hotel._id,
    roomTypeId: roomType._id,
  });

  await withAcceptMocks({
    hotel,
    roomType,
    units: [unit],
    fn: async () => acceptDharamshalaRequest({
      booking,
      actor: { _id: oid(), role: 'partner', paymentMode: 'pay_at_dharamshala' },
    }),
  });

  assert.equal(getDharamshalaPlatformFee(hotel), 0);
  assert.equal(booking.bookingStatus, 'confirmed');
  assert.equal(booking.paymentStatus, 'not_required');
  assert.equal(booking.amountPaidOnline, 0);
  assert.equal(booking.amountPayableAtProperty, 1200);
  assert.equal(booking.totalAmount, 1200);
  assert.equal(booking.paymentHoldExpiresAt, undefined);
  assert.equal(booking.statusHistory.at(-1).to, 'confirmed');
});

test('Dharamshala Razorpay payable amount uses only the online amount selected by partner', () => {
  assert.equal(payableAmountForBooking({
    propertyType: 'dharamshala',
    paymentMode: 'pay_at_dharamshala',
    amountPaidOnline: 79,
    amountPayableAtProperty: 2000,
    totalAmount: 2079,
  }), 79);

  assert.equal(payableAmountForBooking({
    propertyType: 'dharamshala',
    paymentMode: 'full_online',
    amountPaidOnline: 2079,
    amountPayableAtProperty: 0,
    totalAmount: 2079,
  }), 2079);
});

test('Dharamshala decision routes are partner-only and scoped to the authenticated partner', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/booking.routes.js'), 'utf8');

  assert.match(source, /router\.put\('\/:id\/dharamshala\/accept', protect, authorize\('partner'\)/);
  assert.match(source, /router\.put\('\/:id\/dharamshala\/reject', protect, authorize\('partner'\)/);
  assert.match(source, /partnerId:\s*req\.user\._id/);
  assert.doesNotMatch(source, /router\.put\('\/:id\/dharamshala\/accept', protect, authorize\('admin'/);
  assert.doesNotMatch(source, /router\.put\('\/:id\/dharamshala\/reject', protect, authorize\('admin'/);
});

test('customer sanitizer hides Dharamshala contact and contribution until partner acceptance', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/booking.routes.js'), 'utf8');

  assert.match(source, /const canShowPartnerContact = isDharamshala \? partnerAccepted : plain\.bookingStatus === 'confirmed'/);
  assert.match(source, /if \(!canShowPartnerContact\)/);
  assert.match(source, /if \(isDharamshala && !partnerAccepted\)/);
  assert.match(source, /'dharamshalaAmount'/);
  assert.match(source, /'amountPaidOnline'/);
});
