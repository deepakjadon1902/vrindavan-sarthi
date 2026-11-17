const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

(async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    const raw = await conn.connection.db.collection('roomtypes').findOne({ _id: new mongoose.Types.ObjectId('6aca722c6ec271838b5d5416') });
    console.log('Raw RoomType document for Double AC Bed (Jai Shree Ram Enterprises):');
    console.log(JSON.stringify(raw, null, 2));

    const sampleDharamshalaRoom = await conn.connection.db.collection('roomtypes').findOne({ name: /swarnkamal/i });
    console.log('\nRaw RoomType document for Swarnkamal:');
    console.log(JSON.stringify(sampleDharamshalaRoom, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
})();
