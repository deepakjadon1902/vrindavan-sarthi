const fs = require('fs');
const path = 'backend/utils/customerMessages.js';
let content = fs.readFileSync(path, 'utf8');

const target = `const isHotelMarketplace = (booking) =>
  booking?.service_billing_model === 'hotel_marketplace' ||
  ['hotel', 'room', 'room_type'].includes(String(booking?.bookingType || ''));

const bookingRows = (booking) => {
  const hotelBooking = isHotelMarketplace(booking);
  return [
    ['Booking ID', booking.bookingId],
    ['Created On', dateTimeText(booking.createdAt)],
    ['Service Type', booking.bookingType],
    ['Billing Model', booking.service_billing_model],
    ['Service Name', booking.itemName],
    ['Property Name', hotelBooking ? String(booking.itemName || '').split(' - ')[0] : ''],
    ['Property Partner Name', hotelBooking ? booking.partnerName : ''],
    ['Property Partner Phone', hotelBooking ? booking.partnerPhone : ''],
    ['Customer', booking.customerFullName || booking.userName],
    ['Mobile', booking.customerMobile || booking.userPhone],
    ['Email', booking.customerEmail || booking.userEmail],
    ['Partner', hotelBooking ? '' : booking.partnerName],
    ['Booking Status', booking.bookingStatus],
    ['Verification Stage', booking.verificationStage],
    ['Check-in / Travel Date', booking.pickupDate || dateText(booking.checkIn)],
    ['Check-out', dateText(booking.checkOut)],
    ['Route', booking.bookingType === 'cab' ? \`\${booking.pickupLocation} to \${booking.dropLocation}\` : ''],
    ['Pickup Time', booking.pickupTime],
    ['Arrival Mode', booking.arrivalMode],
    ['Arrival Time', booking.arrivalTime],
    ['Vehicle Number', booking.vehicleNumber],
    ['Cab Type', booking.cabType || booking.assignedVehicleType],
    ['Assigned Vehicle', booking.assignedVehicleName],
    ['Driver Name', booking.assignedDriverName],
    ['Driver Phone', booking.assignedDriverPhone],
    ['Guests / Passengers', booking.guests],
    ['Adults', booking.totalAdults],
    ['Children', booking.totalChildren],
    ['Travelling with Pet', booking.hasPet ? yesNo(booking.hasPet) : ''],
    ['Room Details', hotelBooking ? booking.itemName : ''],
    ['Waitlisted', booking.isWaitlisted ? 'Yes' : ''],
    [hotelBooking ? 'Room Amount' : 'Base Amount', money(booking.baseAmount || booking.checkoutSubtotal)],
    [hotelBooking ? 'Hotel GST / Hotel Taxes' : 'GST', Number(booking.taxAmount || 0) ? money(booking.taxAmount) : ''],
    [hotelBooking ? 'Platform Convenience Fee' : 'Convenience Fee', money(booking.convenienceFeeAmount)],
    [hotelBooking ? 'Total Payable' : 'Grand Total', money(booking.totalAmount)],
    [hotelBooking ? 'Advance Paid Online' : 'Advance Paid', money(booking.advanceAmount)],
    [hotelBooking ? 'Balance Payable at Property' : 'Balance Payable', money(booking.balanceAmount)],
    ['Payment Option', booking.paymentOption === 'advance_30' ? '30% advance' : 'Full payment'],
    ['Payment Method', booking.paymentMethod],
    ['Payment Status', booking.paymentStatus],
    ['UPI Transaction ID', booking.upiTransactionId],
    ['Hotel GSTIN', hotelBooking ? booking.hotel_gstin : ''],
    ['Vrindavan Sarthi GSTIN', !hotelBooking ? COMPANY_GSTIN : ''],
    ['Additional Info', booking.additionalInfo],
    ['Cancellation Reason', booking.cancellationReason],
    ['Cancellation Details', booking.cancellationDetails],
    ['Cancelled By', booking.cancelledByRole],
    ['Cancellation Deduction', Number(booking.cancellationDeductionAmount || 0) ? \`\${money(booking.cancellationDeductionAmount)} (\${Number(booking.cancellationDeductionPercent || 12)}%)\` : ''],
    ['Refundable Amount', Number(booking.refundableAmount || 0) ? money(booking.refundableAmount) : ''],
  ];
};`;

