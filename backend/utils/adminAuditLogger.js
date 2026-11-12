const AuditLog = require('../models/AuditLog');

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordResetOtpHash',
  'token',
  'guestAccessToken',
  'razorpay_signature',
  'secret',
  'authorization',
  'cvv',
  'credit_card',
]);

const sanitizeForAudit = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForAudit);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeForAudit(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
};

const logAdminAction = async ({
  actor,
  action,
  targetEntityType,
  targetEntityId,
  beforeState,
  afterState,
  reason = '',
  metadata = {},
  bookingId = '',
  req,
}) => {
  try {
    if (!actor || !action) return null;

    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    const userAgent = req ? String(req.headers['user-agent'] || '').slice(0, 255) : '';

    const entry = await AuditLog.create({
      action,
      targetEntityType: targetEntityType || 'system',
      targetEntityId: String(targetEntityId || ''),
      reason: String(reason || '').slice(0, 500),
      bookingId: bookingId || (targetEntityType === 'booking' ? String(targetEntityId || '') : ''),
      actorId: actor._id || actor.id,
      actorRole: actor.adminRole || actor.role || 'admin',
      actorName: actor.name || actor.email || 'Admin',
      beforeState: sanitizeForAudit(beforeState),
      afterState: sanitizeForAudit(afterState),
      metadata: sanitizeForAudit(metadata),
      ip: String(ip).slice(0, 45),
      userAgent,
      timestamp: new Date(),
    });

    return entry;
  } catch (err) {
    console.error('[adminAuditLogger] Failed to record audit log:', err.message);
    return null;
  }
};

module.exports = {
  logAdminAction,
  sanitizeForAudit,
};
