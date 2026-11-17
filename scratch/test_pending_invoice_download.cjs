const mongoose = require('../backend/node_modules/mongoose');
const jwt = require('../backend/node_modules/jsonwebtoken');
require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const http = require('http');

async function checkPending() {
  await mongoose.connect(process.env.MONGO_URI);
  const pending = await mongoose.connection.collection('bookings').findOne({
    bookingStatus: { $in: ['pending_property_confirmation', 'awaiting_customer_payment', 'pending'] },
    paymentStatus: { $ne: 'paid' }
  });
  if (pending) {
    console.log('Found pending booking:', pending.bookingId, pending._id.toString());
    const token = jwt.sign({ id: '69f30f2c146187f9caafecc2' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings/' + pending._id.toString() + '/invoice',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log('Pending invoice status code:', res.statusCode);
        console.log('Response body:', body);
      });
    });
    req.end();
  } else {
    console.log('No pending booking found in database.');
  }
  await mongoose.disconnect();
}
checkPending().catch(console.error);
