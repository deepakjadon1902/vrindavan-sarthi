const mongoose = require('../backend/node_modules/mongoose');
require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const { bookingRows } = require('../backend/utils/customerMessages');

async function testPdf() {
  await mongoose.connect(process.env.MONGO_URI);
  const booking = await mongoose.connection.collection('bookings').findOne({ bookingId: 'VVS-DR-20261023-191395' });
  const rows = bookingRows(booking);
  console.log('--- ALL BOOKING ROWS ---');
  rows.forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      console.log(k + ' => ' + v);
    }
  });
  await mongoose.disconnect();
}
testPdf().catch(console.error);
