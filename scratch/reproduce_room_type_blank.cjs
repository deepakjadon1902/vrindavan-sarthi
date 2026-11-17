const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 924 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
  });

  const page = await context.newPage();

  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  page.on('pageerror', err => {
    pageErrors.push({
      message: err.message,
      stack: err.stack
    });
  });

  page.on('requestfailed', req => {
    failedRequests.push({
      url: req.url(),
      failure: req.failure()
    });
  });

  const targetUrl = 'http://localhost:8081/room-types/6a92ea5e4cd3e4e13e47ff96?checkIn=2026-10-24&checkOut=2026-10-25';
  console.log(`Navigating to ${targetUrl}...`);

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 20000 });
    console.log(`HTTP Status: ${response.status()}`);
  } catch (err) {
    console.log(`Navigation error: ${err.message}`);
  }

  await page.waitForTimeout(1000);

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText);
  const htmlLength = await page.evaluate(() => document.documentElement.outerHTML.length);
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');

  await page.screenshot({ path: path.resolve(__dirname, 'reproduce_blank.png'), fullPage: true });

  console.log('\n--- PAGE INFO ---');
  console.log('Title:', title);
  console.log('HTML Length:', htmlLength);
  console.log('Root HTML Length:', rootHtml.length);
  console.log('Body Text (first 200 chars):', bodyText.slice(0, 200));

  console.log('\n--- PAGE ERRORS (' + pageErrors.length + ') ---');
  for (const err of pageErrors) {
    console.log('Error:', err.message);
    console.log('Stack:', err.stack);
  }

  console.log('\n--- CONSOLE MESSAGES (' + consoleMessages.length + ') ---');
  for (const msg of consoleMessages) {
    if (msg.type === 'error' || msg.type === 'warning') {
      console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
    }
  }

  console.log('\n--- FAILED REQUESTS (' + failedRequests.length + ') ---');
  for (const req of failedRequests) {
    console.log(`Failed: ${req.url} -> ${JSON.stringify(req.failure)}`);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
