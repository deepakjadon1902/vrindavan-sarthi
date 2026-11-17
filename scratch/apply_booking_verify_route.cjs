const fs = require('fs');
const path = require('path');

const brPath = path.resolve(__dirname, '../backend/routes/booking.routes.js');
let content = fs.readFileSync(brPath, 'utf8');

const verifyRouteCode = `// Public, non-sensitive booking verification endpoint for QR code voucher scans
router.get('/verify/:bookingId', async (req, res) => {
  try {
    const rawId = String(req.params.bookingId || '').trim();
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(rawId);
    const query = isObjectId ? { $or: [{ _id: rawId }, { bookingId: rawId }] } : { bookingId: rawId };

    const booking = await Booking.findOne(query)
      .select('bookingId bookingType service_billing_model itemName propertyName propertyAddress propertyLocation checkIn checkOut checkInTime guests totalAdults totalChildren totalAmount amountPaidOnline amountPayableAtProperty bookingStatus paymentStatus paymentMethod customerFullName userName paidAt createdAt hotelId roomNumber')
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.hotelId) {
      const hotel = await Hotel.findById(booking.hotelId).select('name fullAddress address location contactPhone partnerPhone googleMapLink nearestTemple').lean();
      if (hotel) {
        booking.propertyName = booking.propertyName || hotel.name || '';
        booking.propertyAddress = hotel.fullAddress || hotel.address || hotel.location || '';
        booking.propertyLocation = hotel.location || hotel.fullAddress || hotel.address || '';
        booking.googleMapLink = hotel.googleMapLink || '';
        booking.nearestTemple = hotel.nearestTemple || '';
        booking.partnerPhone = booking.partnerPhone || hotel.contactPhone || hotel.partnerPhone || '';
      }
    }

    // Return strictly non-sensitive voucher summary (no passwords, hashes, tokens, emails, phone numbers)
    return res.json({
      success: true,
      data: {
        verified: true,
        bookingId: booking.bookingId || String(booking._id),
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        propertyName: booking.propertyName || String(booking.itemName || '').split(' - ')[0] || 'Property',
        roomType: String(booking.itemName || '').includes(' - ') ? String(booking.itemName).split(' - ')[1] : String(booking.itemName || 'Standard Room'),
        roomNumber: booking.roomNumber || null,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        checkInTime: booking.checkInTime || '12:00 PM',
        guests: booking.guests || ((booking.totalAdults || 1) + (booking.totalChildren || 0)),
        guestName: booking.customerFullName || booking.userName || 'Guest Devotee',
        totalAmount: booking.totalAmount,
        amountPaidOnline: booking.amountPaidOnline,
        amountPayableAtProperty: booking.amountPayableAtProperty,
        paymentMethod: booking.paymentMethod,
        paidAt: booking.paidAt,
        bookedOn: booking.createdAt,
        propertyLocation: booking.propertyLocation || '',
        nearestTemple: booking.nearestTemple || '',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
});
`;

const target = '// Get single booking (owner/admin/partner/authorized guest)';

if (content.includes(target)) {
  content = content.replace(target, verifyRouteCode + '\n' + target);
  fs.writeFileSync(brPath, content, 'utf8');
  console.log('Successfully inserted GET /api/bookings/verify/:bookingId in booking.routes.js!');
} else {
  console.error('Target not found in booking.routes.js');
  process.exit(1);
}
