const mongoose = require('../backend/node_modules/mongoose');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function runReadOnlyAudit() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB (Read-Only Mode).');

  // 1. Check all bookings in database
  const bookings = await mongoose.connection.collection('bookings').find({}).sort({ createdAt: -1 }).toArray();
  console.log('Total bookings in DB:', bookings.length);

  // 2. Check future bookings
  const futureBookings = bookings.filter(b => b.checkIn && new Date(b.checkIn) >= new Date('2027-01-01'));
  console.log('Bookings with checkIn >= 2027-01-01:', futureBookings.length);
  if (futureBookings.length > 0) {
    console.log('Future bookings:', futureBookings.map(b => ({
      id: b.bookingId,
      checkIn: b.checkIn,
      email: b.customerEmail ? b.customerEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'N/A',
      amount: b.totalAmount
    })));
  }

  // 3. Check RoomUnitBookingDay records
  const rubd = await mongoose.connection.collection('roomunitbookingdays').find({}).toArray();
  console.log('Total RoomUnitBookingDay records:', rubd.length);
  const rubdDates = rubd.map(r => r.date).filter(Boolean);
  if (rubdDates.length > 0) {
    rubdDates.sort((a, b) => new Date(a) - new Date(b));
    console.log('RUBD earliest date:', rubdDates[0]);
    console.log('RUBD latest date:', rubdDates[rubdDates.length - 1]);
  }

  // 4. Inspect all existing bookings details
  console.log('\n--- ALL CURRENT BOOKINGS (Masked PII) ---');
  bookings.forEach(b => {
    const maskedEmail = b.customerEmail ? b.customerEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'N/A';
    const maskedName = b.customerFullName ? b.customerFullName[0] + '***' : 'N/A';
    console.log({
      _id: b._id.toString(),
      bookingId: b.bookingId,
      displayBookingId: b.displayBookingId,
      type: b.bookingType,
      itemName: b.itemName,
      hotelId: b.hotelId?.toString(),
      totalAmount: b.totalAmount,
      amountPaidOnline: b.amountPaidOnline,
      paymentStatus: b.paymentStatus,
      bookingStatus: b.bookingStatus,
      paymentMode: b.paymentMode,
      razorpayOrderId: b.razorpayOrderId,
      razorpayPaymentId: b.razorpayPaymentId,
      createdAt: b.createdAt,
      checkIn: b.checkIn,
      customer: maskedName + ' (' + maskedEmail + ')'
    });
  });

  await mongoose.disconnect();
}

runReadOnlyAudit().catch(err => {
  console.error('Error during read-only audit:', err);
  process.exit(1);
});
