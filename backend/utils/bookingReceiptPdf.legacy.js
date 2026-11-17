const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const PAGE = { width: 595.28, height: 841.89, margin: 32 };

const COLORS = {
  primaryGreen: [20, 83, 45],       // #14532d deep forest green
  subGreen: [22, 101, 52],          // #166534
  accentGold: [194, 137, 20],       // #c28914 warm golden
  goldLight: [254, 243, 199],       // #fef3c7 light amber/gold
  goldBorder: [253, 230, 138],      // #fde68a
  crimson: [153, 27, 27],           // #991b1b deep crimson red
  headerPink: [254, 226, 226],      // #fee2e2 light pink/red header
  pinkBorder: [254, 205, 211],      // #fecdd3
  navyDark: [15, 23, 42],           // #0f172a
  navy: [30, 41, 59],               // #1e293b
  muted: [100, 116, 139],           // #64748b
  lightMuted: [148, 163, 184],      // #94a3b8
  border: [226, 232, 240],          // #e2e8f0
  white: [255, 255, 255],
  ivoryBg: [254, 253, 250],         // #fefdfa warm ivory
  greenSuccess: [22, 128, 61],      // #16803d
  greenBg: [240, 253, 244],         // #f0fdf4
  greenBorder: [187, 247, 208],     // #bbf7d0
  redBg: [255, 241, 242],           // #fff1f2
  redBorder: [254, 205, 211],       // #fecdd3
  blueHeader: [239, 246, 255],      // #eff6ff
  blueText: [29, 78, 216],          // #1d4ed8
  amberHeader: [254, 243, 199],     // #fef3c7
  amberText: [146, 64, 14],         // #92400e
  disclaimerBg: [248, 250, 252],    // #f8fafc
  slateBlue: [51, 65, 85],          // #334155
};

const clean = (val) => String(val || '').replace(/\s+/g, ' ').trim();
const money = (val) => `INR ${Number(val || 0).toLocaleString('en-IN')}`;

const formatIstDateTime = (val) => {
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
};

const formatIstDateTimeShort = (val) => {
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
};

const formatIstDateWithDay = (val) => {
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
};

const formatTimeString12 = (val, fallback = '12:00 PM') => {
  if (!val) return fallback;
  const s = String(val).trim();
  if (/\b(am|pm)\b/i.test(s)) {
    return s.toUpperCase().replace(/\s*(AM|PM)/, ' $1');
  }
  const match = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    if (hours >= 0 && hours < 24) {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      const hoursStr = String(hours).padStart(2, '0');
      return `${hoursStr}:${mins} ${period}`;
    }
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  } catch {}
  return s;
};

function resolvePaymentModeLabel(b) {
  const isDharamshala =
    b.service_billing_model === 'dharamshala_booking' ||
    String(b.propertyType || '').toLowerCase() === 'dharamshala' ||
    b.bookingType === 'dharamshala';

  const total = Number(b.totalAmount || 0);
  const paid = Number(b.amountPaidOnline ?? b.advanceAmount ?? 0);
  const balance = Number(b.amountPayableAtProperty ?? b.balanceAmount ?? Math.max(0, total - paid));
  const isCab = b.bookingType === 'cab';

  if (balance > 0) {
    if (isDharamshala) {
      return 'Platform Fee Paid Online; Balance Due at Property';
    }
    if (isCab) {
      return 'Advance Paid Online — Balance Payable to Driver';
    }
    if (b.paymentOption === 'advance_30') {
      return '30% Advance Paid Online — 70% Balance at Check-in';
    }
    return 'Advance Paid Online — Balance Payable at Property';
  }

  if (total > 0 && paid >= total) {
    if (b.paymentMethod === 'cash' || b.paymentMode === 'cash') {
      return 'Paid in Full (Cash / Direct)';
    }
    return 'Full Online Payment';
  }

  return b.paymentMethod === 'online' ? 'Online Payment' : 'Pay at Property';
}

function escapePdf(str) {
  return String(str || '')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/•/g, '|')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function textWidth(str, size = 9, font = 'F1') {
  const factor = font === 'F2' ? 0.58 : 0.52;
  return clean(str).length * size * factor;
}

