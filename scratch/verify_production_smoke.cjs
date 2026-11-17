const { chromium } = require('D:/vrindavan-sarthi/frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/acer/.gemini/antigravity/brain/0e76a3e8-689e-47bb-a51f-ed198dd0bebd';
const BASE_URL = 'https://www.vrindavansarthi.in';

const routes = [
  { name: 'home', path: '/' },
  { name: 'hotels', path: '/hotels' },
  { name: 'rooms', path: '/rooms' },
  { name: 'cabs', path: '/cabs' },
  { name: 'tours', path: '/tours' },
];

const viewports = [
  { name: 'mobile_390', width: 390, height: 844 },
  { name: 'desktop_1280', width: 1280, height: 850 },
];

async function runProductionSmokeTests() {
  console.log(`--- RUNNING COMPREHENSIVE PRODUCTION SMOKE SUITE ON ${BASE_URL} ---`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const results = {
    testedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: {},
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      issues: [],
    },
    screenshots: []
  };

  try {
    for (const route of routes) {
      console.log(`\n==============================================`);
      console.log(`TESTING PRODUCTION ROUTE: ${route.path} (${route.name})`);
      console.log(`==============================================`);
      results.routes[route.name] = {
        path: route.path,
        viewports: {}
      };

      for (const vp of viewports) {
        results.summary.totalChecks++;
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 2,
        });
        const page = await context.newPage();

        const consoleErrors = [];
        const pageErrors = [];
        const failedRequests = [];

        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', err => {
          pageErrors.push(err.toString());
        });
        page.on('requestfailed', req => {
          // Exclude analytics/beacon/optional failures
          const url = req.url();
          if (!url.includes('google-analytics') && !url.includes('analytics')) {
            failedRequests.push(`${req.method()} ${url}: ${req.failure() ? req.failure().errorText : 'failed'}`);
          }
        });

        const targetUrl = `${BASE_URL}${route.path}`;
        const res = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 35000 });
        await page.waitForTimeout(1500);

        const pageAnalysis = await page.evaluate(() => {
          const root = document.getElementById('root');
          const rootChildCount = root ? root.children.length : 0;
          const text = (root ? root.innerText : '') || '';
          const hasText = text.trim().length > 0;
          
          // Check horizontal overflow
          const scrollWidth = document.documentElement.scrollWidth;
          const innerWidth = window.innerWidth;
          const hasOverflow = scrollWidth > innerWidth + 1; // 1px tolerance for subpixel rounding

          // Check broken images
          const imgElements = Array.from(document.querySelectorAll('main img, #root img'));
          const brokenImages = imgElements
            .filter(img => img.complete && img.naturalWidth === 0 && !img.src.startsWith('data:image/svg'))
            .map(img => img.src);

          // Card count
          const cards = document.querySelectorAll('article, [data-testid="listing-card"], .group.relative');

          return {
            title: document.title,
            rootExists: !!root,
            rootChildCount,
            hasText,
            textSample: text.trim().slice(0, 160).replace(/\n+/g, ' '),
            scrollWidth,
            innerWidth,
            hasOverflow,
            totalImages: imgElements.length,
            brokenImagesCount: brokenImages.length,
            brokenImagesSample: brokenImages.slice(0, 3),
            cardsFound: cards.length
          };
        });

        const isRenderOk = pageAnalysis.rootExists && pageAnalysis.rootChildCount > 0 && pageAnalysis.hasText;
        const noPageErrors = pageErrors.length === 0;
        const noOverflow = !pageAnalysis.hasOverflow;
        const checkPassed = isRenderOk && noPageErrors && noOverflow;

        if (checkPassed) {
          results.summary.passedChecks++;
        } else {
          results.summary.failedChecks++;
          results.summary.issues.push(`${route.name} (${vp.name}): Render=${isRenderOk}, Overflow=${pageAnalysis.hasOverflow}, Errors=${pageErrors.length}`);
        }

        const screenshotName = `prod_smoke_${route.name}_${vp.name}.png`;
        const localPath = path.resolve('scratch', screenshotName);
        const artifactPath = path.join(ARTIFACT_DIR, screenshotName);

        await page.screenshot({ path: localPath, fullPage: false });
        fs.copyFileSync(localPath, artifactPath);
        results.screenshots.push(screenshotName);

        console.log(`[${route.name} | ${vp.name}] Status: ${checkPassed ? 'PASS' : 'FAIL'}`);
        console.log(`  Root Render: ${isRenderOk} (Children: ${pageAnalysis.rootChildCount})`);
        console.log(`  Text Sample: "${pageAnalysis.textSample}"`);
        console.log(`  Horizontal Overflow: ${pageAnalysis.hasOverflow ? 'YES (FAIL)' : 'NO (0px PASS)'} (${pageAnalysis.scrollWidth} / ${pageAnalysis.innerWidth})`);
        console.log(`  Broken Images: ${pageAnalysis.brokenImagesCount} of ${pageAnalysis.totalImages}`);
        console.log(`  Cards Detected: ${pageAnalysis.cardsFound}`);
        console.log(`  Page Errors: ${pageErrors.length}, Console Errors: ${consoleErrors.length}`);
        console.log(`  Screenshot: ${screenshotName}`);

        results.routes[route.name].viewports[vp.name] = {
          passed: checkPassed,
          isRenderOk,
          noOverflow,
          pageErrors,
          consoleErrors,
          brokenImagesCount: pageAnalysis.brokenImagesCount,
          cardsFound: pageAnalysis.cardsFound,
          screenshot: screenshotName
        };

        await context.close();
      }
    }

    console.log(`\n==============================================`);
    console.log('PRODUCTION SMOKE TEST SUMMARY');
    console.log(`==============================================`);
    console.log(`Total Checks: ${results.summary.totalChecks}`);
    console.log(`Passed: ${results.summary.passedChecks}`);
    console.log(`Failed: ${results.summary.failedChecks}`);
    if (results.summary.issues.length > 0) {
      console.log('Issues:', results.summary.issues);
    } else {
      console.log('ALL 10 CHECKS PASSED ON PRODUCTION (https://www.vrindavansarthi.in)!');
    }

    fs.writeFileSync(
      path.resolve('scratch', 'prod_smoke_results.json'),
      JSON.stringify(results, null, 2)
    );
  } finally {
    await browser.close();
  }
}

runProductionSmokeTests().catch(err => {
  console.error('Fatal production smoke error:', err);
  process.exit(1);
});
