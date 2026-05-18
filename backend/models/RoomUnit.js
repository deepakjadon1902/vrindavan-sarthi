const mongoose = require('mongoose');

const roomUnitSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    number: { type: String, required: true }, // e.g. "201"
    floor: { type: String, default: '' },

    // Optional per-room override for pets
    petsAllowedOverride: { type: Boolean, default: null },

    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },

    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    createdByRole: { type: String, enum: ['admin', 'partner'], default: null },
  },
  { timestamps: true }
);

roomUnitSchema.index({ hotelId: 1, roomTypeId: 1, status: 1, createdAt: -1 });
roomUnitSchema.index({ roomTypeId: 1, number: 1 }, { unique: true });

module.exports = mongoose.model('RoomUnit', roomUnitSchema);
