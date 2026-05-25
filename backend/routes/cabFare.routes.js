const express = require('express');
const CabFare = require('../models/CabFare');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

const normalize = (v) => String(v || '').trim();

const normalizeLocationKey = (v) => normalize(v).replace(/\s+/g, ' ');

const calcFare = ({ baseFare, includedPersons, extraPersonCharge, persons }) => {
  const base = Number(baseFare || 0);
  const included = Math.max(1, Number(includedPersons || 1));
  const extraCharge = Math.max(0, Number(extraPersonCharge || 0));
  const pax = Math.max(1, Number(persons || 1));

  const extraPersons = Math.max(0, pax - included);
  const extra = extraPersons * extraCharge;
  const total = Math.max(0, base + extra);

  return {
    baseFare: base,
    includedPersons: included,
    extraPersonCharge: extraCharge,
    persons: pax,
    extraPersons,
    extraAmount: extra,
    totalFare: total,
  };
};

// Public: list active fare rules (for auto-suggests)
router.get('/', async (req, res) => {
  try {
    const fares = await CabFare.find({ status: 'active' })
      .sort({ pickupLocation: 1, dropLocation: 1, cabType: 1 })
      .select('pickupLocation dropLocation cabType baseFare includedPersons extraPersonCharge status updatedAt')
      .lean();
    res.json({ success: true, data: fares });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: calculate fare for a route/type/persons
router.get('/calculate', async (req, res) => {
  try {
    const pickup = normalizeLocationKey(req.query?.pickupLocation);
    const drop = normalizeLocationKey(req.query?.dropLocation);
    const cabType = normalize(req.query?.cabType);
    const persons = Number(req.query?.persons || 1);

    if (!pickup || !drop || !cabType) {
      return res.status(400).json({ success: false, message: 'pickupLocation, dropLocation and cabType are required' });
    }

    const rule = await CabFare.findOne({
      pickupLocation: pickup,
      dropLocation: drop,
      cabType,
      status: 'active',
    }).lean();

    if (!rule) return res.status(404).json({ success: false, message: 'Fare not set for this route/cab type' });

    const breakdown = calcFare({ ...rule, persons });
    res.json({ success: true, data: { ruleId: String(rule._id), ...breakdown } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin CRUD
router.get('/all', protect, authorize('admin'), async (req, res) => {
  try {
    const limitRaw = Number(req.query?.limit || 0);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(5000, Math.floor(limitRaw)) : 2000;
    const fares = await CabFare.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ success: true, data: fares });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const pickupLocation = normalizeLocationKey(req.body?.pickupLocation);
    const dropLocation = normalizeLocationKey(req.body?.dropLocation);
    const cabType = normalize(req.body?.cabType);
    const baseFare = Number(req.body?.baseFare || 0);
    const includedPersons = Number(req.body?.includedPersons || 1);
    const extraPersonCharge = Number(req.body?.extraPersonCharge || 0);
    const status = normalize(req.body?.status) === 'inactive' ? 'inactive' : 'active';

    if (!pickupLocation || !dropLocation || !cabType) {
      return res.status(400).json({ success: false, message: 'pickupLocation, dropLocation and cabType are required' });
    }
    if (!Number.isFinite(baseFare) || baseFare < 0) return res.status(400).json({ success: false, message: 'Invalid baseFare' });
    if (!Number.isFinite(includedPersons) || includedPersons < 1) return res.status(400).json({ success: false, message: 'Invalid includedPersons' });
    if (!Number.isFinite(extraPersonCharge) || extraPersonCharge < 0) return res.status(400).json({ success: false, message: 'Invalid extraPersonCharge' });

    const fare = await CabFare.create({
      pickupLocation,
      dropLocation,
      cabType,
      baseFare,
      includedPersons,
      extraPersonCharge,
      status,
    });
    res.status(201).json({ success: true, data: fare });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(409).json({ success: false, message: 'Fare rule already exists for this route and cab type' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const update = {};
    if (typeof req.body?.pickupLocation !== 'undefined') update.pickupLocation = normalizeLocationKey(req.body.pickupLocation);
    if (typeof req.body?.dropLocation !== 'undefined') update.dropLocation = normalizeLocationKey(req.body.dropLocation);
    if (typeof req.body?.cabType !== 'undefined') update.cabType = normalize(req.body.cabType);
    if (typeof req.body?.baseFare !== 'undefined') update.baseFare = Number(req.body.baseFare || 0);
    if (typeof req.body?.includedPersons !== 'undefined') update.includedPersons = Number(req.body.includedPersons || 1);
    if (typeof req.body?.extraPersonCharge !== 'undefined') update.extraPersonCharge = Number(req.body.extraPersonCharge || 0);
    if (typeof req.body?.status !== 'undefined') update.status = normalize(req.body.status) === 'inactive' ? 'inactive' : 'active';

    const fare = await CabFare.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!fare) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: fare });
  } catch (err) {
    if (String(err?.code) === '11000') {
      return res.status(409).json({ success: false, message: 'Fare rule already exists for this route and cab type' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await CabFare.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
