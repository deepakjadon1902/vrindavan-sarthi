const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { generateBookingInvoicePdf } = require('../backend/utils/customerMessages');

(async () => {
  const mockBooking = {
    bookingId: 'VVS-DR-20261023-191395',
    bookingType: 'room_type',
    service_billing_model: 'dharamshala_booking',
    itemName: 'Shri Giriraj Sewa Sadan - Double Bed',
    partnerName: 'Shri Giriraj Sewa Sadan',
    partnerPhone: '9927600017',
    customerFullName: 'Vrindavan Sarthi',
    customerMobile: '6396147954',
    customerEmail: 'vrindavansarthi108@gmail.com',
    checkIn: '2026-10-26T00:00:00.000Z',
    checkOut: '2026-10-27T00:00:00.000Z',
    checkInTime: '12:00',
    guests: 1,
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
    createdAt: '2026-10-23T13:43:28.185Z',
    propertyLocation: 'Keshav Dham Road Opposite prem Mandir',
    propertyAddress: 'Keshav Dham Road Opposite prem Mandir',
    googleMapLink: 'https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6',
    nearestTemple: 'Prem Mandir',
  };

  const { buffer, filename } = generateBookingInvoicePdf(mockBooking);
  const pdfPath = path.join(__dirname, 'baseline_receipt.pdf');
  fs.writeFileSync(pdfPath, buffer);
  console.log('Saved baseline_receipt.pdf:', buffer.length);

  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
  
  // Navigate to PDF file
  const fileUrl = 'file:///' + pdfPath.replace(/\\/g, '/');
  await page.goto(fileUrl);
  await page.waitForTimeout(2000);
  const imgPath = path.join(__dirname, 'baseline_receipt.png');
  await page.screenshot({ path: imgPath });
  console.log('Saved baseline_receipt.png');

  await browser.close();
})().catch(console.error);
