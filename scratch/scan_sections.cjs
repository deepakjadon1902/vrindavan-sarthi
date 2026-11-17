const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  
  // We can render the image into an HTML canvas and analyze the brightness / boundaries of sections
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

  // Let's crop slices of the reference image:
  // 0 - 15% (header)
  // 15 - 25% (status bar)
  // 25 - 60% (middle cards)
  // 60 - 75% (contacts / actions / policies)
  // 75 - 90% (disclaimer / instructions)
  // 90 - 100% (footer)
  
  const slices = [
    { name: 'slice_header', y: 0, h: 150 },
    { name: 'slice_status', y: 140, h: 100 },
    { name: 'slice_mid_top', y: 230, h: 220 },
    { name: 'slice_mid_bot', y: 440, h: 220 },
    { name: 'slice_lower_mid', y: 650, h: 200 },
    { name: 'slice_bottom', y: 840, h: 184 },
  ];

  for (const s of slices) {
    const sliceData = await page.evaluate((s) => {
      const c = document.getElementById('c');
      const tempC = document.createElement('canvas');
      tempC.width = 733;
      tempC.height = s.h;
      const tCtx = tempC.getContext('2d');
      tCtx.drawImage(c, 0, s.y, 733, s.h, 0, 0, 733, s.h);
      return tempC.toDataURL('image/png');
    }, s);

    const b64 = sliceData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(`scratch/${s.name}.png`, Buffer.from(b64, 'base64'));
    console.log(`Saved scratch/${s.name}.png`);
  }

  await browser.close();
})();
