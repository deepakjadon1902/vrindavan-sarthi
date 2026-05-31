const mongoose = require('mongoose');

const guestDetailSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['adult', 'child'], required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  bookingType: { type: String, enum: ['hotel', 'room', 'cab', 'tour', 'room_type'], required: true },
  itemId: { type: String, required: true },
  itemName: String,
  itemImage: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userEmail: String,
  userPhone: String,
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  partnerName: String,

  // Hotel inventory booking (room-type based)
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
  roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType' },
  roomUnitId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomUnit' },
  roomNumber: String,

  checkIn: Date,
  checkOut: Date,
  guests: Number,

  // Cab booking fields
  pickupLocation: String,
  dropLocation: String,
  pickupDate: String,
  pickupTime: String,
  cabType: String,
  cabFareRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CabFare' },
  cabFareBase: { type: Number, default: 0 },
  cabFareExtra: { type: Number, default: 0 },
  cabFareTotal: { type: Number, default: 0 },
  tollOption: { type: String, enum: ['included', 'excluded'], default: null },
  assignedCabId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cab' },
  assignedVehicleName: String,
  assignedVehicleType: String,
  assignedDriverName: String,
  assignedDriverPhone: String,
  assignedDriverEmail: String,

  // Detailed booking form fields
  customerFullName: String,
  customerMobile: String,
  customerEmail: String,

  arrivalMode: { type: String, enum: ['personal_vehicle', 'transport'], default: null },
  vehicleNumber: String,
  arrivalTime: String,

  totalAdults: { type: Number, default: 0 },
  totalChildren: { type: Number, default: 0 },
  hasPet: { type: Boolean, default: false },
  guestDetails: [guestDetailSchema],

  totalAmount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  advancePercent: { type: Number, default: 30 },
  invoiceSentAt: Date,
  paymentMethod: { type: String, enum: ['online', 'doorstep'], default: 'online' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  bookingStatus: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  verificationStage: { type: String, enum: ['pending_partner', 'pending_admin', 'verified', 'rejected'], default: 'pending_admin' },
  partnerPaymentVerified: { type: Boolean, default: false },
  partnerPaymentVerifiedAt: Date,
  adminPaymentVerified: { type: Boolean, default: false },
  adminPaymentVerifiedAt: Date,
  additionalInfo: String,
  upiTransactionId: String,

  // Waitlist (room_type bookings only): when no room unit could be assigned immediately.
  // Such bookings have roomUnitId/roomNumber unset until later assignment.
  isWaitlisted: { type: Boolean, default: false },
  waitlistAssignedAt: Date,

  // Cancellation control
  cancellationRequested: { type: Boolean, default: false },
  cancellationReason: String,
  cancellationRequestedAt: Date,
  cancellationReviewedByAdmin: { type: Boolean, default: false },
  cancellationReviewedAt: Date,
}, { timestamps: true });

bookingSchema.pre('save', function (next) {
  if (!this.bookingId) {
    const year = new Date().getFullYear();
    this.bookingId = `VVS-${year}-${String(Math.floor(10000 + Math.random() * 90000))}`;
  }
  next();
});

bookingSchema.index({ bookingType: 1, createdAt: -1 });
bookingSchema.index({ hotelId: 1, roomTypeId: 1, roomUnitId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ partnerId: 1, createdAt: -1 });
bookingSchema.index({ roomTypeId: 1, bookingStatus: 1, checkIn: 1, checkOut: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
