const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
  
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('prototype-receipt-a4/reference_booking.png').toString('base64');
  
  await page.setContent(`
    <img id="ref" src="${refB64}" />
    <img id="proto" src="${protoB64}" />
  `);
  
  const refDims = await page.evaluate(() => {
    const img = document.getElementById('ref');
    return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
  });
  
  const protoDims = await page.evaluate(() => {
    const img = document.getElementById('proto');
    return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
  });
  
  console.log('Reference dimensions:', refDims);
  console.log('Prototype dimensions:', protoDims);
  
  await browser.close();
})();
