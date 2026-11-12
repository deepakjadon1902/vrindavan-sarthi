const mongoose = require('mongoose');

const FINANCIAL_EVENT_TYPES = [
  'ONLINE_PAYMENT_RECEIVED',
  'CUSTOMER_REFUND',
  'PLATFORM_COMMISSION',
  'PARTNER_BREAKAGE_ENTITLEMENT',
  'PLATFORM_BREAKAGE_COMMISSION',
  'CONVENIENCE_FEE',
  'DHARAMSHALA_SERVICE_FEE',
  'GATEWAY_EXPENSE',
  'DESK_COLLECTION',
  'PARTNER_SETTLEMENT',
  'SETTLEMENT_ROLLOVER',
  'FINANCIAL_ADJUSTMENT',
  'REVERSAL',
];

const financialLedgerEntrySchema = new mongoose.Schema(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    bookingCode: {
      type: String,
      default: '',
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      index: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    eventType: {
      type: String,
      enum: FINANCIAL_EVENT_TYPES,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    // Integer monetary arithmetic in paise (1 INR = 100 paise) avoids floating-point leakage
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value in paise',
      },
    },
    amountRupees: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    payoutStatus: {
      type: String,
      enum: ['pending', 'settled', 'not_applicable'],
      default: 'not_applicable',
      index: true,
    },
    settledAt: Date,
    settlementReference: String,
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
      unique: true,
    },
    isReversed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reversalReferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialLedgerEntry',
    },
    reversalReason: String,
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorRole: {
      type: String,
      enum: ['user', 'partner', 'admin', 'system'],
      default: 'system',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Compound indices for performant financial reporting & multi-tenant isolation
financialLedgerEntrySchema.index({ partnerId: 1, eventType: 1, payoutStatus: 1 });
financialLedgerEntrySchema.index({ bookingId: 1, eventType: 1 });
financialLedgerEntrySchema.index({ createdAt: -1 });

module.exports = mongoose.model('FinancialLedgerEntry', financialLedgerEntrySchema);
