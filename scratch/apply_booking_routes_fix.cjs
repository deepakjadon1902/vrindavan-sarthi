const fs = require('fs');
const path = 'backend/routes/booking.routes.js';
let content = fs.readFileSync(path, 'utf8');

const target = `    if (!isOwner && !isPartner && !isAdmin && !isAuthorizedGuest) {
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

    const { buffer, filename } = generateBookingInvoicePdf(booking);`;

const replacement = `    if (!isOwner && !isPartner && !isAdmin && !isAuthorizedGuest) {
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
      }
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

    // Secure invoice eligibility: prevent premature receipt download for unverified/pending/failed bookings
    const bookingStatus = String(booking.bookingStatus || '').toLowerCase();
    const paymentStatus = String(booking.paymentStatus || '').toLowerCase();
    const unverifiedStatuses = [
      'pending',
      'pending_property_confirmation',
      'awaiting_customer_payment',
      'rejected_by_property',
      'expired_property_no_response',
      'expired',
      'payment_failed',
    ];
    if (unverifiedStatuses.includes(bookingStatus) && paymentStatus !== 'paid') {
      return res.status(409).json({
        success: false,
        message: 'Booking receipt is only available after booking confirmation and verified payment.',
        code: 'INVOICE_NOT_READY',
      });
    }
    if (paymentStatus === 'failed') {
      return res.status(409).json({
        success: false,
        message: 'Cannot generate receipt for a failed payment.',
        code: 'PAYMENT_FAILED',
      });
    }

    const { buffer, filename } = generateBookingInvoicePdf(booking);`;

const normalize = (s) => s.replace(/\r\n/g, '\n');
const nContent = normalize(content);
const nTarget = normalize(target);
const nReplacement = normalize(replacement);

if (!nContent.includes(nTarget)) {
  console.error('Target not found in content!');
  process.exit(1);
}

const isCRLF = content.includes('\r\n');
const updatedNorm = nContent.replace(nTarget, nReplacement);
const finalContent = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;

fs.writeFileSync(path, finalContent, 'utf8');
console.log('Successfully updated booking.routes.js');
