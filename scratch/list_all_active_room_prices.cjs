const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

(async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    const rooms = await conn.connection.db.collection('roomtypes').find({ status: 'active' }).toArray();
    console.log(`Active room types: ${rooms.length}`);
    for (const r of rooms) {
      const hotel = await conn.connection.db.collection('hotels').findOne({ _id: r.hotelId });
      console.log(`- Room: "${r.name}" | Price: ₹${r.pricePerNight} | Hotel: "${hotel?.name}" (${hotel?.propertyType}) | Approval: ${hotel?.approvalStatus}`);
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
})();
