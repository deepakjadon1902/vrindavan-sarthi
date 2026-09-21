import { chromium } from '@playwright/test';

const baseUrl = process.env.CHECK_BASE_URL || 'http://localhost:8081';
const routes = ['/', '/hotels', '/rooms', '/cabs', '/tours', '/bookings'];
const viewports = [
  { name: 'mobile-320', width: 320, height: 720 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-414', width: 414, height: 896 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'mobile-480', width: 480, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-820', width: 820, height: 1180 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1536', width: 1536, height: 864 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
];

const mockBookings = [
  {
    _id: 'booking-one',
    bookingId: 'VVS-DR-20260919-446359',
    bookingType: 'room',
    itemName: 'ANUKAMPA DHAM - Triple Bed AC Room With Extra Long Verified Dharamshala Name',
    itemImage: '/placeholder.svg',
    checkIn: '2026-09-21',
    checkOut: '2026-09-23',
    paymentMethod: 'online',
    paymentStatus: 'not_required',
    bookingStatus: 'confirmed',
    totalAmount: 0,
    createdAt: '2026-09-19T10:00:00.000Z',
  },
  {
    _id: 'booking-two',
    bookingId: 'VVS-2026-85117',
    bookingType: 'hotel',
    itemName: 'Vrinda Uday Dham - Double Bed AC Room Premium Stay Near Temple Corridor',
    itemImage: '/placeholder.svg',
    checkIn: '2026-08-27',
    checkOut: '2026-08-28',
    paymentMethod: 'online',
    paymentStatus: 'paid',
    bookingStatus: 'cancelled',
    totalAmount: 15349,
    createdAt: '2026-08-25T10:00:00.000Z',
  },
];

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'vvs-auth',
      JSON.stringify({
        state: {
          token: 'breakpoint-check-token',
          isAuthenticated: true,
          user: {
            id: 'breakpoint-user',
            name: 'Vrindavan Guest',
            email: 'guest@example.com',
            phone: '9999999999',
            role: 'user',
            createdAt: new Date().toISOString(),
          },
        },
        version: 0,
      })
    );
  });

  await page.route('**/bookings/my**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockBookings }),
    });
  });

  for (const routePath of routes) {
    await page.goto(`${baseUrl}${routePath}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);

    const result = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const viewportWidth = doc.clientWidth;
      const rootOverflow = Math.max(doc.scrollWidth, body.scrollWidth) - viewportWidth;
      const selectors = 'nav, header, main, section, article, h1, h2, h3, a, button, input, [class*="grid"], [class*="card"], [class*="premium"]';
      const offenders = Array.from(document.querySelectorAll(selectors))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter((item) => item.width > 0 && (item.left < -2 || item.right > viewportWidth + 2 || item.width > viewportWidth + 2))
        .slice(0, 8);

      const emptyImages = Array.from(document.images)
        .filter((img) => img.complete && img.naturalWidth === 0)
        .slice(0, 4)
        .map((img) => img.alt || img.src);

      return { rootOverflow: Math.round(rootOverflow), offenders, emptyImages };
    });

    if (result.rootOverflow > 2 || result.offenders.length || result.emptyImages.length) {
      failures.push({ viewport: viewport.name, route: routePath, ...result });
    }
  }

  await page.close();
}

await browser.close();

if (failures.length) {
  console.log(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: routes.length * viewports.length, routes, viewports: viewports.map((v) => v.name) }, null, 2));
