const test = require('node:test');
const assert = require('node:assert/strict');

const RatePlan = require('../models/RatePlan');
const RateCalendar = require('../models/RateCalendar');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const {
  dateKey,
  getRoomTypeAvailability,
  resolveRatesForStay,
  sanitizeRatePlanInput,
  validateOccupancy,
} = require('../utils/rateEngine');

const oid = (suffix) => `507f1f77bcf86cd799439${String(suffix).padStart(3, '0').slice(-3)}`;
const date = (value) => new Date(`${value}T00:00:00.000Z`);
const leanable = (value) => ({ lean: async () => value });
const sortableLeanable = (value) => ({ sort: () => ({ lean: async () => value }) });

test('RatePlan schema declares canonical uniqueness and default-plan indexes', () => {
  const indexes = RatePlan.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.hotelId === 1 && fields.roomTypeId === 1 && fields.code === 1 && options.unique));
  assert.ok(indexes.some(([fields, options]) => fields.roomTypeId === 1 && fields.isDefault === 1 && options.unique));
});

test('RateCalendar schema declares one override per rate plan and date', () => {
  const indexes = RateCalendar.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.ratePlanId === 1 && fields.date === 1 && options.unique));
});

test('rate plan input validation normalizes meal plan and rejects invalid price', () => {
  const input = sanitizeRatePlanInput({ name: 'Breakfast Included', basePrice: '3000', mealPlan: 'breakfast' });
  assert.equal(input.code, 'BREAKFAST_INCLUDED');
  assert.equal(input.mealPlan, 'BREAKFAST');
  assert.equal(input.basePrice, 3000);
  assert.throws(() => sanitizeRatePlanInput({ name: 'Bad', basePrice: -1 }), /Valid basePrice/);
});

test('rate resolution uses date-specific override and falls back to default rate', async () => {
  const originalFind = RateCalendar.find;
  const originalFindOne = RateCalendar.findOne;
  RateCalendar.find = () => leanable([
    { date: date('2026-10-11'), price: 3000, active: true },
  ]);
  RateCalendar.findOne = () => leanable(null);
  try {
    const result = await resolveRatesForStay({
      hotel: { _id: oid('001') },
      roomType: { _id: oid('002'), pricePerNight: 2500 },
      ratePlan: { _id: oid('003'), basePrice: 2500, currency: 'INR', restrictions: {} },
      checkIn: date('2026-10-10'),
      checkOut: date('2026-10-12'),
      roomQuantity: 2,
    });
    assert.equal(result.baseAmount, 11000);
    assert.deepEqual(result.nightlyBreakdown.map((night) => [dateKey(night.date), night.price, night.source]), [
      ['2026-10-10', 2500, 'default'],
      ['2026-10-11', 3000, 'calendar'],
    ]);
  } finally {
    RateCalendar.find = originalFind;
    RateCalendar.findOne = originalFindOne;
  }
});

