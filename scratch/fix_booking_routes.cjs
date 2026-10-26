const fs = require('fs');
let content = fs.readFileSync('backend/routes/booking.routes.js', 'utf8');

// 1. In assign-cab
const assignCabTarget = 
`    try {
      await ensureBookingConfirmedAlarmNotifications(booking);
    } catch (notifyErr) {`;

const assignCabReplacement = 
`    try {
      await ensureBookingConfirmedAlarmNotifications(booking);
      await ensureBookingInvoiceNotification(booking);
    } catch (notifyErr) {`;

if (!content.includes(assignCabTarget.replace(/\n/g, '\r\n'))) {
  console.error('assignCabTarget not found');
  process.exit(1);
}
content = content.replace(assignCabTarget.replace(/\n/g, '\r\n'), assignCabReplacement.replace(/\n/g, '\r\n'));

// 2. In verify admin and partner
const inv1 = "invoice: !['cab', 'tour'].includes(String(booking.bookingType || ''))";
const rep1 = "invoice: !['cab'].includes(String(booking.bookingType || ''))";
if (!content.includes(inv1)) {
  console.error('inv1 not found');
  process.exit(1);
}
content = content.replace(inv1, rep1);

const inv2 = "invoice: !['cab', 'tour'].includes(String(updated.bookingType || ''))";
const rep2 = "invoice: !['cab'].includes(String(updated.bookingType || ''))";
if (!content.includes(inv2)) {
  console.error('inv2 not found');
  process.exit(1);
}
content = content.replace(inv2, rep2);

fs.writeFileSync('backend/routes/booking.routes.js', content, 'utf8');
console.log('Successfully updated booking.routes.js');
