const fs = require('fs');
const path = require('path');

// 1. Update customerMessages.js
const cmPath = path.resolve(__dirname, '../backend/utils/customerMessages.js');
let cm = fs.readFileSync(cmPath, 'utf8');

// Replace sendBookingInvoice attachment
const oldAttach = /attachments:\s*\[\{\s*filename:\s*`\$\{filenamePrefix\}-\$\{booking\.bookingId\}\.pdf`,\s*content:\s*buildPdf\(\{[\s\S]*?\}\),\s*contentType:\s*'application\/pdf',\s*\}\]/;
const newAttach = `attachments: [{
      filename: \`\${filenamePrefix}-\${booking.bookingId}.pdf\`,
      content: buildBookingReceiptPdf(booking),
      contentType: 'application/pdf',
    }]`;

if (oldAttach.test(cm)) {
  cm = cm.replace(oldAttach, newAttach);
  console.log('[PASS] Replaced sendBookingInvoice attachment in customerMessages.js');
} else {
  console.error('[FAIL] Could not match oldAttach in customerMessages.js');
}

// Replace generateBookingInvoicePdf
const oldGen = /const generateBookingInvoicePdf = \(booking\) => \{[\s\S]*?return \{ buffer, filename, documentTitle \};\s*\};/;
const newGen = `const generateBookingInvoicePdf = (booking) => {
  const hotelBooking = isHotelMarketplace(booking);
  const documentTitle = hotelBooking ? 'BOOKING CONFIRMATION & PAYMENT RECEIPT' : 'TAX INVOICE';
  const filename = \`\${hotelBooking ? 'booking-receipt' : 'tax-invoice'}-\${booking.bookingId || booking._id}.pdf\`;
  const buffer = buildBookingReceiptPdf(booking);
  return { buffer, filename, documentTitle };
};`;

if (oldGen.test(cm)) {
  cm = cm.replace(oldGen, newGen);
  console.log('[PASS] Replaced generateBookingInvoicePdf in customerMessages.js');
} else {
  console.error('[FAIL] Could not match oldGen in customerMessages.js');
}

fs.writeFileSync(cmPath, cm, 'utf8');

// 2. Update backend/routes/booking.routes.js GET /:id/invoice to populate hotel fields
const brPath = path.resolve(__dirname, '../backend/routes/booking.routes.js');
let br = fs.readFileSync(brPath, 'utf8');

const targetStr = `    if (!isOwner && !isPartner && !isAdmin && !isAuthorizedGuest) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }`;

const replacementStr = `    if (!isOwner && !isPartner && !isAdmin && !isAuthorizedGuest) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    if (booking.hotelId) {
      const hotel = await Hotel.findById(booking.hotelId)
        .select('name address fullAddress location nearestTemple googleMapLink contactPhone contactWhatsapp partnerPhone partnerWhatsapp')
        .lean();
      if (hotel) {
        booking.propertyName = booking.propertyName || hotel.name || '';
        booking.propertyLocation = hotel.location || hotel.fullAddress || hotel.address || '';
        booking.propertyAddress = hotel.fullAddress || hotel.address || hotel.location || '';
        booking.googleMapLink = hotel.googleMapLink || '';
        booking.nearestTemple = hotel.nearestTemple || '';
        booking.partnerPhone = booking.partnerPhone || hotel.contactPhone || hotel.partnerPhone || hotel.contactWhatsapp || '';
      }
    }`;

// Notice this might appear multiple times or once around router.get('/:id/invoice')
const invoiceRouteRegex = /(router\.get\('\/:id\/invoice'[\s\S]*?if \(!isOwner && !isPartner && !isAdmin && !isAuthorizedGuest\) \{\s*return res\.status\(401\)\.json\(\{ success: false, message: 'Not authorized' \}\);\s*\})/;

if (invoiceRouteRegex.test(br)) {
  br = br.replace(invoiceRouteRegex, `$1\n\n    if (booking.hotelId) {\n      const hotel = await Hotel.findById(booking.hotelId)\n        .select('name address fullAddress location nearestTemple googleMapLink contactPhone contactWhatsapp partnerPhone partnerWhatsapp')\n        .lean();\n      if (hotel) {\n        booking.propertyName = booking.propertyName || hotel.name || '';\n        booking.propertyLocation = hotel.location || hotel.fullAddress || hotel.address || '';\n        booking.propertyAddress = hotel.fullAddress || hotel.address || hotel.location || '';\n        booking.googleMapLink = hotel.googleMapLink || '';\n        booking.nearestTemple = hotel.nearestTemple || '';\n        booking.partnerPhone = booking.partnerPhone || hotel.contactPhone || hotel.partnerPhone || hotel.contactWhatsapp || '';\n      }\n    }`);
  console.log('[PASS] Populated hotel details in GET /:id/invoice');
  fs.writeFileSync(brPath, br, 'utf8');
} else {
  console.error('[FAIL] Could not match router.get("/:id/invoice") pattern in booking.routes.js');
}
