const payableAmountForBooking = (booking) => {
  if (String(booking?.propertyType || '').toLowerCase() === 'dharamshala') {
    return Math.max(0, Math.round(Number(booking?.amountPaidOnline || 0)));
  }
  return Math.max(0, Math.round(Number(
    booking?.advanceAmount || booking?.advance_paid || booking?.totalAmount || 0
  )));
};

const expectedBookingAmountPaise = (booking) => payableAmountForBooking(booking) * 100;

module.exports = {
  expectedBookingAmountPaise,
  payableAmountForBooking,
};
