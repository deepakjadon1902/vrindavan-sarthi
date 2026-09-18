const mongoose = require('mongoose');

const LODGING_BOOKING_TYPES = new Set(['hotel', 'room', 'room_type']);
const LEGACY_GENERIC_BOOKING_TYPES = new Set(['tour']);

const normalizeString = (value) => String(value || '').trim();
const normalizeBookingType = (value) => normalizeString(value).toLowerCase();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const isLodgingBookingType = (value) => LODGING_BOOKING_TYPES.has(normalizeBookingType(value));

const assertValidObjectId = (value, label = 'id') => {
  if (isValidObjectId(value)) return '';
  return `Invalid ${label}`;
};

const rejectInvalidObjectId = (res, value, label = 'id') => {
  const message = assertValidObjectId(value, label);
  if (!message) return false;
  res.status(400).json({ success: false, message });
  return true;
};

const pickAllowed = (source, allowedKeys) => {
  const out = {};
  for (const key of allowedKeys) {
    if (typeof source?.[key] !== 'undefined') out[key] = source[key];
  }
  return out;
};

module.exports = {
  LEGACY_GENERIC_BOOKING_TYPES,
  normalizeBookingType,
  isValidObjectId,
  isLodgingBookingType,
  assertValidObjectId,
  rejectInvalidObjectId,
  pickAllowed,
};
