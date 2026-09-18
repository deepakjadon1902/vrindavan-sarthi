const mongoose = require('mongoose');

const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const RatePlan = require('../models/RatePlan');
const RateCalendar = require('../models/RateCalendar');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC, daysBetween } = require('./date');
const { calculateLodgingPriceFromBase } = require('./pricing');

const BOOKABLE_ROOM_STATUSES = ['active', 'available'];
const MEAL_PLANS = ['ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD'];
const PAYMENT_POLICIES = ['ADVANCE_30', 'FULL_100', 'EITHER'];
const CANCELLATION_POLICIES = ['FLEXIBLE', 'NON_REFUNDABLE', 'CUSTOM'];

const normalize = (value) => String(value || '').trim();
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const assertObjectId = (value, name) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) throw httpError(`Invalid ${name}`, 400);
  return value;
};

const normalizeDateInput = (value, name) => {
  const date = value instanceof Date ? value : parseDateOnlyToUTC(String(value || ''));
  if (!isValidDate(date)) throw httpError(`Invalid ${name}`, 400);
  return date;
};

const normalizeStay = ({ checkIn, checkOut }) => {
  const start = normalizeDateInput(checkIn, 'checkIn');
  const end = normalizeDateInput(checkOut, 'checkOut');
  if (start >= end) throw httpError('checkOut must be after checkIn', 400);
  const nights = enumerateDatesUTC(start, end);
  if (!nights.length) throw httpError('Invalid stay dates', 400);
  return { checkIn: start, checkOut: end, nights };
};

const sanitizeRatePlanInput = (body = {}, { requireName = true, requirePrice = true } = {}) => {
  const name = normalize(body.name);
  if (requireName && !name) throw httpError('Rate plan name is required', 400);
  const code = normalize(body.code || name || 'ROOM_ONLY').toUpperCase().replace(/[^A-Z0-9_ -]+/g, '').replace(/\s+/g, '_').slice(0, 40);
  const mealPlan = normalize(body.mealPlan || 'ROOM_ONLY').toUpperCase();
  if (!MEAL_PLANS.includes(mealPlan)) throw httpError('Invalid mealPlan', 400);
  const cancellationPolicy = normalize(body.cancellationPolicy || 'FLEXIBLE').toUpperCase();
  if (!CANCELLATION_POLICIES.includes(cancellationPolicy)) throw httpError('Invalid cancellationPolicy', 400);
  const paymentPolicy = normalize(body.paymentPolicy || 'EITHER').toUpperCase();
  if (!PAYMENT_POLICIES.includes(paymentPolicy)) throw httpError('Invalid paymentPolicy', 400);
  const basePrice = typeof body.basePrice !== 'undefined' ? Math.round(Number(body.basePrice)) : undefined;
  if (requirePrice && (!Number.isFinite(basePrice) || basePrice < 0)) throw httpError('Valid basePrice is required', 400);
  if (typeof basePrice !== 'undefined' && (!Number.isFinite(basePrice) || basePrice < 0)) throw httpError('Valid basePrice is required', 400);

  const restrictions = sanitizeRestrictions(body.restrictions || body);
  const occupancyRules = {};
  if (typeof body?.occupancyRules?.maxAdults !== 'undefined') occupancyRules.maxAdults = Math.max(1, Number(body.occupancyRules.maxAdults || 1));
  if (typeof body?.occupancyRules?.maxChildren !== 'undefined') occupancyRules.maxChildren = Math.max(0, Number(body.occupancyRules.maxChildren || 0));

  return {
    ...(name ? { name } : {}),
    ...(code ? { code } : {}),
    description: normalize(body.description),
    mealPlan,
    cancellationPolicy,
    paymentPolicy,
    ...(typeof basePrice !== 'undefined' ? { basePrice } : {}),
    currency: normalize(body.currency || 'INR').toUpperCase() || 'INR',
    occupancyRules,
    restrictions,
    active: typeof body.active === 'undefined' ? true : Boolean(body.active),
    sortOrder: Math.max(0, Math.floor(Number(body.sortOrder || 0))),
  };
};

