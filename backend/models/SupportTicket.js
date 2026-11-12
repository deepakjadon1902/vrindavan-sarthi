const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    userPhone: { type: String, default: '' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
    bookingCode: { type: String, default: '', index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel' },
    propertyName: { type: String, default: '' },
    category: {
      type: String,
      enum: ['Booking', 'Payment', 'Cancellation', 'Refund', 'Property', 'Partner', 'Check-in', 'Checkout', 'Other'],
      default: 'Other',
      index: true,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Waiting for Response', 'Resolved', 'Closed'],
      default: 'Open',
      index: true,
    },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedAdminName: { type: String, default: '' },
    internalNotes: [
      {
        note: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    timeline: [
      {
        action: { type: String, required: true },
        performedBy: { type: String, default: '' },
        performedByRole: { type: String, default: '' },
        note: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    resolutionNotes: { type: String, default: '' },
    resolvedAt: Date,
    closedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
