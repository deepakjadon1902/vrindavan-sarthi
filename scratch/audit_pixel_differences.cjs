const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

  // Load reference image into canvas
  const refB64 = 'data:image/jpeg;base64,' + fs.readFileSync('scratch/reference_receipt.jpg').toString('base64');
  const protoB64 = 'data:image/png;base64,' + fs.readFileSync('prototype-receipt-a4/reference_booking.png').toString('base64');

  await page.setContent(`
    <canvas id="cRef" width="733" height="1024"></canvas>
    <canvas id="cProto" width="794" height="1123"></canvas>
    <script>
      function draw(id, src) {
        return new Promise(resolve => {
          const img = new Image();
          img.onload = () => {
            const c = document.getElementById(id);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            resolve();
          };
          img.src = src;
        });
      }
      window.ready = Promise.all([draw('cRef', "${refB64}"), draw('cProto', "${protoB64}")]);
    </script>
  `);

  await page.waitForFunction(() => window.ready);

  // Analyze specific elements in Reference vs Prototype:
  // 1. Where does the footer text start horizontally in Reference?
  const analysis = await page.evaluate(() => {
    const cRef = document.getElementById('cRef');
    const ctxRef = cRef.getContext('2d');
    const cProto = document.getElementById('cProto');
    const ctxProto = cProto.getContext('2d');

    // In Reference, at y=950-1000, find left-most dark pixel
    let refFooterLeftX = 733;
    for (let y = 940; y < 1010; y++) {
      for (let x = 10; x < 200; x++) {
        const d = ctxRef.getImageData(x, y, 1, 1).data;
        if (d[0] < 120 && d[1] < 120 && d[2] < 120) {
          if (x < refFooterLeftX) refFooterLeftX = x;
        }
      }
    }

    // In Prototype, at y=1050-1100, find left-most dark pixel
    let protoFooterLeftX = 794;
    for (let y = 1050; y < 1100; y++) {
      for (let x = 10; x < 200; x++) {
        const d = ctxProto.getImageData(x, y, 1, 1).data;
        if (d[0] < 120 && d[1] < 120 && d[2] < 120) {
          if (x < protoFooterLeftX) protoFooterLeftX = x;
        }
      }
    }

    // Check padding from page edge:
    // Reference width = 733px. refFooterLeftX as % of width:
    const refLeftPct = ((refFooterLeftX / 733) * 100).toFixed(1);
    // Prototype width = 794px. protoFooterLeftX as % of width:
    const protoLeftPct = ((protoFooterLeftX / 794) * 100).toFixed(1);

    return {
      refFooterLeftX,
      refLeftPct: refLeftPct + '%',
      protoFooterLeftX,
      protoLeftPct: protoLeftPct + '%'
    };
  });

  console.log('Footer left margin comparison:', analysis);
  await browser.close();
})();
