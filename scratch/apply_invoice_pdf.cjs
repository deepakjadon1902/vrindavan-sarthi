const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../backend/utils/invoicePdf.js');
let content = fs.readFileSync(targetPath, 'utf8');

const codeToAppend = `
const A4_PAGE = { width: 595.28, height: 841.89, margin: 32 };
const EXECUTIVE_COLORS = {
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

const dateText = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(val);
  }
};

const dateTimeText = (val) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(val);
  }
};

const resolveMapUrl = (booking, propName, propLoc) => {
  const saved = clean(booking.googleMapLink);
  if (/^https?:\/\//i.test(saved)) return saved;
  if (!propName && !propLoc) return null;
  const parts = [propName, propLoc, booking.nearestTemple ? \`Near \${booking.nearestTemple}\` : '', 'Vrindavan'].filter(Boolean);
  return \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(parts.join(', '))}\`;
};

class ExecutivePdfBuilder {
  constructor() {
    this.ops = [];
    this.annotations = [];
    this.width = A4_PAGE.width;
    this.height = A4_PAGE.height;
    this.margin = A4_PAGE.margin;
  }

  rect(x, y, w, h, fill = null, stroke = null, lineWidth = 1) {
    if (fill) this.ops.push(\`\${rgb(fill)} rg\`);
    if (stroke) {
      this.ops.push(\`\${rgb(stroke)} RG\`);
      this.ops.push(\`\${lineWidth} w\`);
    }
    this.ops.push(\`\${x.toFixed(2)} \${y.toFixed(2)} \${w.toFixed(2)} \${h.toFixed(2)} re \${fill && stroke ? 'B' : fill ? 'f' : 'S'}\`);
  }

  line(x1, y1, x2, y2, stroke = EXECUTIVE_COLORS.border, width = 1) {
    this.ops.push(\`\${rgb(stroke)} RG\`);
    this.ops.push(\`\${width} w\`);
    this.ops.push(\`\${x1.toFixed(2)} \${y1.toFixed(2)} m \${x2.toFixed(2)} \${y2.toFixed(2)} l S\`);
  }

  text(val, x, y, { size = 10, font = 'F1', color = EXECUTIVE_COLORS.ink } = {}) {
    if (!clean(val)) return;
    this.ops.push(\`\${rgb(color)} rg\`);
    this.ops.push(\`BT /\${font} \${size} Tf \${x.toFixed(2)} \${y.toFixed(2)} Td (\${escapePdfText(val)}) Tj ET\`);
  }

  link(textVal, url, x, y, { size = 9, font = 'F2', color = EXECUTIVE_COLORS.linkBlue, underline = true } = {}) {
    const str = clean(textVal);
    if (!str) return;
    this.text(str, x, y, { size, font, color });
    const tw = textWidth(str, size);
    if (underline) {
      this.line(x, y - 1.5, x + tw, y - 1.5, color, 0.6);
    }
    if (url && /^https?:\\/\\//i.test(url)) {
      this.annotations.push({
        x1: x,
        y1: y - 3,
        x2: x + tw,
        y2: y + size + 2,
        url: url.trim(),
      });
    }
  }

  wrapped(val, x, y, maxWidth, { size = 9, font = 'F1', color = EXECUTIVE_COLORS.ink, lineHeight = 12 } = {}) {
    const lines = wrapText(val, maxWidth, size);
    lines.forEach((l, idx) => {
      this.text(l, x, y - idx * lineHeight, { size, font, color });
    });
    return lines.length * lineHeight;
  }

  badge(textVal, x, y, { bg = EXECUTIVE_COLORS.greenBg, border = EXECUTIVE_COLORS.greenBorder, textCol = EXECUTIVE_COLORS.green, size = 8, font = 'F2', padX = 6, padY = 3 } = {}) {
    const str = clean(textVal);
    const tw = textWidth(str, size);
    const bw = tw + padX * 2;
    const bh = size + padY * 2;
    this.rect(x, y - padY, bw, bh, bg, border, 0.7);
    this.text(str, x + padX, y + 1, { size, font, color: textCol });
    return bw;
  }

  render(booking) {
    const logoData = loadLogo();
    const bookingType = String(booking.bookingType || '').toLowerCase();
    const isCab = bookingType === 'cab';
    const isTour = bookingType === 'tour';
    const isDharamshala = String(booking.service_billing_model || '') === 'dharamshala_booking' || String(booking.propertyType || '').toLowerCase() === 'dharamshala';
    const isLodging = !isCab && !isTour;

    // 1. HEADER (Top: y = 841.89 down to 752)
    this.rect(0, 752, this.width, 90, EXECUTIVE_COLORS.cream);
    this.rect(0, 838, this.width, 4, EXECUTIVE_COLORS.gold); // Gold stripe

    // Logo
    if (logoData) {
      this.ops.push('q');
      this.ops.push(\`38 0 0 38 34 766 cm\`);
      this.ops.push('/Logo Do');
      this.ops.push('Q');
      this.rect(34, 766, 38, 38, null, EXECUTIVE_COLORS.gold, 1);
    } else {
      this.rect(34, 766, 38, 38, EXECUTIVE_COLORS.crimson);
      this.text('VS', 44, 778, { size: 14, font: 'F2', color: EXECUTIVE_COLORS.white });
    }

    // Platform Identity
    this.text('VRINDAVAN SARTHI', 82, 792, { size: 15, font: 'F2', color: EXECUTIVE_COLORS.crimson });
    this.text('Pilgrimage & Devotional Stay Services | Braj Dham', 82, 780, { size: 8, font: 'F1', color: EXECUTIVE_COLORS.muted });
    this.text('Raja Wala Mandir, In front of Giriraj Ji Maharaj, Govardhan, Mathura, UP 281502', 82, 769, { size: 7.2, color: EXECUTIVE_COLORS.muted });

    // Document Title & Reference on Top Right
    let docTitle = 'BOOKING CONFIRMATION & PAYMENT RECEIPT';
    if (isCab) docTitle = 'CAB BOOKING CONFIRMATION & RECEIPT';
    else if (isTour) docTitle = 'PILGRIMAGE TOUR BOOKING RECEIPT';
    const docTitleWidth = textWidth(docTitle, 9.5);
    this.text(docTitle, this.width - this.margin - docTitleWidth, 792, { size: 9.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
    const genDate = \`Generated: \${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\`;
    const genDateW = textWidth(genDate, 8);
    this.text(genDate, this.width - this.margin - genDateW, 780, { size: 8, color: EXECUTIVE_COLORS.muted });
    this.text('Support: +91 86798 20256', this.width - this.margin - textWidth('Support: +91 86798 20256', 7.5), 769, { size: 7.5, color: EXECUTIVE_COLORS.muted });

    // 2. STATUS & RESERVATION METADATA BAR (y = 740 down to 704)
    this.rect(this.margin, 704, this.width - this.margin * 2, 38, EXECUTIVE_COLORS.white, EXECUTIVE_COLORS.border, 1);

    // Status pill
    const isConfirmed = ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(String(booking.bookingStatus || '').toLowerCase()) || booking.paymentStatus === 'paid';
    const statusText = isConfirmed ? 'RESERVATION CONFIRMED' : (String(booking.bookingStatus || 'PENDING').toUpperCase());
    this.text('STATUS', this.margin + 12, 726, { size: 7, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.badge(statusText, this.margin + 12, 712, {
      bg: isConfirmed ? EXECUTIVE_COLORS.greenBg : EXECUTIVE_COLORS.amberBg,
      border: isConfirmed ? EXECUTIVE_COLORS.greenBorder : EXECUTIVE_COLORS.border,
      textCol: isConfirmed ? EXECUTIVE_COLORS.green : EXECUTIVE_COLORS.amber,
      size: 8,
      font: 'F2',
      padX: 6,
      padY: 2.5
    });

    // Booking Reference ID
    this.text('BOOKING REFERENCE', this.margin + 175, 726, { size: 7, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(booking.bookingId || String(booking._id || 'VVS-REF'), this.margin + 175, 712, { size: 10.5, font: 'F2', color: EXECUTIVE_COLORS.navy });

    // Booked On
    this.text('BOOKED ON', this.margin + 360, 726, { size: 7, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(dateTimeText(booking.createdAt), this.margin + 360, 712, { size: 8.5, font: 'F1', color: EXECUTIVE_COLORS.ink });

    // 3. MAIN 2-COLUMN SECTION
    const colLeftW = 325;
    const colRightW = this.width - this.margin * 2 - colLeftW - 14;
    const colRightX = this.margin + colLeftW + 14;

    // --- LEFT COLUMN ---
    // Block 3A: Service Details (Height: 162 pt, y = 692 down to 530)
    let leftY = 692;
    this.rect(this.margin, leftY - 162, colLeftW, 162, EXECUTIVE_COLORS.white, EXECUTIVE_COLORS.border, 1);
    this.rect(this.margin, leftY - 24, colLeftW, 24, EXECUTIVE_COLORS.softBg);
    
    const blockTitle = isCab ? 'VEHICLE & JOURNEY DETAILS' : isTour ? 'PILGRIMAGE TOUR DETAILS' : 'ACCOMMODATION & STAY DETAILS';
    this.text(blockTitle, this.margin + 10, leftY - 16, { size: 8, font: 'F2', color: EXECUTIVE_COLORS.crimson });
    this.line(this.margin, leftY - 24, this.margin + colLeftW, leftY - 24, EXECUTIVE_COLORS.border, 1);

    const propName = booking.propertyName || String(booking.itemName || '').split(' - ')[0] || booking.partnerName || (isCab ? 'Cab Service' : isTour ? 'Vrindavan Sarthi Tours' : 'Property');
    const roomName = String(booking.itemName || '').includes(' - ') ? String(booking.itemName || '').split(' - ')[1] : String(booking.itemName || (isCab ? 'Sedan / SUV' : 'Standard Service'));
    const propLoc = booking.propertyAddress || booking.propertyLocation || (isCab ? 'Mathura / Vrindavan' : 'Vrindavan, Mathura District, Uttar Pradesh');

    if (isLodging) {
      this.text(propName, this.margin + 10, leftY - 40, { size: 11.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text(\`Room Type: \${roomName}\`, this.margin + 10, leftY - 53, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.ink });

      // Verified Address & Landmark
      const landmark = booking.nearestTemple ? \`Landmark: Near \${booking.nearestTemple}\` : '';
      this.text('Address:', this.margin + 10, leftY - 67, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.wrapped(propLoc, this.margin + 52, leftY - 67, colLeftW - 62, { size: 7.8, color: EXECUTIVE_COLORS.ink, lineHeight: 10 });

      if (landmark) {
        this.text(landmark, this.margin + 52, leftY - 82, { size: 7.5, font: 'F1', color: EXECUTIVE_COLORS.gold });
      }

      // Google Maps Clickable Link
      const mapUrl = resolveMapUrl(booking, propName, propLoc);
      if (mapUrl) {
        this.link('Open in Google Maps / Get Directions', mapUrl, this.margin + 10, leftY - 98, { size: 8, font: 'F2', color: EXECUTIVE_COLORS.linkBlue });
      }

      // Stay Dates Grid (Check-in, Check-out, Nights/Occupancy)
      const gridY = leftY - 152;
      const cellW = (colLeftW - 20) / 3;

      // Check-in
      this.rect(this.margin + 10, gridY, cellW, 44, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.border, 0.7);
      this.text('CHECK-IN', this.margin + 15, gridY + 32, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(dateText(booking.checkIn), this.margin + 15, gridY + 19, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text(booking.checkInTime || '12:00 PM', this.margin + 15, gridY + 8, { size: 7, color: EXECUTIVE_COLORS.muted });

      // Check-out
      this.rect(this.margin + 10 + cellW, gridY, cellW, 44, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.border, 0.7);
      this.text('CHECK-OUT', this.margin + 15 + cellW, gridY + 32, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(dateText(booking.checkOut), this.margin + 15 + cellW, gridY + 19, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text('11:00 AM', this.margin + 15 + cellW, gridY + 8, { size: 7, color: EXECUTIVE_COLORS.muted });

      // Duration & Guests
      const nights = Math.max(1, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))) || 1;
      const guests = booking.guests || ((booking.totalAdults || 1) + (booking.totalChildren || 0));
      this.rect(this.margin + 10 + cellW * 2, gridY, cellW, 44, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.border, 0.7);
      this.text('DURATION / GUESTS', this.margin + 15 + cellW * 2, gridY + 32, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(\`\${nights} Night\${nights > 1 ? 's' : ''}\`, this.margin + 15 + cellW * 2, gridY + 19, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text(\`\${guests} Guest(s)\${booking.roomQuantity ? \` (\${booking.roomQuantity} Room)\` : ''}\`, this.margin + 15 + cellW * 2, gridY + 8, { size: 7, color: EXECUTIVE_COLORS.muted });
    } else if (isCab) {
      this.text(booking.itemName || 'Dedicated Cab Booking', this.margin + 10, leftY - 40, { size: 11.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text(\`Vehicle: \${booking.vehicleType || 'AC Sedan / Ertiga'}\`, this.margin + 10, leftY - 54, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.ink });
      this.text('Pickup:', this.margin + 10, leftY - 72, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.wrapped(booking.pickupAddress || booking.pickupCity || 'Mathura Station / Hotel', this.margin + 52, leftY - 72, colLeftW - 62, { size: 7.8, color: EXECUTIVE_COLORS.ink });
      this.text('Drop:', this.margin + 10, leftY - 92, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.wrapped(booking.dropAddress || booking.dropCity || 'Vrindavan / Govardhan', this.margin + 52, leftY - 92, colLeftW - 62, { size: 7.8, color: EXECUTIVE_COLORS.ink });
      
      const gridY = leftY - 152;
      const cellW = (colLeftW - 20) / 2;
      this.rect(this.margin + 10, gridY, cellW, 44, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.border, 0.7);
      this.text('JOURNEY DATE', this.margin + 15, gridY + 32, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(dateText(booking.travelDate || booking.pickupDate), this.margin + 15, gridY + 19, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text(booking.pickupTime || 'As scheduled', this.margin + 15, gridY + 8, { size: 7, color: EXECUTIVE_COLORS.muted });

      this.rect(this.margin + 10 + cellW, gridY, cellW, 44, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.border, 0.7);
      this.text('PASSENGERS', this.margin + 15 + cellW, gridY + 32, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(\`\${booking.passengers || booking.guests || 1} Traveler(s)\`, this.margin + 15 + cellW, gridY + 19, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text('Clean AC Vehicle', this.margin + 15 + cellW, gridY + 8, { size: 7, color: EXECUTIVE_COLORS.muted });
    } else {
      // Tour
      this.text(booking.itemName || 'Braj Dham Pilgrimage Tour', this.margin + 10, leftY - 40, { size: 11.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text(\`Package: \${booking.packageName || 'Comprehensive Braj Yatra'}\`, this.margin + 10, leftY - 54, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.ink });
      this.text('Inclusions:', this.margin + 10, leftY - 72, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.wrapped(booking.inclusions || 'Temple Darshan, Guided Assistance & AC Transport', this.margin + 62, leftY - 72, colLeftW - 72, { size: 7.8, color: EXECUTIVE_COLORS.ink });
      
      const gridY = leftY - 152;
      const cellW = (colLeftW - 20) / 2;
      this.rect(this.margin + 10, gridY, cellW, 44, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.border, 0.7);
      this.text('TOUR DATE', this.margin + 15, gridY + 32, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(dateText(booking.tourDate || booking.travelDate || booking.checkIn), this.margin + 15, gridY + 19, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text('Full Day Yatra', this.margin + 15, gridY + 8, { size: 7, color: EXECUTIVE_COLORS.muted });

      this.rect(this.margin + 10 + cellW, gridY, cellW, 44, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.border, 0.7);
      this.text('DEVOTEES', this.margin + 15 + cellW, gridY + 32, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(\`\${booking.guests || booking.totalAdults || 1} Devotee(s)\`, this.margin + 15 + cellW, gridY + 19, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
      this.text('Experienced Guide', this.margin + 15 + cellW, gridY + 8, { size: 7, color: EXECUTIVE_COLORS.muted });
    }

    // Block 3B: Primary Guest Details (Height: 58 pt, y = 520 down to 462)
    leftY = 520;
    this.rect(this.margin, leftY - 58, colLeftW, 58, EXECUTIVE_COLORS.white, EXECUTIVE_COLORS.border, 1);
    this.rect(this.margin, leftY - 20, colLeftW, 20, EXECUTIVE_COLORS.softBg);
    this.text('PRIMARY GUEST DETAILS', this.margin + 10, leftY - 14, { size: 8, font: 'F2', color: EXECUTIVE_COLORS.crimson });
    this.line(this.margin, leftY - 20, this.margin + colLeftW, leftY - 20, EXECUTIVE_COLORS.border, 1);

    const custName = booking.customerFullName || booking.userName || 'Guest Devotee';
    const custPhone = booking.customerMobile || booking.userPhone || '—';
    const custEmail = booking.customerEmail || booking.userEmail || '—';
    this.text('Guest Name:', this.margin + 10, leftY - 34, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(custName, this.margin + 64, leftY - 34, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
    this.text('Mobile Phone:', this.margin + 10, leftY - 48, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(custPhone, this.margin + 64, leftY - 48, { size: 8, font: 'F1', color: EXECUTIVE_COLORS.ink });
    this.text('Email:', this.margin + 175, leftY - 48, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(custEmail, this.margin + 205, leftY - 48, { size: 8, font: 'F1', color: EXECUTIVE_COLORS.ink });

    // Block 3C: Contacts & Helpdesk (Height: 62 pt, y = 452 down to 390)
    leftY = 452;
    this.rect(this.margin, leftY - 62, colLeftW, 62, EXECUTIVE_COLORS.white, EXECUTIVE_COLORS.border, 1);
    this.rect(this.margin, leftY - 20, colLeftW, 20, EXECUTIVE_COLORS.softBg);
    this.text('KEY CONTACTS & PILGRIMAGE ASSISTANCE', this.margin + 10, leftY - 14, { size: 8, font: 'F2', color: EXECUTIVE_COLORS.crimson });
    this.line(this.margin, leftY - 20, this.margin + colLeftW, leftY - 20, EXECUTIVE_COLORS.border, 1);

    const partnerPhone = booking.partnerPhone || booking.partnerWhatsapp || null;
    const receptionContact = partnerPhone ? \`+91 \${partnerPhone}\` : 'Desk coordination via Vrindavan Sarthi helpline';
    this.text(isCab ? 'Driver Desk:' : isTour ? 'Yatra Coordinator:' : 'Property Reception:', this.margin + 10, leftY - 34, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(\`\${propName} (\${receptionContact})\`, this.margin + 98, leftY - 34, { size: 7.8, font: 'F2', color: EXECUTIVE_COLORS.navy });
    this.text(isCab ? 'Pickup coordination, vehicle arrival updates' : isTour ? 'Yatra scheduling and darshan assistance' : 'Key collection, check-in arrival timing, and satvik meal assistance', this.margin + 98, leftY - 43, { size: 6.8, font: 'F1', color: EXECUTIVE_COLORS.muted });

    this.text('Vrindavan Sarthi:', this.margin + 10, leftY - 54, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text('24/7 Helpline: +91 86798 20256 | vrindavansarthi108@gmail.com', this.margin + 98, leftY - 54, { size: 8, font: 'F2', color: EXECUTIVE_COLORS.crimson });

    // --- RIGHT COLUMN: FINANCIAL BREAKDOWN (y = 692 down to 390, Height = 302 pt) ---
    const rightY = 692;
    const rightH = 302;
    this.rect(colRightX, rightY - rightH, colRightW, rightH, EXECUTIVE_COLORS.white, EXECUTIVE_COLORS.border, 1);
    this.rect(colRightX, rightY - 24, colRightW, 24, EXECUTIVE_COLORS.cream);
    this.text('PAYMENT BREAKDOWN', colRightX + 12, rightY - 16, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.crimson });
    this.line(colRightX, rightY - 24, colRightX + colRightW, rightY - 24, EXECUTIVE_COLORS.gold, 1);

    // Financial rows
    let py = rightY - 42;
    const rowH = 17;
    const roomTariff = Number(booking.dharamshalaAmount || booking.baseAmount || booking.checkoutSubtotal || 0);
    const dharamshalaFee = Number(booking.vrindavanSarthiServiceFee || 0);
    const convenienceFee = Number(booking.convenienceFeeAmount || 0);
    const fee = isDharamshala ? (dharamshalaFee || convenienceFee) : convenienceFee;
    const feeName = isDharamshala ? 'Platform Facilitation Fee' : 'Platform Convenience Fee';
    const tax = Number(booking.taxAmount || 0);
    const total = Number(booking.totalAmount || 0);
    const paid = Number(booking.amountPaidOnline ?? booking.advanceAmount ?? 0);
    const balance = Number(booking.amountPayableAtProperty ?? booking.balanceAmount ?? 0);

    // Line 1: Tariff / Base Fare
    const tariffLabel = isDharamshala ? 'Dharamshala Tariff' : isCab ? 'Cab Fare' : isTour ? 'Tour Package Fare' : 'Room Amount';
    this.text(tariffLabel, colRightX + 12, py, { size: 8.5, color: EXECUTIVE_COLORS.ink });
    this.text(money(roomTariff), colRightX + colRightW - 12 - textWidth(money(roomTariff), 8.5), py, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
    py -= rowH;

    // Line 2: Fee (if any)
    if (fee > 0 || isDharamshala) {
      this.text(feeName, colRightX + 12, py, { size: 8.5, color: EXECUTIVE_COLORS.ink });
      this.text(money(fee), colRightX + colRightW - 12 - textWidth(money(fee), 8.5), py, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
      py -= rowH;
    }

    // Line 3: Taxes (if any)
    if (tax > 0) {
      this.text('Taxes / GST', colRightX + 12, py, { size: 8.5, color: EXECUTIVE_COLORS.ink });
      this.text(money(tax), colRightX + colRightW - 12 - textWidth(money(tax), 8.5), py, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.navy });
      py -= rowH;
    }

    // Divider
    this.line(colRightX + 10, py + 4, colRightX + colRightW - 10, py + 4, EXECUTIVE_COLORS.border, 0.8);
    py -= 6;

    // TOTAL AMOUNT
    this.rect(colRightX + 8, py - 18, colRightW - 16, 24, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.gold, 0.8);
    this.text('TOTAL PAYABLE', colRightX + 14, py - 6, { size: 8.5, font: 'F2', color: EXECUTIVE_COLORS.crimson });
    const totStr = money(total);
    this.text(totStr, colRightX + colRightW - 14 - textWidth(totStr, 11), py - 6, { size: 11, font: 'F2', color: EXECUTIVE_COLORS.crimson });
    py -= 28;

    // PAID ONLINE
    this.rect(colRightX + 8, py - 16, colRightW - 16, 22, EXECUTIVE_COLORS.greenBg, EXECUTIVE_COLORS.greenBorder, 0.8);
    this.text('Paid Online (Verified)', colRightX + 14, py - 5, { size: 8, font: 'F2', color: EXECUTIVE_COLORS.green });
    const paidStr = money(paid);
    this.text(paidStr, colRightX + colRightW - 14 - textWidth(paidStr, 9.5), py - 5, { size: 9.5, font: 'F2', color: EXECUTIVE_COLORS.green });
    py -= 26;

    // BALANCE DUE
    const balBg = balance > 0 ? EXECUTIVE_COLORS.crimsonBg : EXECUTIVE_COLORS.softBg;
    const balBorder = balance > 0 ? EXECUTIVE_COLORS.crimsonBorder : EXECUTIVE_COLORS.border;
    const balTextCol = balance > 0 ? EXECUTIVE_COLORS.crimson : EXECUTIVE_COLORS.muted;
    const balLabel = balance > 0 ? (isCab ? 'Payable to Driver' : 'Payable at Property') : 'Balance Settled';
    this.rect(colRightX + 8, py - 16, colRightW - 16, 22, balBg, balBorder, 0.8);
    this.text(balLabel, colRightX + 14, py - 5, { size: 8, font: 'F2', color: balTextCol });
    const balStr = money(balance);
    this.text(balStr, colRightX + colRightW - 14 - textWidth(balStr, 9.5), py - 5, { size: 9.5, font: 'F2', color: balTextCol });
    py -= 24;

    // Payment details box
    this.line(colRightX + 10, py + 6, colRightX + colRightW - 10, py + 6, EXECUTIVE_COLORS.border, 0.8);
    
    let modeText = 'Full Online Payment';
    if (isDharamshala && balance > 0) modeText = 'Platform fee online / Balance at property';
    else if (balance > 0) modeText = 'Advance online / Balance at check-in';
    
    this.text('Payment Mode:', colRightX + 12, py - 6, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(modeText, colRightX + 80, py - 6, { size: 7.2, color: EXECUTIVE_COLORS.ink });

    this.text('Method:', colRightX + 12, py - 18, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
    this.text(booking.paymentMethod === 'online' ? 'Online Gateway (Razorpay)' : 'Pay at Property', colRightX + 80, py - 18, { size: 7.5, color: EXECUTIVE_COLORS.ink });

    if (booking.razorpayPaymentId) {
      this.text('Payment ID:', colRightX + 12, py - 30, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(booking.razorpayPaymentId, colRightX + 80, py - 30, { size: 7.2, font: 'F2', color: EXECUTIVE_COLORS.navy });
    }

    if (booking.paidAt) {
      this.text('Paid At:', colRightX + 12, py - 42, { size: 7.5, font: 'F2', color: EXECUTIVE_COLORS.muted });
      this.text(dateTimeText(booking.paidAt), colRightX + 80, py - 42, { size: 7, color: EXECUTIVE_COLORS.muted });
    }

    // 4. IMPORTANT INSTRUCTIONS / POLICIES (y = 380 down to 292, Height: 88 pt)
    const card4Y = 380;
    const card4H = 88;
    this.rect(this.margin, card4Y - card4H, this.width - this.margin * 2, card4H, EXECUTIVE_COLORS.cream, EXECUTIVE_COLORS.goldLight, 1);
    this.rect(this.margin, card4Y - 20, this.width - this.margin * 2, 20, EXECUTIVE_COLORS.goldLight);
    this.text('IMPORTANT GUEST INSTRUCTIONS & PROPERTY POLICIES', this.margin + 12, card4Y - 14, { size: 8, font: 'F2', color: EXECUTIVE_COLORS.amber });
    this.line(this.margin, card4Y - 20, this.width - this.margin * 2 + this.margin, card4Y - 20, EXECUTIVE_COLORS.gold, 0.7);

    const balanceNotice = balance > 0
      ? \`• Balance Collection: Outstanding balance of \${money(balance)} is payable directly to \${propName} reception upon arrival.\`
      : '• Balance Cleared: No further stay charges are due for the reserved dates.';

    const bullets = [
      '• Mandatory ID: Valid government-issued Photo ID (Aadhaar / Passport) is strictly required for every adult guest upon check-in.',
      isLodging
        ? '• Check-in Timing: Standard check-in is 12:00 PM; check-out is 11:00 AM. Late check-out is subject to property availability.'
        : '• Schedule Adherence: Please arrive at the designated pickup point 15 minutes before the scheduled time.',
      balanceNotice,
      '• Spiritual Sanctity: Unmarried couples are not permitted. Smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited.',
      '• Cancellation: Cancellations and refunds are governed by the property terms. Platform facilitation fees are non-refundable after confirmation.'
    ];

    let by = card4Y - 32;
    bullets.forEach((b) => {
      this.text(b, this.margin + 12, by, { size: 7.2, color: EXECUTIVE_COLORS.ink });
      by -= 11;
    });

    // 5. LEGAL DISCLAIMER (y = 282 down to 238, Height: 44 pt)
    const discY = 282;
    const discH = 44;
    this.rect(this.margin, discY - discH, this.width - this.margin * 2, discH, EXECUTIVE_COLORS.softBg, EXECUTIVE_COLORS.border, 0.8);
    this.text('LEGAL & PLATFORM DISCLAIMER', this.margin + 10, discY - 12, { size: 6.8, font: 'F2', color: EXECUTIVE_COLORS.muted });
    const discText = 'Vrindavan Sarthi acts only as an online booking and payment facilitation platform connecting devotees with independent properties and service providers. Accommodation services are rendered directly by the property partner. The property partner is solely responsible for issuing the official tax invoice for accommodation and for compliance with applicable GST and local regulations. Please present this confirmation receipt at reception.';
    this.wrapped(discText, this.margin + 10, discY - 22, this.width - this.margin * 2 - 20, { size: 6.5, color: EXECUTIVE_COLORS.muted, lineHeight: 8.5 });

    // 6. FOOTER (y = 44 down to 20)
    this.line(this.margin, 46, this.width - this.margin, 46, EXECUTIVE_COLORS.border, 0.8);
    this.text('Vrindavan Sarthi Enterprises | Raja Wala Mandir, In front of Giriraj Ji Maharaj, Govardhan, Mathura, UP 281502', this.margin, 34, { size: 7, color: EXECUTIVE_COLORS.muted });
    this.text('24/7 Pilgrimage Helpline: +91 86798 20256 | Email: vrindavansarthi108@gmail.com', this.margin, 23, { size: 7, color: EXECUTIVE_COLORS.muted });
    this.text('Page 1 of 1', this.width - this.margin - 40, 28, { size: 7, font: 'F2', color: EXECUTIVE_COLORS.muted });

    return this.buildOutput(logoData);
  }

  buildOutput(logo) {
    const stream = this.ops.join('\\n');
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
        header: \`<< /Type /XObject /Subtype /Image /Width \${logo.width} /Height \${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length \${logo.data.length} >>\`,
      });
    }

    const annotsStr = this.annotations.map((a) =>
      \`<< /Type /Annot /Subtype /Link /Rect [\${a.x1.toFixed(2)} \${a.y1.toFixed(2)} \${a.x2.toFixed(2)} \${a.y2.toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (\${escapePdfText(a.url)}) >> >>\`
    ).join(' ');

    const annotsDict = annotsStr ? \`/Annots [ \${annotsStr} ] \` : '';
    const xObjects = logoObjectNo ? \`/XObject << /Logo \${logoObjectNo} 0 R >> \` : '';

    const pageNo = objects.length + 1;
    const contentNo = pageNo + 1;
    objects.push(\`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 \${this.width} \${this.height}] \${annotsDict}/Resources << /Font << /F1 3 0 R /F2 4 0 R >> \${xObjects}>> /Contents \${contentNo} 0 R >>\`);
    objects.push(\`<< /Length \${Buffer.byteLength(stream, 'utf8')} >>\\nstream\\n\${stream}\\nendstream\`);

    objects[1] = \`<< /Type /Pages /Kids [\${pageNo} 0 R] /Count 1 >>\`;

    const chunks = [Buffer.from('%PDF-1.4\\n', 'utf8')];
    const byteLength = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const offsets = [0];
    objects.forEach((obj, i) => {
      offsets.push(byteLength());
      chunks.push(Buffer.from(\`\${i + 1} 0 obj\\n\`, 'utf8'));
      if (obj && typeof obj === 'object' && obj.binary) {
        chunks.push(Buffer.from(\`\${obj.header}\\nstream\\n\`, 'utf8'));
        chunks.push(obj.data);
        chunks.push(Buffer.from('\\nendstream\\n', 'utf8'));
      } else {
        chunks.push(Buffer.from(String(obj), 'utf8'));
        chunks.push(Buffer.from('\\n', 'utf8'));
      }
      chunks.push(Buffer.from('endobj\\n', 'utf8'));
    });
    const xrefStart = byteLength();
    chunks.push(Buffer.from(\`xref\\n0 \${objects.length + 1}\\n0000000000 65535 f \\n\`, 'utf8'));
    for (let i = 1; i < offsets.length; i += 1) {
      chunks.push(Buffer.from(\`\${String(offsets[i]).padStart(10, '0')} 00000 n \\n\`, 'utf8'));
    }
    chunks.push(Buffer.from(\`trailer\\n<< /Size \${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n\${xrefStart}\\n%%EOF\\n\`, 'utf8'));
    return Buffer.concat(chunks);
  }
}

const buildBookingReceiptPdf = (booking) => {
  const builder = new ExecutivePdfBuilder();
  return builder.render(booking);
};

module.exports = { buildPdf, buildBookingReceiptPdf };
`;

// Replace the old export line
const oldExport = /module\.exports\s*=\s*\{\s*buildPdf\s*\};?\s*$/;
if (oldExport.test(content)) {
  content = content.replace(oldExport, codeToAppend.trim() + '\n');
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Successfully updated backend/utils/invoicePdf.js!');
} else {
  console.error('Could not find module.exports = { buildPdf }; in invoicePdf.js');
  process.exit(1);
}
