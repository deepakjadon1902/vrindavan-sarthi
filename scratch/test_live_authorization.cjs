const http = require('http');

function get(path, headers = {}) {
  return new Promise((resolve) => {
    http.get({ host: 'localhost', port: 5000, path, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

(async () => {
  console.log('--- TESTING LIVE AUTHORIZATION GUARDS ON PORT 5000 ---');

  // 1. Access non-existent booking without auth
  const res1 = await get('/api/bookings/658b11972de2597e84a011df');
  console.log('1. GET /api/bookings/non-existent without auth:');
  console.log(`   Status: ${res1.status} | Body: ${res1.body}`);

  // 2. Access invoice without auth
  const res2 = await get('/api/bookings/658b11972de2597e84a011df/invoice');
  console.log('2. GET /api/bookings/non-existent/invoice without auth:');
  console.log(`   Status: ${res2.status} | Body: ${res2.body}`);

  // 3. Access invoice with invalid guest token
  const res3 = await get('/api/bookings/658b11972de2597e84a011df/invoice?token=bogus_token_123');
  console.log('3. GET /api/bookings/non-existent/invoice with bogus token:');
  console.log(`   Status: ${res3.status} | Body: ${res3.body}`);

  // 4. Try finding an existing booking from the DB to test unauthorized access
  const mongoose = require('../backend/node_modules/mongoose');
  require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'test' });
  const realBooking = await mongoose.connection.db.collection('bookings').findOne({});
  await mongoose.disconnect();

  if (realBooking) {
    console.log(`\nFound real booking in DB: ID ${realBooking._id}`);
    
    // 5. Try accessing real booking without auth or token
    const resReal = await get(`/api/bookings/${realBooking._id}`);
    console.log('5. GET /api/bookings/:realId without auth:');
    console.log(`   Status: ${resReal.status} | Body: ${resReal.body}`);

    // 6. Try accessing real booking invoice without auth or token
    const resRealInv = await get(`/api/bookings/${realBooking._id}/invoice`);
    console.log('6. GET /api/bookings/:realId/invoice without auth:');
    console.log(`   Status: ${resRealInv.status} | Body: ${resRealInv.body}`);

    // 7. Try accessing real booking invoice with attacker guess token
    const resRealAttacker = await get(`/api/bookings/${realBooking._id}/invoice?token=attacker_token_xyz`);
    console.log('7. GET /api/bookings/:realId/invoice with attacker token:');
    console.log(`   Status: ${resRealAttacker.status} | Body: ${resRealAttacker.body}`);
  }
})();
