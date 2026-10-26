const fs = require('fs');
const path = require('path');

const PAGE = { width: 595.28, height: 841.89, margin: 32 };
const COLORS = {
  navy: [26, 38, 57],          // #1a2639
  navyDark: [15, 23, 42],      // #0f172a
  crimson: [138, 31, 45],      // #8a1f2d
  crimsonDark: [112, 26, 37],
  gold: [202, 148, 26],        // #ca941a
  goldLight: [245, 230, 190],
  cream: [253, 250, 244],      // #fdfaf4
  softBg: [248, 249, 250],     // #f8f9fa
  border: [229, 231, 235],     // #e5e7eb
  borderDark: [209, 213, 219],
  muted: [107, 114, 128],      // #6b7280
  ink: [31, 41, 55],           // #1f2937
  white: [255, 255, 255],
  green: [22, 101, 52],        // #166534
  greenBg: [240, 253, 244],    // #f0fdf4
  greenBorder: [187, 247, 208],
  amber: [146, 64, 14],        // #92400e
  amberBg: [254, 243, 199],    // #fef3c7
  crimsonBg: [255, 241, 242],  // #fff1f2
  crimsonBorder: [254, 205, 211],
  linkBlue: [29, 78, 216],     // #1d4ed8
};

const clean = (val) => String(val || '').replace(/\s+/g, ' ').trim();
const money = (val) => `INR ${Number(val || 0).toLocaleString('en-IN')}`;
const dateText = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(val);
  }
};
const dateTimeText = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(val);
  }
};

const escapePdf = (val) =>
  clean(val)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const textWidth = (text, size = 10) => clean(text).length * size * 0.49;
const rgb = ([r, g, b]) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;

