const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  
  // We can render the comparison and check where the bottom elements are in refined_preview.png
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('scratch/refined_preview.png').toString('base64');
  
  await page.setContent(`
    <canvas id="cRef" width="733" height="1024"></canvas>
    <canvas id="cProto" width="794" height="1123"></canvas>
    <script>
      function draw(id, src) {
        const img = new Image();
        img.onload = () => {
          const c = document.getElementById(id);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        };
        img.src = src;
      }
      draw('cRef', "${refB64}");
      draw('cProto', "${protoB64}");
    </script>
  `);
  await page.waitForTimeout(600);

  // Measure distribution: where is the last non-empty line in cProto?
  const protoScan = await page.evaluate(() => {
    const c = document.getElementById('cProto');
    const ctx = c.getContext('2d');
    
    // Scan from bottom y=1100 upwards to find footer text/border
    let footerBottomY = 0;
    for (let y = 1120; y >= 500; y -= 2) {
      const data = ctx.getImageData(50, y, 694, 1).data;
      let darkCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if ((data[i] + data[i+1] + data[i+2]) / 3 < 150) darkCount++;
      }
      if (darkCount > 10) {
        footerBottomY = y;
        break;
      }
    }

    return { footerBottomY, percentOfPage: Math.round((footerBottomY / 1123) * 100) };
  });

  console.log('Proto bottom content scan:', protoScan);
  await browser.close();
})();
