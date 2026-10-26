const fs = require('fs');
let c = fs.readFileSync('backend/utils/notificationDelivery.js', 'utf8');

const t = 'await Booking.updateOne({ _id: booking._id, invoiceSentAt: { $exists: false } }, { $set: { invoiceSentAt: new Date() } });';
const r = 'const now = new Date();\n      await Booking.updateOne({ _id: booking._id, $or: [{ invoiceSentAt: { $exists: false } }, { invoiceSentAt: null }] }, { $set: { invoiceSentAt: now } });\n      booking.invoiceSentAt = now;';

if (c.includes(t)) {
  c = c.replace(t, r);
  fs.writeFileSync('backend/utils/notificationDelivery.js', c, 'utf8');
  console.log('Successfully updated Booking.updateOne');
} else {
  console.log('Target not found in file');
}

const tOrder = 'await Order.updateOne({ _id: order._id, invoiceSentAt: { $exists: false } }, { $set: { invoiceSentAt: new Date() } });';
const rOrder = 'const orderNow = new Date();\n      await Order.updateOne({ _id: order._id, $or: [{ invoiceSentAt: { $exists: false } }, { invoiceSentAt: null }] }, { $set: { invoiceSentAt: orderNow } });\n      order.invoiceSentAt = orderNow;';

if (c.includes(tOrder)) {
  c = c.replace(tOrder, rOrder);
  fs.writeFileSync('backend/utils/notificationDelivery.js', c, 'utf8');
  console.log('Successfully updated Order.updateOne');
} else {
  console.log('Order target not found in file');
}
