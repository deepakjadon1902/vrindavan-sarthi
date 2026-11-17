const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\\\Users\\\\acer\\\\AppData\\\\Local\\\\ms-playwright\\\\chromium-1033\\\\chrome-win\\\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  await page.goto('http://localhost:8081/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const homeSummary = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll('h2, h3')).map(el => el.textContent.trim());
    const waLinks = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('wa.me')).map(a => a.textContent.trim());
    return {
      titles: titles.slice(0, 20),
      waLinks
    };
  });

  console.log(JSON.stringify(homeSummary, null, 2));
  await browser.close();
})();
