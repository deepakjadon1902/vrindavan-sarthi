const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });

  // 1. Inspect Cabs
  await page.goto('http://localhost:8081/cabs', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/inspect_cabs_mobile_412.png', fullPage: true });

  const cabGridInfo = await page.evaluate(() => {
    const grid = document.querySelector('main .grid');
    if (!grid) return null;
    const computed = window.getComputedStyle(grid);
    const children = Array.from(grid.children);
    return {
      className: grid.className,
      display: computed.display,
      gridTemplateColumns: computed.gridTemplateColumns,
      gap: computed.gap,
      childCount: children.length,
      childrenBoxes: children.slice(0, 6).map((c, i) => {
        const rect = c.getBoundingClientRect();
        return {
          index: i + 1,
          tagName: c.tagName,
          className: c.className,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
    };
  });
  console.log('CABS GRID INFO:\n', JSON.stringify(cabGridInfo, null, 2));

  // 2. Inspect Tours
  await page.goto('http://localhost:8081/tours', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/inspect_tours_mobile_412.png', fullPage: true });

  const tourGridInfo = await page.evaluate(() => {
    const grid = document.querySelector('main .grid');
    if (!grid) return null;
    const computed = window.getComputedStyle(grid);
    const children = Array.from(grid.children);
    return {
      className: grid.className,
      display: computed.display,
      gridTemplateColumns: computed.gridTemplateColumns,
      gap: computed.gap,
      childCount: children.length,
      childrenBoxes: children.slice(0, 6).map((c, i) => {
        const rect = c.getBoundingClientRect();
        return {
          index: i + 1,
          tagName: c.tagName,
          className: c.className,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
    };
  });
  console.log('TOURS GRID INFO:\n', JSON.stringify(tourGridInfo, null, 2));

  await browser.close();
})().catch(console.error);
