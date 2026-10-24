const mongoose = require('mongoose');

const roomUnitSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    number: { type: String, required: true }, // e.g. "201"
    roomId: { type: String, index: true }, // e.g. "201"
    floor: { type: String, default: '' },

    // Optional per-room override for pets
    petsAllowedOverride: { type: Boolean, default: null },

    status: {
      type: String,
      enum: ['active', 'inactive', 'available', 'unavailable', 'maintenance', 'closed'],
      default: 'available',
      index: true,
    },

    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    createdByRole: { type: String, enum: ['admin', 'partner'], default: null },
  },
  { timestamps: true }
);

roomUnitSchema.pre('save', async function (next) {
  if (!this.roomId && this.hotelId) {
    try {
      const cleanNum = String(this.number || '').trim();
      if (/^\d+$/.test(cleanNum)) {
        this.roomId = cleanNum;
      } else {
        const { getNextRoomId } = require('../utils/idAllocation');
        this.roomId = await getNextRoomId(this.hotelId, this.number);
      }
    } catch {
      // Continue safely if Counter is unavailable in detached test mocks
    }
  }
  next();
});

roomUnitSchema.index({ hotelId: 1, roomTypeId: 1, status: 1, createdAt: -1 });
roomUnitSchema.index({ roomTypeId: 1, number: 1 }, { unique: true });
roomUnitSchema.index({ roomTypeId: 1, status: 1 });

module.exports = mongoose.model('RoomUnit', roomUnitSchema);
