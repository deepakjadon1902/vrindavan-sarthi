const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const RoomUnitBookingDay = require('../backend/models/RoomUnitBookingDay');

async function clean() {
  await mongoose.connect(process.env.MONGO_URI);
  const res = await RoomUnitBookingDay.deleteMany({ date: { $gte: new Date('2027-01-01') } });
  console.log('Cleaned future test days:', res.deletedCount);
  await mongoose.disconnect();
}
clean();
