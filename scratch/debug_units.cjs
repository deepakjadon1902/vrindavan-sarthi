const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });
const Hotel = require('./backend/models/Hotel');
const RoomType = require('./backend/models/RoomType');
const RoomUnit = require('./backend/models/RoomUnit');
const RoomUnitBookingDay = require('./backend/models/RoomUnitBookingDay');
const { tryReserveRoomUnitsForBooking } = require('./backend/utils/reservationLifecycle');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const hotel = await Hotel.findById('6a93f456114b753bb641effe').lean();
  const roomType = await RoomType.findById('6a93f61a114b753bb641f0a5').lean();
  const units = await RoomUnit.find({ roomTypeId: roomType._id }).lean();
  console.log('Units found:', units.map(u => ({ id: u._id, hotelId: u.hotelId, roomTypeId: u.roomTypeId, status: u.status })));
  const days = [new Date('2028-06-01'), new Date('2028-06-02')];
  const selected = await tryReserveRoomUnitsForBooking({
    booking: { _id: new mongoose.Types.ObjectId() },
    hotel,
    roomType,
    units,
    daysToReserve: days,
    blockedSet: new Set(),
    roomQuantity: 1,
  });
  console.log('Selected units count:', selected.length);
  await mongoose.disconnect();
}
test().catch(console.error);