test('minimum stay, closed, CTA, and CTD restrictions are enforced', async () => {
  const originalFind = RateCalendar.find;
  const originalFindOne = RateCalendar.findOne;
  RateCalendar.findOne = () => leanable(null);
  try {
    RateCalendar.find = () => leanable([{ date: date('2026-10-10'), minimumStay: 2 }]);
    await assert.rejects(
      resolveRatesForStay({
        hotel: { _id: oid('011') },
        roomType: { _id: oid('012') },
        ratePlan: { _id: oid('013'), basePrice: 1000, restrictions: {} },
        checkIn: date('2026-10-10'),
        checkOut: date('2026-10-11'),
      }),
      /Minimum stay/
    );

    RateCalendar.find = () => leanable([{ date: date('2026-10-10'), closed: true }]);
    await assert.rejects(
      resolveRatesForStay({
        hotel: { _id: oid('014') },
        roomType: { _id: oid('015') },
        ratePlan: { _id: oid('016'), basePrice: 1000, restrictions: {} },
        checkIn: date('2026-10-10'),
        checkOut: date('2026-10-11'),
      }),
      /closed/
    );

    RateCalendar.find = () => leanable([{ date: date('2026-10-10'), closedToArrival: true }]);
    await assert.rejects(
      resolveRatesForStay({
        hotel: { _id: oid('017') },
        roomType: { _id: oid('018') },
        ratePlan: { _id: oid('019'), basePrice: 1000, restrictions: {} },
        checkIn: date('2026-10-10'),
        checkOut: date('2026-10-11'),
      }),
      /closed to arrival/
    );

    RateCalendar.find = () => leanable([]);
    RateCalendar.findOne = () => leanable({ date: date('2026-10-11'), closedToDeparture: true });
    await assert.rejects(
      resolveRatesForStay({
        hotel: { _id: oid('020') },
        roomType: { _id: oid('021') },
        ratePlan: { _id: oid('022'), basePrice: 1000, restrictions: {} },
        checkIn: date('2026-10-10'),
        checkOut: date('2026-10-11'),
      }),
      /closed to departure/
    );
  } finally {
    RateCalendar.find = originalFind;
    RateCalendar.findOne = originalFindOne;
  }
});

test('occupancy validation reuses room type capacity and optional rate plan limits', () => {
  const roomType = { maxAdults: 2, maxChildren: 1 };
  assert.deepEqual(validateOccupancy({ roomType, ratePlan: {}, roomQuantity: 2, adults: 4, children: 2 }), {
    totalAdults: 4,
    totalChildren: 2,
    guests: 6,
  });
  assert.throws(() => validateOccupancy({ roomType, ratePlan: {}, roomQuantity: 1, adults: 3, children: 0 }), /Max adults/);
  assert.throws(() => validateOccupancy({ roomType, ratePlan: { occupancyRules: { maxAdults: 1 } }, roomQuantity: 1, adults: 2, children: 0 }), /Max adults/);
});

test('availability counts physical rooms once across rate plans and respects blocks/bookings', async () => {
  const originalHotelFindById = Hotel.findById;
  const originalRoomTypeFindOne = RoomType.findOne;
  const originalRoomUnitFind = RoomUnit.find;
  const originalBlockDistinct = RoomUnitBlock.distinct;
  const originalBookingDistinct = RoomUnitBookingDay.distinct;
  Hotel.findById = () => leanable({ _id: oid('031'), petsAllowed: true });
  RoomType.findOne = () => leanable({ _id: oid('032'), hotelId: oid('031'), status: 'active', petsAllowed: true });
  RoomUnit.find = () => sortableLeanable([
    { _id: oid('033'), hotelId: oid('031'), roomTypeId: oid('032'), status: 'available', number: '101' },
    { _id: oid('034'), hotelId: oid('031'), roomTypeId: oid('032'), status: 'available', number: '102' },
    { _id: oid('035'), hotelId: oid('031'), roomTypeId: oid('032'), status: 'available', number: '103' },
  ]);
  RoomUnitBlock.distinct = async () => [oid('034')];
  RoomUnitBookingDay.distinct = async () => [oid('035')];
  try {
    const result = await getRoomTypeAvailability({
      hotelId: oid('031'),
      roomTypeId: oid('032'),
      checkIn: date('2026-10-10'),
      checkOut: date('2026-10-12'),
      quantity: 2,
    });
    assert.equal(result.totalUnits, 3);
    assert.equal(result.availableCount, 1);
    assert.equal(result.inventoryAvailable, false);
  } finally {
    Hotel.findById = originalHotelFindById;
    RoomType.findOne = originalRoomTypeFindOne;
    RoomUnit.find = originalRoomUnitFind;
    RoomUnitBlock.distinct = originalBlockDistinct;
    RoomUnitBookingDay.distinct = originalBookingDistinct;
  }
});
