const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const checkPage = async (path, name) => {
    const pageMobile = await browser.newPage({ viewport: { width: 412, height: 915 } });
    await pageMobile.goto(`http://localhost:8081${path}`, { waitUntil: 'networkidle' });
    await pageMobile.waitForTimeout(600);
    await pageMobile.screenshot({ path: `scratch/grid_${name}_mobile_412.png`, fullPage: false });

    const mobileInfo = await pageMobile.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article'));
      return articles.slice(0, 6).map((a, i) => {
        const r = a.getBoundingClientRect();
        return {
          card: i + 1,
          left: Math.round(r.left),
          top: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });
    });

    const pageDesktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pageDesktop.goto(`http://localhost:8081${path}`, { waitUntil: 'networkidle' });
    await pageDesktop.waitForTimeout(600);
    await pageDesktop.screenshot({ path: `scratch/grid_${name}_desktop_1440.png`, fullPage: false });

    const desktopInfo = await pageDesktop.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article'));
      return articles.slice(0, 8).map((a, i) => {
        const r = a.getBoundingClientRect();
        return {
          card: i + 1,
          left: Math.round(r.left),
          top: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      });
    });

    await pageMobile.close();
    await pageDesktop.close();

    console.log(`=== ${name.toUpperCase()} MOBILE (412px) ===`);
    console.table(mobileInfo);
    console.log(`=== ${name.toUpperCase()} DESKTOP (1440px) ===`);
    console.table(desktopInfo);
  };

  await checkPage('/cabs', 'cabs');
  await checkPage('/tours', 'tours');
  await checkPage('/hotels', 'hotels');
  await checkPage('/rooms', 'rooms');

  await browser.close();
})().catch(console.error);
