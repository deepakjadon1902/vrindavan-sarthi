const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const artDir = 'C:\\\\Users\\\\acer\\\\.gemini\\\\antigravity\\\\brain\\\\0e76a3e8-689e-47bb-a51f-ed198dd0bebd';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\\\Users\\\\acer\\\\AppData\\\\Local\\\\ms-playwright\\\\chromium-1033\\\\chrome-win\\\\chrome.exe',
    headless: true
  });

  const viewports = [
    { width: 320, height: 600, label: '320' },
    { width: 390, height: 844, label: '390' },
    { width: 768, height: 1024, label: '768' },
    { width: 1280, height: 800, label: '1280' },
    { width: 1440, height: 900, label: '1440' }
  ];

  const primaryRoutes = [
    { path: '/', name: 'journey_home' },
    { path: '/hotels', name: 'journey_hotels' },
    { path: '/hotels?type=dharamshala', name: 'journey_dharamshala' },
    { path: '/rooms', name: 'journey_rooms' },
  ];

  const detailRoutes = [
    { path: '/hotels/6a93f456114b753bb641effe', name: 'journey_hotel_detail_anukampa' },
    { path: '/rooms/6a93f6db114b753bb641f138', name: 'journey_room_detail_triple' },
    { path: '/cabs', name: 'journey_cabs' },
    { path: '/tours', name: 'journey_tours' },
    { path: '/login', name: 'journey_login' },
  ];

  const results = [];

  // 1. Capture primary routes across all 5 viewports
  for (const vp of viewports) {
    for (const r of primaryRoutes) {
      const shotName = `${r.name}_${vp.label}.png`;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:8081${r.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      const check = await page.evaluate(() => {
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
        const main = document.querySelector('.braj-page > main');
        return { hasOverflow, textLen: main ? main.innerText.length : 0 };
      });

      const scratchPath = path.join('scratch', shotName);
      const artPath = path.join(artDir, shotName);
      await page.screenshot({ path: scratchPath, fullPage: false });
      fs.copyFileSync(scratchPath, artPath);
      results.push({ name: shotName, vp: vp.label, path: r.path, overflow: check.hasOverflow });
      console.log(`Saved: ${shotName} (overflow: ${check.hasOverflow})`);
      await ctx.close();
    }
  }

  // 2. Capture detail routes at 390 and 1280
  for (const vp of [{ width: 390, height: 844, label: '390' }, { width: 1280, height: 800, label: '1280' }]) {
    for (const r of detailRoutes) {
      const shotName = `${r.name}_${vp.label}.png`;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto(`http://localhost:8081${r.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      const check = await page.evaluate(() => {
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;
        const title = document.querySelector('h1, h2');
        return { hasOverflow, title: title ? title.textContent.trim().slice(0, 50) : 'None' };
      });

      const scratchPath = path.join('scratch', shotName);
      const artPath = path.join(artDir, shotName);
      await page.screenshot({ path: scratchPath, fullPage: false });
      fs.copyFileSync(scratchPath, artPath);
      results.push({ name: shotName, vp: vp.label, path: r.path, overflow: check.hasOverflow, title: check.title });
      console.log(`Saved: ${shotName} | Title: "${check.title}" | Overflow: ${check.hasOverflow}`);
      await ctx.close();
    }
  }

  await browser.close();
  fs.writeFileSync('scratch/journey_audit_results.json', JSON.stringify(results, null, 2));
  console.log('Full journey screenshots captured successfully.');
})();
