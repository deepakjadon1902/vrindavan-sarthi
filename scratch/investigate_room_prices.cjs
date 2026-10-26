const path = require('path');
const mongoose = require(path.resolve(__dirname, '../backend/node_modules/mongoose'));
require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: path.resolve(__dirname, '../backend/.env') });

const RoomType = require('../backend/models/RoomType');
const Hotel = require('../backend/models/Hotel');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
    console.log('Connected to MongoDB');

    const rooms = await RoomType.find({}).populate('hotelId', 'name propertyType status approvalStatus city').lean();
    console.log(`Total RoomTypes in DB: ${rooms.length}`);

    console.log('\n--- SUSPICIOUS / LOW PRICED ROOMS (<= ₹100) ---');
    const lowPriceRooms = [];
    rooms.forEach(r => {
      if (r.basePrice <= 100) {
        lowPriceRooms.push(r);
      }
    });

    lowPriceRooms.forEach(r => {
      console.log(JSON.stringify({
        id: r._id,
        name: r.name,
        basePrice: r.basePrice,
        pricePerNight: r.pricePerNight,
        status: r.status,
        hotelId: r.hotelId?._id,
        hotelName: r.hotelId?.name,
        hotelType: r.hotelId?.propertyType,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }, null, 2));
    });

    console.log('\n--- ALL ROOM TYPES (ID, Name, Hotel, basePrice) ---');
    rooms.forEach(r => {
      console.log(`[${r._id}] "${r.name}" | BasePrice: ₹${r.basePrice} | Hotel: "${r.hotelId?.name}" (${r.hotelId?.propertyType}) | Status: ${r.status}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
})();
