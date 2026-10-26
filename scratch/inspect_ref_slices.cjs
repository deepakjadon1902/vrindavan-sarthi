const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  
  // Let's create an interactive viewer or extract coordinates of elements from ref
  await page.setContent(`
    <img id="img" src="${refB64}" style="width: 733px; height: 1024px; display: block;" />
  `);
  
  // Let's take screenshots of 10 equal horizontal bands of the reference image
  for (let i = 0; i < 10; i++) {
    const y = i * 102.4;
    const clip = { x: 0, y: Math.round(y), width: 733, height: 102 };
    await page.screenshot({ path: `scratch/band_${i}.png`, clip });
  }

  console.log('Saved 10 bands from reference image');
  await browser.close();
})();
