const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function testToursCrop() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="p-4 bg-slate-50 space-y-6">
    <h1 class="text-lg font-bold">Testing Tours Crop (h-[165px])</h1>

    <div class="space-y-4">
      <h2 class="font-bold text-sm text-slate-700">Braj 84 Kos with object-center</h2>
      <div class="h-[165px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1785144380/vrindavan-sarthi/tours/qghepcclsd0f8urizjvp.webp" class="h-full w-full object-cover object-center" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Braj 84 Kos with object-[center_35%]</h2>
      <div class="h-[165px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1785144380/vrindavan-sarthi/tours/qghepcclsd0f8urizjvp.webp" class="h-full w-full object-cover object-[center_35%]" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Barsana - Nandgaon Tour with object-center</h2>
      <div class="h-[165px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1785144183/vrindavan-sarthi/tours/dddediiqvkffn9ftud95.png" class="h-full w-full object-cover object-center" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Barsana with object-[center_30%]</h2>
      <div class="h-[165px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1785144183/vrindavan-sarthi/tours/dddediiqvkffn9ftud95.png" class="h-full w-full object-cover object-[center_30%]" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Gokul - Mahavan Tour with object-center</h2>
      <div class="h-[165px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1785144334/vrindavan-sarthi/tours/nbe8vkvymjnsw4wgljhw.jpg" class="h-full w-full object-cover object-center" />
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.resolve(__dirname, 'test_tour_crop.png'), fullPage: true });
  await browser.close();
  console.log('Saved test_tour_crop.png');
}

testToursCrop().catch(console.error);
