const fs = require('fs');
const path = require('path');

// Inspect PDF for URI link annotations
const pdfPath = path.resolve('prototype-receipt-a4/reference_booking.pdf');
const pdfBuf = fs.readFileSync(pdfPath);
const pdfStr = pdfBuf.toString('binary');

// Look for /URI in PDF stream
const uriMatches = [];
const regex = /\/URI\s*\(([^)]+)\)/g;
let match;
while ((match = regex.exec(pdfStr)) !== null) {
  uriMatches.push(match[1]);
}

console.log('Detected PDF Clickable Link Annotations:');
console.log(uriMatches);
console.log('Total Links Found:', uriMatches.length);
