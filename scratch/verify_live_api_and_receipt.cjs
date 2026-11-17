const jwt = require('../backend/node_modules/jsonwebtoken');
require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const http = require('http');

async function testLiveApi() {
  const token = jwt.sign(
    { id: '69f30f2c146187f9caafecc2' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('Testing GET /api/bookings/6adb64804d6f6cd4d284f6f3...');
  
  const req = http.request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings/6adb64804d6f6cd4d284f6f3',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        console.log('Status code:', res.statusCode);
        try {
          const json = JSON.parse(data);
          const b = json.data;
          console.log('--- RETURNED BOOKING FIELDS ---');
          console.log('bookingId:', b?.bookingId);
          console.log('bookingStatus:', b?.bookingStatus);
          console.log('paymentStatus:', b?.paymentStatus);
          console.log('propertyName:', b?.propertyName);
          console.log('propertyLocation:', b?.propertyLocation);
          console.log('propertyAddress:', b?.propertyAddress);
          console.log('googleMapLink:', b?.googleMapLink);
          console.log('nearestTemple:', b?.nearestTemple);
          console.log('vrindavanSarthiServiceFee:', b?.vrindavanSarthiServiceFee);
          console.log('dharamshalaAmount:', b?.dharamshalaAmount);
          console.log('amountPaidOnline:', b?.amountPaidOnline);
          console.log('amountPayableAtProperty:', b?.amountPayableAtProperty);
          console.log('additionalInfo:', b?.additionalInfo);
        } catch (e) {
          console.log('Raw output:', data);
        }
      });
    }
  );
  req.on('error', console.error);
  req.end();
}

testLiveApi();
