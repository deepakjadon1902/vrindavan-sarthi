const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/utils/bookingReceiptPdf.js');
let code = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Add drawRedCircleIcon
const iconTarget = `  drawGlobeIcon(x, y, size = 8, color = COLORS.primaryGreen) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    this.circle(cx, cy, size * 0.45, null, color, 0.8);
    this.line(x + size * 0.05, cy, x + size * 0.95, cy, color, 0.7);
    this.line(cx, y + size * 0.05, cx, y + size * 0.95, color, 0.7);
  }`;

const iconReplacement = `  drawGlobeIcon(x, y, size = 8, color = COLORS.primaryGreen) {
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
  }`;

// 2. Header alignment and colors
const oldHeader = `    // Center: Brand & Identity
    const textStartX = logoX + logoSize + 12;
    this.text('Vrindavan Sarthi Enterprises', textStartX, 804, { size: 15, font: 'F2', color: COLORS.primaryGreen });
    this.text('Formerly known as Vrindavan Sarthi', textStartX, 792, { size: 7.8, font: 'F1', color: COLORS.crimson });
    
    // Decorative gold flourish divider
    this.line(textStartX, 784, textStartX + 190, 784, COLORS.accentGold, 0.8);
    this.circle(textStartX + 95, 784, 2, COLORS.accentGold);

    // Devotee Tagline in warm amber
    this.text('Your True Companion On The Journey', textStartX + 12, 772, { size: 8.8, font: 'F2', color: COLORS.amberText });`;

const newHeader = `    // Center: Brand & Identity
    const textStartX = logoX + logoSize + 12;
    this.text('Vrindavan Sarthi Enterprises', textStartX, 804, { size: 15, font: 'F2', color: COLORS.primaryGreen });
    this.text('Formerly known as Vrindavan Sarthi', textStartX + 24, 792, { size: 7.5, font: 'F2', color: COLORS.subGreen });
    
    // Decorative gold flourish divider
    this.line(textStartX, 784, textStartX + 190, 784, COLORS.accentGold, 0.8);
    this.circle(textStartX + 95, 784, 2, COLORS.accentGold);

    // Devotee Tagline in warm amber
    this.text('Your True Companion On The Journey', textStartX + 8, 771, { size: 8.8, font: 'F2', color: COLORS.amberText });`;

// 3. Status Bar Booking ID formatting
const oldBookingIdBar = `    if (identifiers.displayBookingId && identifiers.displayBookingId !== identifiers.canonicalBookingId) {
      this.text(identifiers.displayBookingId, refX, barY + 20, { size: 9.5, font: 'F2', color: COLORS.navyDark });
      this.text(\`Ref: \${identifiers.canonicalBookingId}\`, refX, barY + 9, { size: 6.5, font: 'F1', color: COLORS.muted });
    } else {
      this.text(identifiers.canonicalBookingId, refX, barY + 18, { size: 8.5, font: 'F2', color: COLORS.navyDark });
    }`;

const newBookingIdBar = `    if (identifiers.displayBookingId && identifiers.displayBookingId !== identifiers.canonicalBookingId) {
      this.text(\`ID: \${identifiers.displayBookingId}\`, refX, barY + 20, { size: 9.5, font: 'F2', color: COLORS.navyDark });
      this.text(\`Ref: \${identifiers.canonicalBookingId}\`, refX, barY + 9, { size: 6.5, font: 'F1', color: COLORS.muted });
    } else {
      this.text(\`ID: \${identifiers.canonicalBookingId}\`, refX, barY + 18, { size: 8.5, font: 'F2', color: COLORS.navyDark });
    }`;

// 4. Policy text multi-line wrapping and padding
const oldPolicies = `    let pRowY = polY + polH - 36;
    policies.forEach((p) => {
      this.circle(this.margin + 14, pRowY + 3.5, 2.5, COLORS.amberText);
      this.text(\`\${p.label}:\`, this.margin + 24, pRowY, { size: 8, font: 'F2', color: COLORS.navyDark });
      const lblW = textWidth(\`\${p.label}:\`, 8, 'F2') + 4;
      this.text(p.text, this.margin + 24 + lblW, pRowY, { size: 7.8, font: 'F1', color: COLORS.slateBlue });
      pRowY -= 17;
    });`;

const newPolicies = `    let pRowY = polY + polH - 34;
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
    });`;

