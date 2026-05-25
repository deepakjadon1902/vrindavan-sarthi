const mongoose = require('mongoose');

const roomTypeSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    images: [String],
    amenities: [String],

    // Pricing (per night)
    pricePerNight: { type: Number, required: true, default: 0 },

    // Occupancy controls
    maxAdults: { type: Number, default: 2 },
    maxChildren: { type: Number, default: 0 },

    // Pets allowed at room-type level (can be overridden per-room-unit)
    petsAllowed: { type: Boolean, default: false },

    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },

    // Partner ownership (copied from Hotel to simplify filtering/authorization)
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    // Who created/updated this room type (admin/partner)
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    createdByRole: { type: String, enum: ['admin', 'partner'], default: null },
  },
  { timestamps: true }
);

roomTypeSchema.index({ hotelId: 1, status: 1, createdAt: -1 });
roomTypeSchema.index({ partnerId: 1, createdAt: -1 });
roomTypeSchema.index({ hotelId: 1, partnerId: 1, createdAt: -1 });

module.exports = mongoose.model('RoomType', roomTypeSchema);
