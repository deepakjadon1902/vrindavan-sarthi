const crypto = require('crypto');
const Counter = require('../models/Counter');

/**
 * Concurrency-safe atomic numeric ID allocator.
 * Atomically increments a sequence document in MongoDB, guaranteeing uniqueness
 * across concurrent processes and preserving leading zeros.
 */
async function getNextNumericId(sequenceName, padDigits = 4) {
  const doc = await Counter.findByIdAndUpdate(
    sequenceName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return String(doc.seq).padStart(padDigits, '0');
}

/**
 * Allocate a globally unique 3-digit Property ID (e.g. '001', '002').
 */
async function getNextPropertyId() {
  return getNextNumericId('property_id', 3);
}

/**
 * Allocate a 2-digit Category ID unique within its parent property (e.g. '01', '02').
 */
async function getNextCategoryId(hotelId) {
  const key = `category_id_${String(hotelId || 'global')}`;
  return getNextNumericId(key, 2);
}

/**
 * Allocate or resolve a short numeric Room ID (e.g. '104').
 * If physical room number is already numeric (e.g. '104'), preserves that identifier;
 * otherwise allocates from property's room sequence.
 */
async function getNextRoomId(hotelId, physicalRoomNumber = '') {
  const cleanNumber = String(physicalRoomNumber || '').trim();
  if (/^\d{1,5}$/.test(cleanNumber)) {
    return cleanNumber;
  }
  const key = `room_id_${String(hotelId || 'global')}`;
  return getNextNumericId(key, 3);
}

/**
 * Allocate a globally unique 4-digit Booking ID (e.g. '0001', '0002').
 */
async function getNextBookingId() {
  return getNextNumericId('booking_id', 4);
}

/**
 * Deterministic fallback generator for historical records that do not yet have
 * stored numeric IDs in the database. Generates a consistent, repeatable numeric string
 * based on the entity's ObjectId so that IDs never fluctuate across receipt renders.
 */
function deriveStableNumericId(objectId, padDigits = 3) {
  if (!objectId) return String(1).padStart(padDigits, '0');
  const str = String(objectId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const maxVal = Math.pow(10, padDigits) - 1;
  const num = (hash % maxVal) + 1;
  return String(num).padStart(padDigits, '0');
}

/**
 * Resolves authoritative and backward-compatible receipt identifiers for
 * Property, Category, Physical Room, and Booking.
 */
function resolveReceiptIdentifiers(booking = {}, hotel = null, roomType = null, roomUnit = null) {
  const isPureNumeric = (val) => /^\d+$/.test(String(val || '').trim());

  // 1. Booking ID resolution
  const canonicalBookingId = String(booking.bookingId || booking._id || '0001');
  let displayBookingId = booking.displayBookingId || null;
  if (!displayBookingId && isPureNumeric(booking.bookingId)) {
    displayBookingId = String(booking.bookingId).padStart(4, '0');
  }

  // 2. Property ID resolution: Authoritative saved hotel.propertyId takes precedence over booking fallback
  let propertyId = hotel?.propertyId || booking.propertyId || null;
  if (!propertyId) {
    const propKey = booking.hotelId || hotel?._id;
    propertyId = propKey ? deriveStableNumericId(propKey, 3) : '001';
  }

  // 3. Category ID resolution: Authoritative saved roomType.categoryId takes precedence over booking fallback
  let categoryId = roomType?.categoryId || booking.categoryId || null;
  if (!categoryId) {
    const catKey = booking.roomTypeId || roomType?._id;
    categoryId = catKey ? deriveStableNumericId(catKey, 2) : '01';
  }

  // 4. Physical Room & Room ID resolution
  const rawRoomNumber = booking.roomNumber || (Array.isArray(booking.roomNumbers) && booking.roomNumbers[0]) || roomUnit?.number || null;
  let roomNumber = null;
  let roomId = null;

  if (rawRoomNumber && String(rawRoomNumber).trim()) {
    roomNumber = String(rawRoomNumber).trim();
    roomId = booking.roomId || roomUnit?.roomId || (isPureNumeric(roomNumber) ? roomNumber : null);
  }

  // Complete property location and contact details
  const propertyName = booking.propertyName || hotel?.name || (String(booking.itemName || '').includes(' - ') ? String(booking.itemName).split(' - ')[0] : 'Property Reception');
  const propertyType = booking.propertyType || hotel?.propertyType || 'hotel';
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
