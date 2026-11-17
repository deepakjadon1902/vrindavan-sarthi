const fs = require('fs');

const pdfBytes = fs.readFileSync('C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/.user_uploaded/media_1792955333039_65556779.pdf');
const pdfStr = pdfBytes.toString('binary');

// Find trailer, Info, Producer, Creator
const matchInfo = pdfStr.match(/\/Producer\s*\(([^)]+)\)/i);
const matchCreator = pdfStr.match(/\/Creator\s*\(([^)]+)\)/i);
console.log('Producer:', matchInfo ? matchInfo[1] : 'none');
console.log('Creator:', matchCreator ? matchCreator[1] : 'none');

// Look for font names
const fonts = [...pdfStr.matchAll(/\/BaseFont\s*\/([A-Za-z0-9_-]+)/g)].map(m => m[1]);
console.log('Fonts in ref PDF:', [...new Set(fonts)]);

// Check if there are embedded images
const images = [...pdfStr.matchAll(/\/Subtype\s*\/Image/g)];
console.log('Images in ref PDF:', images.length);
