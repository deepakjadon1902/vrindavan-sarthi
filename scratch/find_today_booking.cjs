const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

(async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    
    // Look for bookings created today (2026-10-23)
    const bookingsToday = await conn.connection.db.collection('bookings').find({
      $or: [
        { bookingId: /20261023/i },
        { bookingId: /191395/i },
        { createdAt: { $gte: new Date('2026-10-23T00:00:00.000Z') } }
      ]
    }).toArray();

    console.log(`Found ${bookingsToday.length} bookings for 2026-10-23:`);
    for (const b of bookingsToday) {
      console.log(JSON.stringify(b, null, 2));
    }

    if (bookingsToday.length === 0) {
      console.log('No booking found for 2026-10-23. Listing all bookings in collection:');
      const all = await conn.connection.db.collection('bookings').find({}).sort({ createdAt: -1 }).toArray();
      all.forEach(b => console.log(`- ${b.bookingId} | ${b.itemName} | Total: ${b.totalAmount} | Created: ${b.createdAt}`));
    }

    await mongoose.disconnect();
  } catch (e) {
    console.error(e);
  }
})();
