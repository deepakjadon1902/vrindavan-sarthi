const fs = require('fs');
let code = fs.readFileSync('backend/tests/verify_all_email_flows_integration.js', 'utf8');

const target = 
`    const dharamshalaBooking = await Booking.create({
      bookingId: \`VVS-DHR-\${testRunId}\`,
      displayBookingId: '80000002',
      bookingType: 'room_type',
      propertyType: 'dharamshala',
      service_billing_model: 'dharamshala_booking',
      itemName: 'Shri Radha Rani Seva Dham - Family Hall',
      userId: new mongoose.Types.ObjectId(), itemId: 'mock_item_1', customerFullName: 'Braj Yatri',
      customerEmail: 'yatri.dharamshala@mocktest.local',
      customerMobile: '9876500002',
      checkIn: new Date('2026-11-15'),
      checkOut: new Date('2026-11-18'),`;

const replacement = 
`    const dharamshalaBooking = await Booking.create({
      bookingId: \`VVS-DHR-\${testRunId}\`,
      displayBookingId: '80000002',
      bookingType: 'room_type',
      propertyType: 'dharamshala',
      service_billing_model: 'dharamshala_booking',
      hotelId: new mongoose.Types.ObjectId('6a93f456114b753bb641effe'),
      roomTypeId: new mongoose.Types.ObjectId('6a93f61a114b753bb641f0a5'),
      itemName: 'ANUKAMPA DHAM - AC Double Bed Room',
      userId: new mongoose.Types.ObjectId(), itemId: 'mock_item_1', customerFullName: 'Braj Yatri',
      customerEmail: 'yatri.dharamshala@mocktest.local',
      customerMobile: '9876500002',
      checkIn: new Date('2027-01-15'),
      checkOut: new Date('2027-01-18'),`;

if (!code.includes(target.replace(/\n/g, '\r\n')) && !code.includes(target)) {
  console.error('Target not found for dharamshalaBooking');
  process.exit(1);
}
code = code.replace(target.replace(/\n/g, '\r\n'), replacement.replace(/\n/g, '\r\n'));
fs.writeFileSync('backend/tests/verify_all_email_flows_integration.js', code, 'utf8');
console.log('Successfully updated dharamshalaBooking');
