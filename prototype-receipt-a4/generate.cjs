const fs = require('fs');
const path = require('path');
const QRCode = require('../backend/node_modules/qrcode');
const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');

// Helper to encode local image to base64 data URI
function getAssetDataUri(filePath, mimeType = 'image/png') {
  if (fs.existsSync(filePath)) {
    const b64 = fs.readFileSync(filePath).toString('base64');
    return `data:${mimeType};base64,${b64}`;
  }
  return '';
}

// Format currency
function formatMoney(amount) {
  const num = Number(amount || 0);
  return `INR ${num.toLocaleString('en-IN')}`;
}

// Format IST DateTime
function formatIstDateTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ' (IST)';
  } catch {
    return String(val);
  }
}

function formatIstDateShort(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' (IST)';
  } catch {
    return String(val);
  }
}

function formatIstDateWithDay(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(val);
  }
}

function formatTime12(val, fallback = '12:00 PM') {
  if (!val) return fallback;
  const s = String(val).trim();
  if (/\b(am|pm)\b/i.test(s)) return s.toUpperCase();
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, '0')}:${mins} ${period}`;
  }
  return s;
}

// Generate QR Code as Data URI
async function generateQrDataUrl(text) {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 260,
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
}

// Render HTML template
async function buildReceiptHtml(booking) {
  const assetsDir = path.join(__dirname, 'assets');
  const logoUri = getAssetDataUri(path.join(assetsDir, 'vrindasarthi_logo.jpeg'), 'image/jpeg');
  const skylineUri = getAssetDataUri(path.join(assetsDir, 'skyline.png'), 'image/png');
  const featherTRUri = getAssetDataUri(path.join(assetsDir, 'feather_tr.png'), 'image/png');
  const featherBLUri = getAssetDataUri(path.join(assetsDir, 'feather_bl.png'), 'image/png');
  const featherBRUri = getAssetDataUri(path.join(assetsDir, 'feather_br.png'), 'image/png');

  // Booking classification
  const isDharamshala =
    booking.service_billing_model === 'dharamshala_booking' ||
    String(booking.propertyType || '').toLowerCase() === 'dharamshala' ||
    booking.bookingType === 'dharamshala';
  const isCab = booking.bookingType === 'cab';
  const isTour = booking.bookingType === 'tour';
  const isHotel = !isDharamshala && !isCab && !isTour;

  // Financial calculations
  const totalAmount = Number(booking.totalAmount || 0);
  const paidOnline = Number(booking.amountPaidOnline ?? booking.advanceAmount ?? (booking.paymentStatus === 'paid' && Number(booking.amountPayableAtProperty ?? 0) === 0 ? totalAmount : 0));
  const balanceAmount = Number(booking.amountPayableAtProperty ?? booking.balanceAmount ?? Math.max(0, totalAmount - paidOnline));
  const baseTariff = Number(booking.dharamshalaAmount ?? booking.baseAmount ?? (totalAmount - (booking.vrindavanSarthiServiceFee || 0) - (booking.taxAmount || 0)));
  const serviceFee = Number(booking.vrindavanSarthiServiceFee ?? (isDharamshala ? 99 : 0));
  const taxAmount = Number(booking.taxAmount || 0);

  // Status and labels
  const bookingRef = booking.bookingId || booking.reference || 'VVS-REF-PENDING';
  const bookingDate = formatIstDateShort(booking.createdAt || booking.bookingDate || new Date());
  const generationTimestamp = formatIstDateTime(new Date());
  const verifyUrl = booking.verificationUrl || `https://www.vrindavansarthi.in/verify-booking?ref=${bookingRef}`;
  const qrDataUrl = await generateQrDataUrl(verifyUrl);

  // Payment mode label
  let paymentModeLabel = 'Online (Razorpay)';
  let paymentStatusLabel = 'Full Online Payment';
  let balanceBoxTitle = 'Balance Payable at Property';
  let isFullySettled = balanceAmount <= 0;

  if (isDharamshala) {
    if (balanceAmount > 0) {
      paymentStatusLabel = 'Platform Fee Paid – Property Balance Due';
      paymentModeLabel = 'Online (Razorpay)';
      balanceBoxTitle = 'Balance Payable at Property';
    } else {
      paymentStatusLabel = 'Full Online Payment (Settled)';
      balanceBoxTitle = 'Balance Settled';
    }
  } else if (isCab) {
    balanceBoxTitle = 'Balance Payable to Driver';
    if (balanceAmount > 0) {
      paymentStatusLabel = 'Advance Paid – Balance Due to Driver';
      paymentModeLabel = 'Advance Online (Razorpay)';
    } else {
      paymentStatusLabel = 'Full Online Payment (Settled)';
      balanceBoxTitle = 'Balance Settled';
    }
  } else if (booking.paymentOption === 'advance_30' || (balanceAmount > 0 && !isFullySettled)) {
    paymentStatusLabel = '30% Advance Paid – 70% Balance Due';
    paymentModeLabel = '30% Advance Online (Razorpay)';
    balanceBoxTitle = 'Balance Due at Check-in';
  } else {
    paymentStatusLabel = 'Full Online Payment';
    paymentModeLabel = booking.paymentMethod === 'cash' ? 'Paid in Full (Cash / Direct)' : 'Online (Razorpay)';
    balanceBoxTitle = 'Balance Settled';
  }

  // Google Maps URL
  let mapsUrl = booking.googleMapLink;
  if (!mapsUrl || !/^https?:\/\//i.test(mapsUrl)) {
    const qParts = [
      booking.partnerName || booking.propertyName || (isCab ? booking.pickupAddress : 'Vrindavan'),
      booking.propertyAddress || booking.propertyLocation || '',
      'Vrindavan, Mathura, UP'
    ].filter(Boolean);
    mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(qParts.join(', '))}`;
  }

  // Property ID & Room ID badges
  const propertyId = booking.partnerId || booking.propertyId || 'VVS-P-1023';
  const guestId = booking.guestId || `VVS-G-${bookingRef.split('-').pop() || '191395'}`;
  const roomNumber = booking.roomNumber || booking.roomId || (isCab || isTour ? '' : '203');
  const roomType = booking.roomType || booking.roomTypeName || (booking.itemName ? booking.itemName.replace(/^.*?-\s*/, '') : (isCab ? (booking.vehicleType || 'Dedicated Sedan') : isTour ? (booking.packageName || 'Full Day Darshan Tour') : 'Double Bed Room'));
  const propertyName = booking.partnerName || booking.propertyName || (isCab ? 'Vrindavan Sarthi Cab Service' : isTour ? 'Vrindavan Sarthi Pilgrimage Tours' : 'Shri Giriraj Sewa Sadan');
  const propertyAddress = booking.propertyAddress || booking.propertyLocation || (isCab ? `Pickup: ${booking.pickupAddress || 'IGI Airport, New Delhi'} → Drop: ${booking.dropAddress || 'Prem Mandir, Vrindavan'}` : isTour ? (booking.packageName || 'Mathura, Vrindavan, Govardhan & Barsana Guided Tour') : 'Keshav Dham Road, Opposite Prem Mandir, Vrindavan');
  const nearestTemple = booking.nearestTemple || (isCab ? `Vehicle: ${booking.vehicleType || 'AC 6 Seater'}` : isTour ? `Inclusions: ${booking.inclusions || 'Guide, VIP Passes & Prasad'}` : 'Near Prem Mandir');

  // Stay dates & duration
  const checkInDateStr = formatIstDateWithDay(booking.checkIn || booking.travelDate || booking.tourDate || new Date());
  const checkOutDateStr = formatIstDateWithDay(booking.checkOut || (booking.checkIn ? new Date(new Date(booking.checkIn).getTime() + 86400000) : new Date()));
  const checkInTimeStr = formatTime12(booking.checkInTime, isCab ? (booking.pickupTime || '09:00 AM') : '12:00 PM');
  const checkOutTimeStr = formatTime12(booking.checkOutTime, '11:00 AM');
  const nights = booking.nights || booking.totalNights || 1;
  const guests = booking.guests || booking.totalGuests || (booking.totalAdults ? `${booking.totalAdults} Guest(s)` : (booking.passengers ? `${booking.passengers} Passenger(s)` : '1 Guest(s)'));
  const rooms = booking.rooms || booking.totalRooms || 1;

  // Contact details
  const receptionPhone = booking.partnerPhone || '+91 9927600017';
  const guestName = booking.customerFullName || booking.customerName || booking.guestName || 'Vrindavan Sarthi Devotee';
  const guestPhone = booking.customerMobile || booking.customerPhone || '+91 6396147954';
  const guestEmail = booking.customerEmail || 'vrindavansarthi108@gmail.com';
  const guestCity = booking.customerCity || 'Vrindavan';
  const guestDistrict = booking.customerDistrict || 'Mathura';
  const guestState = booking.customerState || 'Uttar Pradesh';

  // Policy text
  let balancePolicyText = `Outstanding balance of ${formatMoney(balanceAmount)} is payable directly to ${propertyName} reception upon arrival.`;
  if (isFullySettled) {
    balancePolicyText = `Balance Cleared: Total booking tariff was paid online in full. No additional room rent is payable at check-in.`;
  } else if (isCab) {
    balancePolicyText = `Remaining trip balance of ${formatMoney(balanceAmount)} is payable directly to your driver upon arrival at destination.`;
  }

  // Tariff label & subtext
  let tariffLabel = 'Dharamshala Tariff';
  let tariffSubtext = '(Payable directly to property)';
  if (isHotel) {
    tariffLabel = 'Room Tariff';
    tariffSubtext = '(Base accommodation charge)';
  } else if (isCab) {
    tariffLabel = 'Vehicle & Driver Tariff';
    tariffSubtext = '(Point-to-point journey)';
  } else if (isTour) {
    tariffLabel = 'Pilgrimage Tour Tariff';
    tariffSubtext = '(All inclusive darshan package)';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vrindavan Sarthi Receipt - ${bookingRef}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      width: 210mm;
      height: 297mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #525659;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
    }
    .page-container {
      width: 210mm;
      height: 296mm;
      max-height: 296mm;
      background: #fcfbfa;
      padding: 7.5mm 9.5mm 6.5mm 9.5mm;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      margin: 0 auto;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
      break-after: avoid !important;
      break-inside: avoid !important;
    }

    /* Background decorative art */
    .bg-skyline {
      position: absolute;
      top: 0;
      left: 140px;
      right: 140px;
      height: 56px;
      background: url("${skylineUri}") no-repeat center top;
      background-size: cover;
      opacity: 0.85;
      pointer-events: none;
      z-index: 0;
    }
    .bg-feather-tr {
      position: absolute;
      top: 0;
      right: 0;
      width: 135px;
      height: 60px;
      background: url("${featherTRUri}") no-repeat right top;
      background-size: contain;
      pointer-events: none;
      z-index: 0;
    }
    .bg-feather-bl {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 60px;
      height: 130px;
      background: url("${featherBLUri}") no-repeat left bottom;
      background-size: contain;
      pointer-events: none;
      z-index: 0;
    }
    .bg-feather-br {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 60px;
      height: 130px;
      background: url("${featherBRUri}") no-repeat right bottom;
      background-size: contain;
      pointer-events: none;
      z-index: 0;
    }

    .layer-content {
      position: relative;
      z-index: 1;
    }

    /* 1. Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #e2e8f0;
      height: 82px;
      flex-shrink: 0;
    }
    .brand-left {
      display: flex;
      align-items: center;
      gap: 13px;
    }
    .logo-container {
      width: 90px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .logo-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .brand-titles {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .brand-name {
      font-size: 23px;
      font-weight: 800;
      color: #14532d;
      letter-spacing: 0.2px;
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.1;
    }
    .brand-former {
      font-size: 10px;
      font-weight: 600;
      color: #334155;
      margin-top: 2px;
      letter-spacing: 0.2px;
    }
    .brand-flourish {
      display: flex;
      align-items: center;
      gap: 5px;
      margin: 2px 0;
    }
    .brand-flourish svg {
      width: 36px;
      height: 7px;
      fill: #ca941a;
    }
    .brand-tagline {
      font-size: 11.8px;
      font-weight: 600;
      color: #b45309;
      font-style: italic;
      font-family: Georgia, "Times New Roman", serif;
      letter-spacing: 0.2px;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }
    .receipt-title {
      font-size: 14.5px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
    }
    .receipt-gen-time {
      font-size: 8.8px;
      font-weight: 500;
      color: #64748b;
      margin-top: 2.5px;
    }
    .voucher-pill {
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 5px;
      padding: 3.5px 9px;
      margin-top: 4px;
      text-align: center;
    }
    .voucher-pill-title {
      font-size: 10px;
      font-weight: 700;
      color: #92400e;
      line-height: 1.15;
    }
    .voucher-pill-sub {
      font-size: 7.8px;
      color: #78350f;
      line-height: 1.15;
    }

    /* 2. Horizontal Status Bar */
    .status-bar {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      display: grid;
      grid-template-columns: 1.35fr 1.3fr 1.25fr 1.05fr;
      align-items: center;
      padding: 5px 10px;
      height: 68px;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .status-cell {
      padding: 0 9px;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .status-cell:not(:last-child) {
      border-right: 1px solid #e2e8f0;
    }
    .status-confirmed-cell {
      flex-direction: row;
      align-items: center;
      gap: 9px;
    }
    .status-icon-badge {
      width: 27px;
      height: 27px;
      border-radius: 50%;
      background: #16a34a;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .status-icon-badge svg {
      width: 14.5px;
      height: 14.5px;
      stroke: white;
      stroke-width: 3;
      fill: none;
    }
    .status-confirmed-text {
      font-size: 11.2px;
      font-weight: 800;
      color: #15803d;
      line-height: 1.2;
      letter-spacing: 0.2px;
    }
    .status-confirmed-sub {
      font-size: 8.5px;
      color: #16a34a;
      font-weight: 500;
      margin-top: 1px;
    }

    .cell-label {
      font-size: 7.8px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .cell-label svg {
      width: 10px;
      height: 10px;
      stroke: #64748b;
      stroke-width: 2;
      fill: none;
    }
    .cell-val-bold {
      font-size: 11.2px;
      font-weight: 800;
      color: #0f172a;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
      display: flex;
      align-items: center;
      gap: 4.5px;
      word-break: break-all;
    }
    .cell-val-bold svg {
      width: 10.5px;
      height: 10.5px;
      stroke: #94a3b8;
      stroke-width: 1.8;
      fill: none;
      flex-shrink: 0;
    }
    .cell-val-date {
      font-size: 10.2px;
      font-weight: 600;
      color: #1e293b;
    }

    .qr-cell {
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 0 4px;
    }
    .qr-img {
      width: 48px;
      height: 48px;
      image-rendering: pixelated;
      border: 0.5px solid #e2e8f0;
      border-radius: 3px;
      display: block;
      margin: 0 auto;
    }
    .qr-caption {
      font-size: 7.2px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.15;
      margin-top: 1.5px;
    }
    .qr-subcaption {
      font-size: 6.8px;
      color: #64748b;
      line-height: 1.15;
    }

    /* 3. Middle Section: Two Columns */
    .middle-grid {
      display: grid;
      grid-template-columns: 1.14fr 0.96fr;
      gap: 8.5px;
      flex-shrink: 0;
    }

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .card-header-crimson {
      background: #fee2e2;
      border-bottom: 1px solid #fecdd3;
      padding: 3.5px 9px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 25px;
      box-sizing: border-box;
    }
    .card-title-group {
      display: flex;
      align-items: center;
      gap: 5.5px;
    }
    .card-badge-icon-crimson {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      background: #991b1b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-badge-icon-crimson svg {
      width: 10px;
      height: 10px;
      stroke: white;
      stroke-width: 2.2;
      fill: none;
    }
    .card-badge-icon-crimson.fill-icon svg {
      fill: white;
      stroke: none;
    }
    .card-title-crimson {
      font-size: 10.2px;
      font-weight: 800;
      color: #991b1b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-gold {
      background: #fef3c7;
      border: 1px solid #fde68a;
      color: #92400e;
      font-size: 7.8px;
      font-weight: 700;
      padding: 1.5px 5px;
      border-radius: 3.5px;
      white-space: nowrap;
      display: inline-block;
    }

    /* Stay details card body */
    .stay-body {
      padding: 7px 9px;
    }
    .prop-name {
      font-size: 15.5px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      word-break: break-word;
    }
    .prop-id-container {
      margin-top: 2.5px;
      margin-bottom: 4px;
    }
    .room-info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 3.5px;
      font-size: 9.6px;
      color: #334155;
      flex-wrap: wrap;
    }
    .room-info-bold {
      font-weight: 700;
      color: #0f172a;
    }
    .location-row {
      display: flex;
      align-items: flex-start;
      gap: 4.5px;
      font-size: 8.8px;
      color: #475569;
      line-height: 1.3;
      margin-top: 1.5px;
    }
    .location-row svg {
      width: 10.5px;
      height: 10.5px;
      stroke: #dc2626;
      stroke-width: 2;
      fill: #fee2e2;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* 3-cell Stay Summary Box */
    .stay-summary-box {
      background: #fdfbf7;
      border: 1px solid #ebd9c2;
      border-radius: 5px;
      display: grid;
      grid-template-columns: 1fr 1fr 1.05fr;
      padding: 4.5px 7px;
      margin-top: 5px;
      gap: 5px;
    }
    .stay-cell-label {
      font-size: 7.2px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 1.5px;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .stay-cell-label svg {
      width: 8.5px;
      height: 8.5px;
      stroke: #dc2626;
      stroke-width: 2;
      fill: none;
    }
    .stay-cell-date {
      font-size: 9.5px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }
    .stay-cell-time {
      font-size: 8.6px;
      font-weight: 600;
      color: #475569;
    }

    /* Guest Details Card */
    .guest-card {
      margin-top: 6px;
    }
    .guest-body {
      padding: 5.5px 9px;
      display: flex;
      flex-direction: column;
      gap: 2.8px;
      font-size: 9.2px;
      line-height: 1.35;
    }
    .guest-line {
      display: flex;
      align-items: flex-start;
    }
    .guest-label-fixed {
      width: 84px;
      color: #475569;
      font-weight: 500;
      flex-shrink: 0;
    }
    .guest-colon {
      margin-right: 5.5px;
      color: #475569;
      flex-shrink: 0;
    }
    .guest-val-bold {
      font-weight: 700;
      color: #0f172a;
      word-break: break-word;
    }
    .guest-address-row {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-top: 2px;
      padding-top: 2.5px;
      border-top: 1px dashed #e2e8f0;
      font-size: 8.6px;
      flex-wrap: wrap;
    }

    /* Right Column: Payment Breakdown Card */
    .payment-body {
      padding: 7px 9px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .pay-item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.8px 0;
    }
    .pay-item-desc {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .pay-item-name {
      font-size: 9.2px;
      font-weight: 700;
      color: #1e293b;
    }
    .pay-item-sub {
      font-size: 7.5px;
      color: #64748b;
    }
    .pay-item-val {
      font-size: 10.2px;
      font-weight: 800;
      color: #0f172a;
    }

    /* Highlight Containers */
    .box-total {
      background: #fffbeb;
      border: 1.2px solid #fde68a;
      border-radius: 5px;
      padding: 4.5px 8.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 2.5px;
    }
    .box-total-label {
      font-size: 10px;
      font-weight: 800;
      color: #92400e;
      letter-spacing: 0.3px;
    }
    .box-total-val {
      font-size: 13px;
      font-weight: 900;
      color: #991b1b;
    }

    .box-paid {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 5px;
      padding: 4px 8.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .box-paid-left {
      display: flex;
      align-items: center;
      gap: 4.5px;
      font-size: 9.2px;
      font-weight: 700;
      color: #15803d;
    }
    .box-paid-left svg {
      width: 11px;
      height: 11px;
      stroke: #15803d;
      stroke-width: 2.5;
      fill: none;
    }
    .box-paid-val {
      font-size: 11.2px;
      font-weight: 800;
      color: #15803d;
    }

    .box-balance {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 5px;
      padding: 4px 8.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .box-balance.settled {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .box-balance-left {
      display: flex;
      align-items: center;
      gap: 4.5px;
      font-size: 9.2px;
      font-weight: 700;
      color: #991b1b;
    }
    .box-balance.settled .box-balance-left {
      color: #15803d;
    }
    .box-balance-left svg {
      width: 11px;
      height: 11px;
      stroke: #991b1b;
      stroke-width: 2;
      fill: none;
    }
    .box-balance.settled .box-balance-left svg {
      stroke: #15803d;
    }
    .box-balance-val {
      font-size: 11.2px;
      font-weight: 800;
      color: #991b1b;
    }
    .box-balance.settled .box-balance-val {
      color: #15803d;
    }

    /* Payment metadata rows */
    .pay-meta-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 7px;
      row-gap: 2.5px;
      font-size: 8.5px;
      line-height: 1.3;
      margin-top: 3.5px;
      padding-top: 3.5px;
      border-top: 1px dashed #e2e8f0;
    }
    .pay-meta-label {
      color: #64748b;
      font-weight: 600;
    }
    .pay-meta-val {
      color: #0f172a;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
      word-break: break-all;
    }
    .pay-meta-val svg {
      width: 9px;
      height: 9px;
      stroke: #94a3b8;
      stroke-width: 1.8;
      fill: none;
      flex-shrink: 0;
    }

    /* 4. Contacts & Quick Actions Row */
    .contacts-row {
      display: grid;
      grid-template-columns: 1.14fr 0.96fr;
      gap: 8.5px;
      flex-shrink: 0;
    }
    .contacts-body {
      padding: 5.5px 9px;
      display: flex;
      flex-direction: column;
      gap: 3.5px;
      font-size: 8.6px;
      line-height: 1.25;
    }
    .contact-item {
      display: flex;
      flex-direction: column;
    }
    .contact-item-title {
      font-weight: 700;
      color: #0f172a;
    }
    .contact-item-title span {
      color: #991b1b;
      font-weight: 800;
      font-size: 9.5px;
    }
    .contact-item-sub {
      font-size: 7.5px;
      color: #64748b;
      margin-top: 0.5px;
    }

    .card-header-blue {
      background: #eff6ff;
      border-bottom: 1px solid #bfdbfe;
      padding: 3.5px 9px;
      display: flex;
      align-items: center;
      gap: 5.5px;
      height: 25px;
      box-sizing: border-box;
    }
    .card-badge-icon-blue {
      width: 16px;
      height: 16px;
      border-radius: 3px;
      background: #1d4ed8;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-badge-icon-blue svg {
      width: 10px;
      height: 10px;
      stroke: white;
      stroke-width: 2;
      fill: none;
    }
    .card-title-blue {
      font-size: 10.2px;
      font-weight: 800;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .actions-body {
      padding: 5.5px 9px;
      display: flex;
      gap: 7px;
      align-items: center;
      box-sizing: border-box;
    }
    .btn-action {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4.5px 7px;
      border-radius: 5px;
      text-decoration: none;
      color: #0f172a;
    }
    .btn-maps {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }
    .btn-whatsapp {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    .btn-icon-pin svg {
      width: 17px;
      height: 17px;
    }
    .btn-icon-wa svg {
      width: 17px;
      height: 17px;
      fill: #22c55e;
    }
    .btn-text-group {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }
    .btn-title {
      font-size: 8.8px;
      font-weight: 800;
      color: #0f172a;
    }
    .btn-title-wa {
      color: #15803d;
    }
    .btn-sub {
      font-size: 7.2px;
      color: #64748b;
    }

    /* 5. Instructions & Policies Card */
    .card-policies {
      border-color: #fde68a;
      flex-shrink: 0;
    }
    .card-header-amber {
      background: #fef3c7;
      border-bottom: 1px solid #fde68a;
      padding: 3px 9px;
      display: flex;
      align-items: center;
      gap: 5.5px;
      height: 24px;
      box-sizing: border-box;
    }
    .card-badge-icon-amber {
      width: 15px;
      height: 15px;
      border-radius: 3px;
      background: #b45309;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-badge-icon-amber svg {
      width: 9px;
      height: 9px;
      stroke: white;
      stroke-width: 2.2;
      fill: none;
    }
    .card-title-amber {
      font-size: 9.5px;
      font-weight: 800;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .policies-body {
      padding: 5.5px 9px;
      display: flex;
      flex-direction: column;
      gap: 2.8px;
      font-size: 8.5px;
      line-height: 1.35;
      color: #1e293b;
    }
    .policy-item {
      display: flex;
      align-items: flex-start;
      gap: 4.5px;
    }
    .policy-icon {
      width: 9.5px;
      height: 9.5px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .policy-icon svg {
      width: 100%;
      height: 100%;
      stroke: #64748b;
      stroke-width: 2;
      fill: none;
    }
    .policy-strong {
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
    }

    /* 6. Legal & Disclaimer Card */
    .card-disclaimer {
      background: #f8fafc;
      border-color: #cbd5e1;
      flex-shrink: 0;
    }
    .card-header-slate {
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      padding: 2.5px 9px;
      display: flex;
      align-items: center;
      gap: 5.5px;
      height: 23px;
      box-sizing: border-box;
    }
    .card-badge-icon-slate {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .card-badge-icon-slate svg {
      width: 8.5px;
      height: 8.5px;
      stroke: white;
      stroke-width: 2;
      fill: none;
    }
    .card-title-slate {
      font-size: 8.8px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .disclaimer-body {
      padding: 5.5px 9px;
      font-size: 8px;
      line-height: 1.35;
      color: #475569;
    }

    /* 7. Footer */
    .footer {
      border-top: 1.5px solid #e2e8f0;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8px;
      line-height: 1.3;
      height: 36px;
      flex-shrink: 0;
    }
    .footer-left {
      display: flex;
      flex-direction: column;
      z-index: 1;
    }
    .footer-brand {
      font-size: 11px;
      font-weight: 800;
      color: #991b1b;
      font-family: Georgia, serif;
    }
    .footer-former {
      font-size: 7.5px;
      color: #64748b;
    }

    .footer-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      color: #334155;
      z-index: 1;
    }
    .footer-line {
      display: flex;
      align-items: center;
      gap: 3.5px;
    }
    .footer-line svg {
      width: 8.5px;
      height: 8.5px;
      stroke: #dc2626;
      stroke-width: 2;
      fill: none;
    }
    .footer-links a {
      color: #334155;
      text-decoration: none;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }

    .footer-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      z-index: 1;
    }
    .social-row {
      display: flex;
      align-items: center;
      gap: 4.5px;
    }
    .follow-label {
      font-size: 8px;
      font-weight: 700;
      color: #0f172a;
    }
    .social-icon {
      width: 14.5px;
      height: 14.5px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .social-icon svg {
      width: 100%;
      height: 100%;
    }
    .footer-handle {
      font-size: 8px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 1px;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <!-- Decorative background elements -->
    <div class="bg-skyline"></div>
    <div class="bg-feather-tr"></div>
    <div class="bg-feather-bl"></div>
    <div class="bg-feather-br"></div>

    <!-- 1. Header Block -->
    <div class="header layer-content">
      <div class="brand-left">
        <div class="logo-container">
          <img class="logo-img" src="${logoUri}" alt="Vrindavan Sarthi">
        </div>
        <div class="brand-titles">
          <div class="brand-name">Vrindavan Sarthi Enterprises</div>
          <div class="brand-former">Formerly known as Vrindavan Sarthi</div>
          <div class="brand-flourish">
            <svg viewBox="0 0 100 20">
              <path d="M0,10 Q25,0 50,10 Q75,20 100,10 Q75,15 50,10 Q25,5 0,10 Z"></path>
              <circle cx="50" cy="10" r="3"></circle>
            </svg>
          </div>
          <div class="brand-tagline">"Your True Companion On The Journey"</div>
        </div>
      </div>
      <div class="header-right">
        <div class="receipt-title">BOOKING CONFIRMATION &amp;<br>PAYMENT RECEIPT</div>
        <div class="receipt-gen-time">Generated: ${generationTimestamp}</div>
        <div class="voucher-pill">
          <div class="voucher-pill-title">Booking Voucher</div>
          <div class="voucher-pill-sub">Please show this at property reception</div>
        </div>
      </div>
    </div>

    <!-- 2. Status & Verification Bar -->
    <div class="status-bar layer-content">
      <div class="status-cell status-confirmed-cell">
        <div class="status-icon-badge">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div>
          <div class="status-confirmed-text">RESERVATION CONFIRMED</div>
          <div class="status-confirmed-sub">Your booking is confirmed</div>
        </div>
      </div>

      <div class="status-cell">
        <div class="cell-label">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          BOOKING REFERENCE
        </div>
        <div class="cell-val-bold">
          ${bookingRef}
          <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </div>
      </div>

      <div class="status-cell">
        <div class="cell-label">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          BOOKED ON
        </div>
        <div class="cell-val-date">${bookingDate}</div>
      </div>

      <div class="status-cell qr-cell">
        <img class="qr-img" src="${qrDataUrl}" alt="QR">
        <div class="qr-caption">Scan to Verify Booking</div>
        <div class="qr-subcaption">${bookingRef}</div>
      </div>
    </div>

    <!-- 3. Middle Section: Two Columns -->
    <div class="middle-grid layer-content">
      <!-- Left Column: Stay Details & Guest Details -->
      <div style="display: flex; flex-direction: column;">
        <!-- Card 1: Accommodation & Stay Details -->
        <div class="card">
          <div class="card-header-crimson">
            <div class="card-title-group">
              <div class="card-badge-icon-crimson fill-icon">
                <svg viewBox="0 0 24 24"><path d="M2 19h20M4 19v-4a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4M4 12V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v6M13 12V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v6"></path></svg>
              </div>
              <div class="card-title-crimson">${isCab ? 'CAB & JOURNEY DETAILS' : isTour ? 'PILGRIMAGE TOUR DETAILS' : 'ACCOMMODATION & STAY DETAILS'}</div>
            </div>
          </div>
          <div class="stay-body">
            <div class="prop-name">${propertyName}</div>
            <div class="prop-id-container">
              <span class="badge-gold">Property ID: ${propertyId}</span>
            </div>
            <div class="room-info-row">
              <span>${isCab ? 'Vehicle Type:' : isTour ? 'Tour Package:' : 'Room Type:'} <strong class="room-info-bold">${roomType}</strong></span>
              ${roomNumber && !isCab && !isTour ? `<span class="badge-gold">Room ID: ${roomNumber}</span>` : ''}
            </div>
            <div class="location-row">
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>${propertyAddress}</span>
            </div>
            ${nearestTemple ? `
            <div class="location-row">
              <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>${nearestTemple}</span>
            </div>` : ''}

            <!-- 3-cell Stay Summary Box -->
            <div class="stay-summary-box">
              <div>
                <div class="stay-cell-label">
                  <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  ${isCab ? 'TRAVEL DATE' : isTour ? 'TOUR DATE' : 'CHECK-IN'}
                </div>
                <div class="stay-cell-date">${checkInDateStr}</div>
                <div class="stay-cell-time">${checkInTimeStr}</div>
              </div>
              <div>
                <div class="stay-cell-label">
                  <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  ${isCab ? 'PICKUP TIME' : isTour ? 'DURATION' : 'CHECK-OUT'}
                </div>
                <div class="stay-cell-date">${isCab ? checkInTimeStr : isTour ? 'Full Day Darshan' : checkOutDateStr}</div>
                <div class="stay-cell-time">${isCab ? 'Sharp at Pickup' : isTour ? 'Morning to Evening' : checkOutTimeStr}</div>
              </div>
              <div>
                <div class="stay-cell-label">
                  <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  DURATION / GUESTS
                </div>
                <div class="stay-cell-date">${isCab ? `${guests}` : isTour ? `${guests}` : `${nights} Night${nights > 1 ? 's' : ''}`}</div>
                <div class="stay-cell-time">${isCab ? 'Direct Journey' : isTour ? 'Guided Group' : `${guests} (${rooms} Room)`}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Primary Guest Details -->
        <div class="card guest-card">
          <div class="card-header-crimson">
            <div class="card-title-group">
              <div class="card-badge-icon-crimson">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div class="card-title-crimson">PRIMARY GUEST DETAILS</div>
            </div>
            ${guestId ? `<span class="badge-gold">Guest ID: ${guestId}</span>` : ''}
          </div>
          <div class="guest-body">
            <div class="guest-line">
              <span class="guest-label-fixed">Guest Name</span>
              <span class="guest-colon">:</span>
              <span class="guest-val-bold">${guestName}</span>
            </div>

            <div class="guest-line">
              <span class="guest-label-fixed">Mobile Phone</span>
              <span class="guest-colon">:</span>
              <span class="guest-val-bold">${guestPhone}</span>
            </div>

            <div class="guest-line">
              <span class="guest-label-fixed">Email</span>
              <span class="guest-colon">:</span>
              <span class="guest-val-bold">${guestEmail}</span>
            </div>

            <div class="guest-address-row">
              <span>City : <strong style="color: #0f172a;">${guestCity}</strong></span>
              <span style="color: #cbd5e1;">|</span>
              <span>District: <strong style="color: #0f172a;">${guestDistrict}</strong></span>
              <span style="color: #cbd5e1;">|</span>
              <span>State: <strong style="color: #0f172a;">${guestState}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Payment Breakdown Card -->
      <div class="card">
        <div class="card-header-crimson">
          <div class="card-title-group">
            <div class="card-badge-icon-crimson">
              <svg viewBox="0 0 24 24"><line x1="6" y1="4" x2="18" y2="4"></line><line x1="6" y1="9" x2="18" y2="9"></line><path d="M6 14h6a3.5 3.5 0 0 0 0-7H6"></path><path d="M12 14l5 6"></path></svg>
            </div>
            <div class="card-title-crimson">PAYMENT BREAKDOWN</div>
          </div>
        </div>
        <div class="payment-body">
          <div class="pay-item-row">
            <div class="pay-item-desc">
              <div class="pay-item-name">${tariffLabel}</div>
              <div class="pay-item-sub">${tariffSubtext}</div>
            </div>
            <div class="pay-item-val">${formatMoney(baseTariff)}</div>
          </div>

          ${serviceFee > 0 ? `
          <div class="pay-item-row">
            <div class="pay-item-desc">
              <div class="pay-item-name">Platform Facilitation Fee</div>
              <div class="pay-item-sub">(Paid online to Vrindavan Sarthi)</div>
            </div>
            <div class="pay-item-val">${formatMoney(serviceFee)}</div>
          </div>` : ''}

          ${taxAmount > 0 ? `
          <div class="pay-item-row">
            <div class="pay-item-desc">
              <div class="pay-item-name">Hotel GST / Taxes</div>
              <div class="pay-item-sub">(Applicable tax levy)</div>
            </div>
            <div class="pay-item-val">${formatMoney(taxAmount)}</div>
          </div>` : ''}

          <!-- Total Booking Cost Highlight -->
          <div class="box-total">
            <div class="box-total-label">TOTAL BOOKING COST</div>
            <div class="box-total-val">${formatMoney(totalAmount)}</div>
          </div>

          <!-- Paid Online Highlight -->
          <div class="box-paid">
            <div class="box-paid-left">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Amount Paid Online (Verified)</span>
            </div>
            <div class="box-paid-val">${formatMoney(paidOnline)}</div>
          </div>

          <!-- Balance Payable Highlight -->
          <div class="box-balance ${isFullySettled ? 'settled' : ''}">
            <div class="box-balance-left">
              ${isFullySettled ? `
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Balance Settled</span>
              ` : `
                <svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                <span>${balanceBoxTitle}</span>
              `}
            </div>
            <div class="box-balance-val">${formatMoney(balanceAmount)}</div>
          </div>

          <!-- Metadata Rows -->
          <div class="pay-meta-grid">
            <div class="pay-meta-label">Payment Status :</div>
            <div class="pay-meta-val">${paymentStatusLabel}</div>

            <div class="pay-meta-label">Payment Mode :</div>
            <div class="pay-meta-val">${paymentModeLabel}</div>

            ${booking.razorpayPaymentId ? `
            <div class="pay-meta-label">Payment ID :</div>
            <div class="pay-meta-val">
              ${booking.razorpayPaymentId}
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </div>` : ''}

            <div class="pay-meta-label">Paid At :</div>
            <div class="pay-meta-val">${formatIstDateShort(booking.paidAt || booking.createdAt || new Date())}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. Contacts & Quick Actions Row -->
    <div class="contacts-row layer-content">
      <!-- Key Contacts Card -->
      <div class="card">
        <div class="card-header-crimson">
          <div class="card-title-group">
            <div class="card-badge-icon-crimson">
              <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </div>
            <div class="card-title-crimson">KEY CONTACTS &amp; ASSISTANCE</div>
          </div>
        </div>
        <div class="contacts-body">
          <div class="contact-item">
            <div class="contact-item-title">Property Reception : ${propertyName} | <span>${receptionPhone}</span></div>
            <div class="contact-item-sub">Key collection, check-in timing, and satvik meal assistance</div>
          </div>
          <div class="contact-item">
            <div class="contact-item-title">Customer Support : Vrindavan Sarthi | <span>+91 86798 20256</span></div>
            <div class="contact-item-sub">(9:00 AM – 9:00 PM, Every Day)</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions Card -->
      <div class="card">
        <div class="card-header-blue">
          <div class="card-badge-icon-blue">
            <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          </div>
          <div class="card-title-blue">QUICK ACTIONS</div>
        </div>
        <div class="actions-body">
          <a href="${mapsUrl}" target="_blank" class="btn-action btn-maps">
            <div class="btn-icon-pin">
              <!-- Google Maps Pin SVG -->
              <svg viewBox="0 0 24 24"><path fill="#EA4335" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle fill="#fff" cx="12" cy="9" r="2.5"/><circle fill="#4285F4" cx="12" cy="9" r="1.5"/></svg>
            </div>
            <div class="btn-text-group">
              <div class="btn-title">Get Directions</div>
              <div class="btn-sub">( Google Maps )</div>
            </div>
          </a>

          <a href="https://wa.me/918679820256" target="_blank" class="btn-action btn-whatsapp">
            <div class="btn-icon-wa">
              <!-- WhatsApp SVG -->
              <svg viewBox="0 0 24 24"><path d="M20.52 3.48A11.93 11.93 0 0 0 12.04 0C5.43 0 .07 5.36.07 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.19-1.62a11.94 11.94 0 0 0 5.85 1.51h.01c6.6 0 11.97-5.36 11.97-11.97 0-3.2-1.25-6.21-3.5-8.44zM12.05 21.88h-.01a9.9 9.9 0 0 1-5.05-1.39l-.36-.21-3.75.98 1-3.66-.23-.37a9.88 9.88 0 0 1-1.52-5.26c0-5.48 4.46-9.94 9.95-9.94 2.65 0 5.15 1.03 7.02 2.91a9.88 9.88 0 0 1 2.91 7.03c0 5.48-4.46 9.94-9.96 9.94zm5.45-7.44c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.24-.6-.49-.52-.68-.53l-.58-.01c-.2 0-.53.07-.8.38-.28.3-1.07 1.05-1.07 2.56s1.1 2.97 1.25 3.17c.15.2 2.16 3.3 5.23 4.63.73.31 1.3.5 1.74.64.73.23 1.4.2 1.93.12.59-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/></svg>
            </div>
            <div class="btn-text-group">
              <div class="btn-title btn-title-wa">WhatsApp Support</div>
              <div class="btn-sub">+91 86798 20256</div>
            </div>
          </a>
        </div>
      </div>
    </div>

    <!-- 5. Important Guest Instructions Card -->
    <div class="card card-policies layer-content">
      <div class="card-header-amber">
        <div class="card-badge-icon-amber">
          <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="card-title-amber">IMPORTANT GUEST INSTRUCTIONS &amp; PROPERTY POLICIES</div>
      </div>
      <div class="policies-body">
        <div class="policy-item">
          <div class="policy-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
          <div><strong class="policy-strong">Mandatory ID :</strong> Valid government-issued Photo ID (Aadhaar / Passport) is required for every adult guest upon check-in.</div>
        </div>
        <div class="policy-item">
          <div class="policy-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
          <div><strong class="policy-strong">Check-in Timing :</strong> Standard check-in is 12:00 PM; check-out is 11:00 AM. Late check-out is subject to property availability.</div>
        </div>
        <div class="policy-item">
          <div class="policy-icon"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg></div>
          <div><strong class="policy-strong">Balance Collection :</strong> ${balancePolicyText}</div>
        </div>
        <div class="policy-item">
          <div class="policy-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg></div>
          <div><strong class="policy-strong">Spiritual Sanctity :</strong> Unmarried couples are not permitted. Smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited.</div>
        </div>
        <div class="policy-item">
          <div class="policy-icon"><svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg></div>
          <div><strong class="policy-strong">Cancellation :</strong> Cancellations and refunds are governed by the property terms. Platform facilitation fees are non-refundable after confirmation.</div>
        </div>
      </div>
    </div>

    <!-- 6. Legal & Platform Disclaimer -->
    <div class="card card-disclaimer layer-content">
      <div class="card-header-slate">
        <div class="card-badge-icon-slate">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
        <div class="card-title-slate">LEGAL &amp; PLATFORM DISCLAIMER</div>
      </div>
      <div class="disclaimer-body">
        Vrindavan Sarthi acts only as an online booking and payment facilitation platform connecting devotees with independent properties and service providers. Accommodation services are rendered directly by the property partner. The property partner is solely responsible for issuing the official tax invoice for accommodation and for compliance with applicable GST and local regulations. Please present this confirmation receipt at reception.
      </div>
    </div>

    <!-- 7. Decorative Footer -->
    <div class="footer layer-content">
      <div class="footer-left">
        <div class="footer-brand">Vrindavan Sarthi Enterprises</div>
        <div class="footer-former">(Formerly Known as Vrindavan Sarthi)</div>
      </div>

      <div class="footer-center">
        <div class="footer-line">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>Raja Wala Mandir, In front of Giriraj Ji Maharaj, Govardhan, Mathura, UP 281502</span>
        </div>
        <div class="footer-line footer-links" style="margin-top: 2px;">
          <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          <a href="mailto:support@vrindavansarthi.in">support@vrindavansarthi.in</a>
          <span style="color: #cbd5e1; margin: 0 4px;">|</span>
          <a href="https://www.vrindavansarthi.in" target="_blank">www.vrindavansarthi.in</a>
          <span style="color: #cbd5e1; margin: 0 4px;">|</span>
          <a href="https://www.vrindavansarthi.com" target="_blank">www.vrindavansarthi.com</a>
        </div>
      </div>

      <div class="footer-right">
        <div class="social-row">
          <span class="follow-label">Follow Us</span>
          <!-- YouTube -->
          <div class="social-icon">
            <svg viewBox="0 0 24 24"><path fill="#ff0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </div>
          <!-- Instagram -->
          <div class="social-icon">
            <svg viewBox="0 0 24 24"><path fill="#E1306C" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </div>
          <!-- Facebook -->
          <div class="social-icon">
            <svg viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </div>
        </div>
        <div class="footer-handle">@VrindavanSarthi</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Render HTML, PDF and High-res PNG using Playwright
async function renderReceiptToFiles(bookingData, outHtmlPath, outPdfPath, outPngPath) {
  const htmlContent = await buildReceiptHtml(bookingData);
  fs.writeFileSync(outHtmlPath, htmlContent, 'utf8');

  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  
  // Set viewport to exact 2x A4 dimensions (794 x 1123 px at 96 DPI -> 1588 x 2246 px at 2x)
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 2
  });

  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  // Generate A4 PDF with 0 margin
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  fs.writeFileSync(outPdfPath, pdfBuffer);

  // Capture ultra high-resolution screenshot
  const pageElement = await page.$('.page-container');
  if (pageElement) {
    await pageElement.screenshot({ path: outPngPath });
  } else {
    await page.screenshot({ path: outPngPath });
  }

  await browser.close();

  return {
    pdfSize: pdfBuffer.length,
    pngSize: fs.statSync(outPngPath).size
  };
}

module.exports = {
  buildReceiptHtml,
  renderReceiptToFiles
};