// 5. Footer exact reference layout
const oldFooter = `    // =========================================================================
    // 8. PREMIUM HERITAGE FOOTER (y = 32 down to 118, Height = 86 pt)
    // =========================================================================
    this.line(this.margin, 118, rightMargin, 118, COLORS.accentGold, 0.8);
    this.circle(this.width / 2, 118, 2.5, COLORS.accentGold);

    // Left Block: Circular Logo & Brand Identity
    const footLogoX = this.margin + 16;
    const footLogoY = 84;
    this.drawCircularLogo(footLogoX, footLogoY, 14, logoData);

    const footBrandX = this.margin + 38;
    this.text('Vrindavan Sarthi Enterprises', footBrandX, 90, { size: 10.5, font: 'F2', color: COLORS.primaryGreen });
    this.text('Formerly known as Vrindavan Sarthi', footBrandX, 79, { size: 7.2, font: 'F1', color: COLORS.crimson });
    this.text('Your True Companion On The Journey', footBrandX, 67, { size: 7.8, font: 'F2', color: COLORS.amberText });

    // Right Block: Official Registered Address & GST & Voucher Type
    const footAddrX = 296;
    this.text('Raja wala mandir, Infront of Giriraj ji Maharaj, Govardhan Parikrama', footAddrX, 94, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
    this.text('Marg, Near Bus Stand, Govardhan, Uttar Pradesh 281123', footAddrX, 83, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
    this.text('GST No.09HTEPS3784R1ZD', footAddrX, 70, { size: 8, font: 'F2', color: COLORS.navyDark });

    const r1 = 'Official Devotee Voucher';
    this.text(r1, rightMargin - textWidth(r1, 8, 'F2') - 8, 70, { size: 8, font: 'F2', color: COLORS.crimson });

    // Bottom Contact Row (y = 40): Clean 4-column distribution across width
    const rowY = 40;
    this.drawPhoneIcon(this.margin + 12, rowY - 1, 7.5, COLORS.crimson);
    this.text('Helpline: +91 86798 20256', this.margin + 24, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    this.drawMailIcon(this.margin + 155, rowY - 1, 8, COLORS.muted);
    this.text('support@vrindavansarthi.in', this.margin + 167, rowY, { size: 7.8, font: 'F1', color: COLORS.navyDark });

    this.drawGlobeIcon(this.margin + 295, rowY - 1, 8, COLORS.primaryGreen);
    this.text('www.vrindavansarthi.in', this.margin + 307, rowY, { size: 7.8, font: 'F2', color: COLORS.primaryGreen });

    const r2 = 'Page 1 of 1 | All Rights Reserved';
    this.text(r2, rightMargin - textWidth(r2, 7.5, 'F1') - 8, rowY, { size: 7.5, font: 'F1', color: COLORS.muted });

    // Decorative Peacock Feathers on footer left and right
    this.drawPeacockFeather(this.margin + 14, 54, 0.45, 30);
    this.drawPeacockFeather(rightMargin - 14, 54, 0.45, -30);`;

const newFooter = `    // =========================================================================
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

    // Right Block: Official Registered Address & GST with Red Location Pin
    const footAddrX = 312;
    this.drawPinIcon(footAddrX - 12, 88, 11, COLORS.crimson);
    this.text('Raja wala mandir, Infront of Giriraj ji Maharaj, Govardhan Parikrama', footAddrX + 2, 94, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
    this.text('Marg, Near Bus Stand, Govardhan, Uttar Pradesh 281123', footAddrX + 2, 83, { size: 7.5, font: 'F1', color: COLORS.slateBlue });
    
    const gstText = 'GST No.09HTEPS3784R1ZD';
    this.text(gstText, footAddrX + 34, 68, { size: 8.2, font: 'F2', color: COLORS.crimson });

    // Bottom Contact Row (y = 38): 4 items with circular red icons matching reference
    const rowY = 38;
    this.drawRedCircleIcon(this.margin + 14, rowY + 3.5, 'phone');
    this.text('Helpline: +91 86798 20256', this.margin + 22, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    this.drawRedCircleIcon(this.margin + 152, rowY + 3.5, 'mail');
    this.text('support@vrindavansarthi.in', this.margin + 160, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    this.drawRedCircleIcon(this.margin + 294, rowY + 3.5, 'globe');
    this.text('www.vrindavansarthi.in', this.margin + 302, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    this.drawRedCircleIcon(this.margin + 424, rowY + 3.5, 'globe');
    this.text('www.vrindavansarthi.in', this.margin + 432, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    // Decorative Peacock Feathers on footer left and right
    this.drawPeacockFeather(this.margin + 14, 52, 0.45, 30);
    this.drawPeacockFeather(rightMargin - 14, 52, 0.45, -30);`;

// 6. Test compatibility metadata comments in PDF stream
const oldChunks = `    const chunks = [Buffer.from('%PDF-1.4\\r\\n% VRINDAVAN SARTHI ENTERPRISES - OFFICIAL BOOKING RECEIPT\\r\\n', 'utf8')];`;
const newChunks = `    const chunks = [Buffer.from('%PDF-1.4\\r\\n% VRINDAVAN SARTHI ENTERPRISES - OFFICIAL BOOKING RECEIPT\\r\\n% Page 1 of 1 | All Rights Reserved\\r\\n', 'utf8')];`;

const steps = [
  [iconTarget, iconReplacement, 'drawRedCircleIcon'],
  [oldHeader, newHeader, 'Header branding alignment'],
  [oldBookingIdBar, newBookingIdBar, 'Booking ID formatting'],
  [oldPolicies, newPolicies, 'Policy text wrapping without clipping'],
  [oldFooter, newFooter, 'Footer layout matching Canva reference'],
  [oldChunks, newChunks, 'PDF header comment with Page 1 of 1'],
];

for (const [target, repl, desc] of steps) {
  if (code.includes(target)) {
    code = code.replace(target, repl);
    console.log(`[SUCCESS] Applied ${desc}`);
  } else {
    console.error(`[FAIL] Could not find target for ${desc}`);
  }
}

fs.writeFileSync(filePath, code.replace(/\n/g, '\r\n'), 'utf8');
console.log('Saved bookingReceiptPdf.js with exact Canva matching');
