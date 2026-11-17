const { chromium } = require('D:/vrindavan-sarthi/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  
  try {
    console.log('--- CHECKING LIVE PRODUCTION SITE: https://www.vrindavansarthi.in ---');
    const res = await page.goto('https://www.vrindavansarthi.in', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('HTTP Status:', res.status());

    // Evaluate features of the new UI
    const details = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      const footerText = footer ? footer.innerText : '';
      const bodyText = document.body ? document.body.innerText : '';

      const hasTrackOrder = /Track Order/i.test(bodyText);
      const hasRadheRadhe = /Radhe Radhe/i.test(footerText);
      
      // Look for location discovery section headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => h.innerText.trim());
      const hasPremMandir = headings.some(h => /Prem Mandir/i.test(h));
      const hasIskcon = headings.some(h => /ISKCON/i.test(h));
      const hasMathuraJunction = headings.some(h => /Mathura Junction/i.test(h));

      // Category selector
      const categories = ['Dharamshalas', 'Hotels', 'Home Stays', 'Cabs', 'Tours'];
      const foundCategories = categories.filter(c => new RegExp(c, 'i').test(bodyText));

      // Scripts and version info if available in HTML
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));

      return {
        title: document.title,
        hasTrackOrder,
        hasRadheRadhe,
        hasPremMandir,
        hasIskcon,
        hasMathuraJunction,
        headings: headings.slice(0, 15),
        foundCategories,
        scriptSample: scripts.slice(0, 5),
        sampleText: bodyText.slice(0, 400).replace(/\n+/g, ' ')
      };
    });

    console.log('Live Details:', JSON.stringify(details, null, 2));

    await page.screenshot({ path: 'scratch/production_current_state.png', fullPage: false });
    console.log('Screenshot saved to scratch/production_current_state.png');
  } catch (err) {
    console.error('Error checking production:', err);
  } finally {
    await browser.close();
  }
})();
