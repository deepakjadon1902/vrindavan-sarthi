const { chromium } = require('D:/vrindavan-sarthi/frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/acer/.gemini/antigravity/brain/0e76a3e8-689e-47bb-a51f-ed198dd0bebd';

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

async function runRecoveryVerification() {
  console.log('--- VRINDAVAN SARTHI: P0 BLANK SCREEN RECOVERY VERIFICATION SUITE ---');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  const results = {
    routes: {},
    summary: {
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      errors: []
    },
    screenshots: []
  };

  try {
    for (const route of routes) {
      console.log(`\n========================================`);
      console.log(`VERIFYING ROUTE: ${route.path} (${route.name})`);
      console.log(`========================================`);
      results.routes[route.name] = {
        path: route.path,
        viewports: {},
        refreshPassed: false
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
          failedRequests.push(`${req.method()} ${req.url()}: ${req.failure() ? req.failure().errorText : 'failed'}`);
        });

        const targetUrl = `http://localhost:8081${route.path}`;
        const res = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 20000 });
        await page.waitForTimeout(1000);

        const domCheck = await page.evaluate(() => {
          const root = document.getElementById('root');
          return {
            rootExists: !!root,
            rootChildCount: root ? root.children.length : 0,
            hasText: root ? (root.innerText || '').trim().length > 0 : false,
            textSample: root ? (root.innerText || '').trim().slice(0, 150).replace(/\n+/g, ' ') : '',
            horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth
          };
        });

        const isOk = domCheck.rootExists && domCheck.rootChildCount > 0 && domCheck.hasText && pageErrors.length === 0;

        if (isOk) {
          results.summary.passedChecks++;
        } else {
          results.summary.failedChecks++;
          results.summary.errors.push(`${route.name} (${vp.name}): Blank or errored - ${pageErrors.join('; ')}`);
        }

        const screenshotFilename = `recovery_${route.name}_${vp.name}.png`;
        const localPath = path.resolve('scratch', screenshotFilename);
        const artifactPath = path.join(ARTIFACT_DIR, screenshotFilename);

        await page.screenshot({ path: localPath, fullPage: false });
        fs.copyFileSync(localPath, artifactPath);
        results.screenshots.push(screenshotFilename);

        console.log(`[${route.name} | ${vp.name}] Status: ${isOk ? 'RENDERED PASS' : 'BLANK FAIL'}`);
        console.log(`  Root Children: ${domCheck.rootChildCount}, Has Text: ${domCheck.hasText}`);
        console.log(`  Text Sample: "${domCheck.textSample}"`);
        console.log(`  Page Errors: ${pageErrors.length}, Console Errors: ${consoleErrors.length}`);
        console.log(`  Screenshot: ${screenshotFilename}`);

        results.routes[route.name].viewports[vp.name] = {
          rendered: isOk,
          rootChildCount: domCheck.rootChildCount,
          hasText: domCheck.hasText,
          pageErrors,
          consoleErrors,
          screenshot: screenshotFilename
        };

        // For desktop viewport, also test page reload persistence
        if (vp.name === 'desktop_1280') {
          console.log(`  Testing refresh persistence for ${route.name}...`);
          const reloadRes = await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(1000);

          const reloadCheck = await page.evaluate(() => {
            const root = document.getElementById('root');
            return {
              rootExists: !!root,
              rootChildCount: root ? root.children.length : 0,
              hasText: root ? (root.innerText || '').trim().length > 0 : false,
            };
          });

          const refreshOk = reloadCheck.rootExists && reloadCheck.rootChildCount > 0 && reloadCheck.hasText;
          results.routes[route.name].refreshPassed = refreshOk;
          console.log(`  Refresh persistence: ${refreshOk ? 'PASS' : 'FAIL'}`);
        }

        await context.close();
      }
    }

    console.log('\n========================================');
    console.log('RECOVERY VERIFICATION SUMMARY');
    console.log('========================================');
    console.log(`Total Checks: ${results.summary.totalChecks}`);
    console.log(`Passed: ${results.summary.passedChecks}`);
    console.log(`Failed: ${results.summary.failedChecks}`);
    if (results.summary.errors.length > 0) {
      console.log('Errors:', results.summary.errors);
    } else {
      console.log('ALL ROUTES RENDERED VISIBLY WITHOUT BLANK SCREENS!');
    }

    fs.writeFileSync(
      path.resolve('scratch', 'recovery_results.json'),
      JSON.stringify(results, null, 2)
    );
  } finally {
    await browser.close();
  }
}

runRecoveryVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
