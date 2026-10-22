const { chromium } = require('D:/vrindavan-sarthi/frontend/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to https://www.vrindavansarthi.in...');
    const res = await page.goto('https://www.vrindavansarthi.in', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Production HTTP Status:', res.status());
    
    const info = await page.evaluate(() => {
      const root = document.getElementById('root');
      const footer = document.querySelector('footer');
      return {
        title: document.title,
        hasTrackOrder: !!document.body.innerText.match(/Track Order/i),
        hasRadheRadheInFooter: footer ? !!footer.innerText.match(/Radhe Radhe/i) : false,
        sampleText: (document.body.innerText || '').slice(0, 300).replace(/\n+/g, ' ')
      };
    });
    
    console.log('Live Production Info:', JSON.stringify(info, null, 2));
    await page.screenshot({ path: 'scratch/production_live_check.png', fullPage: false });
  } catch (err) {
    console.error('Production check error:', err.message);
  } finally {
    await browser.close();
  }
})();