const replacement = `const isHotelMarketplace = (booking) =>
  booking?.service_billing_model === 'hotel_marketplace' ||
  ['hotel', 'room', 'room_type'].includes(String(booking?.bookingType || ''));

const bookingRows = (booking) => {
  const hotelBooking = isHotelMarketplace(booking);
  const isDharamshala =
    String(booking?.service_billing_model || '') === 'dharamshala_booking' ||
    String(booking?.propertyType || '').toLowerCase() === 'dharamshala';

  const roomTariff = Number(booking.dharamshalaAmount || booking.baseAmount || booking.checkoutSubtotal || 0);
  const dharamshalaFee = Number(booking.vrindavanSarthiServiceFee || 0);
  const convenienceFee = Number(booking.convenienceFeeAmount || 0);
  const effectiveFee = isDharamshala ? (dharamshalaFee || convenienceFee) : convenienceFee;
  const feeLabel = isDharamshala
    ? 'Platform Facilitation Fee'
    : (hotelBooking ? 'Platform Convenience Fee' : 'Convenience Fee');

  const paidOnline = Number(booking.amountPaidOnline ?? booking.advanceAmount ?? 0);
  const balanceAtProperty = Number(booking.amountPayableAtProperty ?? booking.balanceAmount ?? 0);

  let paymentOptionLabel = 'Full payment';
  if (balanceAtProperty > 0) {
    if (isDharamshala || booking.paymentMode === 'pay_at_dharamshala') {
      paymentOptionLabel = 'Platform fee online / Balance at property';
    } else if (booking.paymentOption === 'advance_30') {
      paymentOptionLabel = '30% advance';
    } else {
      paymentOptionLabel = 'Advance online / Balance at property';
    }
  } else {
    paymentOptionLabel = 'Full payment';
  }

  // Remove initiation/debug text from official receipt; show verified note only when supported by records
  let safeAdditionalInfo = String(booking.additionalInfo || '').trim();
  if (safeAdditionalInfo.toLowerCase().includes('initiated')) {
    if (booking.paymentStatus === 'paid' && booking.razorpayPaymentId) {
      safeAdditionalInfo = \`Payment verified via Razorpay (\${booking.razorpayPaymentId}).\`;
    } else if (booking.paymentStatus === 'paid') {
      safeAdditionalInfo = 'Payment verified online.';
    } else {
      safeAdditionalInfo = '';
    }
  }

  return [
    ['Booking ID', booking.bookingId],
    ['Created On', dateTimeText(booking.createdAt)],
    ['Service Type', booking.bookingType],
    ['Billing Model', booking.service_billing_model],
    ['Service Name', booking.itemName],
    ['Property Name', hotelBooking ? String(booking.itemName || '').split(' - ')[0] : ''],
    ['Property Partner Name', hotelBooking ? booking.partnerName : ''],
    ['Property Partner Phone', hotelBooking ? booking.partnerPhone : ''],
    ['Customer', booking.customerFullName || booking.userName],
    ['Mobile', booking.customerMobile || booking.userPhone],
    ['Email', booking.customerEmail || booking.userEmail],
    ['Partner', hotelBooking ? '' : booking.partnerName],
    ['Booking Status', booking.bookingStatus],
    ['Verification Stage', booking.verificationStage],
    ['Check-in / Travel Date', booking.pickupDate || dateText(booking.checkIn)],
    ['Check-out', dateText(booking.checkOut)],
    ['Route', booking.bookingType === 'cab' ? \`\${booking.pickupLocation} to \${booking.dropLocation}\` : ''],
    ['Pickup Time', booking.pickupTime],
    ['Arrival Mode', booking.arrivalMode],
    ['Arrival Time', booking.arrivalTime],
    ['Vehicle Number', booking.vehicleNumber],
    ['Cab Type', booking.cabType || booking.assignedVehicleType],
    ['Assigned Vehicle', booking.assignedVehicleName],
    ['Driver Name', booking.assignedDriverName],
    ['Driver Phone', booking.assignedDriverPhone],
    ['Guests / Passengers', booking.guests],
    ['Adults', booking.totalAdults],
    ['Children', booking.totalChildren],
    ['Travelling with Pet', booking.hasPet ? yesNo(booking.hasPet) : ''],
    ['Room Details', hotelBooking ? booking.itemName : ''],
    ['Waitlisted', booking.isWaitlisted ? 'Yes' : ''],
    [hotelBooking ? 'Room Amount' : 'Base Amount', money(roomTariff)],
    [hotelBooking ? 'Hotel GST / Hotel Taxes' : 'GST', Number(booking.taxAmount || 0) ? money(booking.taxAmount) : ''],
    [feeLabel, money(effectiveFee)],
    [hotelBooking ? 'Total Payable' : 'Grand Total', money(booking.totalAmount)],
    [hotelBooking ? 'Advance Paid Online' : 'Advance Paid', money(paidOnline)],
    [hotelBooking ? 'Balance Payable at Property' : 'Balance Payable', money(balanceAtProperty)],
    ['Payment Option', paymentOptionLabel],
    ['Payment Method', booking.paymentMethod],
    ['Payment Status', booking.paymentStatus],
    ['UPI Transaction ID', booking.upiTransactionId],
    ['Hotel GSTIN', hotelBooking ? booking.hotel_gstin : ''],
    ['Vrindavan Sarthi GSTIN', !hotelBooking ? COMPANY_GSTIN : ''],
    ['Additional Info', safeAdditionalInfo],
    ['Cancellation Reason', booking.cancellationReason],
    ['Cancellation Details', booking.cancellationDetails],
    ['Cancelled By', booking.cancelledByRole],
    ['Cancellation Deduction', Number(booking.cancellationDeductionAmount || 0) ? \`\${money(booking.cancellationDeductionAmount)} (\${Number(booking.cancellationDeductionPercent || 12)}%)\` : ''],
    ['Refundable Amount', Number(booking.refundableAmount || 0) ? money(booking.refundableAmount) : ''],
  ];
};`;

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
console.log('Successfully updated customerMessages.js');
