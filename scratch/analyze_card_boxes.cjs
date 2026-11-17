const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
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

  // Let's analyze horizontal line brightness across the reference image height (1024px)
  // to detect where section dividers, card borders, and backgrounds start and end.
  const rowProfiles = await page.evaluate(() => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    const imgData = ctx.getImageData(0, 0, 733, 1024);
    const data = imgData.data;
    
    const results = [];
    for (let y = 0; y < 1024; y += 4) {
      let rSum = 0, gSum = 0, bSum = 0;
      let count = 0;
      for (let x = 50; x < 683; x += 4) {
        const idx = (y * 733 + x) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
      results.push({
        y,
        avgR: Math.round(rSum / count),
        avgG: Math.round(gSum / count),
        avgB: Math.round(bSum / count),
        brightness: Math.round((rSum + gSum + bSum) / (3 * count))
      });
    }
    return results;
  });

  // Also let's check our prototype heights:
  // How tall were our elements in reference_booking.html?
  await page.goto('file:///' + require('path').resolve('prototype-receipt-a4/reference_booking.html').replace(/\\/g, '/'));
  const protoMetrics = await page.evaluate(() => {
    const container = document.querySelector('.page-container');
    const header = document.querySelector('.header');
    const status = document.querySelector('.status-bar');
    const middleGrid = document.querySelector('.middle-grid');
    const contactsRow = document.querySelector('.contacts-row');
    const policies = document.querySelector('.card-policies');
    const disclaimer = document.querySelector('.card-disclaimer');
    const footer = document.querySelector('.footer');
    
    return {
      containerHeight: container.offsetHeight,
      containerScrollHeight: container.scrollHeight,
      headerHeight: header ? header.offsetHeight : 0,
      statusHeight: status ? status.offsetHeight : 0,
      middleGridHeight: middleGrid ? middleGrid.offsetHeight : 0,
      contactsRowHeight: contactsRow ? contactsRow.offsetHeight : 0,
      policiesHeight: policies ? policies.offsetHeight : 0,
      disclaimerHeight: disclaimer ? disclaimer.offsetHeight : 0,
      footerHeight: footer ? footer.offsetHeight : 0,
      sumChildren: (header ? header.offsetHeight : 0) +
        (status ? status.offsetHeight : 0) +
        (middleGrid ? middleGrid.offsetHeight : 0) +
        (contactsRow ? contactsRow.offsetHeight : 0) +
        (policies ? policies.offsetHeight : 0) +
        (disclaimer ? disclaimer.offsetHeight : 0) +
        (footer ? footer.offsetHeight : 0)
    };
  });

  console.log('Prototype element heights (px in 96 DPI):', protoMetrics);
  
  await browser.close();
})();
