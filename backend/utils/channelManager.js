const crypto = require('crypto');
const mongoose = require('mongoose');

const Booking = require('../models/Booking');
const ChannelInboundEvent = require('../models/ChannelInboundEvent');
const ChannelConnection = require('../models/ChannelConnection');
const ChannelMapping = require('../models/ChannelMapping');
const ChannelReconciliation = require('../models/ChannelReconciliation');
const ChannelSyncOperation = require('../models/ChannelSyncOperation');
const ExternalReservation = require('../models/ExternalReservation');
const Hotel = require('../models/Hotel');
const RatePlan = require('../models/RatePlan');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const RoomUnitBlock = require('../models/RoomUnitBlock');
const RoomUnitBookingDay = require('../models/RoomUnitBookingDay');
const { QUEUE_NAMES, JOB_NAMES } = require('../queues/names');
const { createQueue } = require('../queues/factory');
const { enumerateDatesUTC, parseDateOnlyToUTC, isValidDate } = require('./date');
const { createBookingQuote, getRoomTypeAvailability, httpError } = require('./rateEngine');
const { getChannelProvider, normalizeProvider } = require('../integrations/channelManager');
const { tryReserveRoomUnitsForBooking, transitionBookingStatus, releaseBookingInventory } = require('./reservationLifecycle');

const DEFAULT_PROVIDER = 'ezee';
const SYNCABLE_STATUSES = new Set(['queued', 'retry_scheduled', 'failed']);
const OUTBOUND_OPERATIONS = new Set(['inventory_sync', 'rate_sync']);

const assertObjectId = (value, name) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ''))) throw httpError(`Invalid ${name}`, 400);
};

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const hashPayload = (payload) => crypto.createHash('sha256').update(stableStringify(payload || {})).digest('hex');

const buildChannelOperationKey = ({
  provider = DEFAULT_PROVIDER,
  operation,
  entityType = 'unknown',
  entityId,
  externalReservationId,
  from,
  to,
}) => [
  'channel',
  normalizeProvider(provider),
  operation,
  entityType,
  entityId ? String(entityId) : (externalReservationId || 'none'),
  from || 'na',
  to || 'na',
].join(':');

const buildChannelReconciliationKey = ({ provider = DEFAULT_PROVIDER, reason, operationId, externalReservationId, eventId }) => [
  'channel-reconciliation',
  normalizeProvider(provider),
  reason || 'unknown',
  operationId ? String(operationId) : (externalReservationId || eventId || 'none'),
].join(':');

