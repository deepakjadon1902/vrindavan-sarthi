/**
 * Comprehensive Multi-Viewport DOM Collision & Responsiveness Audit
 * Tests 14 routes across 9 standard viewports: 320, 360, 375, 390, 430, 768, 1024, 1280, 1440
 */
const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8081';

const viewports = [
  { name: '320px', width: 320, height: 640 },   // Minimum supported mobile (iPhone SE 1st gen)
  { name: '360px', width: 360, height: 740 },   // Common Android (Galaxy S8/S9)
  { name: '375px', width: 375, height: 667 },   // iPhone SE 2nd/3rd gen, iPhone 8
  { name: '390px', width: 390, height: 844 },   // Standard iPhone 12/13/14
  { name: '430px', width: 430, height: 932 },   // iPhone 14/15 Pro Max
  { name: '768px', width: 768, height: 1024 },  // iPad Mini / standard tablet
  { name: '1024px', width: 1024, height: 768 }, // iPad Pro / small laptop
  { name: '1280px', width: 1280, height: 800 }, // Standard Desktop
  { name: '1440px', width: 1440, height: 900 }, // Large Desktop
];

const routes = [
  { name: 'Home', path: '/' },
  { name: 'Hotels', path: '/hotels' },
  { name: 'HotelDetail', path: '/hotels/hotel_prem_mandir_ashram' },
  { name: 'Rooms', path: '/rooms' },
  { name: 'RoomTypeDetail', path: '/room-types/rt_hotel_radha_raman_deluxe' },
  { name: 'Cabs', path: '/cabs' },
  { name: 'Tours', path: '/tours' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
  { name: 'Terms', path: '/terms' },
  { name: 'Privacy', path: '/privacy' },
  { name: 'CancellationPolicy', path: '/cancellation-policy' },
  { name: 'Login', path: '/login' },
  { name: 'Register', path: '/register' },
];

async function runAudit() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const allFindings = [];

  console.log(`Starting deep responsive audit for ${routes.length} routes across ${viewports.length} viewports...`);

  try {
    for (const r of routes) {
      console.log(`\nAuditing route: ${r.name} (${r.path})`);

      for (const vp of viewports) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: 1,
        });
        const page = await context.newPage();

        const pageErrors = [];
        const consoleErrors = [];
        page.on('pageerror', err => pageErrors.push(err.toString()));
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        try {
          await page.goto(`${BASE_URL}${r.path}`, { waitUntil: 'networkidle', timeout: 15000 });
          await page.waitForTimeout(600);

          // Deep DOM collision, overlap, and overflow analysis
          const analysis = await page.evaluate(() => {
            const issues = [];
            const scrollW = document.documentElement.scrollWidth;
            const innerW = window.innerWidth;
            const overflow = scrollW - innerW;

            if (overflow > 1) {
              const overflowingEls = [];
              const allEls = document.querySelectorAll('*');
              for (const el of allEls) {
                const rect = el.getBoundingClientRect();
                if (rect.right > innerW + 2 && rect.width > 0) {
                  const tag = el.tagName.toLowerCase();
                  const cls = (el.className || '').toString().slice(0, 60);
                  overflowingEls.push(`${tag}.${cls} (right: ${Math.round(rect.right)}px, w: ${Math.round(rect.width)}px)`);
                  if (overflowingEls.length >= 4) break;
                }
              }
              issues.push({
                type: 'HORIZONTAL_OVERFLOW',
                overflowPx: overflow,
                sampleElements: overflowingEls
              });
            }

            // Check if Navbar covers content
            const nav = document.querySelector('nav:first-of-type, header nav');
            if (nav && window.getComputedStyle(nav).position === 'fixed') {
              const navRect = nav.getBoundingClientRect();
              
              // 1. If breadcrumbs exist, verify breadcrumbs are not behind nav
              const breadcrumb = document.querySelector('nav[aria-label="Breadcrumb"]');
              if (breadcrumb) {
                const bRect = breadcrumb.getBoundingClientRect();
                const bStyle = window.getComputedStyle(breadcrumb);
                const bPt = parseFloat(bStyle.paddingTop) || 0;
                // If breadcrumb top is behind nav or breadcrumb padding doesn't clear nav
                if (bRect.top < 0 || (bRect.top <= 2 && bPt < navRect.height - 4)) {
                  issues.push({
                    type: 'NAVBAR_COVERING_BREADCRUMB',
                    navHeight: Math.round(navRect.height),
                    breadcrumbTop: Math.round(bRect.top),
                    paddingTop: Math.round(bPt)
                  });
                }
              } else {
                // 2. If no breadcrumbs, check the first visible content element inside main
                // (heading, banner text, search bar, etc.)
                const firstVisible = document.querySelector('main h1, main h2, main input, main .sticky, main section:first-of-type p:first-of-type');
                if (firstVisible) {
                  const rect = firstVisible.getBoundingClientRect();
                  if (rect.top < navRect.bottom - 4 && rect.height > 0) {
                    issues.push({
                      type: 'NAVBAR_COVERING_FIRST_ELEMENT',
                      navHeight: Math.round(navRect.height),
                      elementTop: Math.round(rect.top),
                      elementTag: firstVisible.tagName.toLowerCase(),
                      diffPx: Math.round(navRect.bottom - rect.top)
                    });
                  }
                }
              }
            }

            // Check for sticky elements top alignment
            const stickies = document.querySelectorAll('.sticky, [style*="position: sticky"]');
            for (const s of stickies) {
              const sStyle = window.getComputedStyle(s);
              const topVal = parseFloat(sStyle.top);
              if (nav && window.getComputedStyle(nav).position === 'fixed') {
                const navH = nav.getBoundingClientRect().height;
                if (topVal < navH - 2 && topVal >= 0) {
                  issues.push({
                    type: 'STICKY_BEHIND_NAVBAR',
                    element: s.tagName.toLowerCase() + '.' + (s.className || '').slice(0, 40),
                    topCss: sStyle.top,
                    navHeight: Math.round(navH)
                  });
                }
              }
            }

            // Check for broken images
            const images = Array.from(document.querySelectorAll('img'));
            const brokenImgs = images
              .filter(img => img.complete && img.naturalWidth === 0 && !img.src.startsWith('data:image/svg'))
              .map(img => img.src.slice(0, 80));
            if (brokenImgs.length > 0) {
              issues.push({
                type: 'BROKEN_IMAGES',
                count: brokenImgs.length,
                samples: brokenImgs
              });
            }

            return issues;
          });

          // Capture screenshot for key viewports
          if (['320px', '768px', '1280px'].includes(vp.name)) {
            const ssPath = path.join(__dirname, `audit_${r.name}_${vp.name}.png`);
            await page.screenshot({ path: ssPath, fullPage: false });
          }

          const record = {
            route: r.name,
            path: r.path,
            viewport: vp.name,
            width: vp.width,
            pageErrors,
            consoleErrors: consoleErrors.filter(e => !e.includes('favicon')),
            issues: analysis,
          };

          allFindings.push(record);
          const issueSummary = analysis.map(i => i.type).join(', ') || 'CLEAN';
          console.log(`  [${vp.name}] -> ${issueSummary} (errs: ${pageErrors.length})`);

        } catch (pageErr) {
          console.error(`  [${vp.name}] ERROR:`, pageErr.message);
          allFindings.push({
            route: r.name,
            path: r.path,
            viewport: vp.name,
            error: pageErr.message,
          });
        } finally {
          await context.close();
        }
      }
    }

    fs.writeFileSync(
      path.join(__dirname, 'audit_findings.json'),
      JSON.stringify(allFindings, null, 2)
    );
    console.log(`\nAudit finished! Findings saved to scratch/audit_findings.json`);

  } finally {
    await browser.close();
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
