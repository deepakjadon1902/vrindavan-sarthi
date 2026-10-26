const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
  
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  
  // Let's inspect the cards in the reference image
  // We can render each card's approximate coordinates to PNG to read what's in them:
  // Card 1 & 2: Accommodation & Payment (around y=230 to 520)
  // Card 3 & 4: Key Contacts & Quick Actions (around y=520 to 650)
  // Card 5: Important Guest Instructions (around y=650 to 800)
  // Card 6: Legal & Platform Disclaimer (around y=800 to 920)
  // Footer: (around y=930 to 1010)

  const regions = [
    { name: 'ref_contacts_actions', y: 480, h: 180 },
    { name: 'ref_policies', y: 640, h: 200 },
    { name: 'ref_disclaimer', y: 810, h: 140 },
    { name: 'ref_footer', y: 930, h: 90 },
  ];

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

  for (const r of regions) {
    const dataUrl = await page.evaluate((r) => {
      const c = document.getElementById('c');
      const tempC = document.createElement('canvas');
      tempC.width = 733;
      tempC.height = r.h;
      const tCtx = tempC.getContext('2d');
      tCtx.drawImage(c, 0, r.y, 733, r.h, 0, 0, 733, r.h);
      return tempC.toDataURL('image/png');
    }, r);

    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(`scratch/${r.name}.png`, Buffer.from(b64, 'base64'));
    console.log(`Saved scratch/${r.name}.png`);
  }

  await browser.close();
})();
