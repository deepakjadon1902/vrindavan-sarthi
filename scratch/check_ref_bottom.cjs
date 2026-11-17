const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
  
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  
  await page.setContent(`
    <canvas id="c" width="733" height="1024"></canvas>
    <script>
      const img = new Image();
      img.onload = () => {
        const ctx = document.getElementById('c').getContext('2d');
        ctx.drawImage(img, 0, 0);
      };
      img.src = "${refB64}";
    </script>
  `);
  await page.waitForTimeout(500);

  // Let's inspect where the bottom edge of content is in reference image!
  // In the reference image (height 1024), where does the footer actually sit?
  const footerAnalysis = await page.evaluate(() => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    
    // Look at bottom 200 pixels (824 to 1024)
    const scanLines = [];
    for (let y = 800; y < 1024; y += 10) {
      const data = ctx.getImageData(30, y, 673, 1).data;
      let darkCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        if (brightness < 100) darkCount++; // text / icons
      }
      scanLines.push({ y, darkCount });
    }
    return scanLines;
  });

  console.log('Reference image bottom scan:', footerAnalysis);
  await browser.close();
})();
