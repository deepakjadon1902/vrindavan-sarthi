const express = require('express');
const CabFare = require('../models/CabFare');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

const normalize = (v) => String(v || '').trim();

const normalizeLocationKey = (v) => normalize(v).replace(/\s+/g, ' ');
const comparableKey = (v) => normalizeLocationKey(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const vehicleKey = (v) => comparableKey(v).replace(/\b(seater|seat|seats|cab|car|taxi|vehicle)\b/g, '').replace(/\s+/g, ' ').trim();

const calcFare = ({ baseFare }) => {
  const base = Number(baseFare || 0);
  const total = Math.max(0, base);

  return {
    baseFare: base,
    includedPersons: 0,
    extraPersonCharge: 0,
    persons: 0,
    extraPersons: 0,
    extraAmount: 0,
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

// Public: calculate fare for a route/vehicle. Cab fares are whole-vehicle base fares.
router.get('/calculate', async (req, res) => {
  try {
    const pickup = normalizeLocationKey(req.query?.pickupLocation);
    const drop = normalizeLocationKey(req.query?.dropLocation);
    const cabType = normalize(req.query?.cabType);

    if (!pickup || !drop || !cabType) {
      return res.status(400).json({ success: false, message: 'pickupLocation, dropLocation and cabType are required' });
    }

    let rule = await CabFare.findOne({
      pickupLocation: pickup,
      dropLocation: drop,
      cabType,
      status: 'active',
    }).lean();

    if (!rule) {
      const pickupKey = comparableKey(pickup);
      const dropKey = comparableKey(drop);
      const cabKey = vehicleKey(cabType);
      const fares = await CabFare.find({ status: 'active' }).lean();
      rule = fares.find((fare) => {
        const fareCabKey = vehicleKey(fare.cabType);
        return comparableKey(fare.pickupLocation) === pickupKey &&
          comparableKey(fare.dropLocation) === dropKey &&
          (fareCabKey === cabKey || fareCabKey.includes(cabKey) || cabKey.includes(fareCabKey));
      });
    }

    if (!rule) return res.status(404).json({ success: false, message: 'Fare not set for this route/cab type' });

    const breakdown = calcFare(rule);
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
    const includedPersons = 0;
    const extraPersonCharge = 0;
    const status = normalize(req.body?.status) === 'inactive' ? 'inactive' : 'active';

    if (!pickupLocation || !dropLocation || !cabType) {
      return res.status(400).json({ success: false, message: 'pickupLocation, dropLocation and cabType are required' });
    }
    if (!Number.isFinite(baseFare) || baseFare < 0) return res.status(400).json({ success: false, message: 'Invalid baseFare' });

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
    update.includedPersons = 0;
    update.extraPersonCharge = 0;
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
