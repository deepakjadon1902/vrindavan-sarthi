const express = require('express');

const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RatePlan = require('../models/RatePlan');
const RateCalendar = require('../models/RateCalendar');
const { protect, authorize } = require('../middleware/auth');
const { rejectInvalidObjectId } = require('../utils/security');
const { parseDateOnlyToUTC, isValidDate, enumerateDatesUTC } = require('../utils/date');
const {
  createBookingQuote,
  ensureDefaultRatePlan,
  getRoomTypeAvailability,
  httpError,
  sanitizeRatePlanInput,
  sanitizeRestrictions,
} = require('../utils/rateEngine');

const router = express.Router();

const normalize = (value) => String(value || '').trim();

for (const paramName of ['hotelId', 'roomTypeId', 'ratePlanId']) {
  router.param(paramName, (req, res, next, value) => {
    if (rejectInvalidObjectId(res, value, paramName)) return;
    next();
  });
}

const sendError = (res, err, fallback = 'Rate request failed') =>
  res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : fallback });

const authorizeRoomType = async ({ roomTypeId, user, activeOnly = false }) => {
  const roomType = await RoomType.findOne({ _id: roomTypeId, ...(activeOnly ? { status: 'active' } : {}) }).lean();
  if (!roomType) throw httpError('Room type not found', 404);
  const hotel = await Hotel.findById(roomType.hotelId).lean();
  if (!hotel) throw httpError('Hotel not found', 404);
  if (user.role !== 'admin' && String(hotel.partnerId || roomType.partnerId || '') !== String(user._id)) {
    throw httpError('Not authorized', 403);
  }
  return { hotel, roomType };
};

router.get('/room-types/:roomTypeId/plans', async (req, res) => {
  try {
    const roomType = await RoomType.findOne({ _id: req.params.roomTypeId, status: 'active' }).lean();
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });
    const hotel = await Hotel.findById(roomType.hotelId).lean();
    if (!hotel) return res.status(404).json({ success: false, message: 'Hotel not found' });
    await ensureDefaultRatePlan({ hotel, roomType });
    const plans = await RatePlan.find({ roomTypeId: roomType._id, active: true })
      .sort({ sortOrder: 1, basePrice: 1, createdAt: 1 })
      .select('_id hotelId roomTypeId name code description mealPlan cancellationPolicy paymentPolicy basePrice currency occupancyRules restrictions active isDefault sortOrder')
      .lean();
    res.json({ success: true, data: plans });
  } catch (err) {
    sendError(res, err, 'Rate plans could not be loaded');
  }
});

router.get('/room-types/:roomTypeId/availability', async (req, res) => {
  try {
    const roomType = await RoomType.findById(req.params.roomTypeId).lean();
    if (!roomType) return res.status(404).json({ success: false, message: 'Room type not found' });
    const result = await getRoomTypeAvailability({
      hotelId: roomType.hotelId,
      roomTypeId: roomType._id,
      checkIn: req.query.checkIn,
      checkOut: req.query.checkOut,
      quantity: req.query.quantity || 1,
      hasPet: req.query.hasPet === 'true',
    });
    res.json({
      success: true,
      data: {
        hotelId: result.hotel._id,
        roomTypeId: result.roomType._id,
        totalUnits: result.totalUnits,
        availableCount: result.availableCount,
        requestedQuantity: result.requestedQuantity,
        inventoryAvailable: result.inventoryAvailable,
        nights: result.nights,
      },
    });
  } catch (err) {
    sendError(res, err, 'Availability could not be calculated');
  }
});

router.post('/quote', async (req, res) => {
  try {
    const quote = await createBookingQuote({
      hotelId: req.body?.hotelId,
      roomTypeId: req.body?.roomTypeId,
      ratePlanId: req.body?.ratePlanId,
      checkIn: req.body?.checkIn,
      checkOut: req.body?.checkOut,
      roomQuantity: req.body?.roomQuantity || req.body?.quantity || 1,
      adults: req.body?.adults || req.body?.totalAdults || 1,
      children: req.body?.children || req.body?.totalChildren || 0,
      hasPet: Boolean(req.body?.hasPet),
      paymentOption: req.body?.paymentOption || 'advance_30',
      checkInventory: true,
    });
    res.json({ success: true, data: quote.quote });
  } catch (err) {
    sendError(res, err, 'Quote could not be calculated');
  }
});

router.use('/manage', protect);

