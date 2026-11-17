const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { ReferenceMatchedPdfBuilder } = require('../backend/utils/bookingReceiptPdf');

async function main() {
  const referenceBooking = {
    bookingId: 'VVS-DR-20261023-191395',
    displayBookingId: '67400933',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
    propertyName: 'Shri Giriraj Sewa Sadan',
    propertyId: '815466',
    partnerName: 'Shri Giriraj Sewa Sadan',
    partnerPhone: '9927600017',
    customerFullName: 'Vrindavan Sarthi',
    customerMobile: '6396147954',
    customerEmail: 'vrindavansarthi108@gmail.com',
    customerCity: 'Govardhan',
    customerState: 'Uttar Pradesh',
    userId: '618792',
    checkIn: '2026-10-26T00:00:00.000Z',
    checkOut: '2026-10-27T00:00:00.000Z',
    checkInTime: '12:00 PM',
    checkOutTime: '11:00 AM',
    guests: 1,
    roomQuantity: 1,
    roomId: '10440',
    totalAdults: 1,
    totalChildren: 0,
    totalAmount: 1299,
    dharamshalaAmount: 1200,
    baseAmount: 1200,
    vrindavanSarthiServiceFee: 99,
    amountPaidOnline: 99,
    amountPayableAtProperty: 1200,
    paymentStatus: 'paid',
    bookingStatus: 'confirmed',
    paymentMethod: 'online',
    razorpayPaymentId: 'pay_TrN6Yaaj3wvpLk',
    paidAt: '2026-10-23T13:48:43.596Z',
    createdAt: '2026-10-23T13:43:28.185Z',
    propertyLocation: 'Near Prem Mandir, Vrindavan, UP- 281121',
    propertyAddress: 'Keshav Dham Road Opposite prem Mandir',
    googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    nearestTemple: 'Prem Mandir, Vrindavan, UP- 281121',
  };

  const builder = new ReferenceMatchedPdfBuilder();
  
  // 1. Generate Variant with single website
  const bufSingle = builder.generate(referenceBooking, { singleWebsiteFooter: true });
  fs.writeFileSync('C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/receipt_with_single_website.pdf', bufSingle);
  console.log('Saved receipt_with_single_website.pdf');

  // Launch browser to render preview
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1900 } });

  const b64 = bufSingle.toString('base64');
  await page.setContent(`
    <!DOCTYPE html><html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script></head>
    <body style="margin:0; background:#fff;"><canvas id="c"></canvas><script>
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjsLib.getDocument({ data: atob('${b64}') }).promise.then(async (pdf) => {
        const p = await pdf.getPage(1);
        const vp = p.getViewport({ scale: 2.0 });
        const c = document.getElementById('c');
        c.width = vp.width;
        c.height = vp.height;
        await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        window.done = true;
      });
    </script></body></html>
  `);
  await page.waitForFunction(() => window.done);
  
  // Full receipt preview
  const canvasEl = await page.$('#c');
  await canvasEl.screenshot({ path: 'C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/single_website_footer_preview.png' });
  console.log('Saved single_website_footer_preview.png');

  // Crop footer of single website
  const canvasDims = await page.evaluate(() => {
    const c = document.getElementById('c');
    return { w: c.width, h: c.height };
  });
  const footerClip = {
    x: 0,
    y: Math.round(canvasDims.h - 230),
    width: canvasDims.w,
    height: 230
  };
  await page.screenshot({ path: 'scratch/evidence_single_web_footer.png', clip: footerClip });
  console.log('Saved scratch/evidence_single_web_footer.png');

  // 3-way comparison HTML
  const refB64 = fs.readFileSync('scratch/evidence_ref_footer.png').toString('base64');
  const curB64 = fs.readFileSync('scratch/evidence_cur_footer.png').toString('base64');
  const singleB64 = fs.readFileSync('scratch/evidence_single_web_footer.png').toString('base64');

  await page.setViewportSize({ width: 1550, height: 530 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px; box-sizing: border-box; }
        .title { text-align: center; font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 16px; }
        .grid { display: flex; gap: 16px; justify-content: center; }
        .card { flex: 1; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .card-header { padding: 10px 14px; font-size: 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
        .tag-ref { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
        .tag-cur { background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
        .tag-opt { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
        .card img { width: 100%; display: block; }
        .note { font-size: 11px; color: #64748b; padding: 8px 12px; background: #f1f5f9; border-top: 1px solid #e2e8f0; line-height: 1.4; }
      </style>
    </head>
    <body>
      <div class="title">Vrindavan Sarthi Booking Receipt — Footer Comparison & Audit</div>
      <div class="grid">
        <div class="card">
          <div class="card-header">
            <span>1. Canva Reference Authority</span>
            <span class="tag-ref">Original Canva PDF</span>
          </div>
          <img src="data:image/png;base64,${refB64}" />
          <div class="note">Original Canva PDF contains both website entries at x=336.5 and x=479.0.</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span>2. Exact Canva Match (Default)</span>
            <span class="tag-cur">Exact 1:1 Match</span>
          </div>
          <img src="data:image/png;base64,${curB64}" />
          <div class="note">Preserves approved Canva layout 100% including both entries as designed.</div>
        </div>
        <div class="card">
          <div class="card-header">
            <span>3. Cleaned Single-Website Footer</span>
            <span class="tag-opt">Deduplicated</span>
          </div>
          <img src="data:image/png;base64,${singleB64}" />
          <div class="note">Removes the 4th duplicate item while preserving exact Canva coordinates for Helpline, Email, and Website.</div>
        </div>
      </div>
    </body>
    </html>
  `);

  await page.screenshot({
    path: 'C:/Users/acer/.gemini/antigravity/brain/30fd5737-e168-4511-a71c-a8f15511eb09/footer_three_way_comparison.png'
  });
  console.log('Saved footer_three_way_comparison.png to artifact directory');

  await browser.close();
}

main().catch(console.error);