const wrapText = (text, maxWidth, size = 10) => {
  const words = clean(text).split(' ').filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (textWidth(test, size) <= maxWidth || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

class ExecutivePdfBuilder {
  constructor() {
    this.ops = [];
    this.annotations = [];
    this.width = PAGE.width;
    this.height = PAGE.height;
    this.margin = PAGE.margin;
  }

  rect(x, y, w, h, fill = null, stroke = null, lineWidth = 1) {
    if (fill) this.ops.push(`${rgb(fill)} rg`);
    if (stroke) {
      this.ops.push(`${rgb(stroke)} RG`);
      this.ops.push(`${lineWidth} w`);
    }
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
  }

  line(x1, y1, x2, y2, stroke = COLORS.border, width = 1) {
    this.ops.push(`${rgb(stroke)} RG`);
    this.ops.push(`${width} w`);
    this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  text(val, x, y, { size = 10, font = 'F1', color = COLORS.ink } = {}) {
    if (!clean(val)) return;
    this.ops.push(`${rgb(color)} rg`);
    this.ops.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(val)}) Tj ET`);
  }

  link(textVal, url, x, y, { size = 9, font = 'F2', color = COLORS.linkBlue, underline = true } = {}) {
    const str = clean(textVal);
    if (!str) return;
    this.text(str, x, y, { size, font, color });
    const tw = textWidth(str, size);
    if (underline) {
      this.line(x, y - 1.5, x + tw, y - 1.5, color, 0.6);
    }
    if (url && /^https?:\/\//i.test(url)) {
      this.annotations.push({
        x1: x,
        y1: y - 3,
        x2: x + tw,
        y2: y + size + 2,
        url: url.trim(),
      });
    }
  }

  wrapped(val, x, y, maxWidth, { size = 9, font = 'F1', color = COLORS.ink, lineHeight = 12 } = {}) {
    const lines = wrapText(val, maxWidth, size);
    lines.forEach((l, idx) => {
      this.text(l, x, y - idx * lineHeight, { size, font, color });
    });
    return lines.length * lineHeight;
  }

  badge(textVal, x, y, { bg = COLORS.greenBg, border = COLORS.greenBorder, textCol = COLORS.green, size = 8, font = 'F2', padX = 6, padY = 3 } = {}) {
    const str = clean(textVal);
    const tw = textWidth(str, size);
    const bw = tw + padX * 2;
    const bh = size + padY * 2;
    this.rect(x, y - padY, bw, bh, bg, border, 0.7);
    this.text(str, x + padX, y + 1, { size, font, color: textCol });
    return bw;
  }

  render(booking) {
    const logoData = this.loadLogo();
    const isHotel = booking.service_billing_model === 'hotel_marketplace' || ['hotel', 'room', 'room_type'].includes(String(booking.bookingType || ''));
    const isDharamshala = String(booking.service_billing_model || '') === 'dharamshala_booking' || String(booking.propertyType || '').toLowerCase() === 'dharamshala';

    // 1. HEADER (Top: y = 814 down to 746)
    this.rect(0, 752, this.width, 90, COLORS.cream);
    this.rect(0, 838, this.width, 4, COLORS.gold); // Gold stripe

    // Logo
    if (logoData) {
      this.ops.push('q');
      this.ops.push(`38 0 0 38 34 766 cm`);
      this.ops.push(`/Logo Do`);
      this.ops.push('Q');
      this.rect(34, 766, 38, 38, null, COLORS.gold, 1);
    } else {
      this.rect(34, 766, 38, 38, COLORS.crimson);
      this.text('VS', 44, 778, { size: 14, font: 'F2', color: COLORS.white });
    }

    // Platform Identity
    this.text('VRINDAVAN SARTHI', 82, 792, { size: 15, font: 'F2', color: COLORS.crimson });
    this.text('Pilgrimage & Devotional Stay Services | Braj Dham', 82, 780, { size: 8, font: 'F1', color: COLORS.muted });
    this.text('Raja Wala Mandir, In front of Giriraj Ji Maharaj, Govardhan, Mathura, UP 281502', 82, 769, { size: 7.2, color: COLORS.muted });

    // Document Title & Reference on Top Right
    const docTitle = isHotel ? 'BOOKING CONFIRMATION & PAYMENT RECEIPT' : 'TAX INVOICE';
    const docTitleWidth = textWidth(docTitle, 9.5);
    this.text(docTitle, this.width - this.margin - docTitleWidth, 792, { size: 9.5, font: 'F2', color: COLORS.navy });
    const genDate = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    const genDateW = textWidth(genDate, 8);
    this.text(genDate, this.width - this.margin - genDateW, 780, { size: 8, color: COLORS.muted });
    this.text('Support: +91 86798 20256', this.width - this.margin - textWidth('Support: +91 86798 20256', 7.5), 769, { size: 7.5, color: COLORS.muted });

    // 2. STATUS & RESERVATION METADATA BAR (y = 740 down to 704)
    this.rect(this.margin, 704, this.width - this.margin * 2, 38, COLORS.white, COLORS.border, 1);

    // Status pill
    const isConfirmed = ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(String(booking.bookingStatus || '').toLowerCase()) || booking.paymentStatus === 'paid';
    const statusText = isConfirmed ? 'RESERVATION CONFIRMED' : (String(booking.bookingStatus || 'PENDING').toUpperCase());
    this.text('STATUS', this.margin + 12, 726, { size: 7, font: 'F2', color: COLORS.muted });
    this.badge(statusText, this.margin + 12, 712, {
      bg: isConfirmed ? COLORS.greenBg : COLORS.amberBg,
      border: isConfirmed ? COLORS.greenBorder : COLORS.border,
      textCol: isConfirmed ? COLORS.green : COLORS.amber,
      size: 8,
      font: 'F2',
      padX: 6,
      padY: 2.5
    });

    // Booking Reference ID
    this.text('BOOKING REFERENCE', this.margin + 175, 726, { size: 7, font: 'F2', color: COLORS.muted });
    this.text(booking.bookingId || String(booking._id), this.margin + 175, 712, { size: 10.5, font: 'F2', color: COLORS.navy });

    // Booked On
    this.text('BOOKED ON', this.margin + 360, 726, { size: 7, font: 'F2', color: COLORS.muted });
    this.text(dateTimeText(booking.createdAt), this.margin + 360, 712, { size: 8.5, font: 'F1', color: COLORS.ink });

    // 3. MAIN 2-COLUMN SECTION (y = 692 down to 400)
    const colLeftW = 325;
    const colRightW = this.width - this.margin * 2 - colLeftW - 14;
    const colRightX = this.margin + colLeftW + 14;

    // --- LEFT COLUMN ---
    // Block 3A: Accommodation & Stay Details (Height: 162 pt, y = 692 down to 530)
    let leftY = 692;
    this.rect(this.margin, leftY - 162, colLeftW, 162, COLORS.white, COLORS.border, 1);

    // Section header
    this.rect(this.margin, leftY - 24, colLeftW, 24, COLORS.softBg);
    this.text('ACCOMMODATION & STAY DETAILS', this.margin + 10, leftY - 16, { size: 8, font: 'F2', color: COLORS.crimson });
    this.line(this.margin, leftY - 24, this.margin + colLeftW, leftY - 24, COLORS.border, 1);

    // Property name & room
    const propName = booking.propertyName || String(booking.itemName || '').split(' - ')[0] || booking.partnerName || 'Property';
    const roomName = String(booking.itemName || '').includes(' - ') ? String(booking.itemName || '').split(' - ')[1] : String(booking.itemName || 'Standard Room');
    this.text(propName, this.margin + 10, leftY - 40, { size: 11.5, font: 'F2', color: COLORS.navy });
    this.text(`Room Type: ${roomName}`, this.margin + 10, leftY - 53, { size: 8.5, font: 'F2', color: COLORS.ink });

    // Verified Address & Landmark
    const propLoc = booking.propertyAddress || booking.propertyLocation || 'Vrindavan, Mathura District, Uttar Pradesh';
    const landmark = booking.nearestTemple ? `Landmark: Near ${booking.nearestTemple}` : '';
    this.text('Address:', this.margin + 10, leftY - 67, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.wrapped(propLoc, this.margin + 52, leftY - 67, colLeftW - 62, { size: 7.8, color: COLORS.ink, lineHeight: 10 });

    if (landmark) {
      this.text(landmark, this.margin + 52, leftY - 82, { size: 7.5, font: 'F1', color: COLORS.gold });
    }

    // Google Maps Clickable Link
    const mapUrl = booking.googleMapLink || (propName && propLoc ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${propName}, ${propLoc}, Vrindavan`)}` : null);
    if (mapUrl) {
      this.link('Open in Google Maps / Get Directions', mapUrl, this.margin + 10, leftY - 98, { size: 8, font: 'F2', color: COLORS.linkBlue });
    }

    // Stay Dates Grid (Check-in, Check-out, Nights/Occupancy)
    const gridY = leftY - 152;
    const cellW = (colLeftW - 20) / 3;

    // Check-in
    this.rect(this.margin + 10, gridY, cellW, 44, COLORS.cream, COLORS.border, 0.7);
    this.text('CHECK-IN', this.margin + 15, gridY + 32, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(dateText(booking.checkIn), this.margin + 15, gridY + 19, { size: 7.8, font: 'F2', color: COLORS.navy });
    this.text(booking.checkInTime || '12:00 PM', this.margin + 15, gridY + 8, { size: 7, color: COLORS.muted });

    // Check-out
    this.rect(this.margin + 10 + cellW, gridY, cellW, 44, COLORS.cream, COLORS.border, 0.7);
    this.text('CHECK-OUT', this.margin + 15 + cellW, gridY + 32, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(dateText(booking.checkOut), this.margin + 15 + cellW, gridY + 19, { size: 7.8, font: 'F2', color: COLORS.navy });
    this.text('11:00 AM', this.margin + 15 + cellW, gridY + 8, { size: 7, color: COLORS.muted });

    // Stay Duration & Occupancy
    const nights = Math.max(1, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))) || 1;
    const guests = booking.guests || ((booking.totalAdults || 1) + (booking.totalChildren || 0));
    this.rect(this.margin + 10 + cellW * 2, gridY, cellW, 44, COLORS.cream, COLORS.border, 0.7);
    this.text('DURATION / GUESTS', this.margin + 15 + cellW * 2, gridY + 32, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(`${nights} Night${nights > 1 ? 's' : ''}`, this.margin + 15 + cellW * 2, gridY + 19, { size: 7.8, font: 'F2', color: COLORS.navy });
    this.text(`${guests} Guest(s)${booking.roomQuantity ? ` (${booking.roomQuantity} Room)` : ''}`, this.margin + 15 + cellW * 2, gridY + 8, { size: 7, color: COLORS.muted });

    // Block 3B: Primary Guest Details (Height: 58 pt, y = 520 down to 462)
    leftY = 520;
    this.rect(this.margin, leftY - 58, colLeftW, 58, COLORS.white, COLORS.border, 1);
    this.rect(this.margin, leftY - 20, colLeftW, 20, COLORS.softBg);
    this.text('PRIMARY GUEST DETAILS', this.margin + 10, leftY - 14, { size: 8, font: 'F2', color: COLORS.crimson });
    this.line(this.margin, leftY - 20, this.margin + colLeftW, leftY - 20, COLORS.border, 1);

    const custName = booking.customerFullName || booking.userName || 'Guest Devotee';
    const custPhone = booking.customerMobile || booking.userPhone || '—';
    const custEmail = booking.customerEmail || booking.userEmail || '—';
    this.text('Guest Name:', this.margin + 10, leftY - 34, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(custName, this.margin + 64, leftY - 34, { size: 8.5, font: 'F2', color: COLORS.navy });
    this.text('Mobile Phone:', this.margin + 10, leftY - 48, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(custPhone, this.margin + 64, leftY - 48, { size: 8, font: 'F1', color: COLORS.ink });
    this.text('Email:', this.margin + 175, leftY - 48, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(custEmail, this.margin + 205, leftY - 48, { size: 8, font: 'F1', color: COLORS.ink });

    // Block 3C: Contacts & Helpdesk (Height: 62 pt, y = 452 down to 390)
    leftY = 452;
    this.rect(this.margin, leftY - 62, colLeftW, 62, COLORS.white, COLORS.border, 1);
    this.rect(this.margin, leftY - 20, colLeftW, 20, COLORS.softBg);
    this.text('KEY CONTACTS & PILGRIMAGE ASSISTANCE', this.margin + 10, leftY - 14, { size: 8, font: 'F2', color: COLORS.crimson });
    this.line(this.margin, leftY - 20, this.margin + colLeftW, leftY - 20, COLORS.border, 1);

    const partnerPhone = booking.partnerPhone || booking.partnerWhatsapp || 'Available at desk';
    this.text('Property Reception:', this.margin + 10, leftY - 34, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(`${propName} (+91 ${partnerPhone})`, this.margin + 98, leftY - 34, { size: 8, font: 'F2', color: COLORS.navy });
    this.text('Key collection, check-in arrival timing, and satvik meal assistance', this.margin + 98, leftY - 43, { size: 6.8, font: 'F1', color: COLORS.muted });

    this.text('Vrindavan Sarthi:', this.margin + 10, leftY - 54, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text('24/7 Helpline: +91 86798 20256 | vrindavansarthi108@gmail.com', this.margin + 98, leftY - 54, { size: 8, font: 'F2', color: COLORS.crimson });

    // --- RIGHT COLUMN: FINANCIAL BREAKDOWN (y = 692 down to 390, Height = 302 pt) ---
    const rightY = 692;
    const rightH = 302;
    this.rect(colRightX, rightY - rightH, colRightW, rightH, COLORS.white, COLORS.border, 1);
    this.rect(colRightX, rightY - 24, colRightW, 24, COLORS.cream);
    this.text('PAYMENT BREAKDOWN', colRightX + 12, rightY - 16, { size: 8.5, font: 'F2', color: COLORS.crimson });
    this.line(colRightX, rightY - 24, colRightX + colRightW, rightY - 24, COLORS.gold, 1);

    // Financial rows
    let py = rightY - 42;
    const rowH = 17;
    const roomTariff = Number(booking.dharamshalaAmount || booking.baseAmount || booking.checkoutSubtotal || 0);
    const dharamshalaFee = Number(booking.vrindavanSarthiServiceFee || 0);
    const convenienceFee = Number(booking.convenienceFeeAmount || 0);
    const fee = isDharamshala ? (dharamshalaFee || convenienceFee) : convenienceFee;
    const feeName = isDharamshala ? 'Platform Facilitation Fee' : 'Convenience Fee';
    const tax = Number(booking.taxAmount || 0);
    const total = Number(booking.totalAmount || 0);
    const paid = Number(booking.amountPaidOnline ?? booking.advanceAmount ?? 0);
    const balance = Number(booking.amountPayableAtProperty ?? booking.balanceAmount ?? 0);

    // Line 1: Room Amount
    this.text(isDharamshala ? 'Dharamshala Tariff' : 'Room Amount', colRightX + 12, py, { size: 8.5, color: COLORS.ink });
    this.text(money(roomTariff), colRightX + colRightW - 12 - textWidth(money(roomTariff), 8.5), py, { size: 8.5, font: 'F2', color: COLORS.navy });
    py -= rowH;

    // Line 2: Fee
    this.text(feeName, colRightX + 12, py, { size: 8.5, color: COLORS.ink });
    this.text(money(fee), colRightX + colRightW - 12 - textWidth(money(fee), 8.5), py, { size: 8.5, font: 'F2', color: COLORS.navy });
    py -= rowH;

    // Line 3: Taxes (if any)
    if (tax > 0) {
      this.text('Taxes / GST', colRightX + 12, py, { size: 8.5, color: COLORS.ink });
      this.text(money(tax), colRightX + colRightW - 12 - textWidth(money(tax), 8.5), py, { size: 8.5, font: 'F2', color: COLORS.navy });
      py -= rowH;
    }

    // Divider
    this.line(colRightX + 10, py + 4, colRightX + colRightW - 10, py + 4, COLORS.border, 0.8);
    py -= 6;

    // TOTAL AMOUNT
    this.rect(colRightX + 8, py - 18, colRightW - 16, 24, COLORS.cream, COLORS.gold, 0.8);
    this.text('TOTAL PAYABLE', colRightX + 14, py - 6, { size: 8.5, font: 'F2', color: COLORS.crimson });
    const totStr = money(total);
    this.text(totStr, colRightX + colRightW - 14 - textWidth(totStr, 11), py - 6, { size: 11, font: 'F2', color: COLORS.crimson });
    py -= 28;

    // PAID ONLINE
    this.rect(colRightX + 8, py - 16, colRightW - 16, 22, COLORS.greenBg, COLORS.greenBorder, 0.8);
    this.text('Paid Online (Verified)', colRightX + 14, py - 5, { size: 8, font: 'F2', color: COLORS.green });
    const paidStr = money(paid);
    this.text(paidStr, colRightX + colRightW - 14 - textWidth(paidStr, 9.5), py - 5, { size: 9.5, font: 'F2', color: COLORS.green });
    py -= 26;

    // BALANCE DUE
    const balBg = balance > 0 ? COLORS.crimsonBg : COLORS.softBg;
    const balBorder = balance > 0 ? COLORS.crimsonBorder : COLORS.border;
    const balTextCol = balance > 0 ? COLORS.crimson : COLORS.muted;
    this.rect(colRightX + 8, py - 16, colRightW - 16, 22, balBg, balBorder, 0.8);
    this.text(balance > 0 ? 'Payable at Property' : 'Balance Settled', colRightX + 14, py - 5, { size: 8, font: 'F2', color: balTextCol });
    const balStr = money(balance);
    this.text(balStr, colRightX + colRightW - 14 - textWidth(balStr, 9.5), py - 5, { size: 9.5, font: 'F2', color: balTextCol });
    py -= 24;

    // Payment details box
    this.line(colRightX + 10, py + 6, colRightX + colRightW - 10, py + 6, COLORS.border, 0.8);
    this.text('Payment Mode:', colRightX + 12, py - 6, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(balance > 0 ? 'Split / Check-in Balance' : 'Full Online Payment', colRightX + 80, py - 6, { size: 7.5, color: COLORS.ink });

    this.text('Method:', colRightX + 12, py - 18, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(booking.paymentMethod === 'online' ? 'Online Gateway (Razorpay)' : 'Pay at Property', colRightX + 80, py - 18, { size: 7.5, color: COLORS.ink });

    if (booking.razorpayPaymentId) {
      this.text('Payment ID:', colRightX + 12, py - 30, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(booking.razorpayPaymentId, colRightX + 80, py - 30, { size: 7.2, font: 'F2', color: COLORS.navy });
    }

    if (booking.paidAt) {
      this.text('Paid At:', colRightX + 12, py - 42, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(dateTimeText(booking.paidAt), colRightX + 80, py - 42, { size: 7, color: COLORS.muted });
    }

    // 4. IMPORTANT CHECK-IN GUIDELINES (y = 380 down to 292, Height: 88 pt)
    const card4Y = 380;
    const card4H = 88;
    this.rect(this.margin, card4Y - card4H, this.width - this.margin * 2, card4H, COLORS.cream, COLORS.goldLight, 1);
    this.rect(this.margin, card4Y - 20, this.width - this.margin * 2, 20, COLORS.goldLight);
    this.text('IMPORTANT GUEST INSTRUCTIONS & PROPERTY POLICIES', this.margin + 12, card4Y - 14, { size: 8, font: 'F2', color: COLORS.amber });
    this.line(this.margin, card4Y - 20, this.width - this.margin * 2 + this.margin, card4Y - 20, COLORS.gold, 0.7);

    const bullets = [
      '• Mandatory ID: Valid government-issued Photo ID (Aadhaar / Passport) is strictly required for every adult guest upon check-in.',
      '• Check-in Timing: Standard check-in is 12:00 PM; check-out is 11:00 AM. Late check-out is subject to property availability.',
      balance > 0 ? `• Balance Collection: Outstanding balance of ${money(balance)} is payable directly to ${propName} reception upon arrival.` : '• Balance Cleared: No further stay charges are due for the reserved dates.',
      '• Spiritual Sanctity: Unmarried couples are not permitted. Smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited.',
      '• Cancellation: Cancellations and refunds are governed by the property terms. Platform facilitation fees are non-refundable after confirmation.'
    ];

    let by = card4Y - 32;
    bullets.forEach((b) => {
      this.text(b, this.margin + 12, by, { size: 7.2, color: COLORS.ink });
      by -= 11;
    });

    // 5. LEGAL DISCLAIMER (y = 282 down to 238, Height: 44 pt)
    const discY = 282;
    const discH = 44;
    this.rect(this.margin, discY - discH, this.width - this.margin * 2, discH, COLORS.softBg, COLORS.border, 0.8);
    this.text('LEGAL & PLATFORM DISCLAIMER', this.margin + 10, discY - 12, { size: 6.8, font: 'F2', color: COLORS.muted });
    const discText = 'Vrindavan Sarthi acts only as an online booking and payment facilitation platform connecting devotees with independent properties and service providers. Accommodation services are rendered directly by the property partner. The property partner is solely responsible for issuing the official tax invoice for accommodation and for compliance with applicable GST and local regulations. Please present this confirmation receipt at reception.';
    this.wrapped(discText, this.margin + 10, discY - 22, this.width - this.margin * 2 - 20, { size: 6.5, color: COLORS.muted, lineHeight: 8.5 });

    // 6. FOOTER (y = 44 down to 20)
    this.line(this.margin, 46, this.width - this.margin, 46, COLORS.border, 0.8);
    this.text('Vrindavan Sarthi Enterprises | Raja Wala Mandir, In front of Giriraj Ji Maharaj, Govardhan, Mathura, UP 281502', this.margin, 34, { size: 7, color: COLORS.muted });
    this.text('24/7 Pilgrimage Helpline: +91 86798 20256 | Email: vrindavansarthi108@gmail.com', this.margin, 23, { size: 7, color: COLORS.muted });
    this.text('Page 1 of 1', this.width - this.margin - 40, 28, { size: 7, font: 'F2', color: COLORS.muted });

    return this.buildOutput(logoData);
  }

  loadLogo() {
    try {
      const logoPath = path.resolve(__dirname, '../frontend/public/vrindasarthi logo.jpeg');
      const data = fs.readFileSync(logoPath);
      return { data, width: 300, height: 300 };
    } catch {
      return null;
    }
  }

  buildOutput(logo) {
    const stream = this.ops.join('\n');
    const objects = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(null);
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    let logoObjectNo = null;
    if (logo) {
      logoObjectNo = objects.length + 1;
      objects.push({
        binary: true,
        data: logo.data,
        header: `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>`,
      });
    }

    const annotsStr = this.annotations.map((a) =>
      `<< /Type /Annot /Subtype /Link /Rect [${a.x1.toFixed(2)} ${a.y1.toFixed(2)} ${a.x2.toFixed(2)} ${a.y2.toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (${escapePdf(a.url)}) >> >>`
    ).join(' ');

    const annotsDict = annotsStr ? `/Annots [ ${annotsStr} ] ` : '';
    const xObjects = logoObjectNo ? `/XObject << /Logo ${logoObjectNo} 0 R >> ` : '';

    const pageNo = objects.length + 1;
    const contentNo = pageNo + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] ${annotsDict}/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjects}>> /Contents ${contentNo} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);

    objects[1] = `<< /Type /Pages /Kids [${pageNo} 0 R] /Count 1 >>`;

    const chunks = [Buffer.from('%PDF-1.4\n', 'utf8')];
    const byteLength = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const offsets = [0];
    objects.forEach((obj, i) => {
      offsets.push(byteLength());
      chunks.push(Buffer.from(`${i + 1} 0 obj\n`, 'utf8'));
      if (obj && typeof obj === 'object' && obj.binary) {
        chunks.push(Buffer.from(`${obj.header}\nstream\n`, 'utf8'));
        chunks.push(obj.data);
        chunks.push(Buffer.from('\nendstream\n', 'utf8'));
      } else {
        chunks.push(Buffer.from(String(obj), 'utf8'));
        chunks.push(Buffer.from('\n', 'utf8'));
      }
      chunks.push(Buffer.from('endobj\n', 'utf8'));
    });
    const xrefStart = byteLength();
    chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, 'utf8'));
    for (let i = 1; i < offsets.length; i += 1) {
      chunks.push(Buffer.from(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`, 'utf8'));
    }
    chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, 'utf8'));
    return Buffer.concat(chunks);
  }
}

