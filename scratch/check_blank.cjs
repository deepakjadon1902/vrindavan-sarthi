const { chromium } = require('D:/vrindavan-sarthi/frontend/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const networkResponses = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    pageErrors.push(err.toString() + '\n' + (err.stack || ''));
  });
  page.on('requestfailed', req => {
    failedRequests.push(req.method() + ' ' + req.url() + ' -> ' + (req.failure() ? req.failure().errorText : 'failed'));
  });
  page.on('response', res => {
    if (res.status() >= 400) {
      networkResponses.push(res.status() + ' ' + res.url());
    }
  });

  try {
    console.log('Navigating to http://localhost:8081...');
    const res = await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('HTTP Status:', res ? res.status() : 'null');
    
    // Wait a brief moment for React hydration / render
    await page.waitForTimeout(3000);

    const rootInfo = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        rootExists: !!root,
        rootInnerHTML: root ? root.innerHTML.slice(0, 1000) : null,
        rootChildrenCount: root ? root.children.length : 0,
        bodyInnerHTML: document.body.innerHTML.slice(0, 1000),
        title: document.title,
        url: window.location.href,
        hasVisibleElements: root ? (root.innerText || '').trim().length > 0 : false,
        innerTextSample: root ? (root.innerText || '').slice(0, 200) : ''
      };
    });

    console.log('DOM Info:', JSON.stringify(rootInfo, null, 2));
    console.log('All Console Logs (' + consoleLogs.length + '):', consoleLogs);
    console.log('Console Errors (' + consoleErrors.length + '):', consoleErrors);
    console.log('Page Errors (' + pageErrors.length + '):', pageErrors);
    console.log('Failed Requests (' + failedRequests.length + '):', failedRequests);
    console.log('4xx/5xx Responses (' + networkResponses.length + '):', networkResponses);

    const screenshotPath = path.resolve('scratch', 'diagnostic_blank.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);
  } catch (err) {
    console.error('Diagnostic error:', err);
  } finally {
    await browser.close();
  }
})();
