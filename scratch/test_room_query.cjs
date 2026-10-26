const path = require('path');
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

async function testRoomQuery() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const RoomType = require('../backend/models/RoomType');
  const Hotel = require('../backend/models/Hotel');

  const BOOKABLE_ROOM_STATUSES = ['active', 'available'];

  console.log('Testing RoomType aggregate query...');
  const data = await RoomType.aggregate([
    { $match: { status: 'active' } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'hotels',
        let: { hid: '$hotelId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$_id', '$$hid'] },
              status: 'active',
              approvalStatus: 'approved',
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              propertyType: 1,
              location: 1,
              rating: 1,
              image: 1,
              images: { $slice: ['$images', 1] },
              amenities: 1,
              petsAllowed: 1,
              taxEnabled: 1,
              taxPercent: 1,
              showPrices: 1,
              checkInTime: 1,
              checkOutTime: 1,
              partnerId: 1,
              nearestTemple: 1,
              googleMapLink: 1,
            },
          },
        ],
        as: 'hotel',
      },
    },
    { $unwind: { path: '$hotel', preserveNullAndEmptyArrays: false } },
    { $skip: 0 },
    { $limit: 200 },
    {
      $lookup: {
        from: 'roomunits',
        let: { rtId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$roomTypeId', '$$rtId'] }, status: { $in: BOOKABLE_ROOM_STATUSES } } },
          { $group: { _id: null, total: { $sum: 1 } } },
        ],
        as: 'totals',
      },
    },
    {
      $addFields: {
        totalCount: {
          $ifNull: [{ $arrayElemAt: ['$totals.total', 0] }, 0],
        },
      },
    },
    { $project: { totals: 0 } },
  ]);

  console.log('Query returned', data.length, 'room types!');
  if (data.length > 0) {
    console.log('First room type:', {
      _id: String(data[0]._id),
      name: data[0].name,
      hotelName: data[0].hotel?.name,
      hotelPropertyType: data[0].hotel?.propertyType,
      totalCount: data[0].totalCount,
    });
  }

  // Also test Hotel query
  console.log('\nTesting Hotel query...');
  const hotels = await Hotel.find({
    status: 'active',
    approvalStatus: 'approved',
  }).lean();
  console.log('Hotel query returned', hotels.length, 'hotels!');
  if (hotels.length > 0) {
    console.log('First hotel:', {
      _id: String(hotels[0]._id),
      name: hotels[0].name,
      propertyType: hotels[0].propertyType,
      location: hotels[0].location,
    });
  }

  // Also test Cab query
  const Cab = require('../backend/models/Cab');
  console.log('\nTesting Cab query from cab.routes.js...');
  const cabQuery = { status: { $ne: 'deleted' } };
  const cabs = await Cab.find(cabQuery).lean();
  console.log('Cab query returned', cabs.length, 'cabs!');
  if (cabs.length > 0) {
    console.log('First cab:', {
      _id: String(cabs[0]._id),
      vehicleName: cabs[0].vehicleName,
      status: cabs[0].status,
      approvalStatus: cabs[0].approvalStatus,
    });
  }

  // Also test Tour query
  const Tour = require('../backend/models/Tour');
  console.log('\nTesting Tour query from tour.routes.js...');
  const tours = await Tour.find({ status: 'active' }).lean();
  console.log('Tour query returned', tours.length, 'tours!');
  if (tours.length > 0) {
    console.log('First tour:', {
      _id: String(tours[0]._id),
      name: tours[0].name,
      status: tours[0].status,
    });
  }

  await mongoose.disconnect();
}

testRoomQuery();