const sanitizeRestrictions = (source = {}) => {
  const out = {};
  const minimumStay = Number(source.minimumStay);
  if (Number.isFinite(minimumStay)) out.minimumStay = Math.max(1, Math.floor(minimumStay));
  const maximumStay = Number(source.maximumStay);
  if (Number.isFinite(maximumStay) && maximumStay > 0) out.maximumStay = Math.floor(maximumStay);
  for (const key of ['closed', 'closedToArrival', 'closedToDeparture']) {
    if (typeof source[key] !== 'undefined') out[key] = Boolean(source[key]);
  }
  const minimumAdvanceDays = Number(source.minimumAdvanceDays);
  if (Number.isFinite(minimumAdvanceDays) && minimumAdvanceDays >= 0) out.minimumAdvanceDays = Math.floor(minimumAdvanceDays);
  const maximumAdvanceDays = Number(source.maximumAdvanceDays);
  if (Number.isFinite(maximumAdvanceDays) && maximumAdvanceDays >= 0) out.maximumAdvanceDays = Math.floor(maximumAdvanceDays);
  return out;
};

const getDefaultRatePlanCode = (roomTypeId) => `DEFAULT_${String(roomTypeId).slice(-8).toUpperCase()}`;

const ensureDefaultRatePlan = async ({ hotel, roomType, actor = {} }) => {
  const existing = await RatePlan.findOne({ roomTypeId: roomType._id, isDefault: true });
  if (existing) return existing;
  try {
    return await RatePlan.create({
      hotelId: roomType.hotelId || hotel._id,
      roomTypeId: roomType._id,
      partnerId: roomType.partnerId || hotel.partnerId,
      name: 'Room Only',
      code: getDefaultRatePlanCode(roomType._id),
      mealPlan: 'ROOM_ONLY',
      basePrice: Math.max(0, Math.round(Number(roomType.pricePerNight || 0))),
      currency: 'INR',
      active: true,
      isDefault: true,
      sortOrder: 0,
      createdByUserId: actor._id || null,
      createdByRole: actor.role || 'system',
    });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return RatePlan.findOne({ roomTypeId: roomType._id, isDefault: true });
    }
    throw err;
  }
};

const getRatePlanForSale = async ({ hotel, roomType, ratePlanId, actor = {}, allowInactive = false }) => {
  if (ratePlanId) {
    assertObjectId(ratePlanId, 'ratePlanId');
    const plan = await RatePlan.findOne({
      _id: ratePlanId,
      hotelId: hotel._id,
      roomTypeId: roomType._id,
      ...(allowInactive ? {} : { active: true }),
    });
    if (!plan) throw httpError('Rate plan not found', 404);
    return plan;
  }
  return ensureDefaultRatePlan({ hotel, roomType, actor });
};

const getRateCalendars = async ({ ratePlanId, dates }) => {
  const rows = await RateCalendar.find({
    ratePlanId,
    date: { $in: dates },
    active: true,
  }).lean();
  return new Map(rows.map((row) => [dateKey(row.date), row]));
};

const mergeRestrictionValue = (calendarValue, planValue, fallback) => {
  if (calendarValue !== null && typeof calendarValue !== 'undefined') return calendarValue;
  if (planValue !== null && typeof planValue !== 'undefined') return planValue;
  return fallback;
};

