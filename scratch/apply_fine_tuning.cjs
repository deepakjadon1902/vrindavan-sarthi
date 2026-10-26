const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/utils/bookingReceiptPdf.js');
let code = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Fine-tune header top-right Y positions
const oldRightHeader = `    this.text(docTitle1, rightMargin - textWidth(docTitle1, 9.8, 'F2'), 808, { size: 9.8, font: 'F2', color: COLORS.crimson });
    this.text(docTitle2, rightMargin - textWidth(docTitle2, 9.8, 'F2'), 796, { size: 9.8, font: 'F2', color: COLORS.crimson });

    const genDateStr = \`Generated: \${formatIstDateTimeShort(booking.createdAt || new Date())}\`;
    this.text(genDateStr, rightMargin - textWidth(genDateStr, 7.2), 784, { size: 7.2, font: 'F1', color: COLORS.muted });

    // Booking Voucher Pill
    const voucherText = 'Booking Voucher - Present at Check-in';
    const vw = textWidth(voucherText, 7.5, 'F2') + 16;
    const vx = rightMargin - vw;
    this.roundedRect(vx, 766, vw, 15, 3.5, COLORS.goldLight, COLORS.goldBorder, 0.8);
    this.text(voucherText, vx + 8, 770, { size: 7.5, font: 'F2', color: COLORS.amberText });`;

const newRightHeader = `    this.text(docTitle1, rightMargin - textWidth(docTitle1, 9.8, 'F2'), 804, { size: 9.8, font: 'F2', color: COLORS.crimson });
    this.text(docTitle2, rightMargin - textWidth(docTitle2, 9.8, 'F2'), 792, { size: 9.8, font: 'F2', color: COLORS.crimson });

    const genDateStr = \`Generated: \${formatIstDateTimeShort(booking.createdAt || new Date())}\`;
    this.text(genDateStr, rightMargin - textWidth(genDateStr, 7.2), 778, { size: 7.2, font: 'F1', color: COLORS.muted });

    // Booking Voucher Pill
    const voucherText = 'Booking Voucher - Present at Check-in';
    const vw = textWidth(voucherText, 7.5, 'F2') + 16;
    const vx = rightMargin - vw;
    this.roundedRect(vx, 760, vw, 15, 3.5, COLORS.goldLight, COLORS.goldBorder, 0.8);
    this.text(voucherText, vx + 8, 764, { size: 7.5, font: 'F2', color: COLORS.amberText });`;

// 2. Adjust Policies box height and vertical position to eliminate any overflow
const oldPol = `    // =========================================================================
    // 6. IMPORTANT GUEST GUIDELINES & PROPERTY POLICIES (y = 202 down to 298, Height = 96 pt)
    // =========================================================================
    const polY = 202;
    const polH = 96;
    this.roundedRect(this.margin, polY, usableW, polH, 4, COLORS.white, COLORS.goldBorder, 1);
    this.roundedRect(this.margin, polY + polH - 20, usableW, 20, 4, COLORS.amberHeader);
    this.rect(this.margin, polY + polH - 20, usableW, 6, COLORS.amberHeader);
    this.line(this.margin, polY + polH - 20, this.margin + usableW, polY + polH - 20, COLORS.goldBorder, 0.8);
    this.text('IMPORTANT GUEST GUIDELINES & PROPERTY POLICIES', this.margin + 14, polY + polH - 14, { size: 8.5, font: 'F2', color: COLORS.amberText });

    const balanceNotice = balance > 0
      ? \`Outstanding balance of \${money(balance)} is payable directly to \${propNameStr} reception upon arrival via UPI or Cash.\`
      : 'Balance Cleared: No further stay charges are due for the reserved dates.';

    const policies = [
      { label: 'Mandatory Photo ID', text: 'Valid Government Photo ID (Aadhaar, Voter ID, Passport, or DL) is strictly required for all adult devotees upon check-in.' },
      { label: 'Check-in & Check-out', text: \`Standard check-in is \${formatTimeString12(booking.checkInTime, '12:00 PM')}; check-out is \${formatTimeString12(booking.checkOutTime, '11:00 AM')}. Early check-in is subject to property availability.\` },
      { label: 'Balance Settlement', text: balanceNotice },
      { label: 'Spiritual Sanctity', text: 'To maintain divine sanctity of Braj Dham, smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited on property premises.' },
    ];

    let pRowY = polY + polH - 34;
    policies.forEach((p) => {
      this.circle(this.margin + 14, pRowY + 3.5, 2.5, COLORS.amberText);
      this.text(\`\${p.label}:\`, this.margin + 22, pRowY, { size: 7.8, font: 'F2', color: COLORS.navyDark });
      const lblW = textWidth(\`\${p.label}: \`, 7.8, 'F2');
      
      const availW = usableW - 22 - lblW - 8;
      const lines = wrapText(p.text, availW, 7.5, 'F1');
      if (lines.length === 1) {
        this.text(lines[0], this.margin + 22 + lblW, pRowY, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
        pRowY -= 16;
      } else {
        this.text(lines[0], this.margin + 22 + lblW, pRowY, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
        pRowY -= 9.5;
        for (let i = 1; i < lines.length; i++) {
          this.text(lines[i], this.margin + 22 + lblW, pRowY, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
          pRowY -= (i === lines.length - 1 ? 13 : 9.5);
        }
      }
    });

    // =========================================================================
    // 7. LEGAL NOTICE & PLATFORM FACILITATION DISCLAIMER (y = 126 down to 194, Height = 68 pt)
    // =========================================================================
    const discY = 126;
    const discH = 68;`;

const newPol = `    // =========================================================================
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
      ? \`Outstanding balance of \${money(balance)} is payable directly to \${propNameStr} reception upon arrival via UPI or Cash.\`
      : 'Balance Cleared: No further stay charges are due for the reserved dates.';

    const policies = [
      { label: 'Mandatory Photo ID', text: 'Valid Government Photo ID (Aadhaar, Voter ID, Passport, or DL) is strictly required for all adult devotees upon check-in.' },
      { label: 'Check-in & Check-out', text: \`Standard check-in is \${formatTimeString12(booking.checkInTime, '12:00 PM')}; check-out is \${formatTimeString12(booking.checkOutTime, '11:00 AM')}. Early check-in is subject to property availability.\` },
      { label: 'Balance Settlement', text: balanceNotice },
      { label: 'Spiritual Sanctity', text: 'To maintain divine sanctity of Braj Dham, smoking, alcohol, gambling, and non-vegetarian food are strictly prohibited on property premises.' },
    ];

    let pRowY = polY + polH - 33;
    policies.forEach((p) => {
      this.circle(this.margin + 14, pRowY + 3.2, 2.5, COLORS.amberText);
      this.text(\`\${p.label}:\`, this.margin + 22, pRowY, { size: 7.6, font: 'F2', color: COLORS.navyDark });
      const lblW = textWidth(\`\${p.label}: \`, 7.6, 'F2');
      
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
    const discH = 66;`;

const replacements = [
  [oldRightHeader, newRightHeader, 'Right header Y positions'],
  [oldPol, newPol, 'Policies height and padding expansion'],
];

for (const [target, repl, desc] of replacements) {
  if (code.includes(target)) {
    code = code.replace(target, repl);
    console.log(`[SUCCESS] Applied ${desc}`);
  } else {
    console.error(`[FAIL] Could not find target for ${desc}`);
  }
}

fs.writeFileSync(filePath, code.replace(/\n/g, '\r\n'), 'utf8');
console.log('Saved bookingReceiptPdf.js with updated policies and right header');
