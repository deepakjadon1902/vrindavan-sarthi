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

  await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Scroll to Browse Rooms & Configurations
  const sectionInfo = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const h2 = h2s.find(h => h.innerText.includes('Browse Rooms & Configurations'));
    if (!h2) return null;
    h2.scrollIntoView({ behavior: 'instant', block: 'start' });
    const section = h2.closest('section');
    const track = section.querySelector('.md\\:hidden');
    const cards = track ? Array.from(track.children) : [];
    return {
      title: h2.innerText,
      trackFound: !!track,
      cardCount: cards.length,
      cards: cards.map((c, i) => {
        const rect = c.getBoundingClientRect();
        const img = c.querySelector('img');
        const imgRect = img ? img.getBoundingClientRect() : null;
        const h3 = c.querySelector('h3');
        const price = c.querySelector('.font-bold');
        return {
          index: i,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          imgWidth: imgRect ? Math.round(imgRect.width) : null,
          imgHeight: imgRect ? Math.round(imgRect.height) : null,
          name: h3 ? h3.innerText : '',
          visibleInViewport: rect.left >= 0 && rect.right <= 412,
          partiallyVisible: rect.left < 412 && rect.right > 0,
        };
      })
    };
  });

  console.log('Browse Rooms After Metrics:', JSON.stringify(sectionInfo, null, 2));

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'browse_rooms_after_refinement_412px.png') });
  console.log('Saved browse_rooms_after_refinement_412px.png');

  // Swipe carousel
  await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const h2 = h2s.find(h => h.innerText.includes('Browse Rooms & Configurations'));
    if (h2) {
      const section = h2.closest('section');
      const track = section.querySelector('.md\\:hidden');
      if (track) track.scrollLeft = 260;
    }
  });
  await page.waitForTimeout(500);

  const swipedMetrics = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const h2 = h2s.find(h => h.innerText.includes('Browse Rooms & Configurations'));
    if (!h2) return null;
    const section = h2.closest('section');
    const track = section.querySelector('.md\\:hidden');
    const cards = track ? Array.from(track.children) : [];
    return {
      scrollLeft: track.scrollLeft,
      cards: cards.slice(0, 4).map((c, i) => {
        const rect = c.getBoundingClientRect();
        return {
          index: i,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          visibleInViewport: rect.left >= 0 && rect.right <= 412,
        };
      })
    };
  });

  console.log('Swiped Metrics:', JSON.stringify(swipedMetrics, null, 2));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'browse_rooms_swiped_after_refinement_412px.png') });
  console.log('Saved browse_rooms_swiped_after_refinement_412px.png');

  // Desktop check
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'browse_rooms_desktop_1440px.png') });
  console.log('Saved browse_rooms_desktop_1440px.png');

  await browser.close();
})();
