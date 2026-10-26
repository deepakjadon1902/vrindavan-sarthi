const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const Booking = require('../backend/models/Booking');
const NotificationDelivery = require('../backend/models/NotificationDelivery');

async function clean() {
  await mongoose.connect(process.env.MONGO_URI);
  const deleteResult = await Booking.deleteMany({
    customerEmail: { $regex: /@mocktest\.local$/ }
  });
  console.log('Cleaned test bookings with @mocktest.local:', deleteResult.deletedCount);

  const delNotifications = await NotificationDelivery.deleteMany({
    recipient: { $regex: /@mocktest\.local$/ }
  });
  console.log('Cleaned test notifications with @mocktest.local:', delNotifications.deletedCount);

  await mongoose.disconnect();
}
clean();
