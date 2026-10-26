const mongoose = require('../backend/node_modules/mongoose');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function checkBookingTimestamps() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB (Read-Only).');

  const bookings = await mongoose.connection.collection('bookings').find({}).sort({ updatedAt: -1 }).toArray();
  console.log('\n--- BOOKINGS UPDATED AT AUDIT ---');
  bookings.forEach(b => {
    console.log({
      bookingId: b.bookingId,
      itemName: b.itemName,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      paymentStatus: b.paymentStatus,
      bookingStatus: b.bookingStatus,
      customerEmail: b.customerEmail ? b.customerEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'N/A',
    });
  });

  await mongoose.disconnect();
}

checkBookingTimestamps().catch(console.error);