const enforceAdvanceRestrictions = ({ checkIn, restrictions, now = new Date() }) => {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const advanceDays = daysBetween(today, checkIn);
  const hasMinimumAdvance = restrictions.minimumAdvanceDays !== null && typeof restrictions.minimumAdvanceDays !== 'undefined';
  const hasMaximumAdvance = restrictions.maximumAdvanceDays !== null && typeof restrictions.maximumAdvanceDays !== 'undefined';
  if (hasMinimumAdvance && Number.isFinite(Number(restrictions.minimumAdvanceDays)) && advanceDays < Number(restrictions.minimumAdvanceDays)) {
    throw httpError(`Minimum advance booking is ${restrictions.minimumAdvanceDays} day(s)`, 422);
  }
  if (hasMaximumAdvance && Number.isFinite(Number(restrictions.maximumAdvanceDays)) && advanceDays > Number(restrictions.maximumAdvanceDays)) {
    throw httpError(`Maximum advance booking is ${restrictions.maximumAdvanceDays} day(s)`, 422);
  }
};

const resolveRatesForStay = async ({ hotel, roomType, ratePlan, checkIn, checkOut, roomQuantity = 1, now = new Date() }) => {
  const { nights } = normalizeStay({ checkIn, checkOut });
  const quantity = Math.max(1, Math.floor(Number(roomQuantity || 1)));
  const calendarByDate = await getRateCalendars({ ratePlanId: ratePlan._id, dates: nights });
  const checkoutCalendar = await RateCalendar.findOne({ ratePlanId: ratePlan._id, date: checkOut, active: true }).lean();
  const planRestrictions = ratePlan.restrictions || {};
  const stayNights = nights.length;
  const nightlyBreakdown = [];
  let baseAmount = 0;

  for (let index = 0; index < nights.length; index += 1) {
    const day = nights[index];
    const override = calendarByDate.get(dateKey(day));
    const price = Math.round(Number(
      override && override.price !== null && typeof override.price !== 'undefined'
        ? override.price
        : ratePlan.basePrice
    ));
    if (!Number.isFinite(price) || price < 0) throw httpError('Rate is not available for selected dates', 409);

    const restrictions = {
      minimumStay: mergeRestrictionValue(override?.minimumStay, planRestrictions.minimumStay, 1),
      maximumStay: mergeRestrictionValue(override?.maximumStay, planRestrictions.maximumStay, null),
      closed: mergeRestrictionValue(override?.closed, planRestrictions.closed, false),
      closedToArrival: mergeRestrictionValue(override?.closedToArrival, planRestrictions.closedToArrival, false),
      closedToDeparture: mergeRestrictionValue(override?.closedToDeparture, planRestrictions.closedToDeparture, false),
      minimumAdvanceDays: mergeRestrictionValue(override?.minimumAdvanceDays, planRestrictions.minimumAdvanceDays, null),
      maximumAdvanceDays: mergeRestrictionValue(override?.maximumAdvanceDays, planRestrictions.maximumAdvanceDays, null),
    };

    if (restrictions.closed) throw httpError(`Rate is closed on ${dateKey(day)}`, 422);
    if (index === 0 && restrictions.closedToArrival) throw httpError('Rate is closed to arrival on the selected check-in date', 422);
    if (Number(restrictions.minimumStay || 1) > stayNights) throw httpError(`Minimum stay is ${restrictions.minimumStay} night(s)`, 422);
    if (restrictions.maximumStay && Number(restrictions.maximumStay) < stayNights) throw httpError(`Maximum stay is ${restrictions.maximumStay} night(s)`, 422);
    enforceAdvanceRestrictions({ checkIn, restrictions, now });

    const amount = price * quantity;
    baseAmount += amount;
    nightlyBreakdown.push({
      date: day,
      ratePlanId: ratePlan._id,
      price,
      quantity,
      amount,
      source: override ? 'calendar' : 'default',
    });
  }

  const checkoutClosedToDeparture = mergeRestrictionValue(checkoutCalendar?.closedToDeparture, planRestrictions.closedToDeparture, false);
  if (checkoutClosedToDeparture) throw httpError('Rate is closed to departure on the selected check-out date', 422);

  return {
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    ratePlanId: ratePlan._id,
    currency: ratePlan.currency || 'INR',
    checkIn,
    checkOut,
    nights: stayNights,
    roomQuantity: quantity,
    nightlyBreakdown,
    baseAmount,
  };
};

