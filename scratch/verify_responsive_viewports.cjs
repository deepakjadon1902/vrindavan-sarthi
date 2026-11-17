const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:8081';

const viewports = [
  { name: '320px', width: 320, height: 640 },
  { name: '375px', width: 375, height: 667 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '1440px', width: 1440, height: 900 },
];

const routes = [
  { name: 'Home', path: '/' },
  { name: 'Hotels', path: '/hotels' },
  { name: 'Rooms', path: '/rooms' },
  { name: 'Cabs', path: '/cabs' },
  { name: 'Tours', path: '/tours' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
  { name: 'CancellationPolicy', path: '/cancellation-policy' },
  { name: 'Terms', path: '/terms' },
  { name: 'Privacy', path: '/privacy' },
];

async function main() {
  console.log('Launching headless browser for responsive viewport audit...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let totalTests = 0;
  let totalPass = 0;
  const issues = [];

  for (const r of routes) {
    for (const vp of viewports) {
      totalTests++;
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.toString()));

      try {
        await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(500);

        const scrollInfo = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          return {
            docScrollWidth: doc.scrollWidth,
            bodyScrollWidth: body ? body.scrollWidth : 0,
            clientWidth: doc.clientWidth,
            innerWidth: window.innerWidth,
          };
        });

        const overflow = Math.max(scrollInfo.docScrollWidth, scrollInfo.bodyScrollWidth) > scrollInfo.innerWidth + 1; // 1px threshold for subpixel

        if (overflow) {
          issues.push({
            route: r.name,
            viewport: vp.name,
            expected: vp.width,
            actual: Math.max(scrollInfo.docScrollWidth, scrollInfo.bodyScrollWidth),
            type: 'HORIZONTAL_OVERFLOW',
          });
          console.log(`❌ FAIL [${r.name} @ ${vp.name}]: Overflow detected (${scrollInfo.docScrollWidth}px > ${vp.width}px)`);
        } else if (pageErrors.length > 0) {
          issues.push({
            route: r.name,
            viewport: vp.name,
            errors: pageErrors,
            type: 'PAGE_ERROR',
          });
          console.log(`❌ FAIL [${r.name} @ ${vp.name}]: Page Error: ${pageErrors[0]}`);
        } else {
          totalPass++;
          console.log(`✅ PASS [${r.name} @ ${vp.name}]: Clean layout, 0 overflow (Width: ${scrollInfo.clientWidth}px)`);
        }
      } catch (err) {
        issues.push({
          route: r.name,
          viewport: vp.name,
          error: err.message,
          type: 'TIMEOUT_OR_CRASH',
        });
        console.log(`❌ FAIL [${r.name} @ ${vp.name}]: ${err.message}`);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  console.log('\n========================================');
  console.log(`Audit Summary: ${totalPass}/${totalTests} Passed`);
  console.log(`Total Issues: ${issues.length}`);
  console.log('========================================');

  if (issues.length > 0) {
    console.error('Issues:', JSON.stringify(issues, null, 2));
    process.exit(1);
  } else {
    console.log('All viewports passed responsiveness and zero horizontal scroll check!');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
