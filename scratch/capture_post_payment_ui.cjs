const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const jwt = require('../backend/node_modules/jsonwebtoken');
require('../backend/node_modules/dotenv').config({ path: 'backend/.env' });
const fs = require('fs');
const path = require('path');

const artDir = 'C:\\Users\\acer\\.gemini\\antigravity\\brain\\0e76a3e8-689e-47bb-a51f-ed198dd0bebd';

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });

  const token = jwt.sign(
    { id: '69f30f2c146187f9caafecc2', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authData = JSON.stringify({
    state: {
      token: token,
      user: {
        _id: '69f30f2c146187f9caafecc2',
        name: 'Vrindavan Sarthi',
        email: 'vrindavansarthi108@gmail.com',
        role: 'admin',
      },
      isAuthenticated: true,
    },
    version: 0,
  });

  const bookingId = '6adb64804d6f6cd4d284f6f3';
  const pagesToTest = [
    {
      name: 'confirmation',
      url: `http://localhost:8081/bookings/${bookingId}/confirmed`,
    },
    {
      name: 'detail',
      url: `http://localhost:8081/bookings/${bookingId}`,
    },
  ];

  const viewports = [
    { width: 1280, height: 900, label: 'desktop_1280' },
    { width: 390, height: 844, label: 'mobile_390' },
  ];

  for (const pageInfo of pagesToTest) {
    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      // Seed localStorage
      await page.addInitScript((data) => {
        window.localStorage.setItem('auth-storage', data);
      }, authData);

      try {
        await page.goto(pageInfo.url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(2000);

        const outName = `post_payment_${pageInfo.name}_${vp.label}.png`;
        const localPath = path.join(__dirname, outName);
        await page.screenshot({ path: localPath, fullPage: true });

        // Copy to artifact directory
        const artPath = path.join(artDir, outName);
        fs.copyFileSync(localPath, artPath);
        console.log(`Captured ${outName} successfully.`);
      } catch (err) {
        console.error(`Failed ${pageInfo.name} at ${vp.label}:`, err.message);
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
})().catch(console.error);
