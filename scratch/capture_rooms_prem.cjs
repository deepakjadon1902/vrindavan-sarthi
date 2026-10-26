const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\acer\\.gemini\\antigravity\\brain\\30fd5737-e168-4511-a71c-a8f15511eb09';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  await page.goto('http://localhost:8081/rooms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Scroll to Near Prem Mandir section
  await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const prem = h2s.find(h => h.innerText.includes('Prem Mandir'));
    if (prem) {
      prem.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rooms_prem_mandir_2cards_mobile_412px.png') });
  console.log('Saved rooms_prem_mandir_2cards_mobile_412px.png');

  // Swipe Prem Mandir row horizontally
  await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const prem = h2s.find(h => h.innerText.includes('Prem Mandir'));
    if (prem) {
      const section = prem.closest('section');
      const track = section.querySelector('.overflow-x-auto');
      if (track) track.scrollLeft = 380;
    }
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rooms_prem_mandir_swiped_mobile_412px.png') });
  console.log('Saved rooms_prem_mandir_swiped_mobile_412px.png');

  await browser.close();
})();
