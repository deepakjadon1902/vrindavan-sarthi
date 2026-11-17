const mongoose = require('../backend/node_modules/mongoose');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { getRazorpayPayment, getRazorpayOrder } = require('../backend/utils/razorpay');

async function reconcileAllProductionPayments() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB (Read-Only Mode).\n');

  const bookings = await mongoose.connection.collection('bookings').find({}).sort({ createdAt: -1 }).toArray();
  const orders = await mongoose.connection.collection('orders').find({}).sort({ createdAt: -1 }).toArray();

  console.log(`Reconciling ${bookings.length} Bookings...`);
  const bookingRecon = [];

  for (const b of bookings) {
    const item = {
      bookingId: b.bookingId,
      maskedId: b.bookingId ? b.bookingId.replace(/-(.{4})$/, '-***$1') : 'N/A',
      bookingType: b.bookingType,
      propertyType: b.propertyType,
      itemName: b.itemName,
      paymentStatus: b.paymentStatus,
      paymentMode: b.paymentMode,
      totalAmount: b.totalAmount,
      amountPaidOnline: b.amountPaidOnline,
      razorpayPaymentId: b.razorpayPaymentId,
      razorpayOrderId: b.razorpayOrderId,
      upiTransactionId: b.upiTransactionId,
      partnerName: b.partnerName || 'Admin',
      createdAt: b.createdAt,
      providerVerification: 'NOT_APPLICABLE',
      providerStatus: null,
      providerAmountPaise: null,
      providerMethod: null,
      discrepancy: 'NONE',
      severity: 'LOW',
      evidence: '',
    };

    if (b.razorpayPaymentId) {
      try {
        const p = await getRazorpayPayment(b.razorpayPaymentId);
        item.providerVerification = 'VERIFIED_RAZORPAY';
        item.providerStatus = p.status;
        item.providerAmountPaise = p.amount;
        item.providerMethod = p.method;

        const expectedPaise = Math.round((b.amountPaidOnline || b.totalAmount) * 100);
        if (p.amount !== expectedPaise) {
          item.discrepancy = `AMOUNT_MISMATCH: DB expected ₹${expectedPaise / 100}, Razorpay captured ₹${p.amount / 100}`;
          item.severity = 'HIGH';
          item.evidence = `Razorpay payment ${p.id} status=${p.status}, amount=${p.amount} paise`;
        } else if (p.status !== 'captured' && b.paymentStatus === 'paid') {
          item.discrepancy = `STATUS_MISMATCH: DB marked paid, Razorpay status=${p.status}`;
          item.severity = 'HIGH';
          item.evidence = `Razorpay payment ${p.id} captured=${p.captured}`;
        } else {
          item.evidence = `Razorpay payment ${p.id} captured=${p.captured}, amount=₹${p.amount / 100}, method=${p.method}`;
        }
      } catch (err) {
        item.providerVerification = 'UNVERIFIED_PROVIDER_ERROR';
        item.discrepancy = `PROVIDER_FETCH_FAILED: ${err.message}`;
        item.severity = 'MEDIUM';
        item.evidence = `Razorpay API returned HTTP ${err.statusCode || 'ERR'}: ${err.message}`;
      }
    } else if (b.paymentStatus === 'paid') {
      item.providerVerification = 'NO_PROVIDER_REFERENCE';
      item.discrepancy = 'PAID_WITHOUT_PROVIDER_REFERENCE';
      item.severity = b.totalAmount > 0 ? 'HIGH' : 'LOW';
      item.evidence = `Booking marked paid with amount ₹${b.totalAmount} but razorpayPaymentId and upiTransactionId are missing`;
    } else if (b.paymentStatus === 'not_required') {
      item.providerVerification = 'VERIFIED_OFFLINE_PROPERTY';
      item.evidence = `100% pay at property policy. Booking total ₹${b.totalAmount} collected directly at property`;
    } else if (b.paymentStatus === 'pending') {
      item.providerVerification = 'PENDING_NO_CAPTURE';
      item.evidence = `Customer has not yet completed payment; reservation awaiting payment or confirmation`;
    }

    bookingRecon.push(item);
  }

  console.log('\n================ BOOKINGS RECONCILIATION SUMMARY ================');
  bookingRecon.forEach(r => {
    console.log(`[${r.providerVerification}] ${r.maskedId} | DB Amount: ₹${r.totalAmount} (Online: ₹${r.amountPaidOnline}) | Status: ${r.paymentStatus} | Ref: ${r.razorpayPaymentId || '-'} | Discrepancy: ${r.discrepancy} | Evidence: ${r.evidence}`);
  });

  await mongoose.disconnect();
}

reconcileAllProductionPayments().catch(console.error);
