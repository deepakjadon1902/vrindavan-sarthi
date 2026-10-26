const mongoose = require('../backend/node_modules/mongoose');
require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });

async function testCustomerBookingPayload() {
  await mongoose.connect(process.env.MONGO_URI);
  const booking = await mongoose.connection.collection('bookings').findOne({ bookingId: 'VVS-DR-20261023-191395' });
  
  // Look at fields on booking
  console.log('--- Fields on booking document ---');
  console.log('hotelId:', booking.hotelId);
  console.log('itemName:', booking.itemName);
  console.log('partnerName:', booking.partnerName);
  console.log('partnerPhone:', booking.partnerPhone);
  console.log('address:', booking.address);
  console.log('fullAddress:', booking.fullAddress);
  console.log('location:', booking.location);
  console.log('googleMapLink:', booking.googleMapLink);
  console.log('nearestTemple:', booking.nearestTemple);

  await mongoose.disconnect();
}
testCustomerBookingPayload().catch(console.error);
