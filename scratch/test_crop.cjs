const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function testObjectPosition() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="p-4 bg-slate-50 space-y-6">
    <h1 class="text-lg font-bold">Testing Cabs Object Position</h1>

    <div class="space-y-4">
      <h2 class="font-bold text-sm text-slate-700">Kia Carens with object-[center_25%]</h2>
      <div class="h-[160px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1779797319/vrindavan-sarthi/cabs/pe4or94ray6vxapqkeka.jpg" class="h-full w-full object-cover object-[center_25%]" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Kia Carens with object-[center_30%]</h2>
      <div class="h-[160px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1779797319/vrindavan-sarthi/cabs/pe4or94ray6vxapqkeka.jpg" class="h-full w-full object-cover object-[center_30%]" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Tempo Traveller Interior with object-[center_25%]</h2>
      <div class="h-[160px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1779797148/vrindavan-sarthi/cabs/a16r1hoqxk7htqigrfvb.jpg" class="h-full w-full object-cover object-[center_25%]" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Urbania with object-[center_25%]</h2>
      <div class="h-[160px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1779796787/vrindavan-sarthi/cabs/grqsh3udm5i3cy1zb9yj.jpg" class="h-full w-full object-cover object-[center_25%]" />
      </div>

      <h2 class="font-bold text-sm text-slate-700">Ertiga with object-[center_25%]</h2>
      <div class="h-[160px] w-full overflow-hidden rounded-2xl bg-neutral-200">
        <img src="https://res.cloudinary.com/dwdlakutg/image/upload/v1779714666/vrindavan-sarthi/cabs/gygcmje5opnry0oaiiwn.jpg" class="h-full w-full object-cover object-[center_25%]" />
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(html);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.resolve(__dirname, 'test_cab_crop.png'), fullPage: true });
  await browser.close();
  console.log('Saved test_cab_crop.png');
}

testObjectPosition().catch(console.error);
