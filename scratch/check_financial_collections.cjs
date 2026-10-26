const mongoose = require('../backend/node_modules/mongoose');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

async function checkCollections() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB (Read-Only).');

  const collections = ['bookings', 'orders', 'paymentreconciliations', 'webhookevents', 'refundoperations'];
  for (const col of collections) {
    const count = await mongoose.connection.collection(col).countDocuments({});
    console.log(`Collection ${col}: ${count} records`);
  }

  // Get all orders
  const orders = await mongoose.connection.collection('orders').find({}).toArray();
  console.log('\n--- ORDERS ---');
  orders.forEach(o => {
    console.log({
      orderId: o.orderId,
      totalAmount: o.totalAmount,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      razorpayPaymentId: o.razorpayPaymentId,
      createdAt: o.createdAt,
    });
  });

  // Get payment reconciliations
  const recons = await mongoose.connection.collection('paymentreconciliations').find({}).toArray();
  console.log('\n--- PAYMENT RECONCILIATIONS ---');
  recons.forEach(r => {
    console.log({
      _id: r._id.toString(),
      bookingId: r.bookingId?.toString(),
      status: r.status,
      expectedAmountPaise: r.expectedAmountPaise,
      capturedAmountPaise: r.capturedAmountPaise,
      discrepancyReason: r.discrepancyReason,
      createdAt: r.createdAt,
    });
  });

  // Get webhook events
  const webhooks = await mongoose.connection.collection('webhookevents').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('\n--- RECENT WEBHOOK EVENTS ---');
  webhooks.forEach(w => {
    console.log({
      eventId: w.eventId,
      eventType: w.eventType,
      status: w.status,
      createdAt: w.createdAt,
    });
  });

  await mongoose.disconnect();
}

checkCollections().catch(console.error);
