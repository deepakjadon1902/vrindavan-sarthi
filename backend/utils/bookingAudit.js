const AuditLog = require('../models/AuditLog');

const recordBookingAudit = async ({
  action,
  booking,
  req,
  actorId,
  actorRole,
  actorName,
  idempotencyKey,
  beforeState = {},
  afterState = {},
  metadata = {},
}) => {
  try {
    const ip = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req?.ip || '';
    const userAgent = typeof req?.get === 'function' ? String(req.get('user-agent') || '') : '';

    await AuditLog.create({
      action,
      bookingId: booking?.bookingId || String(booking?._id || 'unknown'),
      bookingObjectId: booking?._id,
      actorId: actorId || req?.user?._id,
      actorRole: actorRole || req?.user?.role || 'unknown',
      actorName: actorName || req?.user?.name || '',
      propertyId: booking?.hotelId || undefined,
      partnerId: booking?.partnerId || undefined,
      idempotencyKey: idempotencyKey || undefined,
      beforeState,
      afterState,
      metadata,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn('[audit.record_failed]', err?.message || err);
  }
};

module.exports = { recordBookingAudit };
