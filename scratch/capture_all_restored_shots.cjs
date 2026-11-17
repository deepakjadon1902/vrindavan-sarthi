const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const artDir = 'C:\\\\Users\\\\acer\\\\.gemini\\\\antigravity\\\\brain\\\\0e76a3e8-689e-47bb-a51f-ed198dd0bebd';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\\\Users\\\\acer\\\\AppData\\\\Local\\\\ms-playwright\\\\chromium-1033\\\\chrome-win\\\\chrome.exe',
    headless: true
  });

  const shots = [
    // Dharamshala viewports
    { url: 'http://localhost:8081/hotels?type=dharamshala', vp: { width: 320, height: 600 }, name: 'restored_dharamshala_320.png' },
    { url: 'http://localhost:8081/hotels?type=dharamshala', vp: { width: 390, height: 844 }, name: 'restored_dharamshala_390.png' },
    { url: 'http://localhost:8081/hotels?type=dharamshala', vp: { width: 768, height: 1024 }, name: 'restored_dharamshala_768.png' },
    { url: 'http://localhost:8081/hotels?type=dharamshala', vp: { width: 1280, height: 800 }, name: 'restored_dharamshala_1280.png' },
    
    // Rooms viewports
    { url: 'http://localhost:8081/rooms', vp: { width: 390, height: 844 }, name: 'restored_rooms_390.png' },
    { url: 'http://localhost:8081/rooms', vp: { width: 1280, height: 800 }, name: 'restored_rooms_1280.png' },

    // Home viewports
    { url: 'http://localhost:8081/', vp: { width: 390, height: 844 }, name: 'restored_home_390.png' },
    { url: 'http://localhost:8081/', vp: { width: 1280, height: 800 }, name: 'restored_home_1280.png' },

    // Home scrolled to stays section
    { url: 'http://localhost:8081/', vp: { width: 390, height: 844 }, scrollY: 1050, name: 'restored_home_390_stays.png' },
    { url: 'http://localhost:8081/', vp: { width: 1280, height: 800 }, scrollY: 1100, name: 'restored_home_1280_stays.png' },

    // Dharamshala scrolled sticky test
    { url: 'http://localhost:8081/hotels?type=dharamshala', vp: { width: 390, height: 844 }, scrollY: 250, name: 'restored_dharamshala_390_sticky.png' },
    { url: 'http://localhost:8081/hotels?type=dharamshala', vp: { width: 1280, height: 800 }, scrollY: 250, name: 'restored_dharamshala_1280_sticky.png' },
  ];

  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: s.vp });
    const page = await ctx.newPage();
    await page.goto(s.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    if (s.scrollY) {
      await page.evaluate((y) => window.scrollTo(0, y), s.scrollY);
      await page.waitForTimeout(400);
    }
    const scratchPath = path.join('scratch', s.name);
    const artPath = path.join(artDir, s.name);
    await page.screenshot({ path: scratchPath, fullPage: false });
    fs.copyFileSync(scratchPath, artPath);
    console.log(`Saved screenshot: ${s.name}`);
    await ctx.close();
  }

  await browser.close();
  console.log('All screenshots captured and saved to artifacts.');
})();
