const { chromium } = require('../frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
  });

  await page.goto('http://localhost:8081/rooms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const sectionsData = await page.evaluate(() => {
    // Find all sections or LocationDiscoverySections
    const h2s = Array.from(document.querySelectorAll('h2'));
    return h2s.map(h2 => {
      const section = h2.closest('section');
      if (!section) return { title: h2.innerText, noSection: true };
      const mobileTrack = section.querySelector('.md\\:hidden');
      const desktopGrid = section.querySelector('.hidden.md\\:grid');
      const mobileCards = mobileTrack ? Array.from(mobileTrack.children).map((c, i) => {
        const rect = c.getBoundingClientRect();
        return {
          index: i,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          visible: rect.left >= 0 && rect.right <= 412,
        };
      }) : [];
      return {
        title: h2.innerText,
        hasMobileTrack: !!mobileTrack,
        cardCount: mobileCards.length,
        mobileCards,
      };
    });
  });

  console.log('Rooms Sections Data:', JSON.stringify(sectionsData, null, 2));
  await browser.close();
})();
