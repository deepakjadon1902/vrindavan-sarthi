const crypto = require('crypto');
const Counter = require('../models/Counter');

/**
 * Concurrency-safe atomic numeric ID allocator.
 * Atomically increments a sequence document in MongoDB, guaranteeing uniqueness
 * across concurrent processes, offset bases, and zero padding.
 */
async function getNextNumericId(sequenceName, padDigits = 4, baseOffset = 0, maxVal = null) {
  const doc = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const currentVal = baseOffset + doc.seq;
  if (maxVal !== null && currentVal > maxVal) {
    throw new RangeError(`Numeric ID range exhausted for sequence ${sequenceName} (max: ${maxVal})`);
  }
  return String(currentVal).padStart(padDigits, '0');
}

/**
 * Allocate a globally unique 6-digit Property ID (e.g. '100001', '100002').
 */
async function getNextPropertyId() {
  return getNextNumericId('property_id_v2', 6, 100000, 999999);
}

/**
 * Allocate a 4-digit Category ID unique within Room Category entity type (e.g. '2001', '2002').
 */
async function getNextCategoryId(hotelId) {
  return getNextNumericId('category_id_v2', 4, 2000, 9999);
}

/**
 * Allocate or resolve a 4-digit Room ID (e.g. '1001', '1002').
 * If physical room number is already a 4-digit numeric string, preserves that identifier;
 * otherwise allocates from global 4-digit room sequence.
 */
async function getNextRoomId(hotelId, physicalRoomNumber = '') {
  const cleanNumber = String(physicalRoomNumber || '').trim();
  if (/^\d{4}$/.test(cleanNumber)) {
    return cleanNumber;
  }
  return getNextNumericId('room_id_v2', 4, 1000, 9999);
}

/**
 * Allocate a globally unique 8-digit Booking ID (e.g. '10000001', '10000002').
 */
async function getNextBookingId() {
  return getNextNumericId('booking_id_v2', 8, 10000000, 99999999);
}

/**
 * Deterministic fallback generator for historical records that do not yet have
 * stored numeric IDs in the database. Generates a consistent, repeatable numeric string
 * based on the entity's ObjectId so that IDs never fluctuate across receipt renders.
 */
function deriveStableNumericId(objectId, padDigits = 6, baseOffset = 0) {
  if (!objectId) return String(baseOffset + 1).padStart(padDigits, '0');
  const str = String(objectId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const maxVal = Math.pow(10, padDigits) - 1;
  const range = maxVal - baseOffset;
  const num = (hash % range) + baseOffset + 1;
  return String(num).padStart(padDigits, '0');
}

/**
 * Resolves authoritative and backward-compatible receipt identifiers for
 * Property, Category, Physical Room, and Booking.
 */
function resolveReceiptIdentifiers(booking = {}, hotel = null, roomType = null, roomUnit = null) {
  const isPureNumeric = (val) => /^\d+$/.test(String(val || '').trim());

  // 1. Booking ID resolution (exactly 8 digits for display, preserving canonical VVS-... reference)
  const canonicalBookingId = String(booking.bookingId || booking._id || '10000001');
  let displayBookingId = booking.displayBookingId || null;
  if (!displayBookingId) {
    if (isPureNumeric(booking.bookingId) && String(booking.bookingId).length >= 6) {
      displayBookingId = String(booking.bookingId).padStart(8, '0');
    } else {
      displayBookingId = deriveStableNumericId(booking._id || booking.bookingId, 8, 10000000);
    }
  }

  // 2. Property ID resolution (authoritative saved hotel.propertyId takes precedence)
  let propertyId = hotel?.propertyId || booking.propertyId || null;
  if (!propertyId) {
    const propKey = booking.hotelId || hotel?._id;
    propertyId = propKey ? deriveStableNumericId(propKey, 6, 100000) : '100001';
  }

  // 3. Category ID resolution: DO NOT invent or fake Category ID.
  // Display only when genuinely available; if null/empty/not applicable, omit cleanly.
  let categoryId = null;
  const rawCatId = roomType?.categoryId || booking.categoryId || null;
  if (rawCatId && String(rawCatId).trim()) {
    categoryId = String(rawCatId).trim();
  }

  // 4. Physical Room & Room ID resolution (clean separation)
  const rawRoomNumber = booking.roomNumber || (Array.isArray(booking.roomNumbers) && booking.roomNumbers[0]) || roomUnit?.number || null;
  let roomNumber = null;
  let roomId = booking.roomId || roomUnit?.roomId || null;

  if (rawRoomNumber && String(rawRoomNumber).trim()) {
    roomNumber = String(rawRoomNumber).trim();
    if (!roomId && isPureNumeric(roomNumber) && roomNumber.length === 4) {
      roomId = roomNumber;
    }
  }

  // Complete property location and contact details
  const propertyName = booking.propertyName || hotel?.name || (String(booking.itemName || '').includes(' - ') ? String(booking.itemName).split(' - ')[0] : 'Property Reception');
  const isDhr = booking.service_billing_model === 'dharamshala_booking' || booking.bookingType === 'dharamshala' || String(booking.propertyType || '').toLowerCase() === 'dharamshala';
  const propertyType = booking.propertyType || hotel?.propertyType || (isDhr ? 'dharamshala' : 'hotel');
  const fullAddress = hotel?.fullAddress || booking.propertyAddress || hotel?.address || '';
  const location = hotel?.location || booking.propertyLocation || '';
  const nearestTemple = booking.nearestTemple || hotel?.nearestTemple || '';
  const googleMapLink = booking.googleMapLink || hotel?.googleMapLink || '';
  const partnerPhone = booking.partnerPhone || hotel?.contactPhone || hotel?.partnerPhone || hotel?.contactWhatsapp || '8679820256';

  // Room Category Name
  let roomTypeName = roomType?.name || '';
  if (!roomTypeName) {
    if (String(booking.itemName || '').includes(' - ')) {
      roomTypeName = String(booking.itemName).split(' - ')[1].trim();
    } else {
      roomTypeName = String(booking.itemName || 'Standard Room').trim();
    }
  }

  return {
    canonicalBookingId,
    displayBookingId,
    propertyId,
    propertyName,
    propertyType,
    fullAddress,
    location,
    nearestTemple,
    googleMapLink,
    partnerPhone,
    roomTypeName,
    categoryId,
    roomNumber,
    roomId,
  };
}

module.exports = {
  getNextNumericId,
  getNextPropertyId,
  getNextCategoryId,
  getNextRoomId,
  getNextBookingId,
  deriveStableNumericId,
  resolveReceiptIdentifiers,
};
