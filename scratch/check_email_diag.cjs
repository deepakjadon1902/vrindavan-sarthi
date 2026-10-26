const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('../backend/node_modules/mongoose');

(async () => {
  console.log('=== ENVIRONMENT SANITY CHECK (SAFE SUMMARY) ===');
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM;
  const smtpFrom = process.env.SMTP_FROM;
  const smtpUser = process.env.SMTP_USER;
  const smtpHost = process.env.SMTP_HOST;
  const redisUrl = process.env.REDIS_URL;

  console.log('RESEND_API_KEY present:', Boolean(resendApiKey));
  console.log('RESEND_API_KEY starts with re_:', String(resendApiKey || '').startsWith('re_'));
  console.log('RESEND_FROM present:', Boolean(resendFrom));
  if (resendFrom) {
    const parts = resendFrom.split('@');
    console.log('RESEND_FROM domain:', parts[1] || 'none');
  }
  console.log('SMTP_FROM present:', Boolean(smtpFrom));
  console.log('SMTP_HOST present:', Boolean(smtpHost));
  console.log('REDIS_URL present:', Boolean(redisUrl));

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('No MONGO_URI in .env');
    return;
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const NotificationDelivery = require('../backend/models/NotificationDelivery');
  const countTotal = await NotificationDelivery.countDocuments();
  console.log('Total NotificationDelivery records:', countTotal);

  const byStatus = await NotificationDelivery.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('NotificationDelivery by status:', JSON.stringify(byStatus, null, 2));

  const byTemplate = await NotificationDelivery.aggregate([
    { $group: { _id: { template: '$template', status: '$status' }, count: { $sum: 1 } } }
  ]);
  console.log('NotificationDelivery by template/status:', JSON.stringify(byTemplate, null, 2));

  // Check recent 10 notification delivery records
  const recent = await NotificationDelivery.find().sort({ createdAt: -1 }).limit(10).lean();
  console.log('Recent 10 NotificationDeliveries:', JSON.stringify(recent.map(r => ({
    id: r._id,
    notificationKey: r.notificationKey,
    eventType: r.eventType,
    channel: r.channel,
    template: r.template,
    status: r.status,
    recipient: r.recipient ? `${r.recipient.slice(0, 3)}***@***` : 'none',
    attempts: r.attempts,
    lastError: r.lastError,
    createdAt: r.createdAt,
    failedAt: r.failedAt,
    sentAt: r.sentAt,
  })), null, 2));

  // Check recent bookings: invoiceSentAt count
  const Booking = require('../backend/models/Booking');
  const bookingCount = await Booking.countDocuments();
  const withInvoiceSentAt = await Booking.countDocuments({ invoiceSentAt: { $exists: true } });
  const withoutInvoiceSentAt = await Booking.countDocuments({ invoiceSentAt: { $exists: false } });
  console.log(`Bookings: total=${bookingCount}, invoiceSentAt=${withInvoiceSentAt}, no invoiceSentAt=${withoutInvoiceSentAt}`);

  const recentBookings = await Booking.find().sort({ createdAt: -1 }).limit(5).select('bookingId bookingStatus paymentStatus paymentMethod customerEmail userEmail invoiceSentAt createdAt').lean();
  console.log('Recent 5 bookings:', JSON.stringify(recentBookings.map(b => ({
    bookingId: b.bookingId,
    bookingStatus: b.bookingStatus,
    paymentStatus: b.paymentStatus,
    paymentMethod: b.paymentMethod,
    hasEmail: Boolean(b.customerEmail || b.userEmail),
    invoiceSentAt: b.invoiceSentAt,
    createdAt: b.createdAt
  })), null, 2));

  await mongoose.disconnect();
})().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
