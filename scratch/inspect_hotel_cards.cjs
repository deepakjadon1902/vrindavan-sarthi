const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\\\Users\\\\acer\\\\AppData\\\\Local\\\\ms-playwright\\\\chromium-1033\\\\chrome-win\\\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('response', resp => {
    if (resp.url().includes('/api/')) console.log('API_RESP:', resp.status(), resp.url());
  });

  await page.goto('http://localhost:8081/hotels?type=dharamshala', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const htmlSummary = await page.evaluate(() => {
    const main = document.querySelector('.braj-page > main > div > main');
    const hotelTitles = Array.from(document.querySelectorAll('h2, h3, h4')).map(el => el.textContent.trim());
    const links = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/hotels/')).map(a => a.href);
    return {
      textSnippet: main ? main.innerText.slice(0, 500) : 'No main found',
      hotelTitles,
      linksCount: links.length,
      links: links.slice(0, 5)
    };
  });

  console.log(JSON.stringify(htmlSummary, null, 2));
  await browser.close();
})();
