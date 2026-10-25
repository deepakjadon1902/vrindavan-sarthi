const fs = require('fs');
const path = require('path');
const { resolveReceiptIdentifiers } = require('./idAllocation');
let QRCode = null;
try {
  QRCode = require('qrcode');
} catch {
  QRCode = null;
}

const PAGE = { width: 595.28, height: 841.89, margin: 24 };

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
  } catch {
    // fallback
  }
  return fallback;
};

function resolvePaymentModeLabel(b) {
  const isDharamshala =
    b.service_billing_model === 'dharamshala_booking' ||
    String(b.propertyType || '').toLowerCase() === 'dharamshala' ||
    b.bookingType === 'dharamshala';

  const total = Number(b.totalAmount || 0);
  const paid = Number(b.amountPaidOnline ?? b.advanceAmount ?? 0);
  const balance = Number(b.amountPayableAtProperty ?? b.balanceAmount ?? Math.max(0, total - paid));
  const isCab = b.bookingType === 'cab' || b.service_billing_model === 'taxi_direct';

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
    this.pages = [[]]; // Strictly ONE single A4 page!
    this.pageAnnotations = [[]];
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
      this.pageAnnotations[0].push({
        x1: clickBox.x1,
        y1: clickBox.y1,
        x2: clickBox.x2,
        y2: clickBox.y2,
        url: url.trim(),
      });
    }
  }

  wrapped(val, x, y, maxWidth, { size = 9, font = 'F1', color = COLORS.navy, lineHeight = 11 } = {}) {
    const lines = wrapText(val, maxWidth, size, font);
    lines.forEach((l, idx) => {
      this.text(l, x, y - idx * lineHeight, { size, font, color });
    });
    return lines.length * lineHeight;
  }

  badge(textVal, x, y, { bg = COLORS.goldLight, border = COLORS.goldBorder, textCol = COLORS.amberText, size = 8, font = 'F2', padX = 5, padY = 2 } = {}) {
    const str = clean(textVal);
    const tw = textWidth(str, size, font);
    const bw = tw + padX * 2;
    const bh = size + padY * 2;
    this.roundedRect(x, y - padY, bw, bh, 3, bg, border, 0.7);
    this.text(str, x + padX, y + 0.5, { size, font, color: textCol });
    return bw;
  }

  drawCheckmark(cx, cy, r, color = COLORS.white) {
    this.circle(cx, cy, r, color);
    this.currentOps.push(`${rgb(COLORS.white)} RG`);
    this.currentOps.push('1.5 w');
    this.currentOps.push(`${(cx - r * 0.45).toFixed(2)} ${cy.toFixed(2)} m ${(cx - r * 0.1).toFixed(2)} ${(cy - r * 0.4).toFixed(2)} l ${(cx + r * 0.5).toFixed(2)} ${(cy + r * 0.45).toFixed(2)} l S`);
  }

  drawBedIcon(x, y, size = 9, color = COLORS.crimson) {
    this.rect(x, y, size * 0.9, size * 0.5, color);
    this.rect(x + size * 0.1, y + size * 0.5, size * 0.3, size * 0.25, color);
    this.rect(x, y - size * 0.2, size * 0.15, size * 0.2, color);
    this.rect(x + size * 0.75, y - size * 0.2, size * 0.15, size * 0.2, color);
  }

  drawRupeeIcon(x, y, size = 9, color = COLORS.crimson) {
    this.rect(x, y, size, size * 0.72, null, color, 0.9);
    this.line(x, y + size * 0.48, x + size, y + size * 0.48, color, 0.7);
    this.circle(x + size * 0.28, y + size * 0.22, 0.8, color);
  }

  drawMailIcon(x, y, size = 8, color = COLORS.muted) {
    this.rect(x, y, size, size * 0.7, null, color, 0.8);
    this.line(x, y + size * 0.7, x + size / 2, y + size * 0.25, color, 0.8);
    this.line(x + size, y + size * 0.7, x + size / 2, y + size * 0.25, color, 0.8);
  }

  drawGlobeIcon(x, y, size = 8, color = COLORS.primaryGreen) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    this.circle(cx, cy, size * 0.45, null, color, 0.8);
    this.line(x + size * 0.05, cy, x + size * 0.95, cy, color, 0.7);
    this.line(cx, y + size * 0.05, cx, y + size * 0.95, color, 0.7);
  }

  drawRedCircleIcon(cx, cy, type = 'phone') {
    const r = 4.5;
    this.circle(cx, cy, r, COLORS.crimson);
    if (type === 'phone') {
      this.rect(cx - 1.5, cy - 2.5, 3, 5, COLORS.white);
      this.circle(cx, cy - 1.5, 0.4, COLORS.crimson);
    } else if (type === 'mail') {
      this.rect(cx - 2.5, cy - 1.8, 5, 3.6, null, COLORS.white, 0.6);
      this.line(cx - 2.5, cy + 1.8, cx, cy - 0.2, COLORS.white, 0.6);
      this.line(cx + 2.5, cy + 1.8, cx, cy - 0.2, COLORS.white, 0.6);
    } else if (type === 'globe') {
      this.circle(cx, cy, 2.8, null, COLORS.white, 0.6);
      this.line(cx - 2.8, cy, cx + 2.8, cy, COLORS.white, 0.6);
      this.line(cx, cy - 2.8, cx, cy + 2.8, COLORS.white, 0.6);
    }
  }

  drawPinIcon(x, y, size = 8, color = COLORS.crimson) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    this.circle(cx, cy + size * 0.2, size * 0.35, color);
    this.currentOps.push(`${rgb(color)} RG`);
    this.currentOps.push('1 w');
    this.currentOps.push(`${(cx - size * 0.3).toFixed(2)} ${(cy + size * 0.1).toFixed(2)} m ${cx.toFixed(2)} ${(y - size * 0.1).toFixed(2)} l ${(cx + size * 0.3).toFixed(2)} ${(cy + size * 0.1).toFixed(2)} l S`);
  }

  drawCalendarIcon(x, y, size = 9, color = COLORS.muted) {
    this.rect(x, y, size, size * 0.8, null, color, 0.8);
    this.line(x, y + size * 0.55, x + size, y + size * 0.55, color, 0.8);
    this.line(x + size * 0.25, y + size * 0.8, x + size * 0.25, y + size, color, 0.9);
    this.line(x + size * 0.75, y + size * 0.8, x + size * 0.75, y + size, color, 0.9);
  }

  drawUserIcon(x, y, size = 9, color = COLORS.crimson) {
    const cx = x + size / 2;
    this.circle(cx, y + size * 0.65, size * 0.3, color);
    this.currentOps.push(`${rgb(color)} rg`);
    this.currentOps.push(`${(cx - size * 0.45).toFixed(2)} ${y.toFixed(2)} m ${(cx + size * 0.45).toFixed(2)} ${y.toFixed(2)} l ${(cx + size * 0.35).toFixed(2)} ${(y + size * 0.4).toFixed(2)} l ${(cx - size * 0.35).toFixed(2)} ${(y + size * 0.4).toFixed(2)} l h f`);
  }

  drawPhoneIcon(x, y, size = 8, color = COLORS.crimson) {
    this.roundedRect(x, y, size * 0.65, size, 1.5, null, color, 0.8);
    this.circle(x + size * 0.325, y + size * 0.2, 0.8, color);
    this.line(x + size * 0.15, y + size * 0.85, x + size * 0.5, y + size * 0.85, color, 0.8);
  }

  drawCircularLogo(cx, cy, radius, logoData) {
    const kappa = 0.5522847498;
    const d = radius * kappa;
    if (logoData) {
      this.currentOps.push('q');
      this.currentOps.push(`${cx.toFixed(2)} ${(cy + radius).toFixed(2)} m`);
      this.currentOps.push(`${(cx + d).toFixed(2)} ${(cy + radius).toFixed(2)} ${(cx + radius).toFixed(2)} ${(cy + d).toFixed(2)} ${(cx + radius).toFixed(2)} ${cy.toFixed(2)} c`);
      this.currentOps.push(`${(cx + radius).toFixed(2)} ${(cy - d).toFixed(2)} ${(cx + d).toFixed(2)} ${(cy - radius).toFixed(2)} ${cx.toFixed(2)} ${(cy - radius).toFixed(2)} c`);
      this.currentOps.push(`${(cx - d).toFixed(2)} ${(cy - radius).toFixed(2)} ${(cx - radius).toFixed(2)} ${(cy - d).toFixed(2)} ${(cx - radius).toFixed(2)} ${cy.toFixed(2)} c`);
      this.currentOps.push(`${(cx - radius).toFixed(2)} ${(cy + d).toFixed(2)} ${(cx - d).toFixed(2)} ${(cy + radius).toFixed(2)} ${cx.toFixed(2)} ${(cy + radius).toFixed(2)} c`);
      this.currentOps.push('h W n');
      this.currentOps.push(`${(radius * 2).toFixed(2)} 0 0 ${(radius * 2).toFixed(2)} ${(cx - radius).toFixed(2)} ${(cy - radius).toFixed(2)} cm`);
      this.currentOps.push('/Logo Do');
      this.currentOps.push('Q');
      this.circle(cx, cy, radius, null, COLORS.accentGold, 1);
    } else {
      this.circle(cx, cy, radius, COLORS.primaryGreen, COLORS.accentGold, 1);
      this.text('VS', cx - radius * 0.45, cy - radius * 0.25, { size: radius * 0.65, font: 'F2', color: COLORS.white });
    }
  }

  drawPeacockFeather(x, y, scale = 0.5, angle = 0) {
    this.currentOps.push('q');
    this.currentOps.push(`${scale} 0 0 ${scale} ${x.toFixed(2)} ${y.toFixed(2)} cm`);
    if (angle !== 0) {
      const rad = (angle * Math.PI) / 180;
      const cos = Math.cos(rad).toFixed(4);
      const sin = Math.sin(rad).toFixed(4);
      this.currentOps.push(`${cos} ${sin} ${(-sin)} ${cos} 0 0 cm`);
    }
    this.currentOps.push(`${rgb([20, 83, 45])} RG`);
    this.currentOps.push('2 w');
    this.currentOps.push('0 -22 m 0 28 l S');
    this.circle(0, 28, 13, [22, 101, 52]);
    this.circle(0, 28, 9, [194, 137, 20]);
    this.circle(0, 28, 5.5, [29, 78, 216]);
    this.circle(0, 28, 2.5, [15, 23, 42]);
    this.currentOps.push('Q');
  }

  drawQrCode(textVal, x, y, size = 42) {
    try {
      if (!QRCode) throw new Error('QRCode module not available');
      const qr = QRCode.create(textVal, { errorCorrectionLevel: 'M' });
      const mods = qr.modules;
      const count = mods.size;
      const cellSize = size / count;
      this.rect(x - 2, y - 2, size + 4, size + 4, COLORS.white, COLORS.border, 0.5);
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (mods.get(r, c)) {
            const px = x + c * cellSize;
            const py = y + (count - 1 - r) * cellSize;
            this.rect(px, py, cellSize + 0.05, cellSize + 0.05, COLORS.navyDark);
          }
        }
      }
    } catch {
      this.rect(x, y, size, size, COLORS.border);
      this.text('QR Error', x + 4, y + size / 2, { size: 7, color: COLORS.muted });
    }
  }

  loadLogo() {
    try {
      const p1 = path.resolve(__dirname, 'assets/vrindavan_sarthi_official_logo.jpg');
      if (fs.existsSync(p1)) return { data: fs.readFileSync(p1), width: 1024, height: 1024 };
      const p2 = path.resolve(__dirname, '../../frontend/public/vrindavan_sarthi_official_logo.jpg');
      if (fs.existsSync(p2)) return { data: fs.readFileSync(p2), width: 1024, height: 1024 };
      const p3 = path.resolve(__dirname, '../../frontend/public/vrindasarthi logo.jpeg');
      if (fs.existsSync(p3)) return { data: fs.readFileSync(p3), width: 672, height: 573 };
      return null;
    } catch {
      return null;
    }
  }

  generate(booking, context = {}) {
    const identifiers = resolveReceiptIdentifiers(booking, context?.hotel, context?.roomType, context?.roomUnit);
    const logoData = this.loadLogo();
    const isDharamshala =
      booking.service_billing_model === 'dharamshala_booking' ||
      String(booking.propertyType || '').toLowerCase() === 'dharamshala' ||
      booking.bookingType === 'dharamshala';
    const isCab = booking.bookingType === 'cab' || booking.service_billing_model === 'taxi_direct';
    const isTour = booking.bookingType === 'tour' || booking.service_billing_model === 'tour_direct';

    // Warm ivory page background
    this.rect(0, 0, this.width, this.height, COLORS.ivoryBg);

    const rightMargin = this.width - this.margin; // 571.28 pt
    const usableW = this.width - this.margin * 2;  // 547.28 pt

    // =========================================================================
    // 1. BRAND HEADER (y = 766 to 822, Height = 56 pt)
    // =========================================================================
    const logoSize = 50;
    const logoX = this.margin + 2;
    const logoY = 768;

    const cx = logoX + logoSize / 2;
    const cy = logoY + logoSize / 2;
    const r = logoSize / 2;
    const kappa = 0.5522847498;
    const d = r * kappa;

    if (logoData) {
      this.currentOps.push('q');
      this.currentOps.push(`${cx.toFixed(2)} ${(cy + r).toFixed(2)} m`);
      this.currentOps.push(`${(cx + d).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy + d).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`);
      this.currentOps.push(`${(cx + r).toFixed(2)} ${(cy - d).toFixed(2)} ${(cx + d).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`);
      this.currentOps.push(`${(cx - d).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy - d).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`);
      this.currentOps.push(`${(cx - r).toFixed(2)} ${(cy + d).toFixed(2)} ${(cx - d).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`);
      this.currentOps.push('h W n');
      this.currentOps.push(`${logoSize.toFixed(2)} 0 0 ${logoSize.toFixed(2)} ${logoX.toFixed(2)} ${logoY.toFixed(2)} cm`);
      this.currentOps.push('/Logo Do');
      this.currentOps.push('Q');
      this.circle(cx, cy, r, null, COLORS.accentGold, 1.2);
    } else {
      this.circle(cx, cy, r, COLORS.primaryGreen, COLORS.accentGold, 1.2);
      this.text('VS', cx - 10, cy - 5, { size: 14, font: 'F2', color: COLORS.white });
    }

    // Center: Brand & Identity
    const textStartX = logoX + logoSize + 12;
    this.text('Vrindavan Sarthi Enterprises', textStartX, 804, { size: 15, font: 'F2', color: COLORS.primaryGreen });
    this.text('Formerly known as Vrindavan Sarthi', textStartX + 24, 792, { size: 7.5, font: 'F2', color: COLORS.subGreen });
    
    // Decorative gold flourish divider
    this.line(textStartX, 784, textStartX + 190, 784, COLORS.accentGold, 0.8);
    this.circle(textStartX + 95, 784, 2, COLORS.accentGold);

    // Devotee Tagline in warm amber
    this.text('Your True Companion On The Journey', textStartX + 8, 771, { size: 8.8, font: 'F2', color: COLORS.amberText });

    // Right: Receipt metadata & Voucher Pill
    let docTitle1 = 'BOOKING CONFIRMATION &';
    let docTitle2 = 'PAYMENT RECEIPT';
    if (isCab) {
      docTitle1 = 'CAB BOOKING CONFIRMATION';
      docTitle2 = '& PAYMENT RECEIPT';
    } else if (isTour) {
      docTitle1 = 'PILGRIMAGE TOUR CONFIRMATION';
      docTitle2 = '& PAYMENT RECEIPT';
    }
    this.text(docTitle1, rightMargin - textWidth(docTitle1, 9.8, 'F2'), 804, { size: 9.8, font: 'F2', color: COLORS.crimson });
    this.text(docTitle2, rightMargin - textWidth(docTitle2, 9.8, 'F2'), 792, { size: 9.8, font: 'F2', color: COLORS.crimson });

    const genDateStr = `Generated: ${formatIstDateTimeShort(booking.createdAt || new Date())}`;
    this.text(genDateStr, rightMargin - textWidth(genDateStr, 7.2), 778, { size: 7.2, font: 'F1', color: COLORS.muted });

    // Booking Voucher Pill
    const voucherText = 'Booking Voucher - Present at Check-in';
    const vw = textWidth(voucherText, 7.5, 'F2') + 16;
    const vx = rightMargin - vw;
    this.roundedRect(vx, 760, vw, 15, 3.5, COLORS.goldLight, COLORS.goldBorder, 0.8);
    this.text(voucherText, vx + 8, 764, { size: 7.5, font: 'F2', color: COLORS.amberText });

    // =========================================================================
    // 2. HORIZONTAL STATUS & VERIFICATION BAR (y = 706 down to 758, Height = 52 pt)
    // =========================================================================
    const barY = 706;
    const barH = 52;
    this.roundedRect(this.margin, barY, usableW, barH, 4, COLORS.white, COLORS.border, 1);

    // Left segment: Reservation Confirmed (badge & subtext)
    this.roundedRect(this.margin + 6, barY + 26, 126, 20, 10, COLORS.greenBg, COLORS.greenBorder, 1);
    this.drawCheckmark(this.margin + 17, barY + 36, 5, COLORS.greenSuccess);
    this.text('RESERVATION CONFIRMED', this.margin + 26, barY + 32.5, { size: 7.2, font: 'F2', color: COLORS.greenSuccess });
    this.text('Room Reserved & Guaranteed', this.margin + 10, barY + 11, { size: 7.8, font: 'F1', color: COLORS.slateBlue });

    // Divider 1 (x = 138 pt)
    this.line(this.margin + 138, barY + 6, this.margin + 138, barY + barH - 6, COLORS.border, 0.8);

    // Booking ID / Reference (x = 146 pt)
    const refX = this.margin + 146;
    this.drawCalendarIcon(refX, barY + 34, 8.5, COLORS.muted);
    this.text('BOOKING ID', refX + 13, barY + 36, { size: 7.2, font: 'F2', color: COLORS.muted });
    if (identifiers.displayBookingId && identifiers.displayBookingId !== identifiers.canonicalBookingId) {
      this.text(`ID: ${identifiers.displayBookingId}`, refX, barY + 20, { size: 9.5, font: 'F2', color: COLORS.navyDark });
      this.text(`Ref: ${identifiers.canonicalBookingId}`, refX, barY + 9, { size: 6.5, font: 'F1', color: COLORS.muted });
    } else {
      this.text(`ID: ${identifiers.canonicalBookingId}`, refX, barY + 18, { size: 8.5, font: 'F2', color: COLORS.navyDark });
    }

    // Divider 2 (x = 280 pt)
    this.line(this.margin + 280, barY + 6, this.margin + 280, barY + barH - 6, COLORS.border, 0.8);

    // Booked On (x = 288 pt)
    const bookedOnX = this.margin + 288;
    this.drawCalendarIcon(bookedOnX, barY + 34, 8.5, COLORS.muted);
    this.text('BOOKED ON', bookedOnX + 13, barY + 36, { size: 7.2, font: 'F2', color: COLORS.muted });
    this.text(formatIstDateTimeShort(booking.createdAt), bookedOnX, barY + 18, { size: 7.8, font: 'F1', color: COLORS.navyDark });

    // Divider 3 (x = 412 pt)
    this.line(this.margin + 412, barY + 6, this.margin + 412, barY + barH - 6, COLORS.border, 0.8);

    // Right segment: Offline Vector QR Code & Interactive Verification
    const qrSize = 38;
    const qrX = this.margin + 420;
    const qrY = barY + 9;
    const verifyRef = identifiers.canonicalBookingId || identifiers.displayBookingId;
    const verifyUrl = `https://www.vrindavansarthi.in/verify-booking?ref=${encodeURIComponent(verifyRef)}`;
    this.drawQrCode(verifyUrl, qrX, qrY, qrSize);
    this.pageAnnotations[0].push({
      x1: qrX,
      y1: qrY,
      x2: qrX + qrSize,
      y2: qrY + qrSize,
      url: verifyUrl,
    });
    this.text('Scan with camera to verify authenticity', qrX - 4, barY + 2.5, { size: 5.5, font: 'F1', color: COLORS.muted });
    
    // QR labels
    const qrTextX = qrX + qrSize + 8;
    this.text('Scan to Verify', qrTextX, barY + 36, { size: 7.8, font: 'F2', color: COLORS.slateBlue });
    this.text('Booking Voucher', qrTextX, barY + 24, { size: 7, font: 'F1', color: COLORS.muted });
    const qrRefLabel = identifiers.displayBookingId ? `ID: ${identifiers.displayBookingId}` : `Ref: ${identifiers.canonicalBookingId}`;
    this.text(qrRefLabel, qrTextX, barY + 12, { size: 6.2, font: 'F2', color: COLORS.navy });

    // =========================================================================
    // 3. MAIN 2-COLUMN SECTION (y = 458 down to 698, Height = 240 pt)
    // =========================================================================
    const colLeftW = 280;
    const colRightW = usableW - colLeftW - 10; // 257.28 pt
    const colRightX = this.margin + colLeftW + 10;
    const mainY = 458;
    const mainH = 240;

    // --- LEFT COLUMN: ACCOMMODATION & STAY DETAILS ---
    this.roundedRect(this.margin, mainY, colLeftW, mainH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with Bed Icon
    this.roundedRect(this.margin, mainY + mainH - 24, colLeftW, 24, 4, COLORS.headerPink);
    this.rect(this.margin, mainY + mainH - 24, colLeftW, 6, COLORS.headerPink);
    this.line(this.margin, mainY + mainH - 24, this.margin + colLeftW, mainY + mainH - 24, COLORS.pinkBorder, 0.8);
    
    const bannerTitle = isCab ? 'VEHICLE & JOURNEY DETAILS' : isTour ? 'PILGRIMAGE TOUR DETAILS' : 'ACCOMMODATION & STAY DETAILS';
    this.drawBedIcon(this.margin + 10, mainY + mainH - 17, 10, COLORS.crimson);
    this.text(bannerTitle, this.margin + 28, mainY + mainH - 16, { size: 9, font: 'F2', color: COLORS.crimson });

    const propPhone = identifiers.partnerPhone || '9927600017';
    const propNameStr = identifiers.propertyName || 'Property Reception';

    if (!isCab && !isTour) {
      // 1. Complete Official Property Name (prominent bold, wrapped if long)
      const propName = identifiers.propertyName;
      const propNameLines = wrapText(propName, colLeftW - 24, 12, 'F2');
      let currentY = mainY + mainH - 40;
      propNameLines.slice(0, 2).forEach((line, idx) => {
        this.text(line, this.margin + 12, currentY - idx * 13, { size: 12, font: 'F2', color: COLORS.navyDark });
      });
      currentY -= (propNameLines.slice(0, 2).length * 13 + 3);

      // 2. Property ID Badge & Property Type Pill
      const resolvedPropType = (isDharamshala ? 'dharamshala' : (identifiers.propertyType || 'hotel')).toUpperCase().replace('_', ' ');
      const propTypeLabel = resolvedPropType;
      const propIdLabel = `Property ID: ${identifiers.propertyId}`;
      this.badge(propIdLabel, this.margin + 12, currentY, {
        bg: COLORS.goldLight,
        border: COLORS.goldBorder,
        textCol: COLORS.amberText,
        size: 7.5,
        font: 'F2',
        padX: 5,
        padY: 2,
      });
      const propIdBadgeW = textWidth(propIdLabel, 7.5, 'F2') + 12;
      this.badge(propTypeLabel, this.margin + 12 + propIdBadgeW + 4, currentY, {
        bg: COLORS.blueHeader,
        border: COLORS.border,
        textCol: COLORS.blueText,
        size: 7.2,
        font: 'F2',
        padX: 5,
        padY: 2,
      });
      currentY -= 17;

      // 3. Room Category & Category ID
      const catText = `Category: ${identifiers.roomTypeName}`;
      this.text(catText, this.margin + 12, currentY, { size: 9, font: 'F2', color: COLORS.navy });
      const catTextW = textWidth(catText, 9, 'F2');
      if (identifiers.categoryId && String(identifiers.categoryId).trim()) {
        this.badge(`Category ID: ${String(identifiers.categoryId).trim()}`, this.margin + 12 + catTextW + 6, currentY, {
          bg: COLORS.ivoryBg,
          border: COLORS.border,
          textCol: COLORS.slateBlue,
          size: 7.2,
          font: 'F2',
          padX: 4,
          padY: 1.5,
        });
      }
      currentY -= 16;

      // 4. Physical Room & Room ID / Allocation Status
      if (identifiers.roomNumber || identifiers.roomId) {
        let roomLabel = '';
        if (identifiers.roomNumber && identifiers.roomId) {
          roomLabel = identifiers.roomNumber === identifiers.roomId
            ? `Room ID: ${identifiers.roomId}`
            : `Room No. ${identifiers.roomNumber} | Room ID: ${identifiers.roomId}`;
        } else if (identifiers.roomId) {
          roomLabel = `Room ID: ${identifiers.roomId}`;
        } else {
          roomLabel = `Room No. ${identifiers.roomNumber}`;
        }
        this.badge(roomLabel, this.margin + 12, currentY, {
          bg: COLORS.greenBg,
          border: COLORS.greenBorder,
          textCol: COLORS.greenSuccess,
          size: 7.5,
          font: 'F2',
          padX: 6,
          padY: 2,
        });
      } else {
        this.badge('Room: Allocated at Check-in', this.margin + 12, currentY, {
          bg: COLORS.ivoryBg,
          border: COLORS.border,
          textCol: COLORS.muted,
          size: 7.5,
          font: 'F2',
          padX: 6,
          padY: 2,
        });
      }
      currentY -= 17;

      // 5. Full Available Address with Red Pin
      const fullLoc = identifiers.fullAddress || identifiers.location || 'Govardhan, Mathura, Uttar Pradesh 281502';
      this.drawPinIcon(this.margin + 12, currentY - 1, 8, COLORS.crimson);
      const addrLines = wrapText(fullLoc, colLeftW - 36, 8, 'F1');
      addrLines.slice(0, 2).forEach((line, idx) => {
        this.text(line, this.margin + 24, currentY - idx * 10, { size: 8, font: 'F1', color: COLORS.slateBlue });
      });
      currentY -= (addrLines.slice(0, 2).length * 10 + 2);

      // 6. Landmark / Nearest Temple
      if (identifiers.nearestTemple) {
        this.drawPinIcon(this.margin + 12, currentY - 1, 8, COLORS.crimson);
        this.text(`Near ${identifiers.nearestTemple}`, this.margin + 24, currentY, { size: 8, font: 'F1', color: COLORS.slateBlue });
        currentY -= 12;
      }

      // 7. Reception Phone
      this.drawPhoneIcon(this.margin + 12, currentY - 1, 8, COLORS.crimson);
      this.text(`Reception Phone: +91 ${propPhone}`, this.margin + 24, currentY, { size: 8.2, font: 'F2', color: COLORS.crimson });

      // Bottom 3-box stay grid (Check-in, Check-out, Duration/Guests)
      const gridBoxY = mainY + 14;
      const gridBoxH = 54;
      const gridBoxW = (colLeftW - 18) / 3;

      // Check-in box
      const b1X = this.margin + 8;
      this.roundedRect(b1X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b1X + 8, gridBoxY + 36, 8, COLORS.muted);
      this.text('CHECK-IN', b1X + 20, gridBoxY + 38, { size: 7.2, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.checkIn), b1X + 8, gridBoxY + 23, { size: 8.2, font: 'F2', color: COLORS.navyDark });
      this.text(formatTimeString12(booking.checkInTime, '12:00 PM'), b1X + 8, gridBoxY + 10, { size: 8, font: 'F2', color: COLORS.crimson });

      // Check-out box
      const b2X = b1X + gridBoxW + 2;
      this.roundedRect(b2X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b2X + 8, gridBoxY + 36, 8, COLORS.muted);
      this.text('CHECK-OUT', b2X + 20, gridBoxY + 38, { size: 7.2, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.checkOut), b2X + 8, gridBoxY + 23, { size: 8.2, font: 'F2', color: COLORS.navyDark });
      this.text(formatTimeString12(booking.checkOutTime, '11:00 AM'), b2X + 8, gridBoxY + 10, { size: 8, font: 'F2', color: COLORS.crimson });

      // Duration / Guests box
      const nights = Math.max(1, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))) || 1;
      const guests = booking.guests || ((booking.totalAdults || 1) + (booking.totalChildren || 0));
      const b3X = b2X + gridBoxW + 2;
      this.roundedRect(b3X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawUserIcon(b3X + 8, gridBoxY + 36, 8, COLORS.muted);
      this.text('STAY SUMMARY', b3X + 20, gridBoxY + 38, { size: 7, font: 'F2', color: COLORS.muted });
      this.text(`${nights} Night${nights > 1 ? 's' : ''}`, b3X + 8, gridBoxY + 23, { size: 8.2, font: 'F2', color: COLORS.navyDark });
      this.text(`${guests} Guest(s)${booking.roomQuantity ? ` (${booking.roomQuantity}R)` : ''}`, b3X + 8, gridBoxY + 10, { size: 7.5, color: COLORS.muted });
    } else if (isCab) {
      this.text(booking.itemName || 'Dedicated Cab Transfer', this.margin + 12, mainY + mainH - 44, { size: 14, font: 'F2', color: COLORS.navyDark });
      this.text(`Vehicle: ${booking.vehicleType || 'Sedan / SUV AC'}`, this.margin + 12, mainY + mainH - 64, { size: 9.5, font: 'F2', color: COLORS.navy });
      this.drawPinIcon(this.margin + 12, mainY + mainH - 86, 8, COLORS.crimson);
      this.text(`Pickup: ${booking.pickupAddress || 'Requested Location in Braj'}`, this.margin + 24, mainY + mainH - 85, { size: 8.5, color: COLORS.slateBlue });
      this.drawPinIcon(this.margin + 12, mainY + mainH - 108, 8, COLORS.crimson);
      this.text(`Drop: ${booking.dropAddress || 'Destination in Braj Dham'}`, this.margin + 24, mainY + mainH - 107, { size: 8.5, color: COLORS.slateBlue });

      const cabDate = formatIstDateWithDay(booking.checkIn || booking.startDate || booking.createdAt);
      const cabTime = formatTimeString12(booking.checkInTime || booking.pickupTime, '06:00 AM');
      const b1X = this.margin + 8;
      this.roundedRect(b1X, mainY + 14, colLeftW - 16, 46, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b1X + 8, mainY + 38, 8, COLORS.muted);
      this.text('JOURNEY DATE & PICKUP SCHEDULE', b1X + 20, mainY + 40, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(`${cabDate} at ${cabTime}`, b1X + 8, mainY + 24, { size: 9, font: 'F2', color: COLORS.navyDark });
    } else if (isTour) {
      this.text(booking.packageName || booking.itemName || 'Braj Darshan Pilgrimage Tour', this.margin + 12, mainY + mainH - 44, { size: 14, font: 'F2', color: COLORS.navyDark });
      this.text(`Inclusions: ${booking.inclusions || 'AC Transport, Guided Darshan'}`, this.margin + 12, mainY + mainH - 64, { size: 9, font: 'F2', color: COLORS.navy });
      this.text('Experienced Guide (Darshan Assist)', this.margin + 12, mainY + mainH - 84, { size: 8.5, color: COLORS.slateBlue });

      const tourDate = formatIstDateWithDay(booking.checkIn || booking.startDate || booking.createdAt);
      const b1X = this.margin + 8;
      this.roundedRect(b1X, mainY + 14, colLeftW - 16, 46, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b1X + 8, mainY + 38, 8, COLORS.muted);
      this.text('PILGRIMAGE SCHEDULE & DURATION', b1X + 20, mainY + 40, { size: 7.5, font: 'F2', color: COLORS.muted });
      this.text(`${tourDate} (Full Day Pilgrimage Darshan)`, b1X + 8, mainY + 24, { size: 9, font: 'F2', color: COLORS.navyDark });
    }

    // --- RIGHT COLUMN: PAYMENT SUMMARY & TAX INVOICE ---
    this.roundedRect(colRightX, mainY, colRightW, mainH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with Rupee Icon
    this.roundedRect(colRightX, mainY + mainH - 24, colRightW, 24, 4, COLORS.headerPink);
    this.rect(colRightX, mainY + mainH - 24, colRightW, 6, COLORS.headerPink);
    this.line(colRightX, mainY + mainH - 24, colRightX + colRightW, mainY + mainH - 24, COLORS.pinkBorder, 0.8);
    this.drawRupeeIcon(colRightX + 10, mainY + mainH - 18, 10, COLORS.crimson);
    this.text('PAYMENT SUMMARY & INVOICE', colRightX + 28, mainY + mainH - 16, { size: 9, font: 'F2', color: COLORS.crimson });

    // Financial calculations
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
    this.text(tariffLabel, colRightX + 12, mainY + mainH - 42, { size: 9, font: 'F2', color: COLORS.navyDark });
    const tariffStr = money(roomTariff);
    this.text(tariffStr, colRightX + colRightW - 12 - textWidth(tariffStr, 9, 'F2'), mainY + mainH - 42, { size: 9, font: 'F2', color: COLORS.navyDark });

    // Line 2: Platform Fee
    this.text(feeName, colRightX + 12, mainY + mainH - 58, { size: 9, font: 'F2', color: COLORS.navyDark });
    const feeStr = money(fee);
    this.text(feeStr, colRightX + colRightW - 12 - textWidth(feeStr, 9, 'F2'), mainY + mainH - 58, { size: 9, font: 'F2', color: COLORS.navyDark });

    // Line 3: Optional Tax (for commercial hotels)
    if (hasTax) {
      this.text('Hotel GST / Taxes', colRightX + 12, mainY + mainH - 74, { size: 9, font: 'F2', color: COLORS.navyDark });
      const taxStr = money(tax);
      this.text(taxStr, colRightX + colRightW - 12 - textWidth(taxStr, 9, 'F2'), mainY + mainH - 74, { size: 9, font: 'F2', color: COLORS.navyDark });
    }

    // Box 1: TOTAL BOOKING COST (Gold)
    const boxTotY = hasTax ? (mainY + mainH - 106) : (mainY + mainH - 92);
    this.roundedRect(colRightX + 8, boxTotY, colRightW - 16, 26, 4, COLORS.goldLight, COLORS.goldBorder, 1);
    this.text('TOTAL BOOKING COST', colRightX + 16, boxTotY + 8, { size: 8.5, font: 'F2', color: COLORS.crimson });
    const totStr = money(total);
    this.text(totStr, colRightX + colRightW - 16 - textWidth(totStr, 12, 'F2'), boxTotY + 7, { size: 12, font: 'F2', color: COLORS.crimson });

    // Box 2: Amount Paid Online (Verified) (Green)
    const boxPaidY = boxTotY - 28;
    this.roundedRect(colRightX + 8, boxPaidY, colRightW - 16, 24, 4, COLORS.greenBg, COLORS.greenBorder, 1);
    this.drawCheckmark(colRightX + 18, boxPaidY + 12, 4.5, COLORS.greenSuccess);
    this.text('Paid Online (Verified)', colRightX + 28, boxPaidY + 7.5, { size: 8.2, font: 'F2', color: COLORS.greenSuccess });
    const paidStr = money(paid);
    this.text(paidStr, colRightX + colRightW - 16 - textWidth(paidStr, 10.5, 'F2'), boxPaidY + 7, { size: 10.5, font: 'F2', color: COLORS.greenSuccess });

    // Box 3: Balance Payable at Property (Red)
    const boxBalY = boxPaidY - 27;
    const isSettled = balance <= 0;
    const balBg = isSettled ? COLORS.greenBg : COLORS.redBg;
    const balBorder = isSettled ? COLORS.greenBorder : COLORS.redBorder;
    const balColor = isSettled ? COLORS.greenSuccess : COLORS.crimson;
    const balLabel = isSettled ? 'Balance Settled (Full Paid)' : (isCab ? 'Payable to Driver' : 'Balance Payable at Property');
    this.roundedRect(colRightX + 8, boxBalY, colRightW - 16, 24, 4, balBg, balBorder, 1);
    this.text(balLabel, colRightX + 16, boxBalY + 7.5, { size: 8.2, font: 'F2', color: balColor });
    const balStr = money(balance);
    this.text(balStr, colRightX + colRightW - 16 - textWidth(balStr, 10.5, 'F2'), boxBalY + 7, { size: 10.5, font: 'F2', color: balColor });

    // Payment Metadata lines below boxes
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

    // Payment Mode
    const paymentModeLabel = resolvePaymentModeLabel(booking);
    this.text('Payment Mode   :', colRightX + 12, payMetaY, { size: 8, font: 'F2', color: COLORS.muted });
    let modeLines = [];
    if (paymentModeLabel.includes('; ')) {
      const parts = paymentModeLabel.split('; ');
      modeLines = [parts[0] + ';', parts.slice(1).join('; ')];
    } else if (paymentModeLabel.includes('Balance at Check-in')) {
      modeLines = ['30% Advance Paid Online - 70%', 'Balance at Check-in'];
    } else if (paymentModeLabel.includes('Balance Payable to Driver')) {
      modeLines = ['Advance Paid Online -', 'Balance Payable to Driver'];
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

    // =========================================================================
    // 4. PRIMARY GUEST DETAILS CARD (y = 386 down to 450, Height = 64 pt)
    // =========================================================================
    const guestY = 386;
    const guestH = 64;
    this.roundedRect(this.margin, guestY, usableW, guestH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with User Icon
    this.roundedRect(this.margin, guestY + guestH - 20, usableW, 20, 4, COLORS.headerPink);
    this.rect(this.margin, guestY + guestH - 20, usableW, 6, COLORS.headerPink);
    this.line(this.margin, guestY + guestH - 20, this.margin + usableW, guestY + guestH - 20, COLORS.pinkBorder, 0.8);
    this.drawUserIcon(this.margin + 10, guestY + guestH - 15, 9, COLORS.crimson);
    this.text('PRIMARY & GUEST DETAILS', this.margin + 26, guestY + guestH - 14, { size: 8.5, font: 'F2', color: COLORS.crimson });

    // Guest ID badge on the right
    const guestSuffix = String(booking.userId || booking.bookingId || '191395').replace(/[^0-9]/g, '').slice(-6) || '191395';
    const guestIdStr = `Guest ID: VVS-G-${guestSuffix}`;
    const gw = textWidth(guestIdStr, 8, 'F2') + 14;
    this.badge(guestIdStr, this.margin + usableW - gw - 8, guestY + guestH - 15, {
      bg: COLORS.goldLight,
      border: COLORS.goldBorder,
      textCol: COLORS.amberText,
      size: 8,
      font: 'F2',
      padX: 6,
      padY: 2,
    });

    const gName = booking.customerFullName || booking.userName || 'Guest Devotee';
    const gPhone = booking.customerMobile || booking.userPhone || '—';
    const gEmail = booking.customerEmail || booking.userEmail || '—';
    const city = booking.customerCity || 'Govardhan';
    const state = booking.customerState || 'Uttar Pradesh';

    // Row 1: Name, Phone, Email
    this.text('Guest Name :', this.margin + 12, guestY + 26, { size: 8.5, font: 'F2', color: COLORS.muted });
    this.text(gName, this.margin + 74, guestY + 26, { size: 10, font: 'F2', color: COLORS.navyDark });

    this.text('Mobile :', this.margin + 230, guestY + 26, { size: 8.5, font: 'F2', color: COLORS.muted });
    this.text(gPhone, this.margin + 274, guestY + 26, { size: 9.5, font: 'F1', color: COLORS.navyDark });

    this.text('Email :', this.margin + 380, guestY + 26, { size: 8.5, font: 'F2', color: COLORS.muted });
    this.text(gEmail, this.margin + 418, guestY + 26, { size: 9, font: 'F1', color: COLORS.navyDark });

    // Row 2: Location
    this.text('Origin     :', this.margin + 12, guestY + 11, { size: 8.5, font: 'F2', color: COLORS.muted });
    this.text(`${city}, ${state}`, this.margin + 74, guestY + 11, { size: 9, font: 'F1', color: COLORS.navyDark });

    this.text('Destination :', this.margin + 230, guestY + 11, { size: 8.5, font: 'F2', color: COLORS.muted });
    this.text('Braj Dham (Mathura / Vrindavan / Govardhan)', this.margin + 296, guestY + 11, { size: 8.5, font: 'F1', color: COLORS.slateBlue });

    // =========================================================================
    // 5. KEY CONTACTS (Left) vs QUICK ACTIONS (Right) (y = 306 down to 378, Height = 72 pt)
    // =========================================================================
    const row5Y = 306;
    const row5H = 72;

    // Left: KEY CONTACTS & DEVOTEE HELPDESK
    this.roundedRect(this.margin, row5Y, colLeftW, row5H, 4, COLORS.white, COLORS.pinkBorder, 1);
    this.roundedRect(this.margin, row5Y + row5H - 20, colLeftW, 20, 4, COLORS.headerPink);
    this.rect(this.margin, row5Y + row5H - 20, colLeftW, 6, COLORS.headerPink);
    this.line(this.margin, row5Y + row5H - 20, this.margin + colLeftW, row5Y + row5H - 20, COLORS.pinkBorder, 0.8);
    this.drawPhoneIcon(this.margin + 10, row5Y + row5H - 15, 8.5, COLORS.crimson);
    this.text('KEY CONTACTS & HELPDESK', this.margin + 24, row5Y + row5H - 14, { size: 8.5, font: 'F2', color: COLORS.crimson });

    this.text('Property Reception :', this.margin + 12, row5Y + 36, { size: 8, font: 'F2', color: COLORS.muted });
    this.text(propNameStr, this.margin + 104, row5Y + 36, { size: 8.5, font: 'F2', color: COLORS.navyDark });

    this.text('Reception Phone    :', this.margin + 12, row5Y + 22, { size: 8, font: 'F2', color: COLORS.muted });
    this.text(`+91 ${propPhone}`, this.margin + 104, row5Y + 22, { size: 9, font: 'F2', color: COLORS.crimson });

    this.text('Platform Helpline  :', this.margin + 12, row5Y + 8, { size: 8, font: 'F2', color: COLORS.muted });
    this.text('+91 86798 20256 (9:00 AM - 7:00 PM)', this.margin + 104, row5Y + 8, { size: 8.2, font: 'F2', color: COLORS.primaryGreen });

    // Right: QUICK ACTIONS (Interactive Links)
    this.roundedRect(colRightX, row5Y, colRightW, row5H, 4, COLORS.white, COLORS.border, 1);
    this.roundedRect(colRightX, row5Y + row5H - 20, colRightW, 20, 4, COLORS.blueHeader);
    this.rect(colRightX, row5Y + row5H - 20, colRightW, 6, COLORS.blueHeader);
    this.line(colRightX, row5Y + row5H - 20, colRightX + colRightW, row5Y + row5H - 20, COLORS.border, 0.8);
    this.text('QUICK ACTIONS', colRightX + 12, row5Y + row5H - 14, { size: 8.5, font: 'F2', color: COLORS.blueText });

    // Two buttons
    const btnW = (colRightW - 18) / 2;
    const btn1X = colRightX + 6;
    const btnY = row5Y + 8;
    const btnH = 36;

    // Action 1: Google Maps
    this.roundedRect(btn1X, btnY, btnW, btnH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
    this.drawPinIcon(btn1X + 8, btnY + 16, 9, COLORS.crimson);
    this.text('View Location', btn1X + 22, btnY + 21, { size: 8.5, font: 'F2', color: COLORS.navyDark });
    this.text('( Google Maps )', btn1X + 22, btnY + 9, { size: 7.2, font: 'F1', color: COLORS.muted });
    
    const propLocStr = identifiers.fullAddress || identifiers.location || 'Govardhan, Mathura, Uttar Pradesh 281502';
    const mapLink = identifiers.googleMapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${propNameStr}, ${propLocStr}`)}`;
    this.link('View Location', mapLink, btn1X + 22, btnY + 21, {
      size: 8.5,
      box: { x1: btn1X, y1: btnY, x2: btn1X + btnW, y2: btnY + btnH },
    });

    // Action 2: WhatsApp Support
    const btn2X = btn1X + btnW + 6;
    this.roundedRect(btn2X, btnY, btnW, btnH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
    this.circle(btn2X + 13, btnY + 18, 7, COLORS.greenSuccess);
    this.text('W', btn2X + 10, btnY + 14.5, { size: 8.5, font: 'F2', color: COLORS.white });
    this.text('WhatsApp Support', btn2X + 25, btnY + 21, { size: 8.5, font: 'F2', color: COLORS.navyDark });
    this.text('+91 86798 20256', btn2X + 25, btnY + 9, { size: 7.2, font: 'F2', color: COLORS.greenSuccess });
    
    const waLink = 'https://wa.me/918679820256?text=Namaste%20Vrindavan%20Sarthi%20Support';
    this.link('WhatsApp Support', waLink, btn2X + 25, btnY + 21, {
      size: 8.5,
      box: { x1: btn2X, y1: btnY, x2: btn2X + btnW, y2: btnY + btnH },
    });

    // =========================================================================
    // 6. IMPORTANT GUEST GUIDELINES & PROPERTY POLICIES (y = 196 down to 300, Height = 104 pt)
    // =========================================================================
    const polY = 196;
    const polH = 104;
    this.roundedRect(this.margin, polY, usableW, polH, 4, COLORS.white, COLORS.goldBorder, 1);
    this.roundedRect(this.margin, polY + polH - 20, usableW, 20, 4, COLORS.amberHeader);
    this.rect(this.margin, polY + polH - 20, usableW, 6, COLORS.amberHeader);
    this.line(this.margin, polY + polH - 20, this.margin + usableW, polY + polH - 20, COLORS.goldBorder, 0.8);
    this.text('IMPORTANT GUEST GUIDELINES & PROPERTY POLICIES', this.margin + 14, polY + polH - 14, { size: 8.5, font: 'F2', color: COLORS.amberText });

    const balanceNotice = balance > 0
      ? `Outstanding balance of ${money(balance)} is payable directly to ${propNameStr} reception upon arrival via UPI or Cash.`
      : 'Balance Cleared: No further stay charges are due for the reserved dates.';

    const policies = [
      { label: 'Mandatory Photo ID', text: 'Valid Government Photo ID (Aadhaar, Voter ID, Passport, or DL) is strictly required for all adult devotees upon check-in.' },
      { label: 'Check-in & Check-out', text: `Standard check-in is ${formatTimeString12(booking.checkInTime, '12:00 PM')}; check-out is ${formatTimeString12(booking.checkOutTime, '11:00 AM')}. Early check-in is subject to property availability.` },
      { label: 'Balance Settlement', text: balanceNotice },
      { label: 'Spiritual Sanctity', text: 'To maintain divine sanctity of Braj Dham, smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited on property premises.' },
    ];

    let pRowY = polY + polH - 33;
    policies.forEach((p) => {
      this.circle(this.margin + 14, pRowY + 3.2, 2.5, COLORS.amberText);
      this.text(`${p.label}:`, this.margin + 22, pRowY, { size: 7.6, font: 'F2', color: COLORS.navyDark });
      const lblW = textWidth(`${p.label}: `, 7.6, 'F2');
      
      const availW = usableW - 22 - lblW - 10;
      const lines = wrapText(p.text, availW, 7.3, 'F1');
      if (lines.length === 1) {
        this.text(lines[0], this.margin + 22 + lblW, pRowY, { size: 7.3, font: 'F1', color: COLORS.slateBlue });
        pRowY -= 15.5;
      } else {
        this.text(lines[0], this.margin + 22 + lblW, pRowY, { size: 7.3, font: 'F1', color: COLORS.slateBlue });
        pRowY -= 9;
        for (let i = 1; i < lines.length; i++) {
          this.text(lines[i], this.margin + 22 + lblW, pRowY, { size: 7.3, font: 'F1', color: COLORS.slateBlue });
          pRowY -= (i === lines.length - 1 ? 12.5 : 9);
        }
      }
    });

    // =========================================================================
    // 7. LEGAL NOTICE & PLATFORM FACILITATION DISCLAIMER (y = 124 down to 190, Height = 66 pt)
    // =========================================================================
    const discY = 124;
    const discH = 66;
    this.roundedRect(this.margin, discY, usableW, discH, 4, COLORS.disclaimerBg, COLORS.border, 0.8);
    this.roundedRect(this.margin, discY + discH - 18, usableW, 18, 4, [241, 245, 249]);
    this.rect(this.margin, discY + discH - 18, usableW, 6, [241, 245, 249]);
    this.line(this.margin, discY + discH - 18, this.margin + usableW, discY + discH - 18, COLORS.border, 0.8);
    this.text('LEGAL NOTICE & PLATFORM FACILITATION DISCLAIMER', this.margin + 12, discY + discH - 13, { size: 7.5, font: 'F2', color: COLORS.navyDark });

    const discText = 'Vrindavan Sarthi Enterprises operates as a specialized devotee pilgrimage facilitation desk connecting pilgrims with verified dharamshalas, ashrams, guest houses, and local logistics in the sacred Braj Dham region. The platform facilitation fee covers reservation confirmation, verification support, and front-desk coordination. Property amenities, on-site services, room allocation, and hospitality conduct remain under direct management of the respective accommodation.';
    this.wrapped(discText, this.margin + 12, discY + discH - 28, usableW - 24, { size: 7.2, font: 'F1', color: COLORS.slateBlue, lineHeight: 9.5 });

    // =========================================================================
    // 8. PREMIUM HERITAGE FOOTER (y = 32 down to 118, Height = 86 pt)
    // =========================================================================
    this.line(this.margin, 118, rightMargin, 118, COLORS.accentGold, 0.8);
    this.circle(this.width / 2, 118, 2.5, COLORS.accentGold);

    // Left Block: Circular Logo & Brand Identity (matching Canva reference)
    const footLogoX = this.margin + 20;
    const footLogoY = 82;
    this.drawCircularLogo(footLogoX, footLogoY, 17, logoData);

    const footBrandX = this.margin + 44;
    this.text('Vrindavan Sarthi Enterprises', footBrandX, 92, { size: 12.5, font: 'F2', color: COLORS.crimson });
    this.text('Formerly known as Vrindavan Sarthi', footBrandX + 16, 80, { size: 7.2, font: 'F2', color: COLORS.subGreen });
    this.text('Your True Companion On The Journey', footBrandX + 4, 68, { size: 8.5, font: 'F2', color: COLORS.amberText });

    // Right Block: Official Registered Address & GST with Red Location Pin (Canva reference exact)
    const footAddrX = 320;
    this.drawPinIcon(footAddrX - 12, 89, 11, COLORS.crimson);
    this.text('Raja wala mandir, Infront of Giriraj ji Maharaj, Govardhan Parikrama', footAddrX + 4, 94, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
    this.text('Marg, Near Bus Stand, Govardhan, Uttar Pradesh 281123', footAddrX + 4, 83, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
    
    const gstText = 'GST No.09HTEPS3784R1ZD';
    this.text(gstText, footAddrX + 38, 68, { size: 8.2, font: 'F2', color: COLORS.crimson });

    // Bottom Contact Row (y = 38): 4 items with circular red icons matching reference
    const rowY = 38;
    this.drawRedCircleIcon(36, rowY + 3.5, 'phone');
    this.text('Helpline: +91 86798 20256', 44, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    this.drawRedCircleIcon(175, rowY + 3.5, 'mail');
    this.text('support@vrindavansarthi.in', 183, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    this.drawRedCircleIcon(328, rowY + 3.5, 'globe');
    this.text('www.vrindavansarthi.in', 336, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    // 4th item: In approved Canva reference authority, www.vrindavansarthi.in appears twice (at x=336 and x=478)
    if (!context.singleWebsiteFooter) {
      this.drawRedCircleIcon(470, rowY + 3.5, 'globe');
      this.text('www.vrindavansarthi.in', 478, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });
    }

    // Decorative Peacock Feathers on footer left and right
    this.drawPeacockFeather(this.margin + 14, 52, 0.45, 30);
    this.drawPeacockFeather(rightMargin - 14, 52, 0.45, -30);

    return this.buildOutput(logoData);
  }

  buildOutput(logo) {
    const objects = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>'); // Obj 1
    objects.push(null); // Obj 2 (Pages root)
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

    // Strictly ONE page
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

    const chunks = [Buffer.from('%PDF-1.4\r\n% VRINDAVAN SARTHI ENTERPRISES - OFFICIAL BOOKING RECEIPT\r\n% Page 1 of 1 | All Rights Reserved\r\n% 9:00 AM - 9:00 PM\r\n', 'utf8')];
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

function buildBookingReceiptPdf(booking, context = {}) {
  const builder = new ReferenceMatchedPdfBuilder();
  const buffer = builder.generate(booking, context);
  const ref = booking.bookingId || booking.displayBookingId || String(booking._id || 'receipt');
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
