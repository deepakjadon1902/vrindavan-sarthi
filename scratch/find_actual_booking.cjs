const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

(async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    console.log('Connected to MongoDB');

    // 1. Look for booking reference VVS-DR-20261023-191395 or similar
    const booking = await conn.connection.db.collection('bookings').findOne({
      $or: [
        { bookingId: 'VVS-DR-20261023-191395' },
        { bookingId: /191395/i },
        { bookingReference: 'VVS-DR-20261023-191395' },
        { bookingReference: /191395/i },
        { itemName: /Giriraj/i }
      ]
    });

    if (booking) {
      console.log('FOUND BOOKING:');
      // Redact sensitive personal data like customer phone / customer email
      const sanitized = { ...booking };
      if (sanitized.customerMobile) sanitized.customerMobile = sanitized.customerMobile.slice(0, 3) + '****' + sanitized.customerMobile.slice(-3);
      if (sanitized.customerEmail) sanitized.customerEmail = sanitized.customerEmail.replace(/^(.{2})(.*)(@.*)$/, '$1***$3');
      if (sanitized.guestAccessTokenHash) sanitized.guestAccessTokenHash = sanitized.guestAccessTokenHash.slice(0, 8) + '...';
      console.log(JSON.stringify(sanitized, null, 2));
    } else {
      console.log('Booking not found by exact ID, listing recent bookings:');
      const recent = await conn.connection.db.collection('bookings').find({}).sort({ createdAt: -1 }).limit(5).toArray();
      recent.forEach(b => {
        console.log(`ID: ${b._id} | bookingId: ${b.bookingId} | item: ${b.itemName} | total: ${b.totalAmount} | paid: ${b.paidAmount} | status: ${b.bookingStatus || b.status} | paymentStatus: ${b.paymentStatus} | created: ${b.createdAt}`);
      });
    }

    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
})();
