const fs = require('fs');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function checkFooterText() {
  const refPath = 'C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/.user_uploaded/media_1792955333039_65556779.pdf';
  const data = new Uint8Array(fs.readFileSync(refPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const textContent = await page.getTextContent();
  
  // Filter items in the bottom 120 pt
  const bottomItems = textContent.items.filter(item => item.transform[5] < 120);
  console.log('Items in bottom 120 pt of reference:');
  bottomItems.sort((a,b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  for (const item of bottomItems) {
    console.log(`y=${item.transform[5].toFixed(1)}, x=${item.transform[4].toFixed(1)}, font=${item.fontName}: "${item.str}"`);
  }
}
checkFooterText();
