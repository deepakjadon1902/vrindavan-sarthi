const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { enumerateDatesUTC, isValidDate } = require('./date');

const tryAssignRoomUnitToBooking = async ({ booking }) => {
  if (!booking) return { assigned: false };
  if (booking.bookingType !== 'room_type') return { assigned: false };
  if (!booking.roomTypeId || !booking.hotelId) return { assigned: false };
  if (!isValidDate(booking.checkIn) || !isValidDate(booking.checkOut) || booking.checkIn >= booking.checkOut) return { assigned: false };

  const hotel = await Hotel.findById(booking.hotelId).lean();
  if (!hotel) return { assigned: false };

  const roomType = await RoomType.findById(booking.roomTypeId).lean();
  if (!roomType || roomType.status !== 'active') return { assigned: false };

  const daysToReserve = enumerateDatesUTC(booking.checkIn, booking.checkOut);
  if (!daysToReserve.length) return { assigned: false };

  const units = await RoomUnit.find({ roomTypeId: roomType._id, status: 'active' }).sort({ number: 1 }).lean();
  if (!units.length) return { assigned: false };

  const blockedByBlocks = await RoomUnitBlock.distinct('roomUnitId', {
    roomTypeId: roomType._id,
    startDate: { $lt: booking.checkOut },
    endDate: { $gt: booking.checkIn },
  });
  const blockedSet = new Set(blockedByBlocks.map(String));

  for (const unit of units) {
    if (blockedSet.has(String(unit._id))) continue;

    const effectivePetsAllowed =
      Boolean(hotel.petsAllowed) &&
      (unit.petsAllowedOverride === null || typeof unit.petsAllowedOverride === 'undefined'
        ? Boolean(roomType.petsAllowed)
        : Boolean(unit.petsAllowedOverride));
    if (booking.hasPet && !effectivePetsAllowed) continue;

    try {
      await RoomUnitBookingDay.insertMany(
        daysToReserve.map((d) => ({
          hotelId: hotel._id,
          roomTypeId: roomType._id,
          roomUnitId: unit._id,
          bookingId: booking._id,
          date: d,
        })),
        { ordered: true }
      );
    } catch (err) {
      if (String(err?.code) === '11000') continue;
      throw err;
    }

    booking.roomUnitId = unit._id;
    booking.roomNumber = String(unit.number);
    booking.isWaitlisted = false;
    booking.waitlistAssignedAt = new Date();
    await booking.save();
    return { assigned: true, booking };
  }

  return { assigned: false };
};

const processRoomTypeWaitlist = async ({ roomTypeId, max = 25 }) => {
  const rtId = String(roomTypeId || '').trim();
  if (!rtId) return { processed: 0, assigned: 0 };

  const waitlisted = await Booking.find({
    bookingType: 'room_type',
    roomTypeId: rtId,
    bookingStatus: { $ne: 'cancelled' },
    isWaitlisted: true,
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(200, Number(max) || 25)));

  let assigned = 0;
  for (const booking of waitlisted) {
    const res = await tryAssignRoomUnitToBooking({ booking });
    if (res.assigned) assigned += 1;
  }

  return { processed: waitlisted.length, assigned };
};

module.exports = {
  processRoomTypeWaitlist,
  tryAssignRoomUnitToBooking,
};

