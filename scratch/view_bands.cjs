const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  
  // Let's create an HTML that displays all 10 bands with their pixel heights
  let bandsHtml = '';
  for (let i = 0; i < 10; i++) {
    const b64 = fs.readFileSync(`scratch/band_${i}.png`).toString('base64');
    bandsHtml += `
      <div style="margin-bottom: 5px; border: 1px solid red; display: flex; align-items: center; gap: 10px;">
        <span style="width: 100px; color: yellow; font-size: 14px;">Band ${i} (${i*102} - ${(i+1)*102}px)</span>
        <img src="data:image/png;base64,${b64}" style="width: 733px;" />
      </div>
    `;
  }
  
  await page.setContent(`
    <!DOCTYPE html>
    <html><body style="background: #111; padding: 20px;">
      ${bandsHtml}
    </body></html>
  `);
  
  await page.screenshot({ path: 'scratch/all_bands_view.png', fullPage: true });
  console.log('Saved scratch/all_bands_view.png');
  await browser.close();
})();
