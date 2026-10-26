const fs = require('fs');
const path = require('path');

// 1. Update customerMessages.js
const customerMessagesPath = path.join(__dirname, '..', 'backend', 'utils', 'customerMessages.js');
let cmCode = fs.readFileSync(customerMessagesPath, 'utf8');

if (!cmCode.includes('generateBookingInvoicePdf')) {
  const target = 'module.exports = {';
  const addition = `const generateBookingInvoicePdf = (booking) => {
  const hotelBooking = isHotelMarketplace(booking);
  const documentTitle = hotelBooking ? 'BOOKING CONFIRMATION & PAYMENT RECEIPT' : 'TAX INVOICE';
  const filename = \`\${hotelBooking ? 'booking-receipt' : 'tax-invoice'}-\${booking.bookingId || booking._id}.pdf\`;
  const rows = bookingRows(booking);
  const buffer = buildPdf({
    title: documentTitle,
    documentLabel: documentTitle,
    sections: [{ title: 'Booking Details', rows }],
    lines: hotelBooking ? [HOTEL_MARKETPLACE_DISCLAIMER] : [],
    totalLabel: hotelBooking ? 'Total Payable' : 'Grand Total',
    totalAmount: booking.totalAmount,
  });
  return { buffer, filename, documentTitle };
};

module.exports = {
  generateBookingInvoicePdf,`;

  cmCode = cmCode.replace(target, addition);
  fs.writeFileSync(customerMessagesPath, cmCode, 'utf8');
  console.log('Updated customerMessages.js');
}

// 2. Update booking.routes.js
const bookingRoutesPath = path.join(__dirname, '..', 'backend', 'routes', 'booking.routes.js');
let brCode = fs.readFileSync(bookingRoutesPath, 'utf8');

// Ensure imports in booking.routes.js include getGuestAccessTokenFromRequest, hashGuestAccessToken, generateBookingInvoicePdf
if (!brCode.includes('getGuestAccessTokenFromRequest')) {
  brCode = brCode.replace(
    /withGuestAccessToken,\s*\}/,
    'withGuestAccessToken,\n  getGuestAccessTokenFromRequest,\n  hashGuestAccessToken,\n}'
  );
  console.log('Updated guestBookingAccess import in booking.routes.js');
}

if (!brCode.includes('generateBookingInvoicePdf')) {
  brCode = brCode.replace(
    /const \{\s*assertValidBookingTransition,/,
    'const { generateBookingInvoicePdf } = require(\'../utils/customerMessages\');\nconst {\n  assertValidBookingTransition,'
  );
  console.log('Added generateBookingInvoicePdf import to booking.routes.js');
}

// Update GET /:id route
const oldGetSinglePattern = /\/\/ Get single booking \(owner\/admin\/partner\)\s*router\.get\('\/:id',\s*protect,\s*async\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.json\(\{\s*success:\s*true,\s*data:\s*isOwner\s*&&[\s\S]*?\}\);[\s\S]*?\}\s*\}\);/;

const newGetSingleCode = `// Get single booking (owner/admin/partner/authorized guest)
router.get('/:id', optionalProtect, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    await repairPaidAwaitingCustomerPaymentBookings();
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    let isOwner = false;
    let isPartner = false;
    let isAdmin = false;

    if (req.user?._id) {
      isOwner = String(booking.userId) === String(req.user._id);
      isPartner = booking.partnerId && String(booking.partnerId) === String(req.user._id);
      isAdmin = req.user.role === 'admin';
    }

    const guestToken = getGuestAccessTokenFromRequest(req);
    const isAuthorizedGuest = Boolean(
      guestToken &&
      booking.isGuestBooking &&
      booking.guestAccessTokenHash &&
      booking.guestAccessTokenHash === hashGuestAccessToken(guestToken)
    );

    if (!isOwner && !isPartner && !isAdmin && !isAuthorizedGuest) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    res.json({
      success: true,
      data: (isOwner || isAuthorizedGuest) && !isAdmin && !isPartner
        ? sanitizeCustomerBooking(booking)
        : booking,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Failed to retrieve booking' });
  }
});

// Download booking invoice PDF (authenticated customer, partner, admin, or verified guest)
router.get('/:id/invoice', optionalProtect, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    let isOwner = false;
    let isPartner = false;
    let isAdmin = false;

    if (req.user?._id) {
      isOwner = String(booking.userId) === String(req.user._id);
      isPartner = booking.partnerId && String(booking.partnerId) === String(req.user._id);
      isAdmin = req.user.role === 'admin';
    }

    const guestToken = getGuestAccessTokenFromRequest(req);
    const isAuthorizedGuest = Boolean(
      guestToken &&
      booking.isGuestBooking &&
      booking.guestAccessTokenHash &&
      booking.guestAccessTokenHash === hashGuestAccessToken(guestToken)
    );

    if (!isOwner && !isPartner && !isAdmin && !isAuthorizedGuest) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const { buffer, filename } = generateBookingInvoicePdf(booking);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);
    res.send(buffer);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : 'Failed to generate invoice' });
  }
});`;

if (brCode.match(oldGetSinglePattern)) {
  brCode = brCode.replace(oldGetSinglePattern, newGetSingleCode);
  fs.writeFileSync(bookingRoutesPath, brCode, 'utf8');
  console.log('Successfully updated router.get(/:id) and added router.get(/:id/invoice)');
} else {
  console.log('oldGetSinglePattern did not match');
}
