const https = require('https');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.log('No RESEND_API_KEY');
  process.exit(1);
}

const req = https.request(
  {
    hostname: 'api.resend.com',
    port: 443,
    path: '/domains',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'VrindavanSarthi-Diagnostics',
    },
    timeout: 10000,
  },
  (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Resend /domains HTTP status:', res.statusCode);
      try {
        const parsed = JSON.parse(data);
        // Print domain info safely without exposing IDs or tokens
        if (parsed.data) {
          console.log('Domains found:', parsed.data.map(d => ({
            name: d.name,
            status: d.status,
            region: d.region,
            created_at: d.created_at,
          })));
        } else {
          console.log('Response body:', parsed);
        }
      } catch {
        console.log('Raw response:', data);
      }
    });
  }
);
req.on('error', err => console.error('Request error:', err.message));
req.end();
