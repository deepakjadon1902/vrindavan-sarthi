const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\acer\\.gemini\\antigravity\\brain\\30fd5737-e168-4511-a71c-a8f15511eb09';

async function verify() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  console.log('--- 1. VERIFYING ROOMS (412px) ---');
  await page.goto('http://localhost:8081/rooms', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Take mobile screenshot
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rooms_restored_mobile_412px.png') });
  console.log('Saved rooms_restored_mobile_412px.png');

  // Measure visible cards in the first discovery section
  const roomsDiscoveryCards = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    const discoverySection = sections.find(s => s.querySelector('.overflow-x-auto') && s.querySelector('h2'));
    if (!discoverySection) return null;
    const track = discoverySection.querySelector('.overflow-x-auto');
    if (!track) return null;
    const cards = Array.from(track.children);
    return cards.map((c, i) => {
      const rect = c.getBoundingClientRect();
      return {
        index: i,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        visibleInViewport: rect.left >= 0 && rect.right <= 412,
        partiallyVisible: rect.left < 412 && rect.right > 0,
      };
    });
  });

  console.log('Rooms Mobile Discovery Cards:', JSON.stringify(roomsDiscoveryCards, null, 2));

  // Desktop check for rooms
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rooms_restored_desktop_1440px.png') });
  console.log('Saved rooms_restored_desktop_1440px.png');

  // Reset to mobile for Cabs
  await page.setViewportSize({ width: 412, height: 915 });
  console.log('\n--- 2. VERIFYING CABS (412px) ---');
  await page.goto('http://localhost:8081/cabs', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cabs_verified_412px_initial.png') });

  const cabsMetricsBefore = await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.overflow-x-auto'));
    const pageScrollWidth = document.documentElement.scrollWidth;
    const rows = tracks.map((t, rowIdx) => {
      const cards = Array.from(t.children);
      return {
        row: rowIdx + 1,
        scrollLeft: t.scrollLeft,
        scrollWidth: t.scrollWidth,
        clientWidth: t.clientWidth,
        cards: cards.map((c, i) => {
          const rect = c.getBoundingClientRect();
          return {
            index: i,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            visibleInViewport: rect.left >= 0 && rect.right <= 412,
          };
        }),
      };
    });
    return { pageScrollWidth, rows };
  });

  console.log('Cabs Metrics Before Scroll:', JSON.stringify(cabsMetricsBefore, null, 2));

  // Scroll Row 1 only
  await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.overflow-x-auto'));
    if (tracks[0]) {
      tracks[0].scrollLeft = 380;
    }
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cabs_verified_412px_row1_swiped.png') });

  const cabsMetricsAfter = await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.overflow-x-auto'));
    return tracks.map((t, rowIdx) => ({
      row: rowIdx + 1,
      scrollLeft: t.scrollLeft,
      cards: Array.from(t.children).map((c, i) => {
        const rect = c.getBoundingClientRect();
        return {
          index: i,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          visibleInViewport: rect.left >= 0 && rect.right <= 412,
        };
      }),
    }));
  });

  console.log('Cabs Metrics After Row 1 Scroll:', JSON.stringify(cabsMetricsAfter, null, 2));

  // Desktop check for cabs
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cabs_verified_desktop_1440px.png') });
  console.log('Saved cabs_verified_desktop_1440px.png');

  // Tours check
  await page.setViewportSize({ width: 412, height: 915 });
  console.log('\n--- 3. VERIFYING TOURS (412px) ---');
  await page.goto('http://localhost:8081/tours', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tours_verified_412px_initial.png') });

  const toursMetricsBefore = await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.overflow-x-auto'));
    const pageScrollWidth = document.documentElement.scrollWidth;
    const rows = tracks.map((t, rowIdx) => {
      const cards = Array.from(t.children);
      return {
        row: rowIdx + 1,
        scrollLeft: t.scrollLeft,
        scrollWidth: t.scrollWidth,
        clientWidth: t.clientWidth,
        cards: cards.map((c, i) => {
          const rect = c.getBoundingClientRect();
          return {
            index: i,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            visibleInViewport: rect.left >= 0 && rect.right <= 412,
          };
        }),
      };
    });
    return { pageScrollWidth, rows };
  });

  console.log('Tours Metrics Before Scroll:', JSON.stringify(toursMetricsBefore, null, 2));

  // Scroll Row 1 only
  await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.overflow-x-auto'));
    if (tracks[0]) {
      tracks[0].scrollLeft = 380;
    }
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tours_verified_412px_row1_swiped.png') });

  const toursMetricsAfter = await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('.overflow-x-auto'));
    return tracks.map((t, rowIdx) => ({
      row: rowIdx + 1,
      scrollLeft: t.scrollLeft,
      cards: Array.from(t.children).map((c, i) => {
        const rect = c.getBoundingClientRect();
        return {
          index: i,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          visibleInViewport: rect.left >= 0 && rect.right <= 412,
        };
      }),
    }));
  });

  console.log('Tours Metrics After Row 1 Scroll:', JSON.stringify(toursMetricsAfter, null, 2));

  // Desktop check for tours
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tours_verified_desktop_1440px.png') });
  console.log('Saved tours_verified_desktop_1440px.png');

  await browser.close();
  console.log('\nAll browser verifications finished successfully.');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
