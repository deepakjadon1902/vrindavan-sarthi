const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const artDir = 'C:\\\\Users\\\\acer\\\\.gemini\\\\antigravity\\\\brain\\\\0e76a3e8-689e-47bb-a51f-ed198dd0bebd';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\\\Users\\\\acer\\\\AppData\\\\Local\\\\ms-playwright\\\\chromium-1033\\\\chrome-win\\\\chrome.exe',
    headless: true
  });

  const targets = [
    { url: 'http://localhost:8081/', name: 'home' },
    { url: 'http://localhost:8081/hotels?type=dharamshala', name: 'hotels_dharamshala' },
    { url: 'http://localhost:8081/rooms', name: 'rooms' }
  ];

  const viewports = [
    { width: 320, height: 600, label: '320' },
    { width: 390, height: 844, label: '390' },
    { width: 768, height: 1024, label: '768' },
    { width: 1280, height: 800, label: '1280' }
  ];

  const report = {};

  for (const vp of viewports) {
    for (const t of targets) {
      const key = `${t.name}_${vp.label}`;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();

      const apiCalls = [];
      page.on('response', resp => {
        if (resp.url().includes('/api/')) {
          apiCalls.push({ url: resp.url(), status: resp.status() });
        }
      });

      await page.goto(t.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Screenshot
      const shotName = `restored_${key}.png`;
      const shotPathScratch = path.join('scratch', shotName);
      const shotPathArt = path.join(artDir, shotName);
      await page.screenshot({ path: shotPathScratch, fullPage: false });
      fs.copyFileSync(shotPathScratch, shotPathArt);

      // DOM inspection
      const domData = await page.evaluate(() => {
        const nav = document.querySelector('nav');
        const section = document.querySelector('.braj-page > main > div > section');
        const innerMain = document.querySelector('.braj-page > main > div > main');
        const heading = innerMain ? innerMain.querySelector('h1, h2, h3') : document.querySelector('h1, h2');
        
        // Count cards
        const propertyCards = document.querySelectorAll('[data-testid="listing-card"], .group.relative.flex.flex-col');
        const links = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/hotels/') || a.href.includes('/rooms/'));
        
        // Option B fallback presence
        const optionBFallback = document.querySelector('a[href*="wa.me"]') !== null;

        // Overflow
        const hasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth;

        return {
          navRect: nav ? nav.getBoundingClientRect() : null,
          sectionRect: section ? section.getBoundingClientRect() : null,
          headingRect: heading ? heading.getBoundingClientRect() : null,
          headingText: heading ? heading.textContent.trim().slice(0, 60) : null,
          propertyCardsCount: propertyCards.length,
          listingLinksCount: links.length,
          optionBFallback,
          hasHorizontalOverflow
        };
      });

      report[key] = {
        viewport: vp,
        url: t.url,
        apiCalls,
        domData
      };

      console.log(`[${key}] API Calls: ${apiCalls.length}, Cards: ${domData.propertyCardsCount}, Heading: "${domData.headingText}", Overflow: ${domData.hasHorizontalOverflow}`);
      if (domData.sectionRect && domData.headingRect) {
        const overlap = domData.sectionRect.bottom > domData.headingRect.top;
        const gap = domData.headingRect.top - domData.sectionRect.bottom;
        console.log(`       Section bottom: ${domData.sectionRect.bottom.toFixed(1)}, Heading top: ${domData.headingRect.top.toFixed(1)} -> Gap: ${gap.toFixed(1)}px (Overlap: ${overlap})`);
      }

      await ctx.close();
    }
  }

  await browser.close();
  fs.writeFileSync('scratch/verify_restored_report.json', JSON.stringify(report, null, 2));
  console.log('Verification completed and report saved.');
})();
