const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

async function run() {
  if (!process.env.MONGO_URI) {
    console.log('No MONGO_URI in backend/.env');
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  
  const counters = await mongoose.connection.collection('counters').find({}).toArray();
  console.log('=== COUNTERS ===');
  console.log(JSON.stringify(counters, null, 2));

  const bookingsWithIds = await mongoose.connection.collection('bookings').find({
    $or: [
      { displayBookingId: { $exists: true } },
      { propertyId: { $exists: true } },
      { categoryId: { $exists: true } },
      { roomId: { $exists: true } }
    ]
  }).project({ bookingId: 1, displayBookingId: 1, propertyId: 1, categoryId: 1, roomId: 1 }).toArray();
  console.log('=== BOOKINGS WITH NUMERIC IDS ===', bookingsWithIds.length);
  console.log(JSON.stringify(bookingsWithIds.slice(0, 10), null, 2));

  const hotelsWithPropId = await mongoose.connection.collection('hotels').find({
    propertyId: { $exists: true }
  }).project({ name: 1, propertyId: 1 }).toArray();
  console.log('=== HOTELS WITH PROPERTY ID ===', hotelsWithPropId.length);
  console.log(JSON.stringify(hotelsWithPropId, null, 2));

  const roomTypesWithCatId = await mongoose.connection.collection('roomtypes').find({
    categoryId: { $exists: true }
  }).project({ name: 1, categoryId: 1, hotel: 1 }).toArray();
  console.log('=== ROOMTYPES WITH CATEGORY ID ===', roomTypesWithCatId.length);
  console.log(JSON.stringify(roomTypesWithCatId, null, 2));

  const roomUnitsWithRoomId = await mongoose.connection.collection('roomunits').find({
    roomId: { $exists: true }
  }).project({ number: 1, roomId: 1, hotelId: 1 }).toArray();
  console.log('=== ROOMUNITS WITH ROOM ID ===', roomUnitsWithRoomId.length);
  console.log(JSON.stringify(roomUnitsWithRoomId.slice(0, 10), null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
