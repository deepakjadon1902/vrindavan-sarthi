const fs = require('fs');
const path = 'backend/utils/bookingReceiptPdf.js';
let content = fs.readFileSync(path, 'utf8');

const target = `    this.drawRedCircleIcon(328, rowY + 3.5, 'globe');
    this.text('www.vrindavansarthi.in', 336, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    this.drawRedCircleIcon(470, rowY + 3.5, 'globe');
    this.text('www.vrindavansarthi.in', 478, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });`;

const replacement = `    this.drawRedCircleIcon(328, rowY + 3.5, 'globe');
    this.text('www.vrindavansarthi.in', 336, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });

    // 4th item: In approved Canva reference authority, www.vrindavansarthi.in appears twice (at x=336 and x=478)
    if (!context.singleWebsiteFooter) {
      this.drawRedCircleIcon(470, rowY + 3.5, 'globe');
      this.text('www.vrindavansarthi.in', 478, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });
    }`;

// Normalize line endings for replacement
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedTarget = target.replace(/\r\n/g, '\n');
const normalizedReplacement = replacement.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedTarget)) {
  const updated = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  // Restore CRLF
  fs.writeFileSync(path, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully patched backend/utils/bookingReceiptPdf.js');
} else {
  console.log('Target NOT found in backend/utils/bookingReceiptPdf.js');
}
