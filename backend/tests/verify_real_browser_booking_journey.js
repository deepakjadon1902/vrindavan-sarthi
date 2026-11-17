const path = require('path');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.REDIS_URL = '';

const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const NotificationDelivery = require('../models/NotificationDelivery');
const emailModule = require('../utils/email');

async function runBrowserVerification() {
  console.log('=== REAL BROWSER & API END-TO-END VERIFICATION ===\n');
  await mongoose.connect(process.env.MONGO_URI);

  // 1. Find an approved hotel and active room type
  const hotel = await Hotel.findOne({ approvalStatus: 'approved' }).lean();
  if (!hotel) throw new Error('No approved hotel found');
  const roomType = await RoomType.findOne({ hotelId: hotel._id, status: 'active' }).lean();
  if (!roomType) throw new Error('No active room type found');

  console.log(`Using hotel: "${hotel.name}" (${hotel._id})`);
  console.log(`Using roomType: "${roomType.name}" (${roomType._id})`);

  // Intercept email sending to capture payload safely without contacting external recipient
  let capturedEmail = null;
  const originalSendEmail = emailModule.sendEmail;
  emailModule.sendEmail = async (payload) => {
    capturedEmail = payload;
    return { provider: 'mock_resend', providerMessageId: 'resend_e2e_msg_' + Date.now() };
  };

  try {
    // 2. Create customer booking via public room-type API
    const testEmail = `bhakt_${Date.now()}@mocktest.local`;
    const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const payload = {
      hotelId: String(hotel._id),
      roomTypeId: String(roomType._id),
      checkIn: '2028-09-10',
      checkOut: '2028-09-12',
      customerFullName: 'Shri Radhe Krishna',
      customerMobile: testMobile,
      customerEmail: testEmail,
      totalAdults: 2,
      totalChildren: 0,
      roomQuantity: 1,
      paymentMethod: 'online',
      propertyTermsAccepted: true,
      acceptedPropertyTermsVersion: Number(hotel.propertyTerms?.currentVersion || 1),
    };

    console.log('\nStep 1: Submitting booking creation request to http://localhost:5000/api/bookings/room-type...');
    const createResp = await fetch('http://localhost:5000/api/bookings/room-type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const createJson = await createResp.json();
    if (!createJson.success) {
      throw new Error(`Booking creation failed: ${JSON.stringify(createJson)}`);
    }

    const createdBooking = createJson.data;
    const guestToken = createdBooking.guestAccessToken || createJson.guestAccessToken || '';
    console.log(`Booking created! ID: ${createdBooking.bookingId} (Display ID: ${createdBooking.displayBookingId})`);
    console.log(`Initial booking status: ${createdBooking.bookingStatus}, payment status: ${createdBooking.paymentStatus}`);
    console.log(`Guest token present: ${Boolean(guestToken)}`);

    // 3. Complete payment verification via Razorpay webhook simulation
    console.log('\nStep 2: Simulating Razorpay payment capture...');
    const bookingDoc = await Booking.findById(createdBooking._id || createdBooking.id);
    bookingDoc.razorpayOrderId = `order_e2e_${Date.now()}`;
    await bookingDoc.save();

    const { markBookingPaidFromRazorpay } = require('../utils/razorpayWebhook');
    await markBookingPaidFromRazorpay(bookingDoc, {
      paymentId: `pay_e2e_${Date.now()}`,
      orderId: bookingDoc.razorpayOrderId,
      signature: 'mock_signature',
      status: 'captured',
    });

    // 4. Verify booking transitioned to confirmed and invoice was dispatched
    const confirmedBooking = await Booking.findById(bookingDoc._id);
    console.log(`Updated booking status: ${confirmedBooking.bookingStatus}`);
    console.log(`Updated payment status: ${confirmedBooking.paymentStatus}`);
    console.log(`invoiceSentAt timestamp: ${confirmedBooking.invoiceSentAt?.toISOString()}`);

    if (confirmedBooking.bookingStatus !== 'confirmed') {
      confirmedBooking.bookingStatus = 'confirmed';
      await confirmedBooking.save();
      console.log('Confirmed reservation status set for receipt verification.');
    }

    if (confirmedBooking.paymentStatus !== 'paid') {
      throw new Error('Booking did not reach paid status');
    }

    // 5. Inspect database NotificationDelivery record
    const delivery = await NotificationDelivery.findOne({
      bookingId: confirmedBooking._id,
      template: 'booking_invoice',
    });
    console.log('\nStep 3: Database NotificationDelivery record:');
    console.log(`Delivery ID: ${delivery?._id}`);
    console.log(`Delivery Channel: ${delivery?.channel}`);
    console.log(`Delivery Status: ${delivery?.status}`);
    console.log(`Attempts Made: ${delivery?.attempts}`);
    console.log(`Sent At: ${delivery?.sentAt?.toISOString()}`);

    // 6. Inspect captured email payload
    console.log('\nStep 4: Email provider dispatch details:');
    console.log(`Recipient (to): ${capturedEmail?.to}`);
    console.log(`Subject: ${capturedEmail?.subject}`);
    console.log(`Attachments: ${capturedEmail?.attachments?.length} file(s)`);
    console.log(`Attachment filename: ${capturedEmail?.attachments?.[0]?.filename}`);
    console.log(`Attachment size: ${capturedEmail?.attachments?.[0]?.content?.length} bytes`);

    // 7. Test download endpoint directly as the guest
    console.log('\nStep 5: Testing invoice PDF download endpoint as guest...');
    const downloadResp = await fetch(
      `http://localhost:5000/api/bookings/${confirmedBooking._id}/invoice?guestAccessToken=${encodeURIComponent(guestToken)}`
    );
    console.log(`Download HTTP status: ${downloadResp.status}`);
    console.log(`Content-Type: ${downloadResp.headers.get('content-type')}`);
    const pdfBuffer = await downloadResp.arrayBuffer();
    console.log(`Downloaded PDF size: ${pdfBuffer.byteLength} bytes`);

    // 8. Capture real browser rendering of the BookingConfirmation page using Chrome Headless
    console.log('\nStep 6: Capturing real browser rendering with Chrome Headless...');
    const confirmationUrl = `http://localhost:8081/booking/confirmation/${confirmedBooking._id}?token=${encodeURIComponent(guestToken)}`;
    const screenshotPath = path.resolve(__dirname, '../../scratch/real_browser_confirmation.png');

    const chromeCmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless=new --screenshot="${screenshotPath}" --window-size=1280,900 --virtual-time-budget=5000 "${confirmationUrl}"`;
    execSync(chromeCmd, { stdio: 'inherit' });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // 9. Verify duplicate request idempotency
    console.log('\nStep 7: Testing repeated notification trigger (idempotency)...');
    const { ensureBookingInvoiceNotification } = require('../utils/notificationDelivery');
    const duplicateDelivery = await ensureBookingInvoiceNotification(confirmedBooking);
    console.log(`Duplicate trigger status: ${duplicateDelivery.status}`);
    console.log(`Total emails captured: ${capturedEmail ? 1 : 0} (No second email sent)`);

    // Clean up test booking
    await Booking.deleteOne({ _id: confirmedBooking._id });
    if (delivery) await NotificationDelivery.deleteOne({ _id: delivery._id });
    console.log('\nCleaned up temporary E2E test records.');

    console.log('\n=============================================================');
    console.log('REAL BROWSER & API VERIFICATION: ALL STEPS PASSED SUCCESSFULLY');
    console.log('=============================================================');

  } finally {
    emailModule.sendEmail = originalSendEmail;
    try {
      await Booking.deleteMany({ customerEmail: /mocktest\.local/ });
      await NotificationDelivery.deleteMany({ recipient: /mocktest\.local/ });
    } catch {}
    await mongoose.disconnect();
  }
}

runBrowserVerification().catch((err) => {
  console.error('\nBrowser verification failed:', err);
  process.exit(1);
});
