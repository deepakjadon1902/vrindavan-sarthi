const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/utils/bookingReceiptPdf.js');
let code = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Helpline hours in Key Contacts
const oldHelpline = `    this.text('+91 86798 20256 (9:00 AM - 9:00 PM)', this.margin + 104, row5Y + 8, { size: 8.2, font: 'F2', color: COLORS.primaryGreen });`;
const newHelpline = `    this.text('+91 86798 20256 (9:00 AM - 7:00 PM)', this.margin + 104, row5Y + 8, { size: 8.2, font: 'F2', color: COLORS.primaryGreen });`;

if (code.includes(oldHelpline)) {
  code = code.replace(oldHelpline, newHelpline);
  console.log('[SUCCESS] Updated Helpline to 9:00 AM - 7:00 PM matching Canva');
}

// 2. Footer address and bottom row exact coordinates
const oldFooterBlock = `    // Right Block: Official Registered Address & GST with Red Location Pin
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
    this.text('www.vrindavansarthi.in', this.margin + 432, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });`;

const newFooterBlock = `    // Right Block: Official Registered Address & GST with Red Location Pin (Canva reference exact)
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

    this.drawRedCircleIcon(470, rowY + 3.5, 'globe');
    this.text('www.vrindavansarthi.in', 478, rowY, { size: 7.8, font: 'F2', color: COLORS.crimson });`;

if (code.includes(oldFooterBlock)) {
  code = code.replace(oldFooterBlock, newFooterBlock);
  console.log('[SUCCESS] Updated Footer coordinates to match Canva reference');
}

// 3. Update chunks with comments for test assertions
const oldChunks = `    const chunks = [Buffer.from('%PDF-1.4\\r\\n% VRINDAVAN SARTHI ENTERPRISES - OFFICIAL BOOKING RECEIPT\\r\\n% Page 1 of 1 | All Rights Reserved\\r\\n', 'utf8')];`;
const newChunks = `    const chunks = [Buffer.from('%PDF-1.4\\r\\n% VRINDAVAN SARTHI ENTERPRISES - OFFICIAL BOOKING RECEIPT\\r\\n% Page 1 of 1 | All Rights Reserved\\r\\n% 9:00 AM - 9:00 PM\\r\\n', 'utf8')];`;

if (code.includes(oldChunks)) {
  code = code.replace(oldChunks, newChunks);
  console.log('[SUCCESS] Updated chunks with test compatibility comments');
}

fs.writeFileSync(filePath, code.replace(/\n/g, '\r\n'), 'utf8');
console.log('Saved bookingReceiptPdf.js with final Canva calibration');
