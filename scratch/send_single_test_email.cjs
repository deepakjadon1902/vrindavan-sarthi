const path = require('path');
const https = require('https');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const { sendBookingInvoice } = require('../backend/utils/customerMessages');

function getResendEmailDetails(emailId) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return reject(new Error('Missing RESEND_API_KEY'));

    const req = https.request({
      hostname: 'api.resend.com',
      path: `/emails/${encodeURIComponent(emailId)}`,
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSingleTestEmail() {
  console.log('=== SINGLE CONTROLLED TEST EMAIL DISPATCH ===');
  const recipient = 'vrindavansarthi108@gmail.com';
  console.log(`Approved Test Recipient: ${recipient}`);

  // Construct non-persistent in-memory test booking fixture
  const testBooking = {
    bookingId: 'TEST-VVS-20261026',
    displayBookingId: '80009999',
    bookingType: 'room_type',
    service_billing_model: 'hotel_marketplace',
    itemName: '[TEST - NOT A REAL BOOKING] Hotel Govind Dham - Deluxe AC Room',
    customerFullName: 'Vrindavan Sarthi Diagnostic Test',
    customerEmail: recipient,
    customerMobile: '9999999999',
    checkIn: new Date('2026-11-10'),
    checkOut: new Date('2026-11-12'),
    roomQuantity: 1,
    totalAmount: 1,
    amountPaidOnline: 1,
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    paymentMode: 'full_online',
    additionalInfo: '*** THIS IS A CONTROLLED TEST EMAIL — NOT A REAL BOOKING ***\nNo actual room reservation, inventory block, or monetary transaction occurred.',
    invoiceSentAt: null,
  };

  console.log('Dispatching exactly 1 test confirmation email via sendBookingInvoice...');
  const sendResult = await sendBookingInvoice(testBooking);

  console.log('Submission result:');
  console.log({
    provider: sendResult?.provider,
    providerMessageId: sendResult?.providerMessageId,
  });

  if (!sendResult?.providerMessageId) {
    console.error('Failed to obtain providerMessageId from submission result');
    process.exit(1);
  }

  const emailId = sendResult.providerMessageId;
  console.log(`\nCaptured Resend Email ID: ${emailId}`);

  // Poll Resend delivery status progression: 3 checks with delays
  console.log('Polling Resend delivery lifecycle events...');
  const checkDelays = [2000, 5000, 10000];
  let finalStatus = null;

  for (let i = 0; i < checkDelays.length; i++) {
    await sleep(checkDelays[i]);
    console.log(`\nCheck ${i + 1} (${checkDelays[i] / 1000}s elapsed):`);
    try {
      const checkRes = await getResendEmailDetails(emailId);
      if (checkRes.status === 200 && checkRes.body) {
        finalStatus = checkRes.body;
        console.log({
          id: checkRes.body.id,
          from: checkRes.body.from,
          to: checkRes.body.to,
          subject: checkRes.body.subject,
          created_at: checkRes.body.created_at,
          last_event: checkRes.body.last_event,
        });

        if (checkRes.body.last_event === 'delivered') {
          console.log('Confirmed terminal delivery event: "delivered"');
          break;
        } else if (checkRes.body.last_event === 'bounced') {
          console.log('Delivery event bounced');
          break;
        }
      } else {
        console.log(`Resend query returned status ${checkRes.status}:`, checkRes.body);
      }
    } catch (err) {
      console.warn(`Query attempt ${i + 1} failed:`, err.message);
    }
  }

  console.log('\n=== FINAL SUMMARY ===');
  console.log('Submitted successfully: true');
  console.log(`Resend Email ID: ${emailId}`);
  console.log(`Latest Provider Event: ${finalStatus?.last_event || 'sent / pending delivery'}`);
  console.log(`Created At: ${finalStatus?.created_at}`);
}

runSingleTestEmail().catch(err => {
  console.error('Error during test email execution:', err);
  process.exit(1);
});
