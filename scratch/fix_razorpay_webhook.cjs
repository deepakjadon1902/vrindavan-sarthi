const fs = require('fs');
let content = fs.readFileSync('backend/utils/razorpayWebhook.js', 'utf8');

const target = "if (!booking.invoiceSentAt && !['cab', 'tour'].includes(String(booking.bookingType || '')))";
const rep = "if (!booking.invoiceSentAt && !['cab'].includes(String(booking.bookingType || '')))";

if (!content.includes(target)) {
  console.error('target not found in razorpayWebhook.js');
  process.exit(1);
}
content = content.replace(target, rep);
fs.writeFileSync('backend/utils/razorpayWebhook.js', content, 'utf8');
console.log('Successfully updated razorpayWebhook.js');
