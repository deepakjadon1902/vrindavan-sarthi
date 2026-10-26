const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

(async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    const hotel = await conn.connection.db.collection('hotels').findOne({ _id: new mongoose.Types.ObjectId('6aca71df6ec271838b5d53aa') });
    console.log('Hotel document for Jai Shree Ram Enterprises:');
    console.log(JSON.stringify(hotel, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
})();