const validateOccupancy = ({ roomType, ratePlan, roomQuantity = 1, adults = 1, children = 0 }) => {
  const quantity = Math.max(1, Math.floor(Number(roomQuantity || 1)));
  const totalAdults = Number(adults);
  const totalChildren = Number(children || 0);
  if (!Number.isFinite(totalAdults) || totalAdults < 1) throw httpError('At least 1 adult is required', 400);
  if (!Number.isFinite(totalChildren) || totalChildren < 0) throw httpError('Invalid children count', 400);
  const planAdults = Number(ratePlan?.occupancyRules?.maxAdults || 0);
  const planChildren = Number(ratePlan?.occupancyRules?.maxChildren || 0);
  const maxAdultsPerRoom = planAdults > 0 ? planAdults : Math.max(1, Number(roomType.maxAdults || 1));
  const maxChildrenPerRoom = planChildren > 0 ? planChildren : Math.max(0, Number(roomType.maxChildren || 0));
  const maxAdults = maxAdultsPerRoom * quantity;
  const maxChildren = maxChildrenPerRoom * quantity;
  if (totalAdults > maxAdults) throw httpError(`Max adults for ${quantity} room(s) is ${maxAdults}`, 422);
  if (totalChildren > maxChildren) throw httpError(`Max children for ${quantity} room(s) is ${maxChildren}`, 422);
  return { totalAdults, totalChildren, guests: totalAdults + totalChildren };
};

const getRoomTypeAvailability = async ({ hotelId, roomTypeId, checkIn, checkOut, quantity = 1, hasPet = false }) => {
  assertObjectId(hotelId, 'hotelId');
  assertObjectId(roomTypeId, 'roomTypeId');
  const { checkIn: start, checkOut: end, nights } = normalizeStay({ checkIn, checkOut });
  const requiredQuantity = Math.max(1, Math.floor(Number(quantity || 1)));

  const [hotel, roomType, units] = await Promise.all([
    Hotel.findById(hotelId).lean(),
    RoomType.findOne({ _id: roomTypeId, hotelId, status: 'active' }).lean(),
    RoomUnit.find({ hotelId, roomTypeId, status: { $in: BOOKABLE_ROOM_STATUSES } }).sort({ number: 1 }).lean(),
  ]);
  if (!hotel) throw httpError('Hotel not found', 404);
  if (!roomType) throw httpError('Room type not found', 404);

  const unitIds = units
    .filter((unit) => {
      if (!hasPet) return true;
      return Boolean(hotel.petsAllowed) &&
        (unit.petsAllowedOverride === null || typeof unit.petsAllowedOverride === 'undefined'
          ? Boolean(roomType.petsAllowed)
          : Boolean(unit.petsAllowedOverride));
    })
    .map((unit) => unit._id);

  if (!unitIds.length) {
    return {
      hotel,
      roomType,
      totalUnits: 0,
      blockedUnitIds: [],
      bookedUnitIds: [],
      availableUnitIds: [],
      availableCount: 0,
      requestedQuantity: requiredQuantity,
      inventoryAvailable: false,
      nights: nights.length,
    };
  }

  const [blockedUnitIds, bookedUnitIds] = await Promise.all([
    RoomUnitBlock.distinct('roomUnitId', {
      roomUnitId: { $in: unitIds },
      roomTypeId,
      startDate: { $lt: end },
      endDate: { $gt: start },
    }),
    RoomUnitBookingDay.distinct('roomUnitId', {
      roomUnitId: { $in: unitIds },
      roomTypeId,
      date: { $gte: start, $lt: end },
    }),
  ]);

  const unavailable = new Set([...blockedUnitIds, ...bookedUnitIds].map(String));
  const availableUnitIds = unitIds.filter((id) => !unavailable.has(String(id)));

  return {
    hotel,
    roomType,
    totalUnits: unitIds.length,
    blockedUnitIds,
    bookedUnitIds,
    availableUnitIds,
    availableCount: availableUnitIds.length,
    requestedQuantity: requiredQuantity,
    inventoryAvailable: availableUnitIds.length >= requiredQuantity,
    nights: nights.length,
  };
};