router.get('/manage/room-types/:roomTypeId/plans', async (req, res) => {
  try {
    const { hotel, roomType } = await authorizeRoomType({ roomTypeId: req.params.roomTypeId, user: req.user });
    await ensureDefaultRatePlan({ hotel, roomType, actor: req.user });
    const plans = await RatePlan.find({ roomTypeId: roomType._id }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    res.json({ success: true, data: plans });
  } catch (err) {
    sendError(res, err, 'Managed rate plans could not be loaded');
  }
});

router.post('/manage/room-types/:roomTypeId/plans', async (req, res) => {
  try {
    const { hotel, roomType } = await authorizeRoomType({ roomTypeId: req.params.roomTypeId, user: req.user });
    const input = sanitizeRatePlanInput(req.body);
    const plan = await RatePlan.create({
      ...input,
      hotelId: hotel._id,
      roomTypeId: roomType._id,
      partnerId: hotel.partnerId || roomType.partnerId,
      isDefault: Boolean(req.body?.isDefault) && req.user.role === 'admin',
      createdByUserId: req.user._id,
      createdByRole: req.user.role,
    });
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    if (String(err?.code) === '11000') return res.status(409).json({ success: false, message: 'Rate plan already exists for this room type' });
    sendError(res, err, 'Rate plan could not be created');
  }
});

router.put('/manage/plans/:ratePlanId', async (req, res) => {
  try {
    const plan = await RatePlan.findById(req.params.ratePlanId);
    if (!plan) return res.status(404).json({ success: false, message: 'Rate plan not found' });
    await authorizeRoomType({ roomTypeId: plan.roomTypeId, user: req.user });
    const input = sanitizeRatePlanInput(req.body, { requireName: false, requirePrice: false });
    for (const [key, value] of Object.entries(input)) {
      if (key === 'occupancyRules' && !Object.keys(value || {}).length) continue;
      if (key === 'restrictions' && !Object.keys(value || {}).length) continue;
      if (typeof value !== 'undefined') plan[key] = value;
    }
    if (typeof req.body?.active !== 'undefined') plan.active = Boolean(req.body.active);
    await plan.save();
    res.json({ success: true, data: plan });
  } catch (err) {
    if (String(err?.code) === '11000') return res.status(409).json({ success: false, message: 'Rate plan already exists for this room type' });
    sendError(res, err, 'Rate plan could not be updated');
  }
});

router.get('/manage/plans/:ratePlanId/calendar', async (req, res) => {
  try {
    const plan = await RatePlan.findById(req.params.ratePlanId).lean();
    if (!plan) return res.status(404).json({ success: false, message: 'Rate plan not found' });
    await authorizeRoomType({ roomTypeId: plan.roomTypeId, user: req.user });
    const from = parseDateOnlyToUTC(String(req.query.from || ''));
    const to = parseDateOnlyToUTC(String(req.query.to || ''));
    const filter = { ratePlanId: plan._id };
    if (isValidDate(from) && isValidDate(to) && from < to) filter.date = { $gte: from, $lt: to };
    const rows = await RateCalendar.find(filter).sort({ date: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err, 'Rate calendar could not be loaded');
  }
});

router.put('/manage/plans/:ratePlanId/calendar', async (req, res) => {
  try {
    const plan = await RatePlan.findById(req.params.ratePlanId).lean();
    if (!plan) return res.status(404).json({ success: false, message: 'Rate plan not found' });
    await authorizeRoomType({ roomTypeId: plan.roomTypeId, user: req.user });
    const from = parseDateOnlyToUTC(String(req.body?.date || req.body?.from || ''));
    const toInput = req.body?.to ? parseDateOnlyToUTC(String(req.body.to)) : new Date(from?.getTime() + 24 * 60 * 60 * 1000);
    if (!isValidDate(from) || !isValidDate(toInput) || from >= toInput) {
      return res.status(400).json({ success: false, message: 'Valid date/from and to are required' });
    }
    const dates = enumerateDatesUTC(from, toInput);
    if (!dates.length || dates.length > 370) return res.status(400).json({ success: false, message: 'Date range must be 1 to 370 nights' });
    const price = typeof req.body?.price !== 'undefined' ? Math.round(Number(req.body.price)) : undefined;
    if (typeof price !== 'undefined' && (!Number.isFinite(price) || price < 0)) {
      return res.status(400).json({ success: false, message: 'Valid price is required' });
    }
    const restrictions = sanitizeRestrictions(req.body || {});
    const set = {
      ...(typeof price !== 'undefined' ? { price } : {}),
      ...(normalize(req.body?.currency) ? { currency: normalize(req.body.currency).toUpperCase() } : {}),
      ...restrictions,
      active: typeof req.body?.active === 'undefined' ? true : Boolean(req.body.active),
      updatedByUserId: req.user._id,
      updatedByRole: req.user.role,
    };
    const ops = dates.map((date) => ({
      updateOne: {
        filter: { ratePlanId: plan._id, date },
        update: {
          $set: {
            hotelId: plan.hotelId,
            roomTypeId: plan.roomTypeId,
            ratePlanId: plan._id,
            date,
            ...set,
          },
        },
        upsert: true,
      },
    }));
    await RateCalendar.bulkWrite(ops, { ordered: false });
    const rows = await RateCalendar.find({ ratePlanId: plan._id, date: { $in: dates } }).sort({ date: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err, 'Rate calendar could not be updated');
  }
});

router.delete('/manage/plans/:ratePlanId/calendar', async (req, res) => {
  try {
    const plan = await RatePlan.findById(req.params.ratePlanId).lean();
    if (!plan) return res.status(404).json({ success: false, message: 'Rate plan not found' });
    await authorizeRoomType({ roomTypeId: plan.roomTypeId, user: req.user });
    const date = parseDateOnlyToUTC(String(req.body?.date || req.query?.date || ''));
    if (!isValidDate(date)) return res.status(400).json({ success: false, message: 'Valid date is required' });
    const result = await RateCalendar.deleteOne({ ratePlanId: plan._id, date });
    res.json({ success: true, deleted: result.deletedCount || 0 });
  } catch (err) {
    sendError(res, err, 'Rate calendar entry could not be deleted');
  }
});

router.use('/admin', protect, authorize('admin'));

router.get('/admin/plans', async (req, res) => {
  try {
    const filter = {};
    if (req.query.hotelId) {
      if (rejectInvalidObjectId(res, req.query.hotelId, 'hotelId')) return;
      filter.hotelId = req.query.hotelId;
    }
    if (req.query.roomTypeId) {
      if (rejectInvalidObjectId(res, req.query.roomTypeId, 'roomTypeId')) return;
      filter.roomTypeId = req.query.roomTypeId;
    }
    const plans = await RatePlan.find(filter).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ success: true, data: plans });
  } catch (err) {
    sendError(res, err, 'Admin rate plans could not be loaded');
  }
});

module.exports = router;
