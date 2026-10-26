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

  const cardHeaders = await page.evaluate(() => {
    const c = document.getElementById('c');
    const ctx = c.getContext('2d');
    
    // We look for horizontal bars where x=50 to 300 has distinct header background:
    // Crimson header: pink/crimson tint (R > 220, G < 235, B < 235)
    // Blue header: blue tint (B > R + 20)
    // Amber header: yellow/amber tint (R > 230, G > 220, B < 210)
    // Slate header: gray tint
    
    const headers = [];
    for (let y = 100; y < 950; y++) {
      const leftPixel = ctx.getImageData(60, y, 1, 1).data;
      const rightPixel = ctx.getImageData(400, y, 1, 1).data;
      headers.push({
        y,
        left: { r: leftPixel[0], g: leftPixel[1], b: leftPixel[2] },
        right: { r: rightPixel[0], g: rightPixel[1], b: rightPixel[2] },
      });
    }
    return headers;
  });

  // Filter contiguous color blocks that look like headers
  const detectedBlocks = [];
  let currentBlock = null;

  for (const h of cardHeaders) {
    const isCrimson = (h.left.r > 220 && h.left.g < 235 && h.left.b < 235 && h.left.g > 180);
    const isAmber = (h.left.r > 240 && h.left.g > 230 && h.left.b < 210);
    const isSlate = (h.left.r > 230 && h.left.r < 250 && Math.abs(h.left.r - h.left.g) < 10 && Math.abs(h.left.g - h.left.b) < 10);
    const isBlue = (h.right.b > h.right.r + 20 && h.right.b > 230);

    const type = isCrimson ? 'crimson' : isAmber ? 'amber' : isSlate ? 'slate' : isBlue ? 'blue' : null;
    if (type) {
      if (!currentBlock || currentBlock.type !== type) {
        if (currentBlock && currentBlock.height >= 10) detectedBlocks.push(currentBlock);
        currentBlock = { type, startY: h.y, endY: h.y, height: 1 };
      } else {
        currentBlock.endY = h.y;
        currentBlock.height = currentBlock.endY - currentBlock.startY + 1;
      }
    } else {
      if (currentBlock) {
        if (currentBlock.height >= 8) detectedBlocks.push(currentBlock);
        currentBlock = null;
      }
    }
  }

  console.log('Detected Card Header Banners in Reference (scale 1024px):');
  console.log(detectedBlocks);

  await browser.close();
})();
