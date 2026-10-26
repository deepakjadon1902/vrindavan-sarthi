const { chromium } = require('d:/vrindavan-sarthi/frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Users\\acer\\AppData\\Local\\ms-playwright\\chromium-1033\\chrome-win\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 2
  });

  const htmlPath = 'file:///' + path.resolve('prototype-receipt-a4/reference_booking.html').replace(/\\/g, '/');
  await page.goto(htmlPath, { waitUntil: 'networkidle' });

  const audit = await page.evaluate(() => {
    const getBox = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
        height: Math.round(r.height)
      };
    };

    const container = document.querySelector('.page-container');
    const cBox = container.getBoundingClientRect();

    // Check middle-grid columns
    const leftCol = document.querySelector('.middle-grid > div:first-child');
    const rightCol = document.querySelector('.middle-grid > div:last-child');
    
    // Check contacts-row columns
    const contactsLeft = document.querySelector('.contacts-row > div:first-child');
    const contactsRight = document.querySelector('.contacts-row > div:last-child');

    // Check feathers
    const featherBl = document.querySelector('.bg-feather-bl');
    const featherBr = document.querySelector('.bg-feather-br');
    const footer = document.querySelector('.footer');
    const footerLeft = document.querySelector('.footer-left');
    const footerRight = document.querySelector('.footer-right');

    const logo = document.querySelector('.logo-img');

    return {
      container: {
        width: Math.round(cBox.width),
        height: Math.round(cBox.height),
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        isOverflowing: container.scrollHeight > container.clientHeight
      },
      logo: {
        naturalWidth: logo ? logo.naturalWidth : null,
        naturalHeight: logo ? logo.naturalHeight : null,
        renderedWidth: logo ? logo.offsetWidth : null,
        renderedHeight: logo ? logo.offsetHeight : null,
        aspectRatioMatch: logo ? ((logo.naturalWidth / logo.naturalHeight) / (logo.offsetWidth / logo.offsetHeight)).toFixed(2) : null
      },
      middleGrid: {
        leftColHeight: leftCol ? leftCol.offsetHeight : null,
        rightColHeight: rightCol ? rightCol.offsetHeight : null,
        difference: leftCol && rightCol ? Math.abs(leftCol.offsetHeight - rightCol.offsetHeight) : null,
        leftBottom: leftCol ? Math.round(leftCol.getBoundingClientRect().bottom) : null,
        rightBottom: rightCol ? Math.round(rightCol.getBoundingClientRect().bottom) : null
      },
      contactsRow: {
        leftHeight: contactsLeft ? contactsLeft.offsetHeight : null,
        rightHeight: contactsRight ? contactsRight.offsetHeight : null,
        difference: contactsLeft && contactsRight ? Math.abs(contactsLeft.offsetHeight - contactsRight.offsetHeight) : null,
        leftBottom: contactsLeft ? Math.round(contactsLeft.getBoundingClientRect().bottom) : null,
        rightBottom: contactsRight ? Math.round(contactsRight.getBoundingClientRect().bottom) : null
      },
      footerVsFeathers: {
        footerBox: getBox('.footer'),
        featherBlBox: getBox('.bg-feather-bl'),
        featherBrBox: getBox('.bg-feather-br'),
        footerLeftBox: getBox('.footer-left'),
        footerRightBox: getBox('.footer-right')
      },
      sections: Array.from(container.children)
        .filter(el => !el.className.includes('bg-'))
        .map(el => ({
          class: el.className,
          top: Math.round(el.getBoundingClientRect().top),
          bottom: Math.round(el.getBoundingClientRect().bottom),
          height: el.offsetHeight
        }))
    };
  });

  console.log('Visual Layout Audit Results:');
  console.log(JSON.stringify(audit, null, 2));

  await browser.close();
})();
