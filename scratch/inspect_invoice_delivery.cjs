const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const mongoose = require('../backend/node_modules/mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const NotificationDelivery = require('../backend/models/NotificationDelivery');
  const invoiceRecords = await NotificationDelivery.find({ template: 'booking_invoice' }).lean();
  console.log('Invoice Notification Delivery Records:', JSON.stringify(invoiceRecords, null, 2));
  await mongoose.disconnect();
})();
