const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('../backend/node_modules/mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Booking = require('../backend/models/Booking');
  const { sendBookingInvoice } = require('../backend/utils/customerMessages');

  // Find a confirmed booking
  const booking = await Booking.findOne({ bookingStatus: 'confirmed' }).lean();
  console.log('Testing sendBookingInvoice on confirmed booking:', booking?.bookingId);
  if (!booking) {
    console.log('No confirmed booking found');
    await mongoose.disconnect();
    return;
  }

  // Check email address
  console.log('Customer email:', booking.customerEmail || booking.userEmail);
  console.log('invoiceSentAt:', booking.invoiceSentAt);

  // Check buildBookingReceiptPdf
  const { buildBookingReceiptPdf } = require('../backend/utils/bookingReceiptPdf');
  try {
    const pdfRes = buildBookingReceiptPdf(booking);
    console.log('PDF built successfully, buffer length:', pdfRes?.buffer?.length);
  } catch (err) {
    console.error('buildBookingReceiptPdf threw error:', err);
  }

  await mongoose.disconnect();
})();
