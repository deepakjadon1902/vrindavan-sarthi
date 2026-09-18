const mongoose = require('mongoose');

const externalReservationSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, lowercase: true, trim: true, default: 'ezee', index: true },
    externalReservationId: { type: String, required: true, trim: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', index: true, default: null },
    ratePlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'RatePlan', index: true, default: null },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true, default: null },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'modified', 'cancelled', 'reconciliation_required', 'failed', 'unknown'],
      default: 'pending',
      index: true,
    },
    checkIn: Date,
    checkOut: Date,
    quantity: { type: Number, default: 1 },
    guestName: String,
    guestEmail: String,
    guestPhone: String,
    externalAmount: { type: Number, default: 0 },
    externalCurrency: { type: String, default: 'INR' },
    externalPaymentStatus: { type: String, default: 'unknown' },
    externalPaymentReference: String,
    source: { type: String, default: '' },
    payloadHash: String,
    payloadSummary: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    lastSyncedAt: Date,
    lastError: String,
    reconciliationReason: String,
    lastEventAt: Date,
    providerModifiedAt: Date,
    providerCancelledAt: Date,
  },
  { timestamps: true }
);

externalReservationSchema.index({ provider: 1, externalReservationId: 1 }, { unique: true });
externalReservationSchema.index({ hotelId: 1, status: 1, checkIn: 1 });
externalReservationSchema.index({ bookingId: 1, provider: 1 });

module.exports = mongoose.model('ExternalReservation', externalReservationSchema);
