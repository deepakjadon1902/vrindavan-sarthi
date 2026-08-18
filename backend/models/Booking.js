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

const acceptedPropertyTermsSchema = new mongoose.Schema(
  {
    accepted: { type: Boolean, default: false },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    version: { type: Number, default: 0 },
    acceptedAt: Date,
    sections: {
      generalTerms: { type: String, default: '' },
      checkInRequirements: { type: String, default: '' },
      checkOutRules: { type: String, default: '' },
      cancellationPolicy: { type: String, default: '' },
      guestPolicies: { type: String, default: '' },
      idVerificationRequirements: { type: String, default: '' },
      ageRestrictions: { type: String, default: '' },
      propertyRules: { type: String, default: '' },
      additionalInstructions: { type: String, default: '' },
    },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  bookingType: { type: String, enum: ['hotel', 'room', 'cab', 'tour', 'room_type'], required: true },
  service_billing_model: {
    type: String,
    enum: ['hotel_marketplace', 'taxi_direct', 'tour_direct', 'ecommerce_direct'],
    default: 'hotel_marketplace',
    index: true,
  },
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
  roomUnitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RoomUnit' }],
  roomNumber: String,
  roomNumbers: [String],
  roomQuantity: { type: Number, default: 1 },

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
  baseAmount: { type: Number, default: 0 },
  base_amount: { type: Number, default: 0 },
  taxPercent: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  hotel_gst_amount: { type: Number, default: 0 },
  convenienceFeePercent: { type: Number, default: 4.45 },
  convenienceFeeAmount: { type: Number, default: 0 },
  convenience_fee: { type: Number, default: 0 },
  checkoutSubtotal: { type: Number, default: 0 },
  customer_total: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  advance_paid: { type: Number, default: 0 },
  balanceAmount: { type: Number, default: 0 },
  balance_at_property: { type: Number, default: 0 },
  advancePercent: { type: Number, default: 30 },
  paymentOption: { type: String, enum: ['advance_30', 'full_100'], default: 'advance_30' },
  platformCommissionPercent: { type: Number, default: 0 },
  commission_rate: { type: Number, default: 0 },
  platformCommissionAmount: { type: Number, default: 0 },
  commission_amount: { type: Number, default: 0 },
  grossForHotel: { type: Number, default: 0 },
  gross_for_hotel: { type: Number, default: 0 },
  paymentGatewayFeeAmount: { type: Number, default: 0 },
  payment_gateway_fee: { type: Number, default: 0 },
  partnerNetPayout: { type: Number, default: 0 },
  hotel_net_payout: { type: Number, default: 0 },
  payout_status: { type: String, enum: ['pending', 'checked_in', 'checked_out', 'cancelled', 'settled'], default: 'pending', index: true },
  hotel_gstin: String,
  hotel_invoice_number: String,
  invoiceSentAt: Date,
  paymentMethod: { type: String, enum: ['online', 'doorstep'], default: 'online' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  bookingStatus: { type: String, enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'completed', 'settled'], default: 'pending' },
  verificationStage: { type: String, enum: ['pending_partner', 'pending_admin', 'verified', 'rejected'], default: 'pending_admin' },
  partnerPaymentVerified: { type: Boolean, default: false },
  partnerPaymentVerifiedAt: Date,
  adminPaymentVerified: { type: Boolean, default: false },
  adminPaymentVerifiedAt: Date,
  additionalInfo: String,
  upiTransactionId: String,
  acceptedPropertyTerms: { type: acceptedPropertyTermsSchema, default: () => ({}) },

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
  cancelledByRole: { type: String, enum: ['user', 'admin', 'partner'], default: null },
  cancelledByName: String,
  cancelledAt: Date,
  cancellationDetails: String,
  cancellationDeductionPercent: { type: Number, default: 12 },
  cancellationDeductionAmount: { type: Number, default: 0 },
  refundableAmount: { type: Number, default: 0 },
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
