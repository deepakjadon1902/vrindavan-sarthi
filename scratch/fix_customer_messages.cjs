const fs = require('fs');
let content = fs.readFileSync('backend/utils/customerMessages.js', 'utf8');
const start = content.indexOf('const documentTitle = isCab');
const end = content.indexOf('attachments: [{', start);

const replacement = 
`const documentTitle = isCab
    ? 'CAB BOOKING CONFIRMATION'
    : isTour
    ? 'PILGRIMAGE TOUR CONFIRMATION'
    : hotelBooking
    ? 'BOOKING CONFIRMATION & PAYMENT RECEIPT'
    : 'TAX INVOICE';
  const emailSubject = isCab
    ? \`Vrindavan Sarthi cab booking confirmation \${booking.bookingId}\`
    : isTour
    ? \`Vrindavan Sarthi tour booking confirmation \${booking.bookingId}\`
    : hotelBooking
    ? \`Vrindavan Sarthi booking confirmation \${booking.bookingId}\`
    : \`\${COMPANY_NAME} tax invoice \${booking.bookingId}\`;
  const filenamePrefix = (hotelBooking || isCab || isTour) ? 'booking-receipt' : 'tax-invoice';
  const emailIntro = isCab
    ? 'Your cab booking has been confirmed. Here are the journey, vehicle, and payment details.'
    : isTour
    ? 'Your pilgrimage tour booking has been confirmed. Here are the tour, itinerary, and payment details.'
    : hotelBooking
    ? HOTEL_MARKETPLACE_DISCLAIMER
    : 'Your payment has been verified. Here are the complete booking and payment details.';
  const rows = bookingRows(booking);
  return sendEmail({
    to,
    subject: emailSubject,
    text: [documentTitle, ...(hotelBooking ? [HOTEL_MARKETPLACE_DISCLAIMER] : []), ...rows.map(([k, v]) => \`\${k}: \${v}\`)].join('\\n'),
    html: emailShell({
      title: documentTitle,
      intro: emailIntro,
      rows,
      totalAmount: booking.totalAmount,
    }),
    `;

content = content.slice(0, start) + replacement + content.slice(end);
fs.writeFileSync('backend/utils/customerMessages.js', content, 'utf8');
console.log('Successfully updated customerMessages.js via script');
