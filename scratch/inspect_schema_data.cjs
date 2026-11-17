const path = require('path');
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

async function inspectCollections() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(uri);

  const RoomType = require('../backend/models/RoomType');
  const Cab = require('../backend/models/Cab');
  const Hotel = require('../backend/models/Hotel');

  console.log('=== Inspecting RoomTypes ===');
  const roomTypes = await RoomType.find({}).limit(5).lean();
  for (const rt of roomTypes) {
    console.log({
      _id: String(rt._id),
      name: rt.name,
      hotelId: String(rt.hotelId),
      status: rt.status,
      approvalStatus: rt.approvalStatus,
      isActive: rt.isActive,
      basePrice: rt.basePrice,
      price: rt.price,
    });
  }

  // Count by status and approvalStatus for RoomTypes
  const rtStatusDist = await RoomType.aggregate([
    { $group: { _id: { status: '$status', approvalStatus: '$approvalStatus', isActive: '$isActive' }, count: { $sum: 1 } } }
  ]);
  console.log('RoomTypes status distribution:', JSON.stringify(rtStatusDist, null, 2));

  console.log('\n=== Inspecting Cabs ===');
  const cabs = await Cab.find({}).limit(5).lean();
  for (const cab of cabs) {
    console.log({
      _id: String(cab._id),
      vehicleName: cab.vehicleName,
      status: cab.status,
      isActive: cab.isActive,
      approvalStatus: cab.approvalStatus,
    });
  }

  const cabStatusDist = await Cab.aggregate([
    { $group: { _id: { status: '$status', approvalStatus: '$approvalStatus', isActive: '$isActive' }, count: { $sum: 1 } } }
  ]);
  console.log('Cabs status distribution:', JSON.stringify(cabStatusDist, null, 2));

  console.log('\n=== Inspecting Hotels ===');
  const hotelStatusDist = await Hotel.aggregate([
    { $group: { _id: { status: '$status', approvalStatus: '$approvalStatus', propertyType: '$propertyType' }, count: { $sum: 1 } } }
  ]);
  console.log('Hotels status distribution:', JSON.stringify(hotelStatusDist, null, 2));

  await mongoose.disconnect();
}

inspectCollections();
