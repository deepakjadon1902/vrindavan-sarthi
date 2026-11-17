const jwt = require('../backend/node_modules/jsonwebtoken');
require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const http = require('http');
const fs = require('fs');
const path = require('path');

async function testLiveInvoiceDownload() {
  const token = jwt.sign(
    { id: '69f30f2c146187f9caafecc2' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('Testing GET /api/bookings/6adb64804d6f6cd4d284f6f3/invoice...');
  
  const req = http.request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/bookings/6adb64804d6f6cd4d284f6f3/invoice',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        console.log('Status code:', res.statusCode);
        console.log('Headers Content-Type:', res.headers['content-type']);
        console.log('Headers Content-Disposition:', res.headers['content-disposition']);
        
        const buffer = Buffer.concat(chunks);
        console.log('Downloaded bytes:', buffer.length);
        
        if (res.statusCode === 200 && buffer.length > 5000) {
          fs.writeFileSync('scratch/live_downloaded_receipt.pdf', buffer);
          console.log('Saved scratch/live_downloaded_receipt.pdf!');
          
          const str = buffer.toString('utf8');
          console.log('Is valid PDF 1.4:', str.startsWith('%PDF-1.4'));
          console.log('Contains /Subtype /Link:', str.includes('/Subtype /Link'));
          console.log('Contains Platform Facilitation Fee:', str.includes('Platform Facilitation Fee'));
          console.log('Contains INR 1,200:', str.includes('INR 1,200'));
          console.log('Contains INR 99:', str.includes('INR 99'));
          console.log('Contains INR 1,299:', str.includes('INR 1,299'));
          console.log('Contains Reception Phone (+91 9927600017):', str.includes('9927600017'));
          console.log('Contains 24/7 Helpline (+91 86798 20256):', str.includes('86798 20256'));
          console.log('Contains Google Maps Link:', str.includes('maps.app.goo.gl'));
        } else {
          console.error('Failed to download invoice:', buffer.toString('utf8'));
        }
      });
    }
  );
  req.on('error', console.error);
  req.end();
}

testLiveInvoiceDownload();