function wrapText(str, maxWidth, size = 9, font = 'F1') {
  const words = clean(str).split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (textWidth(candidate, size, font) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function rgb(c) {
  return `${(c[0] / 255).toFixed(3)} ${(c[1] / 255).toFixed(3)} ${(c[2] / 255).toFixed(3)}`;
}

class ReferenceMatchedPdfBuilder {
  constructor() {
    this.width = PAGE.width;
    this.height = PAGE.height;
    this.margin = PAGE.margin;
    this.pages = [[], []]; // Page 1 and Page 2
    this.pageAnnotations = [[], []];
    this.currentPage = 1;
  }

  setPage(pageNo) {
    this.currentPage = pageNo;
    while (this.pages.length < pageNo) {
      this.pages.push([]);
      this.pageAnnotations.push([]);
    }
  }

  get currentOps() {
    return this.pages[this.currentPage - 1];
  }

  rect(x, y, w, h, fill = null, stroke = null, lineWidth = 1) {
    if (fill) {
      this.currentOps.push(`${rgb(fill)} rg`);
      this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    }
    if (stroke) {
      this.currentOps.push(`${rgb(stroke)} RG`);
      this.currentOps.push(`${lineWidth} w`);
      this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    }
  }

  roundedRect(x, y, w, h, r = 3, fill = null, stroke = null, lineWidth = 1) {
    const k = 0.5522847498;
    const ox = r * k;
    const oy = r * k;
    const xe = x + w;
    const ye = y + h;
    const xm = x + r;
    const ym = y + r;
    const xem = xe - r;
    const yem = ye - r;

    const pathOps = [
      `${xm.toFixed(2)} ${y.toFixed(2)} m`,
      `${xem.toFixed(2)} ${y.toFixed(2)} l`,
      `${(xe - ox).toFixed(2)} ${y.toFixed(2)} ${xe.toFixed(2)} ${(y + oy).toFixed(2)} ${xe.toFixed(2)} ${ym.toFixed(2)} c`,
      `${xe.toFixed(2)} ${yem.toFixed(2)} l`,
      `${xe.toFixed(2)} ${(ye - oy).toFixed(2)} ${(xe - ox).toFixed(2)} ${ye.toFixed(2)} ${xem.toFixed(2)} ${ye.toFixed(2)} c`,
      `${xm.toFixed(2)} ${ye.toFixed(2)} l`,
      `${(x + ox).toFixed(2)} ${ye.toFixed(2)} ${x.toFixed(2)} ${(ye - oy).toFixed(2)} ${x.toFixed(2)} ${yem.toFixed(2)} c`,
      `${x.toFixed(2)} ${ym.toFixed(2)} l`,
      `${x.toFixed(2)} ${(y + oy).toFixed(2)} ${(x + ox).toFixed(2)} ${y.toFixed(2)} ${xm.toFixed(2)} ${y.toFixed(2)} c`,
      'h',
    ];

    if (fill && stroke) {
      this.currentOps.push(`${rgb(fill)} rg`);
      this.currentOps.push(`${rgb(stroke)} RG`);
      this.currentOps.push(`${lineWidth} w`);
      this.currentOps.push(pathOps.join(' ') + ' B');
    } else if (fill) {
      this.currentOps.push(`${rgb(fill)} rg`);
      this.currentOps.push(pathOps.join(' ') + ' f');
    } else if (stroke) {
      this.currentOps.push(`${rgb(stroke)} RG`);
      this.currentOps.push(`${lineWidth} w`);
      this.currentOps.push(pathOps.join(' ') + ' S');
    }
  }

  circle(cx, cy, r, fill = null, stroke = null, lineWidth = 1) {
    const k = 0.5522847498;
    const ox = r * k;
    const oy = r * k;
    const pathOps = [
      `${(cx - r).toFixed(2)} ${cy.toFixed(2)} m`,
      `${(cx - r).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx - ox).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`,
      `${(cx + ox).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`,
      `${(cx + r).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx + ox).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`,
      `${(cx - ox).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`,
      'h',
    ];
    if (fill && stroke) {
      this.currentOps.push(`${rgb(fill)} rg`);
      this.currentOps.push(`${rgb(stroke)} RG`);
      this.currentOps.push(`${lineWidth} w`);
      this.currentOps.push(pathOps.join(' ') + ' B');
    } else if (fill) {
      this.currentOps.push(`${rgb(fill)} rg`);
      this.currentOps.push(pathOps.join(' ') + ' f');
    } else if (stroke) {
      this.currentOps.push(`${rgb(stroke)} RG`);
      this.currentOps.push(`${lineWidth} w`);
      this.currentOps.push(pathOps.join(' ') + ' S');
    }
  }

  line(x1, y1, x2, y2, color = COLORS.border, width = 1) {
    this.currentOps.push(`${rgb(color)} RG`);
    this.currentOps.push(`${width} w`);
    this.currentOps.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  text(val, x, y, { size = 9, font = 'F1', color = COLORS.navy } = {}) {
    this.currentOps.push('BT');
    this.currentOps.push(`/${font} ${size} Tf`);
    this.currentOps.push(`${rgb(color)} rg`);
    this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    this.currentOps.push(`(${escapePdf(clean(val))}) Tj`);
    this.currentOps.push('ET');
  }

  link(textVal, url, x, y, { size = 9, font = 'F2', color = COLORS.crimson, box = null } = {}) {
    this.text(textVal, x, y, { size, font, color });
    if (url) {
      const clickBox = box || {
        x1: x,
        y1: y - 2,
        x2: x + textWidth(textVal, size, font),
        y2: y + size + 2,
      };
      this.pageAnnotations[this.currentPage - 1].push({
        x1: clickBox.x1,
        y1: clickBox.y1,
        x2: clickBox.x2,
        y2: clickBox.y2,
        url: url.trim(),
      });
    }
  }

  wrapped(val, x, y, maxWidth, { size = 9, font = 'F1', color = COLORS.navy, lineHeight = 12 } = {}) {
    const lines = wrapText(val, maxWidth, size, font);
    lines.forEach((l, idx) => {
      this.text(l, x, y - idx * lineHeight, { size, font, color });
    });
    return lines.length * lineHeight;
  }

  badge(textVal, x, y, { bg = COLORS.goldLight, border = COLORS.goldBorder, textCol = COLORS.amberText, size = 8, font = 'F2', padX = 6, padY = 2.5 } = {}) {
    const str = clean(textVal);
    const tw = textWidth(str, size, font);
    const bw = tw + padX * 2;
    const bh = size + padY * 2;
    this.roundedRect(x, y - padY, bw, bh, 3, bg, border, 0.7);
    this.text(str, x + padX, y + 0.5, { size, font, color: textCol });
    return bw;
  }

  drawCheckmark(cx, cy, r, color = COLORS.white) {
    this.currentOps.push(`${rgb(color)} RG`);
    this.currentOps.push('1.5 w');
    this.currentOps.push(`${(cx - r * 0.45).toFixed(2)} ${cy.toFixed(2)} m ${(cx - r * 0.1).toFixed(2)} ${(cy - r * 0.35).toFixed(2)} l ${(cx + r * 0.5).toFixed(2)} ${(cy + r * 0.4).toFixed(2)} l S`);
  }

  drawBedIcon(x, y, size = 10, color = COLORS.crimson) {
    this.currentOps.push(`${rgb(color)} RG`);
    this.currentOps.push('1 w');
    this.currentOps.push(`${x} ${y} m ${x} ${y + size} l S`);
    this.currentOps.push(`${x + size * 1.3} ${y} m ${x + size * 1.3} ${y + size * 0.7} l S`);
    this.currentOps.push(`${x} ${y + size * 0.35} m ${x + size * 1.3} ${y + size * 0.35} l S`);
    this.rect(x + size * 0.2, y + size * 0.45, size * 0.35, size * 0.3, color);
  }

  drawRupeeIcon(x, y, size = 10, color = COLORS.crimson) {
    this.text('Rs.', x, y, { size: size * 0.85, font: 'F2', color });
  }

  drawPinIcon(x, y, size = 8, color = COLORS.crimson) {
    this.circle(x + size * 0.5, y + size * 0.6, size * 0.4, color);
    this.currentOps.push(`${rgb(color)} RG`);
    this.currentOps.push('1 w');
    this.currentOps.push(`${x + size * 0.2} ${y + size * 0.5} m ${x + size * 0.5} ${y} l ${x + size * 0.8} ${y + size * 0.5} l S`);
    this.circle(x + size * 0.5, y + size * 0.6, size * 0.15, COLORS.white);
  }

  drawCalendarIcon(x, y, size = 10, color = COLORS.muted) {
    this.roundedRect(x, y, size, size * 0.9, 1.5, null, color, 0.8);
    this.line(x, y + size * 0.65, x + size, y + size * 0.65, color, 0.8);
    this.line(x + size * 0.25, y + size * 0.85, x + size * 0.25, y + size * 1.05, color, 1);
    this.line(x + size * 0.75, y + size * 0.85, x + size * 0.75, y + size * 1.05, color, 1);
  }

  drawUserIcon(x, y, size = 10, color = COLORS.crimson) {
    this.circle(x + size * 0.5, y + size * 0.7, size * 0.25, color);
    this.currentOps.push(`${rgb(color)} rg`);
    this.currentOps.push(`${(x + size * 0.1).toFixed(2)} ${y.toFixed(2)} m ${(x + size * 0.2).toFixed(2)} ${(y + size * 0.4).toFixed(2)} l ${(x + size * 0.8).toFixed(2)} ${(y + size * 0.4).toFixed(2)} l ${(x + size * 0.9).toFixed(2)} ${y.toFixed(2)} l f`);
  }

  drawPhoneIcon(x, y, size = 9, color = COLORS.crimson) {
    this.roundedRect(x, y, size * 0.7, size, 1.5, null, color, 0.8);
    this.line(x + size * 0.2, y + size * 0.85, x + size * 0.5, y + size * 0.85, color, 0.8);
    this.circle(x + size * 0.35, y + size * 0.18, size * 0.08, color);
  }

  drawPeacockFeather(x, y, scale = 0.6, angle = 0) {
    this.currentOps.push('q');
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    this.currentOps.push(`${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} ${x.toFixed(2)} ${y.toFixed(2)} cm`);
    this.currentOps.push(`${scale.toFixed(4)} 0 0 ${scale.toFixed(4)} 0 0 cm`);
    this.currentOps.push('0.1 0.4 0.2 RG 1.5 w 0 0 m 10 30 20 60 25 90 c S');
    this.circle(25, 90, 16, [194, 137, 20]);
    this.circle(25, 90, 11, [20, 83, 45]);
    this.circle(25, 90, 6, [29, 78, 216]);
    this.circle(25, 90, 2.5, [15, 23, 42]);
    this.currentOps.push('Q');
  }

  drawQrCode(textVal, x, y, size = 56) {
    try {
      const qr = QRCode.create(textVal, { errorCorrectionLevel: 'M' });
      const modules = qr.modules.data;
      const count = qr.modules.size;
      const cellSize = size / count;

      this.currentOps.push(`${rgb(COLORS.white)} rg`);
      this.currentOps.push(`${x.toFixed(2)} ${y.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)} re f`);
      this.currentOps.push(`${rgb(COLORS.navyDark)} rg`);

      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (modules[r * count + c]) {
            const cellX = x + c * cellSize;
            const cellY = y + (count - 1 - r) * cellSize;
            this.currentOps.push(`${cellX.toFixed(2)} ${cellY.toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f`);
          }
        }
      }
    } catch (err) {
      this.rect(x, y, size, size, COLORS.border);
      this.text('QR Error', x + 4, y + size / 2, { size: 7, color: COLORS.muted });
    }
  }

  generate(booking) {
    const logoData = this.loadLogo();
    const isDharamshala =
      booking.service_billing_model === 'dharamshala_booking' ||
      String(booking.propertyType || '').toLowerCase() === 'dharamshala' ||
      booking.bookingType === 'dharamshala';
    const isCab = booking.bookingType === 'cab';
    const isTour = booking.bookingType === 'tour';

    // =========================================================================
    // PAGE 1: THE BOOKING CONFIRMATION & PAYMENT VOUCHER
    // =========================================================================
    this.setPage(1);

    // Warm ivory background
    this.rect(0, 0, this.width, this.height, COLORS.ivoryBg);

    // 1. BRAND HEADER (y = 745 to 815, Height = 70 pt)
    const logoSize = 56;
    const logoX = this.margin;
    const logoY = 752;

    if (logoData) {
      this.currentOps.push('q');
      this.currentOps.push(`${logoSize.toFixed(2)} 0 0 ${logoSize.toFixed(2)} ${logoX.toFixed(2)} ${logoY.toFixed(2)} cm`);
      this.currentOps.push('/Logo Do');
      this.currentOps.push('Q');
      this.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 1, null, COLORS.accentGold, 1.2);
    } else {
      this.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, COLORS.primaryGreen);
      this.text('VS', logoX + 18, logoY + 20, { size: 18, font: 'F2', color: COLORS.white });
    }

    // Center: Brand & Identity
    const textStartX = logoX + logoSize + 14;
    this.text('Vrindavan Sarthi Enterprises', textStartX, 796, { size: 16.5, font: 'F2', color: COLORS.primaryGreen });
    this.text('VRINDAVAN SARTHI | DIRECT DEVOTEE FACILITATION DESK', textStartX, 782, { size: 8.5, font: 'F2', color: COLORS.subGreen });
    
    // Decorative gold flourish divider
    this.line(textStartX, 774, textStartX + 190, 774, COLORS.accentGold, 0.8);
    this.circle(textStartX + 95, 774, 2.5, COLORS.accentGold);

    // Devotee Tagline in warm amber
    this.text('Your True Companion On The Journey', textStartX + 18, 761, { size: 9.5, font: 'F2', color: [146, 64, 14] });

    // Right: Receipt metadata & Voucher Pill
    const rightMargin = this.width - this.margin;
    let docTitle1 = 'BOOKING CONFIRMATION &';
    let docTitle2 = 'PAYMENT RECEIPT';
    if (isCab) {
      docTitle1 = 'CAB BOOKING CONFIRMATION';
      docTitle2 = '& PAYMENT RECEIPT';
    } else if (isTour) {
      docTitle1 = 'PILGRIMAGE TOUR CONFIRMATION';
      docTitle2 = '& PAYMENT RECEIPT';
    }
    this.text(docTitle1, rightMargin - textWidth(docTitle1, 10.5, 'F2'), 800, { size: 10.5, font: 'F2', color: COLORS.navy });
    this.text(docTitle2, rightMargin - textWidth(docTitle2, 10.5, 'F2'), 788, { size: 10.5, font: 'F2', color: COLORS.navy });

    const genDateStr = `Generated: ${formatIstDateTimeShort(new Date())}`;
    this.text(genDateStr, rightMargin - textWidth(genDateStr, 7.5), 775, { size: 7.5, color: COLORS.muted });

    // Booking Voucher Pill
    const voucherText = 'Booking Voucher - Present at Check-in';
    const vw = textWidth(voucherText, 8.5, 'F2') + 20;
    const vx = rightMargin - vw;
    this.roundedRect(vx, 754, vw, 17, 4, COLORS.goldLight, COLORS.goldBorder, 0.8);
    this.text(voucherText, vx + 10, 759, { size: 8.5, font: 'F2', color: COLORS.amberText });

    // 2. HORIZONTAL STATUS & VERIFICATION BAR (y = 668 down to 738, Height = 70 pt)
    const barY = 668;
    const barH = 70;
    this.roundedRect(this.margin, barY, this.width - this.margin * 2, barH, 4, COLORS.white, COLORS.border, 1);

    // Left segment: Reservation Confirmed (badge & subtext)
    this.roundedRect(this.margin + 6, barY + 36, 120, 22, 11, COLORS.greenBg, COLORS.greenBorder, 1);
    this.drawCheckmark(this.margin + 17, barY + 47, 5, COLORS.greenSuccess);
    this.text('RESERVATION CONFIRMED', this.margin + 26, barY + 43.5, { size: 7.5, font: 'F2', color: COLORS.greenSuccess });
    this.text('Room Reserved & Guaranteed', this.margin + 10, barY + 20, { size: 7.8, font: 'F1', color: COLORS.slateBlue });

    // Vertical divider 1 (x = 162 pt)
    this.line(this.margin + 130, barY + 8, this.margin + 130, barY + barH - 8, COLORS.border, 0.8);

    // Booking Reference (x = 170 to 292 pt, strictly inside column)
    const refX = this.margin + 138;
    this.drawCalendarIcon(refX, barY + 45, 9, COLORS.muted);
    this.text('BOOKING REFERENCE', refX + 14, barY + 47, { size: 7.8, font: 'F2', color: COLORS.muted });
    this.text(booking.bookingId || String(booking._id), refX, barY + 28, { size: 9.5, font: 'F2', color: COLORS.navyDark });

    // Vertical divider 2 (x = 302 pt, generous buffer before Booked On)
    this.line(this.margin + 270, barY + 8, this.margin + 270, barY + barH - 8, COLORS.border, 0.8);

    // Booked On (x = 310 to 416 pt)
    const bookedOnX = this.margin + 278;
    this.drawCalendarIcon(bookedOnX, barY + 45, 9, COLORS.muted);
    this.text('BOOKED ON', bookedOnX + 14, barY + 47, { size: 7.8, font: 'F2', color: COLORS.muted });
    this.text(formatIstDateTimeShort(booking.createdAt), bookedOnX, barY + 28, { size: 7.8, font: 'F1', color: COLORS.navy });

    // Vertical divider 3 (x = 424 pt, dedicates 139 pt for QR verification)
    this.line(this.margin + 392, barY + 8, this.margin + 392, barY + barH - 8, COLORS.border, 0.8);

    // Right segment: Offline Vector QR Code & Interactive Verification
    const qrSize = 40;
    const qrX = this.margin + 400;
    const qrY = barY + 15;
    const verifyUrl = `https://www.vrindavansarthi.in/verify-booking?ref=${encodeURIComponent(booking.bookingId || '')}`;
    this.drawQrCode(verifyUrl, qrX, qrY, qrSize);
    this.pageAnnotations[this.currentPage - 1].push({
      x1: qrX,
      y1: qrY,
      x2: qrX + qrSize,
      y2: qrY + qrSize,
      url: verifyUrl,
    });
    this.text('Scan with camera to verify authenticity', qrX - 4, barY + 3.5, { size: 5.5, font: 'F1', color: COLORS.muted });
    
    // QR labels safely contained within right margin (qrTextX = 478, right edge = 559.4 pt < 563.28 pt)
    const qrTextX = qrX + qrSize + 6;
    this.text('Scan to Verify', qrTextX, barY + 46, { size: 7.8, font: 'F2', color: COLORS.slateBlue });
    this.text('Booking Voucher', qrTextX, barY + 34, { size: 7.0, font: 'F1', color: COLORS.muted });
    this.text(`Ref: ${booking.bookingId || ''}`, qrTextX, barY + 22, { size: 5.2, font: 'F2', color: COLORS.navy });

    // 3. MAIN 2-COLUMN SECTION (y = 402 down to 656, Height = 254 pt)
    const colLeftW = 270;
    const colRightW = this.width - this.margin * 2 - colLeftW - 12; // 249.28 pt
    const colRightX = this.margin + colLeftW + 12;
    const mainY = 402;
    const mainH = 254;

    // --- LEFT COLUMN: ACCOMMODATION & STAY DETAILS ---
    this.roundedRect(this.margin, mainY, colLeftW, mainH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with Bed Icon
    this.roundedRect(this.margin, mainY + mainH - 24, colLeftW, 24, 4, COLORS.headerPink);
    this.rect(this.margin, mainY + mainH - 24, colLeftW, 6, COLORS.headerPink);
    this.line(this.margin, mainY + mainH - 24, this.margin + colLeftW, mainY + mainH - 24, COLORS.pinkBorder, 0.8);
    
    const bannerTitle = isCab ? 'VEHICLE & JOURNEY DETAILS' : isTour ? 'PILGRIMAGE TOUR DETAILS' : 'ACCOMMODATION & STAY DETAILS';
    this.drawBedIcon(this.margin + 10, mainY + mainH - 18, 10, COLORS.crimson);
    this.text(bannerTitle, this.margin + 28, mainY + mainH - 16, { size: 9, font: 'F2', color: COLORS.crimson });

    if (!isCab && !isTour) {
      // Lodging details: Property Name in prominent bold
      const propName = booking.propertyName || String(booking.itemName || '').split(' - ')[0] || booking.partnerName || 'Property';
      this.text(propName, this.margin + 12, mainY + mainH - 44, { size: 14.5, font: 'F2', color: COLORS.navyDark });
      
      // Property ID badge (derived from persisted records)
      if (booking.propertyCode || booking.hotelId) {
        const propIdText = `Property ID: ${booking.propertyCode || `VVS-P-${String(booking.hotelId).slice(-4).toUpperCase()}`}`;
        this.badge(propIdText, this.margin + 12, mainY + mainH - 62, {
          bg: COLORS.goldLight,
          border: COLORS.goldBorder,
          textCol: COLORS.amberText,
          size: 7.8,
          font: 'F2',
          padX: 6,
          padY: 2.5,
        });
      }

      // Room Type & Room badge
      const roomName = String(booking.itemName || '').includes(' - ') ? String(booking.itemName || '').split(' - ')[1] : String(booking.itemName || 'Standard Room');
      this.text(`Room Type: ${roomName}`, this.margin + 12, mainY + mainH - 82, { size: 9.5, font: 'F2', color: COLORS.navy });
      
      // Room number if assigned in booking
      const roomNum = booking.roomNumber || (booking.roomNumbers && booking.roomNumbers[0]);
      if (roomNum) {
        this.badge(`Room: ${roomNum}`, this.margin + textWidth(`Room Type: ${roomName}`, 9.5, 'F2') + 20, mainY + mainH - 82, {
          bg: COLORS.goldLight,
          border: COLORS.goldBorder,
          textCol: COLORS.amberText,
          size: 7.8,
          font: 'F2',
          padX: 6,
          padY: 2.5,
        });
      }

      // Address with Red Pin
      const propLoc = booking.propertyAddress || booking.propertyLocation || 'Vrindavan';
      this.drawPinIcon(this.margin + 12, mainY + mainH - 104, 8, COLORS.crimson);
      this.wrapped(propLoc, this.margin + 26, mainY + mainH - 103, colLeftW - 38, { size: 8.5, color: COLORS.slateBlue, lineHeight: 11 });

      // Landmark with Red Pin
      if (booking.nearestTemple) {
        this.drawPinIcon(this.margin + 12, mainY + mainH - 128, 8, COLORS.crimson);
        this.text(`Near ${booking.nearestTemple}`, this.margin + 26, mainY + mainH - 127, { size: 8.5, font: 'F1', color: COLORS.slateBlue });
      }

      // Bottom 3-box stay grid (Check-in, Check-out, Duration/Guests)
      const gridBoxY = mainY + 16;
      const gridBoxH = 58;
      const gridBoxW = (colLeftW - 20) / 3;

      // Check-in box
      const b1X = this.margin + 8;
      this.roundedRect(b1X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b1X + 8, gridBoxY + 40, 8, COLORS.muted);
      this.text('CHECK-IN', b1X + 20, gridBoxY + 42, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.checkIn), b1X + 8, gridBoxY + 26, { size: 8.5, font: 'F2', color: COLORS.navyDark });
      this.text(formatTimeString12(booking.checkInTime, '12:00 PM'), b1X + 8, gridBoxY + 12, { size: 8, font: 'F2', color: COLORS.crimson });

      // Check-out box
      const b2X = b1X + gridBoxW + 2;
      this.roundedRect(b2X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b2X + 8, gridBoxY + 40, 8, COLORS.muted);
      this.text('CHECK-OUT', b2X + 20, gridBoxY + 42, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.checkOut), b2X + 8, gridBoxY + 26, { size: 8.5, font: 'F2', color: COLORS.navyDark });
      this.text(formatTimeString12(booking.checkOutTime, '11:00 AM'), b2X + 8, gridBoxY + 12, { size: 8, font: 'F2', color: COLORS.crimson });

      // Duration / Guests box
      const nights = Math.max(1, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))) || 1;
      const guests = booking.guests || ((booking.totalAdults || 1) + (booking.totalChildren || 0));
      const b3X = b2X + gridBoxW + 2;
      this.roundedRect(b3X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawUserIcon(b3X + 8, gridBoxY + 40, 8, COLORS.muted);
      this.text('DURATION/GUESTS', b3X + 20, gridBoxY + 42, { size: 7, font: 'F2', color: COLORS.muted });
      this.text(`${nights} Night${nights > 1 ? 's' : ''}`, b3X + 8, gridBoxY + 26, { size: 8.5, font: 'F2', color: COLORS.navyDark });
      this.text(`${guests} Guest(s)${booking.roomQuantity ? ` (${booking.roomQuantity} Room)` : ''}`, b3X + 8, gridBoxY + 12, { size: 7.5, color: COLORS.muted });
    } else if (isCab) {
      this.text(booking.itemName || 'Dedicated Cab Transfer', this.margin + 12, mainY + mainH - 44, { size: 14, font: 'F2', color: COLORS.navyDark });
      this.text(`Vehicle: ${booking.vehicleType || 'Sedan / SUV AC'}`, this.margin + 12, mainY + mainH - 64, { size: 9.5, font: 'F2', color: COLORS.navy });
      this.drawPinIcon(this.margin + 12, mainY + mainH - 86, 8, COLORS.crimson);
      this.text(`Pickup: ${booking.pickupAddress || 'Requested Location'}`, this.margin + 26, mainY + mainH - 85, { size: 8.5, color: COLORS.slateBlue });
      this.drawPinIcon(this.margin + 12, mainY + mainH - 108, 8, COLORS.crimson);
      this.text(`Drop: ${booking.dropAddress || 'Destination in Braj'}`, this.margin + 26, mainY + mainH - 107, { size: 8.5, color: COLORS.slateBlue });

      // Journey Schedule Box
      const cabDate = formatIstDateWithDay(booking.checkIn || booking.startDate || booking.createdAt);
      const cabTime = formatTimeString12(booking.checkInTime || booking.pickupTime, '06:00 AM');
      const b1X = this.margin + 8;
      const cabBoxW = colLeftW - 16;
      this.roundedRect(b1X, mainY + 16, cabBoxW, 46, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b1X + 8, mainY + 38, 8, COLORS.muted);
      this.text('JOURNEY DATE & PICKUP SCHEDULE', b1X + 20, mainY + 40, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(`${cabDate} at ${cabTime}`, b1X + 8, mainY + 24, { size: 9, font: 'F2', color: COLORS.navyDark });
    } else if (isTour) {
      this.text(booking.packageName || booking.itemName || 'Braj Darshan Pilgrimage Tour', this.margin + 12, mainY + mainH - 44, { size: 14, font: 'F2', color: COLORS.navyDark });
      this.text(`Inclusions: ${booking.inclusions || 'AC Transport, Guided Darshan'}`, this.margin + 12, mainY + mainH - 64, { size: 9, font: 'F2', color: COLORS.navy });
      this.text('Experienced Guide (Darshan Assist)', this.margin + 12, mainY + mainH - 84, { size: 8.5, color: COLORS.slateBlue });

      // Tour Schedule Box
      const tourDate = formatIstDateWithDay(booking.checkIn || booking.startDate || booking.createdAt);
      const b1X = this.margin + 8;
      const tourBoxW = colLeftW - 16;
      this.roundedRect(b1X, mainY + 16, tourBoxW, 46, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b1X + 8, mainY + 38, 8, COLORS.muted);
      this.text('PILGRIMAGE SCHEDULE & DURATION', b1X + 20, mainY + 40, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(`${tourDate} (Full Day Pilgrimage Darshan)`, b1X + 8, mainY + 24, { size: 9, font: 'F2', color: COLORS.navyDark });
    }

    // --- RIGHT COLUMN: PAYMENT BREAKDOWN ---
    this.roundedRect(colRightX, mainY, colRightW, mainH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with Rupee Icon
    this.roundedRect(colRightX, mainY + mainH - 24, colRightW, 24, 4, COLORS.headerPink);
    this.rect(colRightX, mainY + mainH - 24, colRightW, 6, COLORS.headerPink);
    this.line(colRightX, mainY + mainH - 24, colRightX + colRightW, mainY + mainH - 24, COLORS.pinkBorder, 0.8);
    this.drawRupeeIcon(colRightX + 10, mainY + mainH - 18, 10, COLORS.crimson);
    this.text('PAYMENT BREAKDOWN', colRightX + 28, mainY + mainH - 16, { size: 9, font: 'F2', color: COLORS.crimson });

    // Financial values
    const roomTariff = Number(booking.dharamshalaAmount || booking.baseAmount || booking.checkoutSubtotal || 0);
    const fee = Number(booking.vrindavanSarthiServiceFee || booking.convenienceFeeAmount || 0);
    const feeName = isDharamshala ? 'Platform Facilitation Fee' : 'Platform Convenience Fee';
    const tax = Number(booking.taxAmount || 0);
    const hasTax = tax > 0;
    const total = Number(booking.totalAmount || 0);
    const paid = Number(booking.amountPaidOnline ?? booking.advanceAmount ?? 0);
    const balance = Number(booking.amountPayableAtProperty ?? booking.balanceAmount ?? Math.max(0, total - paid));

    // Line 1: Tariff / Base
    const tariffLabel = isDharamshala ? 'Dharamshala Tariff' : isCab ? 'Cab Fare' : isTour ? 'Tour Package Fare' : 'Room Amount';
    const tariffSublabel = isDharamshala ? '(Payable directly to property)' : isCab ? '(Base vehicle transfer fare)' : '(Inclusive of all tour services)';
    this.text(tariffLabel, colRightX + 12, mainY + mainH - 42, { size: 9, font: 'F2', color: COLORS.navyDark });
    this.text(tariffSublabel, colRightX + 12, mainY + mainH - 51, { size: 7, font: 'F1', color: COLORS.muted });
    const tariffStr = money(roomTariff);
    this.text(tariffStr, colRightX + colRightW - 12 - textWidth(tariffStr, 9.5, 'F2'), mainY + mainH - 46, { size: 9.5, font: 'F2', color: COLORS.navyDark });

    // Line 2: Platform Fee
    this.text(feeName, colRightX + 12, mainY + mainH - 64, { size: 9, font: 'F2', color: COLORS.navyDark });
    this.text(`(Paid online to Vrindavan Sarthi)`, colRightX + 12, mainY + mainH - 73, { size: 7, font: 'F1', color: COLORS.muted });
    const feeStr = money(fee);
    this.text(feeStr, colRightX + colRightW - 12 - textWidth(feeStr, 9.5, 'F2'), mainY + mainH - 68, { size: 9.5, font: 'F2', color: COLORS.navyDark });

    // Line 3: Optional Tax (for commercial hotels)
    if (hasTax) {
      this.text('Hotel GST / Taxes', colRightX + 12, mainY + mainH - 84, { size: 9, font: 'F2', color: COLORS.navyDark });
      this.text('(Applicable accommodation tax)', colRightX + 12, mainY + mainH - 93, { size: 7, font: 'F1', color: COLORS.muted });
      const taxStr = money(tax);
      this.text(taxStr, colRightX + colRightW - 12 - textWidth(taxStr, 9.5, 'F2'), mainY + mainH - 88, { size: 9.5, font: 'F2', color: COLORS.navyDark });
    }

    // Box 1: TOTAL BOOKING COST (Cream/Gold) - Highly prominent
    const boxTotY = hasTax ? (mainY + mainH - 124) : (mainY + mainH - 108);
    this.roundedRect(colRightX + 8, boxTotY, colRightW - 16, 26, 4, COLORS.goldLight, COLORS.goldBorder, 1);
    this.text('TOTAL BOOKING COST', colRightX + 16, boxTotY + 8, { size: 9, font: 'F2', color: COLORS.crimson });
    const totStr = money(total);
    this.text(totStr, colRightX + colRightW - 16 - textWidth(totStr, 13, 'F2'), boxTotY + 7, { size: 13, font: 'F2', color: COLORS.crimson });

    // Box 2: Amount Paid Online (Verified) (Green) - Highly prominent
    const boxPaidY = boxTotY - 28;
    this.roundedRect(colRightX + 8, boxPaidY, colRightW - 16, 24, 4, COLORS.greenBg, COLORS.greenBorder, 1);
    this.drawCheckmark(colRightX + 20, boxPaidY + 12, 4.5, COLORS.greenSuccess);
    this.text('Amount Paid Online (Verified)', colRightX + 30, boxPaidY + 7.5, { size: 8.5, font: 'F2', color: COLORS.greenSuccess });
    const paidStr = money(paid);
    this.text(paidStr, colRightX + colRightW - 16 - textWidth(paidStr, 11, 'F2'), boxPaidY + 7, { size: 11, font: 'F2', color: COLORS.greenSuccess });

    // Box 3: Balance Payable at Property (Red) - Highly prominent
    const boxBalY = boxPaidY - 27;
    const isSettled = balance <= 0;
    const balBg = isSettled ? COLORS.greenBg : COLORS.redBg;
    const balBorder = isSettled ? COLORS.greenBorder : COLORS.redBorder;
    const balColor = isSettled ? COLORS.greenSuccess : COLORS.crimson;
    const balLabel = isSettled ? 'Balance Settled' : (isCab ? 'Payable to Driver' : 'Balance Payable at Property');
    this.roundedRect(colRightX + 8, boxBalY, colRightW - 16, 24, 4, balBg, balBorder, 1);
    this.text(balLabel, colRightX + 16, boxBalY + 7.5, { size: 8.5, font: 'F2', color: balColor });
    const balStr = money(balance);
    this.text(balStr, colRightX + colRightW - 16 - textWidth(balStr, 11, 'F2'), boxBalY + 7, { size: 11, font: 'F2', color: balColor });

    // Metadata lines below boxes (Generous leading, clear readable typography)
    let payMetaY = boxBalY - 14;
    const metaRowH = 12.5;
    
    // Payment Status
    const statusLabel = isDharamshala && balance > 0
      ? 'Platform Fee Paid - Balance Due'
      : balance > 0
      ? 'Advance Paid - Balance Due'
      : 'Full Payment Verified';
    this.text('Payment Status :', colRightX + 12, payMetaY, { size: 8, font: 'F2', color: COLORS.muted });
    this.text(statusLabel, colRightX + 80, payMetaY, { size: 8, font: 'F2', color: COLORS.navyDark });
    payMetaY -= metaRowH;

    // Payment Mode: Authoritatively derived from persisted fields
    const paymentModeLabel = resolvePaymentModeLabel(booking);
    this.text('Payment Mode   :', colRightX + 12, payMetaY, { size: 8, font: 'F2', color: COLORS.muted });
    let modeLines = [];
    if (paymentModeLabel.includes('; ')) {
      const parts = paymentModeLabel.split('; ');
      modeLines = [parts[0] + ';', parts.slice(1).join('; ')];
    } else if (textWidth(paymentModeLabel, 7.8, 'F2') > colRightW - 88) {
      modeLines = wrapText(paymentModeLabel, colRightW - 88, 7.8, 'F2');
    } else {
      modeLines = [paymentModeLabel];
    }
    modeLines.forEach((l, idx) => {
      this.text(l, colRightX + 80, payMetaY - idx * 10, { size: 7.8, font: 'F2', color: COLORS.navyDark });
    });
    payMetaY -= ((modeLines.length - 1) * 10 + metaRowH);

    // Payment ID
    if (booking.razorpayPaymentId) {
      this.text('Payment ID     :', colRightX + 12, payMetaY, { size: 8, font: 'F2', color: COLORS.muted });
      this.text(booking.razorpayPaymentId, colRightX + 80, payMetaY, { size: 8, font: 'F1', color: COLORS.navyDark });
      payMetaY -= metaRowH;
    }

    // Paid At
    this.text('Paid At        :', colRightX + 12, payMetaY, { size: 8, font: 'F2', color: COLORS.muted });
    this.text(formatIstDateTimeShort(booking.paidAt || booking.createdAt), colRightX + 80, payMetaY, { size: 8, font: 'F1', color: COLORS.navyDark });

    // 4. PRIMARY GUEST DETAILS CARD (y = 292 down to 386, Height = 94 pt)
    const guestY = 292;
    const guestH = 94;
    this.roundedRect(this.margin, guestY, this.width - this.margin * 2, guestH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with User Icon
    this.roundedRect(this.margin, guestY + guestH - 24, this.width - this.margin * 2, 24, 4, COLORS.headerPink);
    this.rect(this.margin, guestY + guestH - 24, this.width - this.margin * 2, 6, COLORS.headerPink);
    this.line(this.margin, guestY + guestH - 24, this.width - this.margin, guestY + guestH - 24, COLORS.pinkBorder, 0.8);
    this.drawUserIcon(this.margin + 12, guestY + guestH - 18, 10, COLORS.crimson);
    this.text('PRIMARY GUEST DETAILS', this.margin + 28, guestY + guestH - 16, { size: 9, font: 'F2', color: COLORS.crimson });

    // Guest ID badge on the right
    const guestSuffix = String(booking.userId || booking.bookingId || '191395').replace(/[^0-9]/g, '').slice(-6) || '191395';
    const guestIdStr = `Guest ID: VVS-G-${guestSuffix}`;
    const gw = textWidth(guestIdStr, 8, 'F2') + 14;
    this.badge(guestIdStr, this.width - this.margin - gw - 10, guestY + guestH - 17, {
      bg: COLORS.goldLight,
      border: COLORS.goldBorder,
      textCol: COLORS.amberText,
      size: 8,
      font: 'F2',
      padX: 6,
      padY: 2.5,
    });

    // Content: 2 spacious rows with 10 pt readable typography
    const gName = booking.customerFullName || booking.userName || 'Guest Devotee';
    const gPhone = booking.customerMobile || booking.userPhone || '—';
    const gEmail = booking.customerEmail || booking.userEmail || '—';
    
    // Row 1: Name, Phone, Email
    this.text('Guest Name   :', this.margin + 14, guestY + 44, { size: 9, font: 'F2', color: COLORS.muted });
    this.text(gName, this.margin + 88, guestY + 44, { size: 10.5, font: 'F2', color: COLORS.navyDark });

    this.text('Mobile Phone :', this.margin + 240, guestY + 44, { size: 9, font: 'F2', color: COLORS.muted });
    this.text(gPhone, this.margin + 316, guestY + 44, { size: 9.5, font: 'F1', color: COLORS.navyDark });

    this.text('Email :', this.margin + 400, guestY + 44, { size: 9, font: 'F2', color: COLORS.muted });
    this.text(gEmail, this.margin + 438, guestY + 44, { size: 9, font: 'F1', color: COLORS.navyDark });

    // Row 2: Location (City, District, State)
    const city = booking.customerCity || 'Vrindavan';
    const dist = booking.customerDistrict || 'Mathura';
    const state = booking.customerState || 'Uttar Pradesh';
    this.text('City         :', this.margin + 14, guestY + 20, { size: 9, font: 'F2', color: COLORS.muted });
    this.text(city, this.margin + 88, guestY + 20, { size: 9.5, font: 'F1', color: COLORS.navyDark });

    this.text('District:', this.margin + 240, guestY + 20, { size: 9, font: 'F2', color: COLORS.muted });
    this.text(dist, this.margin + 290, guestY + 20, { size: 9.5, font: 'F1', color: COLORS.navyDark });

    this.text('State:', this.margin + 400, guestY + 20, { size: 9, font: 'F2', color: COLORS.muted });
    this.text(state, this.margin + 438, guestY + 20, { size: 9.5, font: 'F1', color: COLORS.navyDark });

    // 5. KEY CONTACTS (Left) vs QUICK ACTIONS (Right) (y = 186 down to 280, Height = 94 pt)
    const row5Y = 186;
    const row5H = 94;

    // Left: KEY CONTACTS & ASSISTANCE
    this.roundedRect(this.margin, row5Y, colLeftW, row5H, 4, COLORS.white, COLORS.pinkBorder, 1);
    this.roundedRect(this.margin, row5Y + row5H - 24, colLeftW, 24, 4, COLORS.headerPink);
    this.rect(this.margin, row5Y + row5H - 24, colLeftW, 6, COLORS.headerPink);
    this.line(this.margin, row5Y + row5H - 24, this.margin + colLeftW, row5Y + row5H - 24, COLORS.pinkBorder, 0.8);
    this.drawPhoneIcon(this.margin + 12, row5Y + row5H - 18, 9, COLORS.crimson);
    this.text('KEY CONTACTS & ASSISTANCE', this.margin + 26, row5Y + row5H - 16, { size: 8.5, font: 'F2', color: COLORS.crimson });

    const propPhone = booking.partnerPhone || '9927600017';
    const propNameStr = booking.propertyName || booking.partnerName || 'Property Reception';

    // Property Reception (Row 1 at y = 242)
    this.text('Property Reception :', this.margin + 12, row5Y + 56, { size: 8, font: 'F2', color: COLORS.muted });
    this.text(propNameStr, this.margin + 104, row5Y + 56, { size: 8.5, font: 'F2', color: COLORS.navyDark });

    // Reception Phone (Row 2 at y = 229)
    this.text('Reception Phone    :', this.margin + 12, row5Y + 43, { size: 8, font: 'F2', color: COLORS.muted });
    this.text(`+91 ${propPhone}`, this.margin + 104, row5Y + 43, { size: 9, font: 'F2', color: COLORS.crimson });

    // Subtle divider (y = 220)
    this.line(this.margin + 12, row5Y + 34, this.margin + colLeftW - 12, row5Y + 34, COLORS.border, 0.6);

    // Customer Helpline (Row 3 at y = 208)
    this.text('Customer Helpline  :', this.margin + 12, row5Y + 22, { size: 8, font: 'F2', color: COLORS.muted });
    this.text('+91 86798 20256', this.margin + 104, row5Y + 22, { size: 8.5, font: 'F2', color: COLORS.navyDark });

    // Support email and operating hours (Row 4 at y = 195, 9 pt above bottom border)
    this.text('Helpline Hours     :', this.margin + 12, row5Y + 9, { size: 8, font: 'F2', color: COLORS.muted });
    this.text('9:00 AM - 9:00 PM | support@vrindavansarthi.in', this.margin + 104, row5Y + 9, { size: 7.2, font: 'F1', color: COLORS.slateBlue });

    // Right: QUICK ACTIONS (Two clickable action buttons)
    this.roundedRect(colRightX, row5Y, colRightW, row5H, 4, COLORS.white, COLORS.border, 1);
    this.roundedRect(colRightX, row5Y + row5H - 24, colRightW, 24, 4, COLORS.blueHeader);
    this.rect(colRightX, row5Y + row5H - 24, colRightW, 6, COLORS.blueHeader);
    this.line(colRightX, row5Y + row5H - 24, colRightX + colRightW, row5Y + row5H - 24, COLORS.border, 0.8);
    this.text('QUICK ACTIONS (CLICKABLE)', colRightX + 14, row5Y + row5H - 16, { size: 8.5, font: 'F2', color: COLORS.blueText });

    // Action 1: Get Directions (Google Maps)
    const btnW = (colRightW - 20) / 2;
    const btn1X = colRightX + 7;
    const btnY = row5Y + 12;
    const btnH = 46;
    this.roundedRect(btn1X, btnY, btnW, btnH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
    this.drawPinIcon(btn1X + 8, btnY + 21, 9, COLORS.crimson);
    this.text('Get Directions', btn1X + 22, btnY + 27, { size: 8.5, font: 'F2', color: COLORS.navyDark });
    this.text('( Google Maps )', btn1X + 22, btnY + 14, { size: 7.2, font: 'F1', color: COLORS.muted });
    
    const propLocStr = booking.propertyAddress || booking.propertyLocation || 'Vrindavan';
    const mapLink = booking.googleMapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${propNameStr}, ${propLocStr}, Vrindavan`)}`;
    this.link('Get Directions', mapLink, btn1X + 22, btnY + 27, {
      size: 8.5,
      box: { x1: btn1X, y1: btnY, x2: btn1X + btnW, y2: btnY + btnH },
    });

    // Action 2: WhatsApp Support
    const btn2X = btn1X + btnW + 6;
    this.roundedRect(btn2X, btnY, btnW, btnH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
    this.circle(btn2X + 13, btnY + 23, 8, COLORS.greenSuccess);
    this.text('W', btn2X + 9, btnY + 19, { size: 9, font: 'F2', color: COLORS.white });
    this.text('WhatsApp Support', btn2X + 26, btnY + 27, { size: 8, font: 'F2', color: COLORS.navyDark });
    this.text('+91 86798 20256', btn2X + 26, btnY + 14, { size: 7.5, font: 'F2', color: COLORS.greenSuccess });
    
    const waLink = 'https://wa.me/918679820256?text=Namaste%20Vrindavan%20Sarthi%20Support';
    this.link('WhatsApp Support', waLink, btn2X + 26, btnY + 27, {
      size: 8,
      box: { x1: btn2X, y1: btnY, x2: btn2X + btnW, y2: btnY + btnH },
    });

    // Page 1 Footer (Page number and turn-over notice)
    this.line(this.margin, 168, this.width - this.margin, 168, COLORS.accentGold, 0.8);
    this.circle(this.width / 2, 168, 2.5, COLORS.accentGold);
    
    this.text('Page 1 of 2 | Official Booking Confirmation & Devotee Check-in Voucher', this.margin, 153, { size: 8.5, font: 'F2', color: COLORS.muted });
    this.text('Please turn over to Page 2 for Property Policies, Guest Guidelines, Check-in Procedure & Platform Terms', this.margin, 139, { size: 8, font: 'F1', color: COLORS.slateBlue });
    this.text('24/7 Pilgrimage Helpline: +91 86798 20256  |  support@vrindavansarthi.in  |  www.vrindavansarthi.in', this.margin, 125, { size: 8, font: 'F2', color: COLORS.primaryGreen });

    // Decorative peacock feathers on Page 1
    this.drawPeacockFeather(this.margin - 8, 45, 0.55, 45);
    this.drawPeacockFeather(this.width - this.margin + 8, 45, 0.55, -45);

    // =========================================================================
    // PAGE 2: GUEST INSTRUCTIONS, VERIFIED POLICIES & LEGAL DISCLAIMER
    // =========================================================================
    this.setPage(2);

    // Warm ivory background for Page 2
    this.rect(0, 0, this.width, this.height, COLORS.ivoryBg);

    // Page 2 Header (y = 755 to 815, Height = 60 pt)
    const p2LogoSize = 42;
    const p2LogoX = this.margin;
    const p2LogoY = 760;

    if (logoData) {
      this.currentOps.push('q');
      this.currentOps.push(`${p2LogoSize.toFixed(2)} 0 0 ${p2LogoSize.toFixed(2)} ${p2LogoX.toFixed(2)} ${p2LogoY.toFixed(2)} cm`);
      this.currentOps.push('/Logo Do');
      this.currentOps.push('Q');
      this.circle(p2LogoX + p2LogoSize / 2, p2LogoY + p2LogoSize / 2, p2LogoSize / 2 + 1, null, COLORS.accentGold, 1);
    }

    const p2TextX = p2LogoX + p2LogoSize + 12;
    this.text('Vrindavan Sarthi Enterprises', p2TextX, 792, { size: 14.5, font: 'F2', color: COLORS.primaryGreen });
    this.text('IMPORTANT GUEST INSTRUCTIONS, PROPERTY POLICIES & TERMS', p2TextX, 778, { size: 8.5, font: 'F2', color: COLORS.amberText });
    this.line(p2TextX, 770, p2TextX + 220, 770, COLORS.accentGold, 0.8);
    this.text('Devotee Pilgrimage Guidelines & Reservation Governance', p2TextX, 758, { size: 8, font: 'F1', color: COLORS.muted });

    // Right: Booking Reference Pill
    const p2RefStr = `Booking Ref: ${booking.bookingId || ''}`;
    const p2rw = textWidth(p2RefStr, 8.5, 'F2') + 16;
    this.roundedRect(this.width - this.margin - p2rw, 768, p2rw, 20, 4, COLORS.goldLight, COLORS.goldBorder, 0.8);
    this.text(p2RefStr, this.width - this.margin - p2rw + 8, 774, { size: 8.5, font: 'F2', color: COLORS.amberText });

    // 1. IMPORTANT GUEST INSTRUCTIONS & PROPERTY POLICIES (y = 520 down to 740, Height = 220 pt)
    const polY = 520;
    const polH = 220;
    this.roundedRect(this.margin, polY, this.width - this.margin * 2, polH, 4, COLORS.white, COLORS.goldBorder, 1);
    this.roundedRect(this.margin, polY + polH - 24, this.width - this.margin * 2, 24, 4, COLORS.amberHeader);
    this.rect(this.margin, polY + polH - 24, this.width - this.margin * 2, 6, COLORS.amberHeader);
    this.line(this.margin, polY + polH - 24, this.width - this.margin, polY + polH - 24, COLORS.goldBorder, 0.8);
    this.text('IMPORTANT GUEST INSTRUCTIONS & PROPERTY POLICIES', this.margin + 14, polY + polH - 16, { size: 9.5, font: 'F2', color: COLORS.amberText });

    const balanceNotice = balance > 0
      ? `Outstanding balance of ${money(balance)} is payable directly to ${propNameStr} reception upon arrival via Cash or UPI.`
      : 'Balance Cleared: No further stay charges are due for the reserved dates.';

    const policies = [
      {
        label: 'Mandatory Photo ID',
        text: 'Valid government-issued Photo ID (Aadhaar Card, Passport, Voter ID, or Driving License) is strictly required for every adult devotee upon check-in.'
      },
      {
        label: 'Check-in & Check-out Timing',
        text: `Standard check-in is ${formatTimeString12(booking.checkInTime, '12:00 PM')}; check-out is ${formatTimeString12(booking.checkOutTime, '11:00 AM')}. Early check-in or late check-out is subject to property availability and management discretion.`
      },
      {
        label: 'Balance Collection',
        text: balanceNotice
      },
      {
        label: 'Spiritual Sanctity',
        text: 'To maintain the divine sanctity of the holy Braj Dham, smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited on property premises.'
      },
      {
        label: 'Cancellation & Modification',
        text: 'Cancellations and changes are governed by property policy. The platform facilitation fee is non-refundable once the booking is confirmed.'
      }
    ];

    let polRowY = polY + polH - 42;
    policies.forEach((p) => {
      this.circle(this.margin + 16, polRowY + 4, 3, COLORS.amberText);
      this.text(`${p.label} :`, this.margin + 26, polRowY, { size: 9, font: 'F2', color: COLORS.navyDark });
      this.wrapped(p.text, this.margin + 26, polRowY - 14, this.width - this.margin * 2 - 40, { size: 8.5, font: 'F1', color: COLORS.slateBlue, lineHeight: 11.5 });
      polRowY -= 36;
    });

    // 2. SMOOTH CHECK-IN PROCEDURE (y = 378 down to 506, Height = 128 pt)
    const procY = 378;
    const procH = 128;
    this.roundedRect(this.margin, procY, this.width - this.margin * 2, procH, 4, COLORS.white, COLORS.greenBorder, 1);
    this.roundedRect(this.margin, procY + procH - 24, this.width - this.margin * 2, 24, 4, COLORS.greenBg);
    this.rect(this.margin, procY + procH - 24, this.width - this.margin * 2, 6, COLORS.greenBg);
    this.line(this.margin, procY + procH - 24, this.width - this.margin, procY + procH - 24, COLORS.greenBorder, 0.8);
    this.drawCheckmark(this.margin + 16, procY + procH - 12, 5, COLORS.greenSuccess);
    this.text('VERIFICATION & SMOOTH CHECK-IN PROCEDURE', this.margin + 28, procY + procH - 16, { size: 9.5, font: 'F2', color: COLORS.greenSuccess });

    const steps = [
      'Step 1: Present this printed voucher or digital PDF confirmation receipt at property reception upon arrival.',
      `Step 2: Reception staff will verify Booking Reference (${booking.bookingId || ''}) or scan the vector QR code with any mobile camera.`,
      `Step 3: Present your original Government Photo ID and settle the balance of ${money(balance)} directly at reception.`,
      `Step 4: For any assistance, direction help, or check-in delay, contact property reception (+91 ${propPhone}) or Vrindavan Sarthi (+91 86798 20256).`,
    ];

    let stepY = procY + procH - 42;
    steps.forEach((st) => {
      this.circle(this.margin + 16, stepY + 3.5, 2.5, COLORS.greenSuccess);
      this.wrapped(st, this.margin + 26, stepY, this.width - this.margin * 2 - 40, { size: 8.5, font: 'F1', color: COLORS.navyDark, lineHeight: 11 });
      stepY -= 22;
    });

    // 3. LEGAL & PLATFORM DISCLAIMER (y = 250 down to 365, Height = 115 pt)
    const discY = 250;
    const discH = 115;
    this.roundedRect(this.margin, discY, this.width - this.margin * 2, discH, 4, COLORS.disclaimerBg, COLORS.border, 0.8);
    this.text('LEGAL & PLATFORM FACILITATION DISCLAIMER', this.margin + 14, discY + discH - 16, { size: 9, font: 'F2', color: COLORS.navy });
    const disclaimerText = 'Vrindavan Sarthi acts only as an online booking and payment technology facilitation platform connecting devotees with independent dharamshalas, ashrams, hotels, and travel service providers. Accommodation and hospitality services are rendered solely and directly by the property partner. The property partner is solely responsible for issuing the official tax invoice for accommodation and for compliance with applicable GST and local regulations. Please present this confirmation receipt at reception.';
    this.wrapped(disclaimerText, this.margin + 14, discY + discH - 32, this.width - this.margin * 2 - 28, { size: 8.5, font: 'F1', color: COLORS.muted, lineHeight: 12.5 });

    // 4. DECORATIVE BRAND FOOTER (y = 50 down to 235)
    this.line(this.margin, 235, this.width - this.margin, 235, COLORS.accentGold, 0.8);
    this.circle(this.width / 2, 235, 2.5, COLORS.accentGold);

    // Subtle peacock feather in bottom-left and bottom-right
    this.drawPeacockFeather(this.margin - 8, 90, 0.55, 45);
    this.drawPeacockFeather(this.width - this.margin + 8, 90, 0.55, -45);

    // Left footer: Brand Identity (strictly contained within x = 32 to 148 pt)
    this.text('Vrindavan Sarthi', this.margin, 220, { size: 12, font: 'F2', color: COLORS.crimson });
    this.text('Enterprises', this.margin, 208, { size: 10.5, font: 'F2', color: COLORS.crimson });
    this.text('(Direct Devotee Desk)', this.margin, 196, { size: 7.8, font: 'F1', color: COLORS.muted });
    this.text('Govardhan & Vrindavan', this.margin, 184, { size: 7.2, font: 'F1', color: COLORS.lightMuted });

    // Center footer: Registered Office & Digital Portals (x = 168 to 425 pt)
    const footMidX = 168;
    this.drawPinIcon(footMidX, 218, 7, COLORS.crimson);
    this.text('Raja Wala Mandir, In front of Giriraj Ji Maharaj,', footMidX + 12, 220, { size: 8.0, font: 'F1', color: COLORS.slateBlue });
    this.text('Govardhan, Mathura, Uttar Pradesh 281502', footMidX + 12, 208, { size: 8.0, font: 'F1', color: COLORS.slateBlue });

    this.text('support@vrindavansarthi.in  |  help@vrindavansarthi.in', footMidX + 12, 195, { size: 8.0, font: 'F2', color: COLORS.crimson });
    this.text('www.vrindavansarthi.in  |  www.vrindavansarthi.com', footMidX + 12, 182, { size: 8.0, font: 'F1', color: COLORS.slateBlue });

    // Right footer: Social / Follow Us (x = 460 to 556 pt)
    const footRightX = 460;
    this.text('Follow Us', footRightX, 220, { size: 8.5, font: 'F2', color: COLORS.navy });
    this.text('@VrindavanSarthi', footRightX, 208, { size: 8.5, font: 'F2', color: COLORS.crimson });
    this.text('Direct Pilgrimage Support', footRightX, 195, { size: 7.2, font: 'F1', color: COLORS.muted });
    this.text('Braj Dham Facilitation', footRightX, 182, { size: 7.0, font: 'F1', color: COLORS.lightMuted });

    // Page 2 bottom indicator
    this.text('Page 2 of 2 | Vrindavan Sarthi Enterprises | All Rights Reserved', this.margin, 158, { size: 8, font: 'F1', color: COLORS.lightMuted });

    return this.buildOutput(logoData);
  }

  loadLogo() {
    try {
      const p1 = path.resolve(__dirname, 'assets/vrindavan_sarthi_official_logo.jpg');
      if (fs.existsSync(p1)) {
        const data = fs.readFileSync(p1);
        return { data, width: 1024, height: 1024 };
      }
      const p2 = path.resolve(__dirname, '../../frontend/public/vrindavan_sarthi_official_logo.jpg');
      if (fs.existsSync(p2)) {
        const data = fs.readFileSync(p2);
        return { data, width: 1024, height: 1024 };
      }
      const p3 = path.resolve(__dirname, '../../frontend/public/vrindasarthi logo.jpeg');
      if (fs.existsSync(p3)) {
        const data = fs.readFileSync(p3);
        return { data, width: 672, height: 573 };
      }
      return null;
    } catch {
      return null;
    }
  }

  buildOutput(logo) {
    const objects = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>'); // Obj 1
    objects.push(null); // Obj 2 (Pages root, populated below)
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // Obj 3
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); // Obj 4

    let logoObjectNo = null;
    if (logo) {
      logoObjectNo = objects.length + 1;
      objects.push({
        binary: true,
        data: logo.data,
        header: `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>`,
      });
    }

    const xObjects = logoObjectNo ? `/XObject << /Logo ${logoObjectNo} 0 R >> ` : '';
    const pageIds = [];

    // For each page, create page object and content object
    for (let pIdx = 0; pIdx < this.pages.length; pIdx++) {
      const stream = this.pages[pIdx].join('\n');
      const pageAnnots = this.pageAnnotations[pIdx] || [];
      const annotsStr = pageAnnots.map((a) =>
        `<< /Type /Annot /Subtype /Link /Rect [${a.x1.toFixed(2)} ${a.y1.toFixed(2)} ${a.x2.toFixed(2)} ${a.y2.toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI (${escapePdf(a.url)}) >> >>`
      ).join(' ');

      const annotsDict = annotsStr ? `/Annots [ ${annotsStr} ] ` : '';
      const pageNo = objects.length + 1;
      const contentNo = pageNo + 1;
      pageIds.push(`${pageNo} 0 R`);

      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] ${annotsDict}/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjects}>> /Contents ${contentNo} 0 R >>`);
      objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    }

    objects[1] = `<< /Type /Pages /Kids [${pageIds.join(' ')}] /Count ${pageIds.length} >>`;

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
      const off = String(offsets[i]).padStart(10, '0');
      chunks.push(Buffer.from(`${off} 00000 n \n`, 'utf8'));
    }
    chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, 'utf8'));
    return Buffer.concat(chunks);
  }
}

function buildBookingReceiptPdf(booking) {
  const builder = new ReferenceMatchedPdfBuilder();
  const buffer = builder.generate(booking);
  const ref = booking.bookingId || String(booking._id || 'receipt');
  const filename = `booking-receipt-${ref}.pdf`;
  return {
    buffer,
    filename,
    documentTitle: 'BOOKING CONFIRMATION & PAYMENT RECEIPT',
  };
}

module.exports = {
  ReferenceMatchedPdfBuilder,
  buildBookingReceiptPdf,
  resolvePaymentModeLabel,
  formatTimeString12,
};