const classifyChannelProviderError = (err = {}) => {
  const status = Number(err.statusCode || err.status || err.response?.status);
  if (err.retryable === true) return 'retryable';
  if (err.retryable === false) return 'permanent';
  if (['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(String(err.code || ''))) return 'retryable';
  if ([408, 409, 425, 429].includes(status)) return 'retryable';
  if (status >= 500) return 'retryable';
  if (status >= 400 && status < 500) return 'permanent';
  return 'unknown';
};

const getPartnerHotelFilter = (user) => (user?.role === 'admin' ? {} : { partnerId: user?._id });

const getProviderCapabilities = async (provider = DEFAULT_PROVIDER) => {
  const instance = getChannelProvider(provider);
  if (typeof instance.getCapabilities === 'function') return instance.getCapabilities();
  return instance.capabilities || {};
};

const upsertChannelReconciliation = async ({
  provider = DEFAULT_PROVIDER,
  reason,
  operation,
  event,
  externalReservationId,
  hotelId,
  roomTypeId,
  ratePlanId,
  bookingId,
  details = {},
}) => ChannelReconciliation.findOneAndUpdate(
  {
    provider: normalizeProvider(provider),
    reconciliationKey: buildChannelReconciliationKey({
      provider,
      reason,
      operationId: operation?._id,
      externalReservationId,
      eventId: event?.eventId,
    }),
  },
  {
    $setOnInsert: {
      provider: normalizeProvider(provider),
      reconciliationKey: buildChannelReconciliationKey({
        provider,
        reason,
        operationId: operation?._id,
        externalReservationId,
        eventId: event?.eventId,
      }),
      reason,
      status: 'open',
      operationId: operation?._id || null,
      inboundEventId: event?._id || null,
      externalReservationId: externalReservationId || operation?.externalReservationId || event?.externalReservationId || '',
    },
    $set: {
      hotelId: hotelId || operation?.hotelId || null,
      roomTypeId: roomTypeId || operation?.roomTypeId || null,
      ratePlanId: ratePlanId || operation?.ratePlanId || null,
      bookingId: bookingId || operation?.bookingId || null,
      details,
    },
  },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

const authorizeHotelAccess = async ({ hotelId, user }) => {
  assertObjectId(hotelId, 'hotelId');
  const hotel = await Hotel.findOne({ _id: hotelId, ...getPartnerHotelFilter(user) }).lean();
  if (!hotel) throw httpError('Hotel not found', user?.role === 'admin' ? 404 : 403);
  return hotel;
};

const resolveMappingEntity = async ({ entityType, internalEntityId, user }) => {
  assertObjectId(internalEntityId, 'internalEntityId');
  if (entityType === 'hotel') {
    const hotel = await authorizeHotelAccess({ hotelId: internalEntityId, user });
    return { hotel, hotelId: hotel._id, roomTypeId: null, ratePlanId: null };
  }
  if (entityType === 'room_type') {
    const roomType = await RoomType.findById(internalEntityId).lean();
    if (!roomType) throw httpError('Room type not found', 404);
    const hotel = await authorizeHotelAccess({ hotelId: roomType.hotelId, user });
    return { hotel, roomType, hotelId: hotel._id, roomTypeId: roomType._id, ratePlanId: null };
  }
  if (entityType === 'rate_plan') {
    const ratePlan = await RatePlan.findById(internalEntityId).lean();
    if (!ratePlan) throw httpError('Rate plan not found', 404);
    const hotel = await authorizeHotelAccess({ hotelId: ratePlan.hotelId, user });
    return { hotel, ratePlan, hotelId: hotel._id, roomTypeId: ratePlan.roomTypeId, ratePlanId: ratePlan._id };
  }
  throw httpError('Invalid channel mapping entity type', 400);
};

const upsertChannelMapping = async ({ provider = DEFAULT_PROVIDER, entityType, internalEntityId, externalEntityId, externalCode, metadata, user }) => {
  if (!['hotel', 'room_type', 'rate_plan'].includes(String(entityType || ''))) throw httpError('Invalid channel mapping entity type', 400);
  const entity = await resolveMappingEntity({ entityType, internalEntityId, user });
  const mapping = await ChannelMapping.findOneAndUpdate(
    { provider: normalizeProvider(provider), entityType, internalEntityId },
    {
      $set: {
        provider: normalizeProvider(provider),
        entityType,
        internalEntityId,
        hotelId: entity.hotelId,
        roomTypeId: entity.roomTypeId,
        ratePlanId: entity.ratePlanId,
        externalEntityId: String(externalEntityId || '').trim(),
        externalCode: String(externalCode || '').trim(),
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
        active: true,
        updatedByUserId: user?._id || null,
        updatedByRole: user?.role || 'system',
      },
      $setOnInsert: {
        createdByUserId: user?._id || null,
        createdByRole: user?.role || 'system',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return mapping;
};

const createOrGetChannelSyncOperation = async ({
  provider = DEFAULT_PROVIDER,
  operation,
  entityType = 'unknown',
  entityId,
  hotelId,
  roomTypeId,
  ratePlanId,
  bookingId,
  externalReservationId,
  externalEntityId,
  idempotencyKey,
  payloadSummary = {},
  metadata = {},
}) => {
  const key = idempotencyKey || buildChannelOperationKey({
    provider,
    operation,
    entityType,
    entityId,
    externalReservationId,
    from: payloadSummary.from || payloadSummary.checkIn,
    to: payloadSummary.to || payloadSummary.checkOut,
  });
  const record = await ChannelSyncOperation.findOneAndUpdate(
    { provider: normalizeProvider(provider), idempotencyKey: key },
    {
      $setOnInsert: {
        provider: normalizeProvider(provider),
        operation,
        entityType,
        entityId: entityId || null,
        hotelId: hotelId || null,
        roomTypeId: roomTypeId || null,
        ratePlanId: ratePlanId || null,
        bookingId: bookingId || null,
        externalReservationId: externalReservationId || '',
        externalEntityId: externalEntityId || '',
        idempotencyKey: key,
        operationKey: key,
        correlationId: metadata.correlationId || metadata.requestId || key,
        requestId: metadata.requestId || '',
        generatedAt: metadata.generatedAt || new Date(),
        stateVersion: Math.max(1, Number(metadata.stateVersion || 1)),
        status: 'queued',
        nextAttemptAt: new Date(),
        payloadSummary,
        metadata,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return record;
};

const enqueueChannelSyncOperation = async (operation, { queueFactory = createQueue } = {}) => {
  const queue = queueFactory(QUEUE_NAMES.channel, { required: false });
  if (!queue) return { queued: false, reason: 'redis_unavailable', operationId: String(operation._id) };
  const jobId = `channel:${operation.provider}:${operation._id}`;
  await queue.add(JOB_NAMES.channelSyncProcess, { operationId: String(operation._id) }, { jobId });
  return { queued: true, jobId, operationId: String(operation._id) };
};

const markOperationFailure = async (operation, err) => {
  const errorClass = classifyChannelProviderError(err);
  operation.attempts = Number(operation.attempts || 0) + 1;
  operation.lastError = err?.message || 'Channel sync failed';
  operation.lastErrorAt = new Date();
  operation.errorClass = errorClass;
  operation.status = errorClass === 'retryable' && operation.attempts < Number(operation.maxAttempts || 5)
    ? 'retry_scheduled'
    : (errorClass === 'permanent' ? 'failed' : 'reconciliation_required');
  operation.nextAttemptAt = operation.status === 'retry_scheduled'
    ? new Date(Date.now() + Math.min(60 * 60 * 1000, 1000 * 2 ** operation.attempts))
    : undefined;
  await operation.save();
  if (operation.status === 'reconciliation_required') {
    await upsertChannelReconciliation({
      provider: operation.provider,
      reason: err?.code === 'PROVIDER_CONTRACT_NOT_CONFIGURED' || err?.code === 'EZEE_CONTRACT_NOT_CONFIGURED'
        ? 'provider_contract_missing'
        : 'provider_unknown_outcome',
      operation,
      details: { error: operation.lastError, errorClass },
    });
  }
  return operation;
};

const isStaleOutboundOperation = async (operation) => {
  if (!OUTBOUND_OPERATIONS.has(String(operation.operation || ''))) return false;
  if (!operation.entityId) return false;
  const newer = await ChannelSyncOperation.findOne({
    provider: operation.provider,
    operation: operation.operation,
    entityType: operation.entityType,
    entityId: operation.entityId,
    _id: { $ne: operation._id },
    generatedAt: { $gt: operation.generatedAt || operation.createdAt },
  }).select('_id generatedAt status').lean();
  return Boolean(newer);
};

const buildInventoryPayload = async (operation) => {
  const roomType = await RoomType.findById(operation.roomTypeId || operation.entityId).lean();
  if (!roomType) throw httpError('Room type not found', 404);
  const hotelMapping = await ChannelMapping.findOne({ provider: operation.provider, entityType: 'hotel', internalEntityId: roomType.hotelId, active: true }).lean();
  const roomMapping = await ChannelMapping.findOne({ provider: operation.provider, entityType: 'room_type', internalEntityId: roomType._id, active: true }).lean();
  if (!hotelMapping || !roomMapping) throw httpError('Channel mapping missing for inventory sync', 409);
  const from = operation.payloadSummary?.from;
  const to = operation.payloadSummary?.to;
  const availability = await getRoomTypeAvailability({
    hotelId: roomType.hotelId,
    roomTypeId: roomType._id,
    checkIn: from,
    checkOut: to,
    quantity: 1,
  });
  return {
    provider: operation.provider,
    externalHotelId: hotelMapping.externalEntityId,
    externalRoomTypeId: roomMapping.externalEntityId,
    from,
    to,
    availableCount: availability.availableCount,
    totalUnits: availability.totalUnits,
    idempotencyKey: operation.idempotencyKey,
    operationKey: operation.operationKey || operation.idempotencyKey,
    correlationId: operation.correlationId || String(operation._id),
  };
};

const buildRatePayload = async (operation) => {
  const ratePlan = await RatePlan.findById(operation.ratePlanId || operation.entityId).lean();
  if (!ratePlan) throw httpError('Rate plan not found', 404);
  const hotelMapping = await ChannelMapping.findOne({ provider: operation.provider, entityType: 'hotel', internalEntityId: ratePlan.hotelId, active: true }).lean();
  const roomMapping = await ChannelMapping.findOne({ provider: operation.provider, entityType: 'room_type', internalEntityId: ratePlan.roomTypeId, active: true }).lean();
  const planMapping = await ChannelMapping.findOne({ provider: operation.provider, entityType: 'rate_plan', internalEntityId: ratePlan._id, active: true }).lean();
  if (!hotelMapping || !roomMapping || !planMapping) throw httpError('Channel mapping missing for rate sync', 409);
  return {
    provider: operation.provider,
    externalHotelId: hotelMapping.externalEntityId,
    externalRoomTypeId: roomMapping.externalEntityId,
    externalRatePlanId: planMapping.externalEntityId,
    from: operation.payloadSummary?.from,
    to: operation.payloadSummary?.to,
    basePrice: ratePlan.basePrice,
    currency: ratePlan.currency || 'INR',
    idempotencyKey: operation.idempotencyKey,
    operationKey: operation.operationKey || operation.idempotencyKey,
    correlationId: operation.correlationId || String(operation._id),
  };
};

const normalizeInboundReservationPayload = (payload = {}) => ({
  eventId: String(payload.eventId || payload.id || payload.externalReservationId || ''),
  eventType: String(payload.eventType || payload.type || 'reservation.created'),
  externalReservationId: String(payload.externalReservationId || payload.reservationId || ''),
  externalHotelId: String(payload.externalHotelId || payload.hotelId || ''),
  externalRoomTypeId: String(payload.externalRoomTypeId || payload.roomTypeId || ''),
  externalRatePlanId: String(payload.externalRatePlanId || payload.ratePlanId || ''),
  checkIn: payload.checkIn,
  checkOut: payload.checkOut,
  quantity: Math.max(1, Math.floor(Number(payload.quantity || payload.roomQuantity || 1))),
  adults: Math.max(1, Math.floor(Number(payload.adults || 1))),
  children: Math.max(0, Math.floor(Number(payload.children || 0))),
  guestName: String(payload.guestName || payload.customerName || 'Channel guest').trim(),
  guestEmail: String(payload.guestEmail || payload.customerEmail || '').trim(),
  guestPhone: String(payload.guestPhone || payload.customerPhone || '').trim(),
  externalAmount: Math.max(0, Math.round(Number(payload.amount || payload.totalAmount || 0))),
  externalCurrency: String(payload.currency || 'INR').trim().toUpperCase(),
  externalPaymentStatus: String(payload.paymentStatus || 'unknown').trim().toLowerCase(),
  customerUserId: payload.customerUserId,
  source: String(payload.source || 'channel_manager').trim(),
  providerModifiedAt: payload.providerModifiedAt || payload.modifiedAt || payload.updatedAt,
  providerCancelledAt: payload.providerCancelledAt || payload.cancelledAt,
});

const recordInboundEvent = async ({ provider = DEFAULT_PROVIDER, payload }) => {
  const normalized = normalizeInboundReservationPayload(payload);
  if (!normalized.eventId) throw httpError('Channel event id is required', 400);
  const event = await ChannelInboundEvent.findOneAndUpdate(
    { provider: normalizeProvider(provider), eventId: normalized.eventId },
    {
      $setOnInsert: {
        provider: normalizeProvider(provider),
        eventId: normalized.eventId,
        eventType: normalized.eventType,
        payloadHash: hashPayload(payload),
        status: 'received',
        externalReservationId: normalized.externalReservationId,
        payloadSummary: normalized,
        rawPayload: payload,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (event.payloadHash && event.payloadHash !== hashPayload(payload)) {
    event.status = 'duplicate_conflict';
    event.lastError = 'Duplicate channel event id has a different payload hash';
    event.lastErrorAt = new Date();
    await event.save();
    await upsertChannelReconciliation({
      provider,
      reason: 'payload_conflict',
      event,
      externalReservationId: normalized.externalReservationId,
      details: { eventId: normalized.eventId },
    });
    return { event, operation: null, duplicateConflict: true };
  }
  const operation = await createOrGetChannelSyncOperation({
    provider,
    operation: 'reservation_inbound',
    entityType: 'external_reservation',
    externalReservationId: normalized.externalReservationId,
    idempotencyKey: buildChannelOperationKey({
      provider,
      operation: 'reservation_inbound',
      entityType: 'external_reservation',
      externalReservationId: normalized.externalReservationId || normalized.eventId,
    }),
    payloadSummary: normalized,
    metadata: { inboundEventId: event._id },
  });
  event.operationId = operation._id;
  if (event.status === 'received') event.status = 'queued';
  await event.save();
  await enqueueChannelSyncOperation(operation);
  return { event, operation };
};

const createBookingForExternalReservation = async ({ external, hotel, roomType, ratePlan, normalized }) => {
  if (!normalized.customerUserId || !mongoose.Types.ObjectId.isValid(String(normalized.customerUserId))) {
    external.status = 'reconciliation_required';
    external.reconciliationReason = 'customer_user_mapping_required';
    await external.save();
    return { external, booking: null, reconciliationRequired: true };
  }

  const quote = await createBookingQuote({
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    ratePlanId: ratePlan?._id,
    checkIn: normalized.checkIn,
    checkOut: normalized.checkOut,
    roomQuantity: normalized.quantity,
    adults: normalized.adults,
    children: normalized.children,
    paymentOption: 'full_100',
    checkInventory: true,
  });
  if (!quote.quote.inventoryAvailable) {
    external.status = 'reconciliation_required';
    external.reconciliationReason = 'insufficient_inventory';
    await external.save();
    return { external, booking: null, reconciliationRequired: true };
  }

  const checkIn = parseDateOnlyToUTC(String(normalized.checkIn));
  const checkOut = parseDateOnlyToUTC(String(normalized.checkOut));
  const daysToReserve = enumerateDatesUTC(checkIn, checkOut);
  const [units, blocks] = await Promise.all([
    RoomUnit.find({ hotelId: hotel._id, roomTypeId: roomType._id, status: { $in: ['active', 'available'] } }).sort({ number: 1 }),
    RoomUnitBlock.find({ roomTypeId: roomType._id, date: { $in: daysToReserve } }).lean(),
  ]);
  const blockedSet = new Set(blocks.map((block) => String(block.roomUnitId)));
  const booking = new Booking({
    bookingType: 'room_type',
    service_billing_model: 'hotel_marketplace',
    itemId: String(roomType._id),
    itemName: roomType.name,
    userId: normalized.customerUserId,
    userName: normalized.guestName,
    userEmail: normalized.guestEmail,
    userPhone: normalized.guestPhone,
    partnerId: hotel.partnerId,
    partnerName: hotel.partnerName,
    partnerPhone: hotel.partnerPhone,
    hotelId: hotel._id,
    roomTypeId: roomType._id,
    ratePlanId: quote.ratePlan._id,
    ratePlanName: quote.ratePlan.name,
    ratePlanCode: quote.ratePlan.code,
    ratePlanMealPlan: quote.ratePlan.mealPlan,
    nightlyBreakdown: quote.quote.nightlyBreakdown,
    checkIn,
    checkOut,
    guests: normalized.adults + normalized.children,
    roomQuantity: normalized.quantity,
    customerFullName: normalized.guestName,
    customerMobile: normalized.guestPhone,
    customerEmail: normalized.guestEmail,
    totalAdults: normalized.adults,
    totalChildren: normalized.children,
    baseAmount: quote.quote.baseAmount,
    base_amount: quote.quote.baseAmount,
    taxPercent: quote.quote.taxPercent,
    taxAmount: quote.quote.taxAmount,
    totalAmount: quote.quote.totalAmount,
    customer_total: quote.quote.totalAmount,
    advanceAmount: quote.quote.totalAmount,
    advance_paid: quote.quote.totalAmount,
    balanceAmount: 0,
    balance_at_property: 0,
    paymentOption: 'full_100',
    paymentMethod: 'online',
    paymentProvider: 'manual_upi',
    paymentStatus: normalized.externalPaymentStatus === 'paid' || normalized.externalPaymentStatus === 'captured' ? 'paid' : 'pending',
    bookingStatus: normalized.externalPaymentStatus === 'paid' || normalized.externalPaymentStatus === 'captured' ? 'confirmed' : 'pending',
    verificationStage: 'verified',
    partnerPaymentVerified: true,
    adminPaymentVerified: true,
    additionalInfo: `Channel reservation ${external.provider}:${external.externalReservationId}`,
  });

  const selectedUnits = await tryReserveRoomUnitsForBooking({
    booking,
    hotel,
    roomType,
    units,
    daysToReserve,
    blockedSet,
    roomQuantity: normalized.quantity,
  });
  if (selectedUnits.length < normalized.quantity) {
    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
    external.status = 'reconciliation_required';
    external.reconciliationReason = 'inventory_race_lost';
    await external.save();
    return { external, booking: null, reconciliationRequired: true };
  }
  booking.roomUnitIds = selectedUnits.map((unit) => unit._id);
  booking.roomNumbers = selectedUnits.map((unit) => unit.number);
  booking.roomUnitId = selectedUnits[0]._id;
  booking.roomNumber = selectedUnits[0].number;
  if (booking.bookingStatus === 'confirmed') await transitionBookingStatus(booking, 'confirmed', { actorRole: 'system', reason: 'channel_reservation_import' });
  try {
    await booking.save();
  } catch (err) {
    await RoomUnitBookingDay.deleteMany({ bookingId: booking._id });
    throw err;
  }
  external.bookingId = booking._id;
  external.status = booking.bookingStatus === 'confirmed' ? 'confirmed' : 'pending';
  external.lastSyncedAt = new Date();
  await external.save();
  return { external, booking, reconciliationRequired: false };
};

const processInboundReservationOperation = async (operation) => {
  const normalized = normalizeInboundReservationPayload(operation.payloadSummary || {});
  const eventType = String(normalized.eventType || '').toLowerCase();
  if (eventType.includes('cancel')) {
    const external = await ExternalReservation.findOne({
      provider: operation.provider,
      externalReservationId: normalized.externalReservationId,
    });
    if (!external) {
      await upsertChannelReconciliation({
        provider: operation.provider,
        reason: 'out_of_order_event',
        operation,
        externalReservationId: normalized.externalReservationId,
        details: { eventType: normalized.eventType },
      });
      return { reconciliationRequired: true, external: null };
    }
    if (external.bookingId) {
      const booking = await Booking.findById(external.bookingId);
      if (booking && !['cancelled', 'expired', 'payment_failed', 'checked_out', 'settled'].includes(String(booking.bookingStatus || ''))) {
        await transitionBookingStatus(booking, 'cancelled', { actorRole: 'system', reason: 'channel_reservation_cancelled' });
        booking.cancelledByRole = 'admin';
        booking.cancelledByName = 'Channel Manager';
        await booking.save();
        await releaseBookingInventory(booking);
      }
    }
    external.status = 'cancelled';
    external.providerCancelledAt = normalized.providerCancelledAt ? new Date(normalized.providerCancelledAt) : new Date();
    external.lastSyncedAt = new Date();
    await external.save();
    return { external, bookingId: external.bookingId, cancelled: true };
  }
  if (eventType.includes('modify') || eventType.includes('update')) {
    await upsertChannelReconciliation({
      provider: operation.provider,
      reason: 'manual_review',
      operation,
      externalReservationId: normalized.externalReservationId,
      details: { eventType: normalized.eventType, message: 'External modification requires provider contract mapping to internal booking modification flow' },
    });
    return { reconciliationRequired: true, external: null };
  }
  const [hotelMapping, roomMapping, planMapping] = await Promise.all([
    ChannelMapping.findOne({ provider: operation.provider, entityType: 'hotel', externalEntityId: normalized.externalHotelId, active: true }).lean(),
    ChannelMapping.findOne({ provider: operation.provider, entityType: 'room_type', externalEntityId: normalized.externalRoomTypeId, active: true }).lean(),
    normalized.externalRatePlanId
      ? ChannelMapping.findOne({ provider: operation.provider, entityType: 'rate_plan', externalEntityId: normalized.externalRatePlanId, active: true }).lean()
      : null,
  ]);
  if (!hotelMapping || !roomMapping) {
    await upsertChannelReconciliation({
      provider: operation.provider,
      reason: 'missing_mapping',
      operation,
      externalReservationId: normalized.externalReservationId,
      details: { externalHotelId: normalized.externalHotelId, externalRoomTypeId: normalized.externalRoomTypeId },
    });
    throw httpError('Channel reservation mapping missing', 409);
  }
  const [hotel, roomType, ratePlan] = await Promise.all([
    Hotel.findById(hotelMapping.internalEntityId).lean(),
    RoomType.findById(roomMapping.internalEntityId).lean(),
    planMapping ? RatePlan.findById(planMapping.internalEntityId).lean() : null,
  ]);
  if (!hotel || !roomType || String(roomType.hotelId) !== String(hotel._id)) {
    await upsertChannelReconciliation({ provider: operation.provider, reason: 'relationship_invalid', operation, externalReservationId: normalized.externalReservationId });
    throw httpError('Channel mapping relationship invalid', 409);
  }
  if (planMapping && (!ratePlan || String(ratePlan.roomTypeId) !== String(roomType._id))) {
    await upsertChannelReconciliation({ provider: operation.provider, reason: 'relationship_invalid', operation, externalReservationId: normalized.externalReservationId });
    throw httpError('Channel rate plan mapping relationship invalid', 409);
  }

  const external = await ExternalReservation.findOneAndUpdate(
    { provider: operation.provider, externalReservationId: normalized.externalReservationId },
    {
      $setOnInsert: {
        provider: operation.provider,
        externalReservationId: normalized.externalReservationId,
        hotelId: hotel._id,
        roomTypeId: roomType._id,
        ratePlanId: ratePlan?._id || null,
        checkIn: parseDateOnlyToUTC(String(normalized.checkIn)),
        checkOut: parseDateOnlyToUTC(String(normalized.checkOut)),
        quantity: normalized.quantity,
        guestName: normalized.guestName,
        guestEmail: normalized.guestEmail,
        guestPhone: normalized.guestPhone,
        externalAmount: normalized.externalAmount,
        externalCurrency: normalized.externalCurrency,
        externalPaymentStatus: normalized.externalPaymentStatus,
        source: normalized.source,
        payloadHash: hashPayload(normalized),
        payloadSummary: normalized,
        providerModifiedAt: normalized.providerModifiedAt ? new Date(normalized.providerModifiedAt) : undefined,
        providerCancelledAt: normalized.providerCancelledAt ? new Date(normalized.providerCancelledAt) : undefined,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (external.bookingId) return { external, bookingId: external.bookingId, idempotent: true };
  return createBookingForExternalReservation({ external, hotel, roomType, ratePlan, normalized });
};

const processChannelSyncOperation = async ({ operationId, provider: providerOverride } = {}) => {
  assertObjectId(operationId, 'channel operation id');
  const operation = await ChannelSyncOperation.findOneAndUpdate(
    { _id: operationId, status: { $in: Array.from(SYNCABLE_STATUSES) } },
    { $set: { status: 'processing', processingStartedAt: new Date() } },
    { new: true }
  );
  if (!operation) {
    return ChannelSyncOperation.findById(operationId).lean().then((record) => ({ idempotent: true, status: record?.status || 'missing' }));
  }

  try {
    if (await isStaleOutboundOperation(operation)) {
      operation.status = 'completed';
      operation.completedAt = new Date();
      operation.errorClass = 'none';
      operation.providerResponseReference = 'stale_outbound_operation_skipped';
      operation.metadata = { ...(operation.metadata || {}), staleSkipped: true };
      await operation.save();
      return operation;
    }
    const provider = providerOverride || getChannelProvider(operation.provider);
    let response;
    if (operation.operation === 'inventory_sync') {
      response = await provider.updateAvailability(await buildInventoryPayload(operation));
    } else if (operation.operation === 'rate_sync') {
      response = await provider.updateRates(await buildRatePayload(operation));
    } else if (operation.operation === 'reservation_inbound' || operation.operation === 'webhook_process') {
      response = await processInboundReservationOperation(operation);
    } else if (operation.operation === 'reservation_create') {
      response = await provider.createReservation({ ...operation.payloadSummary, idempotencyKey: operation.idempotencyKey, correlationId: operation.correlationId });
    } else if (operation.operation === 'reservation_modify') {
      response = await provider.modifyReservation({ ...operation.payloadSummary, idempotencyKey: operation.idempotencyKey, correlationId: operation.correlationId });
    } else if (operation.operation === 'reservation_cancel') {
      response = await provider.cancelReservation({ ...operation.payloadSummary, idempotencyKey: operation.idempotencyKey, correlationId: operation.correlationId });
    } else {
      throw httpError(`Unsupported channel operation: ${operation.operation}`, 400);
    }
    operation.status = response?.reconciliationRequired ? 'reconciliation_required' : 'completed';
    operation.completedAt = new Date();
    operation.errorClass = response?.reconciliationRequired ? 'reconciliation_required' : 'none';
    operation.providerResponseReference = response?.providerReference || response?.bookingId || response?.external?._id || '';
    operation.lastError = response?.reconciliationRequired ? response?.external?.reconciliationReason : undefined;
    await operation.save();
    console.log(`[channel_sync_${operation.status}] id=${operation._id} operation=${operation.operation}`);
    return operation;
  } catch (err) {
    const failed = await markOperationFailure(operation, err);
    console.log(`[channel_sync_${failed.status}] id=${failed._id} operation=${failed.operation} errorClass=${failed.errorClass}`);
    return failed;
  }
};

const requestInventorySync = async ({ provider = DEFAULT_PROVIDER, roomTypeId, from, to, user }) => {
  assertObjectId(roomTypeId, 'roomTypeId');
  const start = parseDateOnlyToUTC(String(from || ''));
  const end = parseDateOnlyToUTC(String(to || ''));
  if (!isValidDate(start) || !isValidDate(end) || start >= end) throw httpError('Valid from/to dates are required', 400);
  const roomType = await RoomType.findById(roomTypeId).lean();
  if (!roomType) throw httpError('Room type not found', 404);
  await authorizeHotelAccess({ hotelId: roomType.hotelId, user });
  const operation = await createOrGetChannelSyncOperation({
    provider,
    operation: 'inventory_sync',
    entityType: 'room_type',
    entityId: roomType._id,
    hotelId: roomType.hotelId,
    roomTypeId: roomType._id,
    payloadSummary: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
    metadata: { generatedAt: new Date(), stateVersion: Date.now() },
  });
  return { operation, queued: await enqueueChannelSyncOperation(operation) };
};

const requestRateSync = async ({ provider = DEFAULT_PROVIDER, ratePlanId, from, to, user }) => {
  assertObjectId(ratePlanId, 'ratePlanId');
  const start = parseDateOnlyToUTC(String(from || ''));
  const end = parseDateOnlyToUTC(String(to || ''));
  if (!isValidDate(start) || !isValidDate(end) || start >= end) throw httpError('Valid from/to dates are required', 400);
  const ratePlan = await RatePlan.findById(ratePlanId).lean();
  if (!ratePlan) throw httpError('Rate plan not found', 404);
  await authorizeHotelAccess({ hotelId: ratePlan.hotelId, user });
  const operation = await createOrGetChannelSyncOperation({
    provider,
    operation: 'rate_sync',
    entityType: 'rate_plan',
    entityId: ratePlan._id,
    hotelId: ratePlan.hotelId,
    roomTypeId: ratePlan.roomTypeId,
    ratePlanId: ratePlan._id,
    payloadSummary: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
    metadata: { generatedAt: new Date(), stateVersion: Date.now() },
  });
  return { operation, queued: await enqueueChannelSyncOperation(operation) };
};

const upsertChannelConnection = async ({ provider = DEFAULT_PROVIDER, hotelId, enabled = false, environment = 'disabled', externalHotelId, credentialsReference, metadata, user }) => {
  await authorizeHotelAccess({ hotelId, user });
  const capabilities = await getProviderCapabilities(provider);
  return ChannelConnection.findOneAndUpdate(
    { provider: normalizeProvider(provider), hotelId },
    {
      $set: {
        provider: normalizeProvider(provider),
        hotelId,
        enabled: Boolean(enabled),
        status: enabled ? 'enabled' : 'disabled',
        environment: enabled ? environment : 'disabled',
        externalHotelId: String(externalHotelId || '').trim(),
        credentialsReference: String(credentialsReference || '').trim(),
        capabilities,
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
        updatedByUserId: user?._id || null,
        updatedByRole: user?.role || 'system',
      },
      $setOnInsert: {
        createdByUserId: user?._id || null,
        createdByRole: user?.role || 'system',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const checkChannelProviderHealth = async ({ provider = DEFAULT_PROVIDER, hotelId, user } = {}) => {
  if (hotelId) await authorizeHotelAccess({ hotelId, user });
  const instance = getChannelProvider(provider);
  const health = await instance.healthCheck();
  if (hotelId) {
    await ChannelConnection.findOneAndUpdate(
      { provider: normalizeProvider(provider), hotelId },
      {
        $set: {
          lastHealthCheckAt: new Date(),
          status: health.ok ? 'enabled' : 'degraded',
          lastError: health.ok ? '' : (health.reason || 'provider_unhealthy'),
          capabilities: await getProviderCapabilities(provider),
        },
      },
      { new: true }
    );
  }
  return health;
};

module.exports = {
  buildChannelOperationKey,
  buildChannelReconciliationKey,
  checkChannelProviderHealth,
  classifyChannelProviderError,
  createOrGetChannelSyncOperation,
  enqueueChannelSyncOperation,
  getProviderCapabilities,
  isStaleOutboundOperation,
  normalizeInboundReservationPayload,
  processChannelSyncOperation,
  recordInboundEvent,
  requestInventorySync,
  requestRateSync,
  upsertChannelConnection,
  upsertChannelMapping,
  upsertChannelReconciliation,
};