const createBookingQuote = async ({
  hotelId,
  roomTypeId,
  ratePlanId,
  checkIn,
  checkOut,
  roomQuantity = 1,
  adults = 1,
  children = 0,
  hasPet = false,
  paymentOption = 'advance_30',
  gatewayFeeAmount,
  actor = {},
  checkInventory = true,
  now = new Date(),
}) => {
  assertObjectId(hotelId, 'hotelId');
  assertObjectId(roomTypeId, 'roomTypeId');
  const { checkIn: start, checkOut: end } = normalizeStay({ checkIn, checkOut });
  const [hotel, roomType] = await Promise.all([
    Hotel.findById(hotelId).lean(),
    RoomType.findOne({ _id: roomTypeId, hotelId, status: 'active' }).lean(),
  ]);
  if (!hotel) throw httpError('Hotel not found', 404);
  if (!roomType) throw httpError('Room type not found', 404);
  const ratePlan = await getRatePlanForSale({ hotel, roomType, ratePlanId, actor });
  if (!ratePlan.active) throw httpError('Rate plan is inactive', 409);

  const quantity = Math.max(1, Math.floor(Number(roomQuantity || 1)));
  const occupancy = validateOccupancy({ roomType, ratePlan, roomQuantity: quantity, adults, children });
  const rate = await resolveRatesForStay({ hotel, roomType, ratePlan, checkIn: start, checkOut: end, roomQuantity: quantity, now });
  const money = await calculateLodgingPriceFromBase({
    hotel,
    roomType: { ...roomType, pricePerNight: rate.nightlyBreakdown[0]?.price ?? roomType.pricePerNight },
    baseAmount: rate.baseAmount,
    paymentOption,
    gatewayFeeAmount,
  });
  const availability = checkInventory
    ? await getRoomTypeAvailability({ hotelId, roomTypeId, checkIn: start, checkOut: end, quantity, hasPet })
    : null;

  return {
    hotel,
    roomType,
    ratePlan,
    availability,
    quote: {
      hotelId: hotel._id,
      roomTypeId: roomType._id,
      ratePlanId: ratePlan._id,
      ratePlanName: ratePlan.name,
      ratePlanCode: ratePlan.code,
      mealPlan: ratePlan.mealPlan,
      checkIn: start,
      checkOut: end,
      nights: rate.nights,
      roomQuantity: quantity,
      adults: occupancy.totalAdults,
      children: occupancy.totalChildren,
      guests: occupancy.guests,
      currency: rate.currency,
      nightlyBreakdown: rate.nightlyBreakdown,
      baseAmount: rate.baseAmount,
      subtotal: money.subtotal,
      taxPercent: money.taxPercent,
      taxAmount: money.taxAmount,
      convenienceFeePercent: money.convenienceFeePercent,
      convenienceFeeAmount: money.convenienceFeeAmount,
      totalAmount: money.totalAmount,
      advanceAmount: money.advanceAmount,
      balanceAmount: money.balanceAmount,
      paymentOption: money.paymentOption,
      quoteExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      inventoryAvailable: availability ? availability.inventoryAvailable : undefined,
      availableCount: availability ? availability.availableCount : undefined,
    },
    money,
  };
};

module.exports = {
  BOOKABLE_ROOM_STATUSES,
  MEAL_PLANS,
  PAYMENT_POLICIES,
  CANCELLATION_POLICIES,
  assertObjectId,
  createBookingQuote,
  dateKey,
  ensureDefaultRatePlan,
  getRatePlanForSale,
  getRoomTypeAvailability,
  httpError,
  normalizeStay,
  resolveRatesForStay,
  sanitizeRatePlanInput,
  sanitizeRestrictions,
  validateOccupancy,
};
