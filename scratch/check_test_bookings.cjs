const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const Booking = require('../backend/models/Booking');
const NotificationDelivery = require('../backend/models/NotificationDelivery');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const testBookings = await Booking.find({
    $or: [
      { bookingId: { $regex: /T-1792/ } },
      { customerEmail: { $regex: /mocktest\.local/ } },
      { customerEmail: { $regex: /example\.com/ } }
    ]
  }).select('bookingId displayBookingId customerFullName customerEmail paymentStatus bookingStatus createdAt').lean();
  console.log('Test bookings found in MongoDB:', testBookings.length);
  testBookings.forEach(b => console.log(b.bookingId, b.customerFullName, b.paymentStatus, b.bookingStatus));
  await mongoose.disconnect();
}
check();
