const fs = require('fs');

// 1. Update customerMessages.js
let cm = fs.readFileSync('backend/utils/customerMessages.js', 'utf8');

// A. Fix broken logoUrl
const oldLogo = `const logoUrl = () => {
  const base = clean(process.env.FRONTEND_BASE_URL || process.env.PUBLIC_SITE_URL);
  if (!base) return '';
  try {
    return new URL('/vrindasarthi%20logo.jpeg', base).toString();
  } catch {
    return '';
  }
};`;

const newLogo = `const logoUrl = () => {
  // Reliable, publicly accessible production asset URL (HTTPS verified)
  return 'https://www.vrindavansarthi.in/vrindavan_sarthi_official_logo.jpg';
};`;

if (cm.includes(oldLogo)) {
  cm = cm.replace(oldLogo, newLogo);
  console.log('Updated logoUrl in customerMessages.js');
} else {
  console.log('oldLogo not found');
}

// B. Improve tableHtml for wrapping and mobile layout
const oldTableHtml = `const tableHtml = (rows) => \`
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:14px">
    \${rows
      .filter(([, value]) => value !== undefined && value !== null && clean(value) !== '')
      .map(([label, value]) => \`
        <tr>
          <td style="padding:10px 12px;border:1px solid #eadfc7;background:#fff8ea;color:#6f4b12;font:600 13px Arial,sans-serif;width:38%">\${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border:1px solid #eadfc7;color:#2b2018;font:13px Arial,sans-serif">\${escapeHtml(value)}</td>
        </tr>
      \`)
      .join('')}
  </table>
\`;`;

const newTableHtml = `const tableHtml = (rows) => \`
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:14px;table-layout:fixed">
    \${rows
      .filter(([, value]) => value !== undefined && value !== null && clean(value) !== '')
      .map(([label, value]) => \`
        <tr>
          <td style="padding:10px 12px;border:1px solid #eadfc7;background:#fff8ea;color:#6f4b12;font:600 13px Arial,sans-serif;width:36%;vertical-align:top;word-wrap:break-word">\${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border:1px solid #eadfc7;color:#2b2018;font:13px Arial,sans-serif;width:64%;vertical-align:top;word-wrap:break-word;word-break:break-word;overflow-wrap:break-word">\${escapeHtml(value)}</td>
        </tr>
      \`)
      .join('')}
  </table>
\`;`;

if (cm.includes(oldTableHtml)) {
  cm = cm.replace(oldTableHtml, newTableHtml);
  console.log('Updated tableHtml in customerMessages.js');
}

// C. Map internal enums to readable labels in bookingRows
const targetRowsStart = `  let paymentOptionLabel = 'Full payment';`;
const enumHelpers = `  const humanBookingType = () => {
    const t = String(booking?.bookingType || '').toLowerCase();
    if (t === 'room_type' || t === 'room' || t === 'hotel') {
      return isDharamshala ? 'Dharamshala Stay' : 'Hotel Stay';
    }
    if (t === 'cab') return 'Cab / Taxi Transfer';
    if (t === 'tour') return 'Pilgrimage Tour Package';
    if (t === 'product') return 'Store Order';
    return t ? t.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase()) : 'Accommodation';
  };

  const humanBillingModel = () => {
    const m = String(booking?.service_billing_model || '').toLowerCase();
    if (m === 'hotel_marketplace') return 'Direct Hotel Reservation';
    if (m === 'dharamshala_booking') return 'Devotee Dharamshala Facilitation';
    if (m === 'taxi_direct') return 'Direct Cab Booking';
    if (m === 'tour_direct') return 'Pilgrimage Tour Booking';
    if (m === 'ecommerce_direct') return 'Spiritual Store Order';
    return m ? m.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase()) : 'Direct Booking';
  };

  const humanBookingStatus = () => {
    const s = String(booking?.bookingStatus || '').toLowerCase();
    if (s === 'confirmed') return 'Confirmed (Reserved)';
    if (s === 'pending_property_confirmation') return 'Pending Property Confirmation';
    if (s === 'awaiting_customer_payment') return 'Awaiting Customer Payment';
    if (s === 'pending') return 'Pending Confirmation';
    if (s === 'cancelled') return 'Cancelled';
    return s ? s.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase()) : 'Confirmed';
  };

  const humanPaymentStatus = () => {
    const s = String(booking?.paymentStatus || '').toLowerCase();
    if (s === 'paid') return balanceAtProperty > 0 ? 'Partially Paid (Advance Online)' : 'Paid in Full (Online Verified)';
    if (s === 'not_required') return 'Pay at Property (Check-in)';
    if (s === 'pending') return 'Pending Payment';
    if (s === 'failed') return 'Payment Failed';
    return s ? s.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase()) : 'Pending';
  };

  const humanVerificationStage = () => {
    const v = String(booking?.verificationStage || '').toLowerCase();
    if (v === 'verified') return 'Verified';
    if (v === 'pending') return 'Pending Verification';
    return v ? v.replace(/_/g, ' ').replace(/\\b\\w/g, (c) => c.toUpperCase()) : 'Verified';
  };
`;

if (cm.includes(targetRowsStart) && !cm.includes('humanBookingType')) {
  cm = cm.replace(targetRowsStart, enumHelpers + '\n' + targetRowsStart);
  cm = cm.replace(`    ['Service Type', booking.bookingType],`, `    ['Accommodation / Service Type', humanBookingType()],`);
  cm = cm.replace(`    ['Billing Model', booking.service_billing_model],`, `    ['Booking Category', humanBillingModel()],`);
  cm = cm.replace(`    ['Booking Status', booking.bookingStatus],`, `    ['Booking Status', humanBookingStatus()],`);
  cm = cm.replace(`    ['Verification Stage', booking.verificationStage],`, `    ['Verification Stage', humanVerificationStage()],`);
  cm = cm.replace(`    ['Payment Status', booking.paymentStatus],`, `    ['Payment Status', humanPaymentStatus()],`);
  console.log('Updated enum mappings in bookingRows');
}

fs.writeFileSync('backend/utils/customerMessages.js', cm, 'utf8');
console.log('Saved backend/utils/customerMessages.js');