// Generate for audited booking
const booking = {
  bookingId: 'VVS-DR-20261023-191395',
  bookingType: 'room_type',
  service_billing_model: 'dharamshala_booking',
  itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
  partnerName: 'Shri Giriraj Sewa Sadan',
  partnerPhone: '9927600017',
  customerFullName: 'Vrindavan Sarthi',
  customerMobile: '6396147954',
  customerEmail: 'vrindavansarthi108@gmail.com',
  checkIn: '2026-10-26T00:00:00.000Z',
  checkOut: '2026-10-27T00:00:00.000Z',
  checkInTime: '12:00 PM',
  guests: 1,
  totalAdults: 1,
  totalChildren: 0,
  totalAmount: 1299,
  dharamshalaAmount: 1200,
  baseAmount: 1200,
  vrindavanSarthiServiceFee: 99,
  amountPaidOnline: 99,
  amountPayableAtProperty: 1200,
  paymentStatus: 'paid',
  bookingStatus: 'confirmed',
  paymentMethod: 'online',
  razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
  paidAt: '2026-10-23T13:48:43.596Z',
  createdAt: '2026-10-23T13:43:28.185Z',
  propertyLocation: 'Keshav Dham Road Opposite prem Mandir',
  propertyAddress: 'Keshav Dham Road Opposite prem Mandir, Vrindavan',
  googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
  nearestTemple: 'Prem Mandir (approx 200m)',
};

const builder = new ExecutivePdfBuilder();
const pdfBuffer = builder.render(booking);
fs.writeFileSync('scratch/redesigned_receipt.pdf', pdfBuffer);
console.log('Saved redesigned_receipt.pdf:', pdfBuffer.length);
