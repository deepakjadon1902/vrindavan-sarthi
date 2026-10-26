const mongoose = require('../backend/node_modules/mongoose');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function checkPartnerAndPayments() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB (Read-Only).');

  // 1. Hotel ANUKAMPA DHAM
  const hotel = await mongoose.connection.collection('hotels').findOne({ _id: new mongoose.Types.ObjectId('6a93f456114b753bb641effe') });
  console.log('Hotel ANUKAMPA DHAM:');
  if (hotel) {
    console.log({
      _id: hotel._id.toString(),
      name: hotel.name,
      propertyType: hotel.propertyType,
      vendorId: hotel.vendorId?.toString(),
      partnerId: hotel.partnerId?.toString(),
      userId: hotel.userId?.toString(),
      createdBy: hotel.createdBy?.toString(),
    });

    const partnerUserId = hotel.vendorId || hotel.partnerId || hotel.userId || hotel.createdBy;
    if (partnerUserId) {
      const partnerUser = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(partnerUserId) });
      console.log('Partner User:', {
        name: partnerUser?.name,
        email: partnerUser?.email ? partnerUser.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'N/A',
        role: partnerUser?.role,
      });
    }
  } else {
    console.log('Hotel not found by that ID');
  }

  // 2. Check how the Admin Payments API constructs the payments table!
  // Let's inspect the Payments route in backend/routes/payment.routes.js or adminOperations.routes.js
  
  await mongoose.disconnect();
}

checkPartnerAndPayments().catch(console.error);
