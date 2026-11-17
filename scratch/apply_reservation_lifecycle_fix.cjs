const fs = require('fs');
const path = 'backend/utils/reservationLifecycle.js';
let content = fs.readFileSync(path, 'utf8');

const target = `  booking.paidAt = booking.paidAt || new Date();`;

const replacement = `  booking.paidAt = booking.paidAt || new Date();
  if (!booking.additionalInfo || String(booking.additionalInfo).toLowerCase().includes('initiated')) {
    const verifiedId = meta.paymentId || booking.razorpayPaymentId;
    booking.additionalInfo = verifiedId
      ? \`Payment verified via Razorpay (\${verifiedId}).\`
      : 'Payment verified online.';
  }`;

const normalize = (s) => s.replace(/\r\n/g, '\n');
const nContent = normalize(content);
const nTarget = normalize(target);
const nReplacement = normalize(replacement);

if (!nContent.includes(nTarget)) {
  console.error('Target not found in content!');
  process.exit(1);
}

const isCRLF = content.includes('\r\n');
const updatedNorm = nContent.replace(nTarget, nReplacement);
const finalContent = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;

fs.writeFileSync(path, finalContent, 'utf8');
console.log('Successfully updated reservationLifecycle.js');
