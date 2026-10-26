const fs = require('fs');
const path = require('path');
const QRCode = require('../backend/node_modules/qrcode');

const PAGE = { width: 595.28, height: 841.89, margin: 28 };

const COLORS = {
  primaryGreen: [20, 83, 45],       // #14532d deep forest green
  subGreen: [45, 106, 79],          // #2d6a4f
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
  peacockBlue: [3, 105, 161],       // #0369a1
  peacockGreen: [13, 148, 136],     // #0d9488
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

class ReferenceMatchedPdfBuilder {
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

  roundedRect(x, y, w, h, r = 4, fill = null, stroke = null, lineWidth = 1) {
    if (fill) this.ops.push(`${rgb(fill)} rg`);
    if (stroke) {
      this.ops.push(`${rgb(stroke)} RG`);
      this.ops.push(`${lineWidth} w`);
    }
    const x2 = x + w;
    const y2 = y + h;
    const k = 0.552284749831;
    const kr = r * k;
    
    this.ops.push(`${(x + r).toFixed(2)} ${y.toFixed(2)} m`);
    this.ops.push(`${(x2 - r).toFixed(2)} ${y.toFixed(2)} l`);
    this.ops.push(`${(x2 - r + kr).toFixed(2)} ${y.toFixed(2)} ${(x2).toFixed(2)} ${(y + r - kr).toFixed(2)} ${(x2).toFixed(2)} ${(y + r).toFixed(2)} c`);
    this.ops.push(`${(x2).toFixed(2)} ${(y2 - r).toFixed(2)} l`);
    this.ops.push(`${(x2).toFixed(2)} ${(y2 - r + kr).toFixed(2)} ${(x2 - r + kr).toFixed(2)} ${(y2).toFixed(2)} ${(x2 - r).toFixed(2)} ${(y2).toFixed(2)} c`);
    this.ops.push(`${(x + r).toFixed(2)} ${(y2).toFixed(2)} l`);
    this.ops.push(`${(x + r - kr).toFixed(2)} ${(y2).toFixed(2)} ${(x).toFixed(2)} ${(y2 - r + kr).toFixed(2)} ${(x).toFixed(2)} ${(y2 - r).toFixed(2)} c`);
    this.ops.push(`${(x).toFixed(2)} ${(y + r).toFixed(2)} l`);
    this.ops.push(`${(x).toFixed(2)} ${(y + r - kr).toFixed(2)} ${(x + r - kr).toFixed(2)} ${(y).toFixed(2)} ${(x + r).toFixed(2)} ${(y).toFixed(2)} c`);
    this.ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
  }

  line(x1, y1, x2, y2, stroke = COLORS.border, width = 1) {
    this.ops.push(`${rgb(stroke)} RG`);
    this.ops.push(`${width} w`);
    this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  circle(x, y, r, fill = null, stroke = null, lineWidth = 1) {
    if (fill) this.ops.push(`${rgb(fill)} rg`);
    if (stroke) {
      this.ops.push(`${rgb(stroke)} RG`);
      this.ops.push(`${lineWidth} w`);
    }
    const k = 0.552284749831 * r;
    this.ops.push(`${(x - r).toFixed(2)} ${y.toFixed(2)} m`);
    this.ops.push(`${(x - r).toFixed(2)} ${(y + k).toFixed(2)} ${(x - k).toFixed(2)} ${(y + r).toFixed(2)} ${x.toFixed(2)} ${(y + r).toFixed(2)} c`);
    this.ops.push(`${(x + k).toFixed(2)} ${(y + r).toFixed(2)} ${(x + r).toFixed(2)} ${(y + k).toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c`);
    this.ops.push(`${(x + r).toFixed(2)} ${(y - k).toFixed(2)} ${(x + k).toFixed(2)} ${(y - r).toFixed(2)} ${x.toFixed(2)} ${(y - r).toFixed(2)} c`);
    this.ops.push(`${(x - k).toFixed(2)} ${(y - r).toFixed(2)} ${(x - r).toFixed(2)} ${(y - k).toFixed(2)} ${(x - r).toFixed(2)} ${y.toFixed(2)} c`);
    this.ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
  }

  ellipse(cx, cy, rx, ry, fill = null, stroke = null, lineWidth = 1) {
    if (fill) this.ops.push(`${rgb(fill)} rg`);
    if (stroke) {
      this.ops.push(`${rgb(stroke)} RG`);
      this.ops.push(`${lineWidth} w`);
    }
    const kx = 0.552284749831 * rx;
    const ky = 0.552284749831 * ry;
    this.ops.push(`${(cx - rx).toFixed(2)} ${cy.toFixed(2)} m`);
    this.ops.push(`${(cx - rx).toFixed(2)} ${(cy + ky).toFixed(2)} ${(cx - kx).toFixed(2)} ${(cy + ry).toFixed(2)} ${cx.toFixed(2)} ${(cy + ry).toFixed(2)} c`);
    this.ops.push(`${(cx + kx).toFixed(2)} ${(cy + ry).toFixed(2)} ${(cx + rx).toFixed(2)} ${(cy + ky).toFixed(2)} ${(cx + rx).toFixed(2)} ${cy.toFixed(2)} c`);
    this.ops.push(`${(cx + rx).toFixed(2)} ${(cy - ky).toFixed(2)} ${(cx + kx).toFixed(2)} ${(cy - ry).toFixed(2)} ${cx.toFixed(2)} ${(cy - ry).toFixed(2)} c`);
    this.ops.push(`${(cx - kx).toFixed(2)} ${(cy - ry).toFixed(2)} ${(cx - rx).toFixed(2)} ${(cy - ky).toFixed(2)} ${(cx - rx).toFixed(2)} ${cy.toFixed(2)} c`);
    this.ops.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
  }

  text(val, x, y, { size = 10, font = 'F1', color = COLORS.navy } = {}) {
    if (!clean(val)) return;
    this.ops.push(`${rgb(color)} rg`);
    this.ops.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(val)}) Tj ET`);
  }

  link(textVal, url, x, y, { size = 9, font = 'F2', color = COLORS.blueText, underline = false, box = null } = {}) {
    const str = clean(textVal);
    if (!str) return;
    this.text(str, x, y, { size, font, color });
    const tw = textWidth(str, size);
    if (underline) {
      this.line(x, y - 1.5, x + tw, y - 1.5, color, 0.6);
    }
    if (url && /^https?:\/\//i.test(url)) {
      const clickBox = box || {
        x1: x - 2,
        y1: y - 3,
        x2: x + tw + 2,
        y2: y + size + 2,
      };
      this.annotations.push({
        x1: clickBox.x1,
        y1: clickBox.y1,
        x2: clickBox.x2,
        y2: clickBox.y2,
        url: url.trim(),
      });
    }
  }

  wrapped(val, x, y, maxWidth, { size = 8.5, font = 'F1', color = COLORS.navy, lineHeight = 11 } = {}) {
    const lines = wrapText(val, maxWidth, size);
    lines.forEach((l, idx) => {
      this.text(l, x, y - idx * lineHeight, { size, font, color });
    });
    return lines.length * lineHeight;
  }

  badge(textVal, x, y, { bg = COLORS.goldLight, border = COLORS.goldBorder, textCol = COLORS.amberText, size = 7.5, font = 'F2', padX = 6, padY = 2.5 } = {}) {
    const str = clean(textVal);
    const tw = textWidth(str, size);
    const bw = tw + padX * 2;
    const bh = size + padY * 2;
    this.roundedRect(x, y - padY, bw, bh, 3, bg, border, 0.7);
    this.text(str, x + padX, y + 0.5, { size, font, color: textCol });
    return bw;
  }

  drawCheckmark(cx, cy, r, color = COLORS.white) {
    this.ops.push(`${rgb(color)} RG`);
    this.ops.push('1.5 w');
    this.ops.push(`${(cx - r * 0.45).toFixed(2)} ${cy.toFixed(2)} m ${(cx - r * 0.1).toFixed(2)} ${(cy - r * 0.35).toFixed(2)} l ${(cx + r * 0.5).toFixed(2)} ${(cy + r * 0.4).toFixed(2)} l S`);
  }

  drawBedIcon(x, y, size = 10, color = COLORS.crimson) {
    this.ops.push(`${rgb(color)} RG`);
    this.ops.push('1 w');
    this.ops.push(`${x} ${y} m ${x} ${y + size} l S`);
    this.ops.push(`${x + size * 1.3} ${y} m ${x + size * 1.3} ${y + size * 0.7} l S`);
    this.ops.push(`${x} ${y + size * 0.35} m ${x + size * 1.3} ${y + size * 0.35} l S`);
    this.rect(x + size * 0.2, y + size * 0.45, size * 0.35, size * 0.3, color);
  }

  drawRupeeIcon(x, y, size = 10, color = COLORS.crimson) {
    this.text('Rs.', x, y, { size: size * 0.85, font: 'F2', color });
  }

  drawPinIcon(x, y, size = 8, color = COLORS.crimson) {
    this.circle(x + size * 0.5, y + size * 0.6, size * 0.4, color);
    this.ops.push(`${rgb(color)} RG`);
    this.ops.push('1 w');
    this.ops.push(`${x + size * 0.2} ${y + size * 0.5} m ${x + size * 0.5} ${y} l ${x + size * 0.8} ${y + size * 0.5} l S`);
    this.circle(x + size * 0.5, y + size * 0.6, size * 0.15, COLORS.white);
  }

  drawCalendarIcon(x, y, size = 10, color = COLORS.muted) {
    this.roundedRect(x, y, size, size * 0.9, 1.5, null, color, 0.8);
    this.line(x, y + size * 0.65, x + size, y + size * 0.65, color, 0.8);
    // loops
    this.line(x + size * 0.25, y + size * 0.85, x + size * 0.25, y + size * 1.05, color, 1);
    this.line(x + size * 0.75, y + size * 0.85, x + size * 0.75, y + size * 1.05, color, 1);
  }

  drawUserIcon(x, y, size = 10, color = COLORS.crimson) {
    this.circle(x + size * 0.5, y + size * 0.7, size * 0.25, color);
    this.ops.push(`${rgb(color)} rg`);
    this.ops.push(`${(x + size * 0.1).toFixed(2)} ${y.toFixed(2)} m ${(x + size * 0.2).toFixed(2)} ${(y + size * 0.4).toFixed(2)} l ${(x + size * 0.8).toFixed(2)} ${(y + size * 0.4).toFixed(2)} l ${(x + size * 0.9).toFixed(2)} ${y.toFixed(2)} l f`);
  }

  drawPhoneIcon(x, y, size = 9, color = COLORS.crimson) {
    this.roundedRect(x, y, size * 0.65, size, 1.5, null, color, 0.9);
    this.circle(x + size * 0.32, y + size * 0.2, size * 0.08, color);
  }

  drawPeacockFeather(cx, cy, scale = 1, angleDeg = 0) {
    // Stylized peacock feather motif
    this.ops.push('q');
    this.ops.push(`${cx} ${cy} cm`);
    if (angleDeg !== 0) {
      const rad = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      this.ops.push(`${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} 0 0 cm`);
    }
    // Outer golden-green glow
    this.ellipse(0, 0, 16 * scale, 22 * scale, [217, 249, 157]); // soft green
    this.ellipse(0, -2 * scale, 12 * scale, 17 * scale, [13, 148, 136]); // teal/emerald
    this.ellipse(0, -4 * scale, 8 * scale, 12 * scale, [202, 138, 4]); // rich gold
    this.ellipse(0, -5 * scale, 5 * scale, 8 * scale, [3, 105, 161]); // deep sapphire
    this.ellipse(0, -6 * scale, 2.5 * scale, 4 * scale, [15, 23, 42]); // deep navy eye
    // Vanes radiating
    this.ops.push(`${rgb(COLORS.primaryGreen)} RG`);
    this.ops.push('0.6 w');
    for (let a = -40; a <= 40; a += 12) {
      const rad = (a * Math.PI) / 180;
      const x1 = Math.sin(rad) * 16 * scale;
      const y1 = Math.cos(rad) * 22 * scale;
      const x2 = Math.sin(rad) * 26 * scale;
      const y2 = Math.cos(rad) * 34 * scale;
      this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    }
    this.ops.push('Q');
  }

  drawQrCode(textVal, x, y, size = 48) {
    try {
      const qr = QRCode.create(textVal, { errorCorrectionLevel: 'M' });
      const numModules = qr.modules.size;
      const modSize = size / numModules;
      this.ops.push(`${rgb(COLORS.navyDark)} rg`);
      for (let r = 0; r < numModules; r++) {
        for (let c = 0; c < numModules; c++) {
          if (qr.modules.get(r, c)) {
            const mx = x + c * modSize;
            const my = y + (numModules - 1 - r) * modSize;
            this.ops.push(`${mx.toFixed(2)} ${my.toFixed(2)} ${modSize.toFixed(2)} ${modSize.toFixed(2)} re f`);
          }
        }
      }
    } catch (e) {
      console.error('QR draw failed:', e);
      this.rect(x, y, size, size, COLORS.white, COLORS.border, 1);
      this.text('QR', x + 15, y + 20, { size: 10, font: 'F2', color: COLORS.muted });
    }
  }

  render(booking) {
    const logoData = this.loadLogo();
    const isDharamshala = String(booking.service_billing_model || '') === 'dharamshala_booking' || String(booking.propertyType || '').toLowerCase() === 'dharamshala';
    const isCab = booking.bookingType === 'cab';
    const isTour = booking.bookingType === 'tour';
    const isHotel = !isDharamshala && !isCab && !isTour;

    // Background subtle ivory tone
    this.rect(0, 0, this.width, this.height, [255, 255, 255]);

    // 1. TOP HEADER (y = 841.89 down to 732)
    this.rect(0, 730, this.width, 112, COLORS.ivoryBg);
    this.rect(0, 838, this.width, 3.89, COLORS.accentGold);

    // Peacock feather decorative flourishes in top corners
    this.drawPeacockFeather(this.width - 24, 822, 0.7, -35);

    // Left: Logo (aspect ratio 672 / 573 = 1.1728)
    const logoW = 56;
    const logoH = logoW / 1.1728; // 47.75 pt
    const logoX = 28;
    const logoY = 752;

    if (logoData) {
      this.ops.push('q');
      this.ops.push(`${logoW.toFixed(2)} 0 0 ${logoH.toFixed(2)} ${logoX.toFixed(2)} ${logoY.toFixed(2)} cm`);
      this.ops.push('/Logo Do');
      this.ops.push('Q');
      this.roundedRect(logoX - 1, logoY - 1, logoW + 2, logoH + 2, 4, null, COLORS.goldBorder, 0.8);
    } else {
      this.roundedRect(logoX, logoY, logoW, logoH, 4, COLORS.primaryGreen);
      this.text('VS', logoX + 16, logoY + 16, { size: 16, font: 'F2', color: COLORS.white });
    }

    // Center: Brand & Identity
    const centerX = 96;
    this.text('Vrindavan Sarthi Enterprises', centerX, 794, { size: 15.5, font: 'F2', color: COLORS.primaryGreen });
    this.text('Formerly known as Vrindavan Sarthi', centerX, 781, { size: 8.5, font: 'F1', color: COLORS.subGreen });
    
    // Decorative flourish / divider
    this.line(centerX, 773, centerX + 180, 773, COLORS.accentGold, 0.8);
    this.circle(centerX + 90, 773, 2.5, COLORS.accentGold);

    // Tagline in serif/gold
    this.text('Your True Companion On The Journey', centerX + 18, 760, { size: 9.5, font: 'F2', color: [133, 77, 14] });

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
    this.text(docTitle1, rightMargin - textWidth(docTitle1, 9.5), 800, { size: 9.5, font: 'F2', color: COLORS.navy });
    this.text(docTitle2, rightMargin - textWidth(docTitle2, 9.5), 788, { size: 9.5, font: 'F2', color: COLORS.navy });

    const genDateStr = `Generated: ${formatIstDateTime(new Date())}`;
    this.text(genDateStr, rightMargin - textWidth(genDateStr, 7), 775, { size: 7, color: COLORS.muted });

    // Booking Voucher Pill
    const voucherText = 'Booking Voucher';
    const vw = textWidth(voucherText, 8.5) + 24;
    const vx = rightMargin - vw;
    this.roundedRect(vx, 755, vw, 16, 8, COLORS.goldLight, COLORS.goldBorder, 0.8);
    this.text(voucherText, vx + 12, 759.5, { size: 8.5, font: 'F2', color: COLORS.amberText });

    const subVoucher = 'Please show this at property reception';
    this.text(subVoucher, rightMargin - textWidth(subVoucher, 6.8), 744, { size: 6.8, font: 'F1', color: COLORS.lightMuted });

    // 2. HORIZONTAL STATUS & VERIFICATION BAR (y = 724 down to 666, Height: 58 pt)
    const barY = 666;
    const barH = 58;
    this.roundedRect(this.margin, barY, this.width - this.margin * 2, barH, 4, COLORS.white, COLORS.border, 1);

    // Left segment: Reservation Confirmed (width: 145 pt)
    const isConfirmed = ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled'].includes(String(booking.bookingStatus || '').toLowerCase()) || booking.paymentStatus === 'paid';
    const statusText = isConfirmed ? 'RESERVATION CONFIRMED' : String(booking.bookingStatus || 'PENDING').toUpperCase();
    const statusSubtext = isConfirmed ? 'Your booking is confirmed' : 'Awaiting confirmation';

    const checkCx = this.margin + 20;
    const checkCy = barY + 29;
    this.circle(checkCx, checkCy, 11, isConfirmed ? COLORS.greenSuccess : COLORS.amberText);
    if (isConfirmed) {
      this.drawCheckmark(checkCx, checkCy, 11, COLORS.white);
    } else {
      this.text('!', checkCx - 2.5, checkCy - 4, { size: 10, font: 'F2', color: COLORS.white });
    }
    this.text(statusText, checkCx + 18, barY + 34, { size: 9, font: 'F2', color: isConfirmed ? COLORS.greenSuccess : COLORS.amberText });
    this.text(statusSubtext, checkCx + 18, barY + 20, { size: 7.5, font: 'F1', color: COLORS.muted });

    // Vertical divider 1
    this.line(this.margin + 168, barY + 8, this.margin + 168, barY + barH - 8, COLORS.border, 0.8);

    // Middle segment: Reference & Booking Date (width: 255 pt)
    const midX = this.margin + 182;
    // Reference
    this.drawCalendarIcon(midX, barY + 37, 8, COLORS.muted);
    this.text('BOOKING REFERENCE', midX + 12, barY + 41, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(booking.bookingId || String(booking._id), midX, barY + 26, { size: 10, font: 'F2', color: COLORS.navyDark });

    // Booked On
    const bookedOnX = midX + 145;
    this.drawCalendarIcon(bookedOnX, barY + 37, 8, COLORS.muted);
    this.text('BOOKED ON', bookedOnX + 12, barY + 41, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(formatIstDateTimeShort(booking.createdAt), bookedOnX, barY + 26, { size: 8, font: 'F1', color: COLORS.navy });

    // Vertical divider 2
    this.line(this.margin + 440, barY + 8, this.margin + 440, barY + barH - 8, COLORS.border, 0.8);

    // Right segment: QR Code & Verification (width: ~95 pt)
    const qrSize = 40;
    const qrX = this.margin + 448;
    const qrY = barY + 13;
    const verifyUrl = `https://www.vrindavansarthi.in/verify-booking?ref=${encodeURIComponent(booking.bookingId || '')}`;
    this.drawQrCode(verifyUrl, qrX, qrY, qrSize);
    
    // QR labels
    const qrTextX = qrX + qrSize + 8;
    this.text('Scan to Verify', qrTextX, barY + 36, { size: 6.5, font: 'F2', color: COLORS.slateBlue });
    this.text('Booking Voucher', qrTextX, barY + 26, { size: 6, font: 'F1', color: COLORS.muted });
    this.text(booking.bookingId || '', qrTextX, barY + 16, { size: 5.8, font: 'F2', color: COLORS.navy });

    // 3. MAIN 2-COLUMN SECTION (y = 658 down to 442, Height: 216 pt)
    const colLeftW = 320;
    const colRightW = this.width - this.margin * 2 - colLeftW - 12; // 207.28 pt
    const colRightX = this.margin + colLeftW + 12;

    // --- LEFT COLUMN: ACCOMMODATION & STAY DETAILS ---
    const accY = 442;
    const accH = 216;
    this.roundedRect(this.margin, accY, colLeftW, accH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with Bed Icon
    this.roundedRect(this.margin, accY + accH - 22, colLeftW, 22, 4, COLORS.headerPink);
    this.rect(this.margin, accY + accH - 22, colLeftW, 6, COLORS.headerPink); // square bottom
    this.line(this.margin, accY + accH - 22, this.margin + colLeftW, accY + accH - 22, COLORS.pinkBorder, 0.8);
    
    const bannerTitle = isCab ? 'VEHICLE & JOURNEY DETAILS' : isTour ? 'PILGRIMAGE TOUR DETAILS' : 'ACCOMMODATION & STAY DETAILS';
    this.drawBedIcon(this.margin + 10, accY + accH - 16, 9, COLORS.crimson);
    this.text(bannerTitle, this.margin + 26, accY + accH - 15, { size: 8, font: 'F2', color: COLORS.crimson });

    if (!isCab && !isTour) {
      // Lodging details
      const propName = booking.propertyName || String(booking.itemName || '').split(' - ')[0] || booking.partnerName || 'Property';
      this.text(propName, this.margin + 10, accY + accH - 40, { size: 12, font: 'F2', color: COLORS.navyDark });
      
      // Property ID badge
      const propIdText = `Property ID: ${booking.propertyCode || (booking.hotelId ? `VVS-P-${String(booking.hotelId).slice(-4).toUpperCase()}` : 'VVS-P-1023')}`;
      this.badge(propIdText, this.margin + 10, accY + accH - 56, {
        bg: COLORS.goldLight,
        border: COLORS.goldBorder,
        textCol: COLORS.amberText,
        size: 7.2,
        font: 'F2',
        padX: 5,
        padY: 2,
      });

      // Room Type & Room ID
      const roomName = String(booking.itemName || '').includes(' - ') ? String(booking.itemName || '').split(' - ')[1] : String(booking.itemName || 'Standard Room');
      this.text(`Room Type: ${roomName}`, this.margin + 10, accY + accH - 74, { size: 8.5, font: 'F2', color: COLORS.navy });
      
      // Room ID badge if assigned
      const roomNum = booking.roomNumber || (booking.roomNumbers && booking.roomNumbers[0]) || '203';
      this.badge(`Room ID: ${roomNum}`, this.margin + textWidth(`Room Type: ${roomName}`, 8.5) + 20, accY + accH - 74, {
        bg: COLORS.goldLight,
        border: COLORS.goldBorder,
        textCol: COLORS.amberText,
        size: 7.2,
        font: 'F2',
        padX: 5,
        padY: 2,
      });

      // Address with Red Pin
      const propLoc = booking.propertyAddress || booking.propertyLocation || 'Keshav Dham Road Opposite prem Mandir, Vrindavan';
      this.drawPinIcon(this.margin + 10, accY + accH - 92, 7.5, COLORS.crimson);
      this.wrapped(propLoc, this.margin + 22, accY + accH - 91, colLeftW - 32, { size: 7.8, color: COLORS.slateBlue, lineHeight: 10 });

      // Landmark with Red Pin
      const landmark = booking.nearestTemple ? `Near ${booking.nearestTemple}` : 'Near Prem Mandir';
      this.drawPinIcon(this.margin + 10, accY + accH - 114, 7.5, COLORS.crimson);
      this.text(landmark, this.margin + 22, accY + accH - 113, { size: 7.8, font: 'F1', color: COLORS.slateBlue });

      // Bottom 3-box stay grid (Check-in, Check-out, Duration/Guests)
      const gridBoxY = accY + 12;
      const gridBoxH = 50;
      const gridBoxW = (colLeftW - 20) / 3;

      // Check-in box
      const b1X = this.margin + 8;
      this.roundedRect(b1X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b1X + 8, gridBoxY + 34, 7.5, COLORS.muted);
      this.text('CHECK-IN', b1X + 18, gridBoxY + 36, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.checkIn), b1X + 8, gridBoxY + 22, { size: 7.5, font: 'F2', color: COLORS.navyDark });
      this.text(booking.checkInTime || '12:00 PM', b1X + 8, gridBoxY + 9, { size: 7, color: COLORS.muted });

      // Check-out box
      const b2X = b1X + gridBoxW + 2;
      this.roundedRect(b2X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawCalendarIcon(b2X + 8, gridBoxY + 34, 7.5, COLORS.muted);
      this.text('CHECK-OUT', b2X + 18, gridBoxY + 36, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.checkOut), b2X + 8, gridBoxY + 22, { size: 7.5, font: 'F2', color: COLORS.navyDark });
      this.text('11:00 AM', b2X + 8, gridBoxY + 9, { size: 7, color: COLORS.muted });

      // Duration / Guests box
      const nights = Math.max(1, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))) || 1;
      const guests = booking.guests || ((booking.totalAdults || 1) + (booking.totalChildren || 0));
      const b3X = b2X + gridBoxW + 2;
      this.roundedRect(b3X, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.drawUserIcon(b3X + 8, gridBoxY + 34, 7.5, COLORS.muted);
      this.text('DURATION / GUESTS', b3X + 18, gridBoxY + 36, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(`${nights} Night${nights > 1 ? 's' : ''}`, b3X + 8, gridBoxY + 22, { size: 7.5, font: 'F2', color: COLORS.navyDark });
      this.text(`${guests} Guest(s)${booking.roomQuantity ? ` (${booking.roomQuantity} Room)` : ''}`, b3X + 8, gridBoxY + 9, { size: 6.8, color: COLORS.muted });
    } else if (isCab) {
      // Cab details
      this.text(booking.itemName || 'Dedicated AC Cab Booking', this.margin + 10, accY + accH - 40, { size: 12, font: 'F2', color: COLORS.navyDark });
      this.text(`Vehicle: ${booking.vehicleType || 'AC Sedan / Ertiga'}`, this.margin + 10, accY + accH - 56, { size: 8.5, font: 'F2', color: COLORS.navy });
      
      this.drawPinIcon(this.margin + 10, accY + accH - 74, 7.5, COLORS.crimson);
      this.text(`Pickup: ${booking.pickupAddress || booking.pickupCity || 'Mathura Junction'}`, this.margin + 22, accY + accH - 73, { size: 7.8, font: 'F1', color: COLORS.slateBlue });

      this.drawPinIcon(this.margin + 10, accY + accH - 92, 7.5, COLORS.crimson);
      this.text(`Drop: ${booking.dropAddress || booking.dropCity || 'Vrindavan / Govardhan'}`, this.margin + 22, accY + accH - 91, { size: 7.8, font: 'F1', color: COLORS.slateBlue });

      const gridBoxY = accY + 12;
      const gridBoxH = 50;
      const gridBoxW = (colLeftW - 16) / 2;

      this.roundedRect(this.margin + 8, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.text('JOURNEY DATE', this.margin + 16, gridBoxY + 36, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.travelDate || booking.pickupDate), this.margin + 16, gridBoxY + 22, { size: 7.5, font: 'F2', color: COLORS.navyDark });
      this.text(booking.pickupTime || 'As scheduled', this.margin + 16, gridBoxY + 9, { size: 7, color: COLORS.muted });

      this.roundedRect(this.margin + 8 + gridBoxW + 4, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.text('PASSENGERS', this.margin + 16 + gridBoxW + 4, gridBoxY + 36, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(`${booking.passengers || booking.guests || 1} Traveler(s)`, this.margin + 16 + gridBoxW + 4, gridBoxY + 22, { size: 7.5, font: 'F2', color: COLORS.navyDark });
      this.text('Clean AC Vehicle', this.margin + 16 + gridBoxW + 4, gridBoxY + 9, { size: 6.8, color: COLORS.muted });
    } else {
      // Tour details
      this.text(booking.itemName || 'Braj Dham Pilgrimage Tour', this.margin + 10, accY + accH - 40, { size: 12, font: 'F2', color: COLORS.navyDark });
      this.text(`Package: ${booking.packageName || 'Comprehensive Braj Yatra'}`, this.margin + 10, accY + accH - 56, { size: 8.5, font: 'F2', color: COLORS.navy });
      this.wrapped(`Inclusions: ${booking.inclusions || 'Temple VIP Passes, Satvik Meals & AC Transport'}`, this.margin + 10, accY + accH - 74, colLeftW - 20, { size: 7.8, color: COLORS.slateBlue });

      const gridBoxY = accY + 12;
      const gridBoxH = 50;
      const gridBoxW = (colLeftW - 16) / 2;

      this.roundedRect(this.margin + 8, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.text('TOUR DATE', this.margin + 16, gridBoxY + 36, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(formatIstDateWithDay(booking.tourDate || booking.travelDate || booking.checkIn), this.margin + 16, gridBoxY + 22, { size: 7.5, font: 'F2', color: COLORS.navyDark });
      this.text('Full Day Darshan', this.margin + 16, gridBoxY + 9, { size: 7, color: COLORS.muted });

      this.roundedRect(this.margin + 8 + gridBoxW + 4, gridBoxY, gridBoxW, gridBoxH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
      this.text('DEVOTEES', this.margin + 16 + gridBoxW + 4, gridBoxY + 36, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(`${booking.guests || booking.totalAdults || 1} Devotee(s)`, this.margin + 16 + gridBoxW + 4, gridBoxY + 22, { size: 7.5, font: 'F2', color: COLORS.navyDark });
      this.text('Experienced Yatra Guide', this.margin + 16 + gridBoxW + 4, gridBoxY + 9, { size: 6.8, color: COLORS.muted });
    }

    // --- RIGHT COLUMN: PAYMENT BREAKDOWN ---
    const payY = 442;
    const payH = 216;
    this.roundedRect(colRightX, payY, colRightW, payH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with Rupee Icon
    this.roundedRect(colRightX, payY + payH - 22, colRightW, 22, 4, COLORS.headerPink);
    this.rect(colRightX, payY + payH - 22, colRightW, 6, COLORS.headerPink);
    this.line(colRightX, payY + payH - 22, colRightX + colRightW, payY + payH - 22, COLORS.pinkBorder, 0.8);
    this.drawRupeeIcon(colRightX + 10, payY + payH - 16, 9, COLORS.crimson);
    this.text('PAYMENT BREAKDOWN', colRightX + 28, payY + payH - 15, { size: 8, font: 'F2', color: COLORS.crimson });

    // Financial values
    const roomTariff = Number(booking.dharamshalaAmount || booking.baseAmount || booking.checkoutSubtotal || 0);
    const fee = Number(booking.vrindavanSarthiServiceFee || booking.convenienceFeeAmount || 0);
    const feeName = isDharamshala ? 'Platform Facilitation Fee' : 'Platform Convenience Fee';
    const total = Number(booking.totalAmount || 0);
    const paid = Number(booking.amountPaidOnline ?? booking.advanceAmount ?? 0);
    const balance = Number(booking.amountPayableAtProperty ?? booking.balanceAmount ?? 0);

    // Line 1: Dharamshala Tariff / Base
    const tariffLabel = isDharamshala ? 'Dharamshala Tariff' : isCab ? 'Cab Fare' : isTour ? 'Tour Package Fare' : 'Room Amount';
    const tariffSublabel = isDharamshala ? '(Payable directly to property)' : isCab ? '(Base vehicle transfer fare)' : '(Inclusive of all tour services)';
    this.text(tariffLabel, colRightX + 10, payY + payH - 38, { size: 8, font: 'F2', color: COLORS.navyDark });
    this.text(tariffSublabel, colRightX + 10, payY + payH - 46, { size: 6.2, font: 'F1', color: COLORS.muted });
    const tariffStr = money(roomTariff);
    this.text(tariffStr, colRightX + colRightW - 10 - textWidth(tariffStr, 8.5), payY + payH - 42, { size: 8.5, font: 'F2', color: COLORS.navyDark });

    // Line 2: Platform Fee
    this.text(feeName, colRightX + 10, payY + payH - 58, { size: 8, font: 'F2', color: COLORS.navyDark });
    this.text(`(Paid online to Vrindavan Sarthi)`, colRightX + 10, payY + payH - 66, { size: 6.2, font: 'F1', color: COLORS.muted });
    const feeStr = money(fee);
    this.text(feeStr, colRightX + colRightW - 10 - textWidth(feeStr, 8.5), payY + payH - 62, { size: 8.5, font: 'F2', color: COLORS.navyDark });

    // Box 1: TOTAL BOOKING COST (Cream/Gold)
    const boxTotY = payY + payH - 96;
    this.roundedRect(colRightX + 8, boxTotY, colRightW - 16, 22, 3, COLORS.goldLight, COLORS.goldBorder, 0.8);
    this.text('TOTAL BOOKING COST', colRightX + 14, boxTotY + 7, { size: 8, font: 'F2', color: COLORS.crimson });
    const totStr = money(total);
    this.text(totStr, colRightX + colRightW - 14 - textWidth(totStr, 10.5), boxTotY + 6.5, { size: 10.5, font: 'F2', color: COLORS.crimson });

    // Box 2: Amount Paid Online (Verified) (Green)
    const boxPaidY = boxTotY - 24;
    this.roundedRect(colRightX + 8, boxPaidY, colRightW - 16, 20, 3, COLORS.greenBg, COLORS.greenBorder, 0.8);
    this.drawCheckmark(colRightX + 18, boxPaidY + 10, 4, COLORS.greenSuccess);
    this.text('Amount Paid Online (Verified)', colRightX + 26, boxPaidY + 6.5, { size: 7.2, font: 'F2', color: COLORS.greenSuccess });
    const paidStr = money(paid);
    this.text(paidStr, colRightX + colRightW - 14 - textWidth(paidStr, 8.5), boxPaidY + 6.5, { size: 8.5, font: 'F2', color: COLORS.greenSuccess });

    // Box 3: Balance Payable at Property (Red)
    const boxBalY = boxPaidY - 22;
    const isSettled = balance <= 0;
    const balBg = isSettled ? COLORS.greenBg : COLORS.redBg;
    const balBorder = isSettled ? COLORS.greenBorder : COLORS.redBorder;
    const balColor = isSettled ? COLORS.greenSuccess : COLORS.crimson;
    const balLabel = isSettled ? 'Balance Settled' : (isCab ? 'Payable to Driver' : 'Balance Payable at Property');
    this.roundedRect(colRightX + 8, boxBalY, colRightW - 16, 20, 3, balBg, balBorder, 0.8);
    this.text(balLabel, colRightX + 14, boxBalY + 6.5, { size: 7.2, font: 'F2', color: balColor });
    const balStr = money(balance);
    this.text(balStr, colRightX + colRightW - 14 - textWidth(balStr, 8.5), boxBalY + 6.5, { size: 8.5, font: 'F2', color: balColor });

    // Metadata lines below boxes
    let payMetaY = boxBalY - 14;
    const metaRowH = 11;
    
    // Payment Status
    const statusLabel = isDharamshala && balance > 0
      ? 'Platform Fee Paid - Property Balance Due'
      : balance > 0
      ? 'Advance Paid - Property Balance Due'
      : 'Full Payment Verified';
    this.text('Payment Status :', colRightX + 10, payMetaY, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(statusLabel, colRightX + 72, payMetaY, { size: 6.8, font: 'F2', color: COLORS.navyDark });
    payMetaY -= metaRowH;

    // Payment Mode
    this.text('Payment Mode   :', colRightX + 10, payMetaY, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(booking.paymentMethod === 'online' ? 'Online (Razorpay)' : 'Pay at Property', colRightX + 72, payMetaY, { size: 6.8, color: COLORS.navyDark });
    payMetaY -= metaRowH;

    // Payment ID
    if (booking.razorpayPaymentId) {
      this.text('Payment ID     :', colRightX + 10, payMetaY, { size: 6.8, font: 'F2', color: COLORS.muted });
      this.text(booking.razorpayPaymentId, colRightX + 72, payMetaY, { size: 6.8, font: 'F2', color: COLORS.navyDark });
      payMetaY -= metaRowH;
    }

    // Paid At
    this.text('Paid At        :', colRightX + 10, payMetaY, { size: 6.8, font: 'F2', color: COLORS.muted });
    this.text(formatIstDateTimeShort(booking.paidAt || booking.createdAt), colRightX + 72, payMetaY, { size: 6.8, color: COLORS.navyDark });

    // 4. PRIMARY GUEST DETAILS CARD (y = 434 down to 368, Height: 66 pt)
    const guestY = 368;
    const guestH = 66;
    this.roundedRect(this.margin, guestY, this.width - this.margin * 2, guestH, 4, COLORS.white, COLORS.pinkBorder, 1);

    // Header banner with User Icon
    this.roundedRect(this.margin, guestY + guestH - 20, this.width - this.margin * 2, 20, 4, COLORS.headerPink);
    this.rect(this.margin, guestY + guestH - 20, this.width - this.margin * 2, 6, COLORS.headerPink);
    this.line(this.margin, guestY + guestH - 20, this.width - this.margin, guestY + guestH - 20, COLORS.pinkBorder, 0.8);
    this.drawUserIcon(this.margin + 10, guestY + guestH - 16, 9, COLORS.crimson);
    this.text('PRIMARY GUEST DETAILS', this.margin + 24, guestY + guestH - 14, { size: 8, font: 'F2', color: COLORS.crimson });

    // Guest ID badge on the right
    const guestSuffix = String(booking.userId || booking.bookingId || '191395').replace(/[^0-9]/g, '').slice(-6) || '191395';
    const guestIdStr = `Guest ID: VVS-G-${guestSuffix}`;
    const gw = textWidth(guestIdStr, 7.2) + 12;
    this.badge(guestIdStr, this.width - this.margin - gw - 8, guestY + guestH - 15, {
      bg: COLORS.goldLight,
      border: COLORS.goldBorder,
      textCol: COLORS.amberText,
      size: 7.2,
      font: 'F2',
      padX: 5,
      padY: 2,
    });

    // Content: 2 rows
    const gName = booking.customerFullName || booking.userName || 'Vrindavan Sarthi';
    const gPhone = booking.customerMobile || booking.userPhone || '6396147954';
    const gEmail = booking.customerEmail || booking.userEmail || 'vrindavansarthi108@gmail.com';
    
    // Row 1
    this.text('Guest Name   :', this.margin + 12, guestY + 30, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(gName, this.margin + 74, guestY + 30, { size: 8.5, font: 'F2', color: COLORS.navyDark });

    this.text('Mobile Phone :', this.margin + 230, guestY + 30, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(gPhone, this.margin + 295, guestY + 30, { size: 8, font: 'F1', color: COLORS.navyDark });

    this.text('Email :', this.margin + 380, guestY + 30, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(gEmail, this.margin + 412, guestY + 30, { size: 8, font: 'F1', color: COLORS.navyDark });

    // Row 2: Location
    const city = booking.customerCity || 'Vrindavan';
    const dist = booking.customerDistrict || 'Mathura';
    const state = booking.customerState || 'Uttar Pradesh';
    this.text('City         :', this.margin + 12, guestY + 12, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(city, this.margin + 74, guestY + 12, { size: 7.8, font: 'F1', color: COLORS.navyDark });

    this.text('District:', this.margin + 160, guestY + 12, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(dist, this.margin + 202, guestY + 12, { size: 7.8, font: 'F1', color: COLORS.navyDark });

    this.text('State:', this.margin + 280, guestY + 12, { size: 7.5, font: 'F2', color: COLORS.muted });
    this.text(state, this.margin + 312, guestY + 12, { size: 7.8, font: 'F1', color: COLORS.navyDark });

    // 5. KEY CONTACTS (Left) vs QUICK ACTIONS (Right) (y = 360 down to 296, Height: 64 pt)
    const row5Y = 296;
    const row5H = 64;

    // Left: KEY CONTACTS & ASSISTANCE
    this.roundedRect(this.margin, row5Y, colLeftW, row5H, 4, COLORS.white, COLORS.pinkBorder, 1);
    this.roundedRect(this.margin, row5Y + row5H - 18, colLeftW, 18, 4, COLORS.headerPink);
    this.rect(this.margin, row5Y + row5H - 18, colLeftW, 5, COLORS.headerPink);
    this.line(this.margin, row5Y + row5H - 18, this.margin + colLeftW, row5Y + row5H - 18, COLORS.pinkBorder, 0.8);
    this.drawPhoneIcon(this.margin + 10, row5Y + row5H - 14, 8, COLORS.crimson);
    this.text('KEY CONTACTS & ASSISTANCE', this.margin + 22, row5Y + row5H - 13, { size: 7.5, font: 'F2', color: COLORS.crimson });

    const propPhone = booking.partnerPhone || '9927600017';
    const propNameStr = booking.propertyName || booking.partnerName || 'Property Reception';
    this.text('Property Reception :', this.margin + 10, row5Y + 30, { size: 7.2, font: 'F2', color: COLORS.muted });
    this.text(`${propNameStr}  |  +91 ${propPhone}`, this.margin + 96, row5Y + 30, { size: 7.8, font: 'F2', color: COLORS.navyDark });
    this.text('Key collection, check-in timing, and satvik meal assistance', this.margin + 96, row5Y + 22, { size: 6.5, font: 'F1', color: COLORS.lightMuted });

    this.text('Customer Support   :', this.margin + 10, row5Y + 10, { size: 7.2, font: 'F2', color: COLORS.muted });
    this.text('Vrindavan Sarthi  |  +91 86798 20256', this.margin + 96, row5Y + 10, { size: 7.8, font: 'F2', color: COLORS.navyDark });
    this.text('(9:00 AM – 9:00 PM, Every Day)', this.margin + 96, row5Y + 2, { size: 6.5, font: 'F1', color: COLORS.lightMuted });

    // Right: QUICK ACTIONS (Two clickable action buttons)
    this.roundedRect(colRightX, row5Y, colRightW, row5H, 4, COLORS.white, COLORS.border, 1);
    this.roundedRect(colRightX, row5Y + row5H - 18, colRightW, 18, 4, COLORS.blueHeader);
    this.rect(colRightX, row5Y + row5H - 18, colRightW, 5, COLORS.blueHeader);
    this.line(colRightX, row5Y + row5H - 18, colRightX + colRightW, row5Y + row5H - 18, COLORS.border, 0.8);
    this.text('QUICK ACTIONS', colRightX + 12, row5Y + row5H - 13, { size: 7.5, font: 'F2', color: COLORS.blueText });

    // Action 1: Get Directions (Google Maps)
    const btnW = (colRightW - 18) / 2;
    const btn1X = colRightX + 6;
    const btnY = row5Y + 6;
    const btnH = 34;
    this.roundedRect(btn1X, btnY, btnW, btnH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
    this.drawPinIcon(btn1X + 8, btnY + 14, 8, COLORS.crimson);
    this.text('Get Directions', btn1X + 22, btnY + 20, { size: 7, font: 'F2', color: COLORS.navyDark });
    this.text('( Google Maps )', btn1X + 22, btnY + 10, { size: 6.2, font: 'F1', color: COLORS.muted });
    
    const propLocStr = booking.propertyAddress || booking.propertyLocation || 'Vrindavan';
    const mapLink = booking.googleMapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${propNameStr}, ${propLocStr}, Vrindavan`)}`;
    this.link('Get Directions', mapLink, btn1X + 22, btnY + 20, {
      size: 7,
      box: { x1: btn1X, y1: btnY, x2: btn1X + btnW, y2: btnY + btnH },
    });

    // Action 2: WhatsApp Support
    const btn2X = btn1X + btnW + 6;
    this.roundedRect(btn2X, btnY, btnW, btnH, 4, COLORS.ivoryBg, COLORS.border, 0.8);
    this.circle(btn2X + 12, btnY + 17, 7, COLORS.greenSuccess);
    this.text('W', btn2X + 8.5, btnY + 13.5, { size: 8, font: 'F2', color: COLORS.white });
    this.text('WhatsApp Support', btn2X + 23, btnY + 20, { size: 6.8, font: 'F2', color: COLORS.navyDark });
    this.text('+91 86798 20256', btn2X + 23, btnY + 10, { size: 6.2, font: 'F2', color: COLORS.greenSuccess });
    
    const waLink = 'https://wa.me/918679820256?text=Namaste%20Vrindavan%20Sarthi%20Support';
    this.link('WhatsApp', waLink, btn2X + 23, btnY + 20, {
      size: 6.8,
      box: { x1: btn2X, y1: btnY, x2: btn2X + btnW, y2: btnY + btnH },
    });

    // 6. IMPORTANT GUEST INSTRUCTIONS & PROPERTY POLICIES (y = 288 down to 192, Height: 96 pt)
    const polY = 192;
    const polH = 96;
    this.roundedRect(this.margin, polY, this.width - this.margin * 2, polH, 4, COLORS.white, COLORS.goldBorder, 1);
    this.roundedRect(this.margin, polY + polH - 18, this.width - this.margin * 2, 18, 4, COLORS.amberHeader);
    this.rect(this.margin, polY + polH - 18, this.width - this.margin * 2, 5, COLORS.amberHeader);
    this.line(this.margin, polY + polH - 18, this.width - this.margin, polY + polH - 18, COLORS.goldBorder, 0.8);
    this.text('IMPORTANT GUEST INSTRUCTIONS & PROPERTY POLICIES', this.margin + 12, polY + polH - 13, { size: 7.5, font: 'F2', color: COLORS.amberText });

    const balanceNotice = balance > 0
      ? `Outstanding balance of ${money(balance)} is payable directly to ${propNameStr} reception upon arrival.`
      : 'No further stay charges are due for the reserved dates.';

    const policies = [
      { label: 'Mandatory ID', text: 'Valid government-issued Photo ID (Aadhaar / Passport) is required for every adult guest upon check-in.' },
      { label: 'Check-in Timing', text: 'Standard check-in is 12:00 PM; check-out is 11:00 AM. Late check-out is subject to property availability.' },
      { label: 'Balance Collection', text: balanceNotice },
      { label: 'Spiritual Sanctity', text: 'Unmarried couples are not permitted. Smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited.' },
      { label: 'Cancellation', text: 'Cancellations and refunds are governed by the property terms. Platform facilitation fees are non-refundable after confirmation.' }
    ];

    let rowY = polY + polH - 32;
    policies.forEach((p) => {
      this.circle(this.margin + 14, rowY + 3, 2.5, COLORS.amberText);
      this.text(`${p.label} :`, this.margin + 22, rowY, { size: 6.8, font: 'F2', color: COLORS.navyDark });
      this.text(p.text, this.margin + 104, rowY, { size: 6.8, font: 'F1', color: COLORS.slateBlue });
      rowY -= 13.5;
    });

    // 7. LEGAL & PLATFORM DISCLAIMER (y = 186 down to 132, Height: 54 pt)
    const discY = 132;
    const discH = 54;
    this.roundedRect(this.margin, discY, this.width - this.margin * 2, discH, 4, COLORS.disclaimerBg, COLORS.border, 0.8);
    this.text('LEGAL & PLATFORM DISCLAIMER', this.margin + 12, discY + discH - 12, { size: 7, font: 'F2', color: COLORS.navy });
    const disclaimerText = 'Vrindavan Sarthi acts only as an online booking and payment facilitation platform connecting devotees with independent properties and service providers. Accommodation services are rendered directly by the property partner. The property partner is solely responsible for issuing the official tax invoice for accommodation and for compliance with applicable GST and local regulations. Please present this confirmation receipt at reception.';
    this.wrapped(disclaimerText, this.margin + 12, discY + discH - 24, this.width - this.margin * 2 - 24, { size: 6.5, color: COLORS.muted, lineHeight: 9 });

    // 8. DECORATIVE BRAND FOOTER (y = 122 down to 24)
    this.line(this.margin, 116, this.width - this.margin, 116, COLORS.accentGold, 0.8);

    // Subtle peacock feather in bottom-left and bottom-right
    this.drawPeacockFeather(this.margin - 8, 40, 0.55, 45);
    this.drawPeacockFeather(this.width - this.margin + 8, 40, 0.55, -45);

    // Left footer: Brand Name
    this.text('Vrindavan Sarthi Enterprises', this.margin, 96, { size: 9.5, font: 'F2', color: COLORS.crimson });
    this.text('(Formerly Known as Vrindavan Sarthi)', this.margin, 84, { size: 7, font: 'F1', color: COLORS.muted });

    // Center footer: Address & Websites
    const footMidX = this.margin + 160;
    this.drawPinIcon(footMidX, 93, 6, COLORS.crimson);
    this.text('Raja Wala Mandir, In front of Giriraj Ji Maharaj, Govardhan, Mathura, UP 281502', footMidX + 10, 95, { size: 6.8, font: 'F1', color: COLORS.slateBlue });

    this.text('support@vrindavansarthi.in', footMidX + 10, 82, { size: 6.8, font: 'F2', color: COLORS.crimson });
    this.text('|  www.vrindavansarthi.in  |  www.vrindavansarthi.com', footMidX + 102, 82, { size: 6.8, font: 'F1', color: COLORS.slateBlue });

    // Right footer: Social / Follow Us
    const footRightX = this.width - this.margin - 80;
    this.text('Follow Us', footRightX, 95, { size: 7, font: 'F2', color: COLORS.navy });
    this.text('@VrindavanSarthi', footRightX, 82, { size: 7, font: 'F2', color: COLORS.crimson });

    return this.buildOutput(logoData);
  }

  loadLogo() {
    try {
      const logoPath = path.resolve(__dirname, '../frontend/public/vrindasarthi logo.jpeg');
      const data = fs.readFileSync(logoPath);
      return { data, width: 672, height: 573 };
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

// Generate test PDF with audited booking
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
  customerCity: 'Vrindavan',
  customerDistrict: 'Mathura',
  customerState: 'Uttar Pradesh',
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
  propertyAddress: 'Keshav Dham Road, Opposite Prem Mandir, Vrindavan',
  googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
  nearestTemple: 'Prem Mandir',
  propertyCode: 'VVS-P-1023',
  roomNumber: '203',
};

const builder = new ReferenceMatchedPdfBuilder();
const pdfBuffer = builder.render(booking);
fs.writeFileSync('scratch/reference_matched_receipt.pdf', pdfBuffer);
console.log('Successfully saved scratch/reference_matched_receipt.pdf:', pdfBuffer.length);
