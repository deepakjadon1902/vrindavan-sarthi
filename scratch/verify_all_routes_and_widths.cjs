const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

const BASE_URL = 'http://localhost:8081';

const widths = [
  { name: '320px', width: 320, height: 640 },
  { name: '375px', width: 375, height: 667 },
  { name: '412px', width: 412, height: 924 }, // Pixel 9 from screenshot
  { name: '430px', width: 430, height: 932 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '1440px', width: 1440, height: 900 },
];

const testRoutes = [
  { name: 'Exact Issue Route (RoomTypeDetail)', path: '/room-types/6a92ea5e4cd3e4e13e47ff96?checkIn=2026-10-24&checkOut=2026-10-25' },
  { name: 'Cabs Listing', path: '/cabs' },
  { name: 'Tours Listing', path: '/tours' },
  { name: 'Hotels Listing', path: '/hotels' },
  { name: 'Rooms Listing', path: '/rooms' },
  { name: 'Home', path: '/' },
  { name: 'Invalid Room ID (Graceful Not Found)', path: '/room-types/invalid_room_type_id_test' },
];

async function run() {
  console.log('Launching browser for comprehensive multi-width verification...');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let passed = 0;
  let total = 0;
  const failures = [];

  for (const r of testRoutes) {
    for (const w of widths) {
      total++;
      const context = await browser.newContext({
        viewport: { width: w.width, height: w.height },
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.toString()));

      try {
        await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(600);

        const check = await page.evaluate(() => {
          const doc = document.documentElement;
          const root = document.getElementById('root');
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            innerWidth: window.innerWidth,
            rootLength: root ? root.innerHTML.length : 0,
            hasHeading: Boolean(document.querySelector('h1, h2')),
          };
        });

        const hasOverflow = check.scrollWidth > check.innerWidth + 1;
        const isBlank = check.rootLength < 100;

        if (pageErrors.length > 0) {
          failures.push({ route: r.name, width: w.name, error: pageErrors[0] });
          console.log(`❌ FAIL [${r.name} @ ${w.name}]: Page Error: ${pageErrors[0]}`);
        } else if (isBlank) {
          failures.push({ route: r.name, width: w.name, error: 'BLANK_PAGE_RENDER' });
          console.log(`❌ FAIL [${r.name} @ ${w.name}]: Page rendered blank!`);
        } else if (hasOverflow) {
          failures.push({ route: r.name, width: w.name, error: `OVERFLOW: ${check.scrollWidth}px > ${w.width}px` });
          console.log(`❌ FAIL [${r.name} @ ${w.name}]: Horizontal overflow (${check.scrollWidth}px > ${w.width}px)`);
        } else {
          passed++;
          console.log(`✅ PASS [${r.name} @ ${w.name}]: Rendered OK (${check.rootLength} chars, 0 overflow)`);
        }
      } catch (err) {
        failures.push({ route: r.name, width: w.name, error: err.message });
        console.log(`❌ FAIL [${r.name} @ ${w.name}]: ${err.message}`);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  console.log('\n======================================================');
  console.log(`Summary: ${passed}/${total} Tests Passed`);
  console.log(`Total Failures: ${failures.length}`);
  console.log('======================================================');

  if (failures.length > 0) {
    console.error('Failures list:', failures);
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
