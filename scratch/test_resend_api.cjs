const https = require('https');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

function resendGet(endpoint) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return reject(new Error('RESEND_API_KEY not configured'));
    const req = https.request({
      hostname: 'api.resend.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testResend() {
  console.log('Testing Resend Domains & API Key readiness (Read-Only)...');
  const domains = await resendGet('/domains');
  console.log('Domains status:', domains.status);
  if (domains.body && domains.body.data) {
    console.log('Domains list:', domains.body.data.map(d => ({
      name: d.name,
      status: d.status,
      region: d.region,
      created_at: d.created_at
    })));
  }

  // Check if we can query an email ID
  const testEmailLookup = await resendGet('/emails/01a1741c-0657-71c2-adfa-d956c650232e');
  console.log('Test email lookup status:', testEmailLookup.status);
  if (testEmailLookup.body) {
    console.log('Test email lookup summary:', {
      id: testEmailLookup.body.id,
      from: testEmailLookup.body.from,
      to: testEmailLookup.body.to,
      subject: testEmailLookup.body.subject,
      created_at: testEmailLookup.body.created_at,
      last_event: testEmailLookup.body.last_event,
    });
  }
}

testResend().catch(console.error);
