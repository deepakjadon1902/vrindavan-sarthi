const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  const authorization = String(req.headers.authorization || '');
  if (authorization) {
    const [scheme, value, extra] = authorization.split(/\s+/);
    if (scheme !== 'Bearer' || !value || extra) {
      return res.status(401).json({ success: false, message: 'Token invalid' });
    }
    token = value;
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized' });

  try {
    if (!process.env.JWT_SECRET) return res.status(500).json({ success: false, message: 'Authentication is not configured' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ success: false, message: 'Token invalid' });
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User no longer exists' });
    if (req.user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Reason: ' + (req.user.suspensionReason || 'Violation of terms'),
      });
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

const optionalProtect = async (req, res, next) => {
  const authorization = String(req.headers.authorization || '');
  if (!authorization) return next();

  const [scheme, value, extra] = authorization.split(/\s+/);
  if (scheme !== 'Bearer' || !value || extra) {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }

  try {
    if (!process.env.JWT_SECRET) return res.status(500).json({ success: false, message: 'Authentication is not configured' });
    const decoded = jwt.verify(value, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ success: false, message: 'Token invalid' });
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User no longer exists' });
    if (req.user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Reason: ' + (req.user.suspensionReason || 'Violation of terms'),
      });
    }
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authorized' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Not authorized for this role' });
  }
  if (req.user.role === 'partner' && req.user.partnerStatus && req.user.partnerStatus !== 'approved') {
    return res.status(403).json({ success: false, message: 'Partner account pending verification' });
  }
  next();
};

const ADMIN_ROLE_PERMISSIONS = {
  super_admin: [
    'manage_admins',
    'manage_properties',
    'manage_partners',
    'manage_bookings',
    'manage_finance',
    'manage_refunds',
    'manage_settlements',
    'manage_users',
    'manage_support',
    'view_reports',
    'view_audit_logs',
    'view_bookings',
    'view_customers',
  ],
  operations_admin: [
    'manage_properties',
    'manage_partners',
    'manage_bookings',
    'view_reports',
    'view_bookings',
    'view_customers',
    'view_audit_logs',
  ],
  finance_admin: [
    'manage_finance',
    'manage_refunds',
    'manage_settlements',
    'manage_bookings',
    'view_reports',
    'view_bookings',
    'view_audit_logs',
  ],
  support_admin: [
    'manage_support',
    'view_bookings',
    'view_customers',
    'view_reports',
  ],
};

const authorizeAdmin = (requiredPermission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authorized' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  if (!requiredPermission) return next();

  const adminRole = req.user.adminRole || 'super_admin';
  const permissions = ADMIN_ROLE_PERMISSIONS[adminRole] || [];
  if (!permissions.includes(requiredPermission)) {
    return res.status(403).json({
      success: false,
      message: `Insufficient admin privileges. Required permission: ${requiredPermission}`,
      role: adminRole,
    });
  }
  next();
};

module.exports = { protect, optionalProtect, authorize, authorizeAdmin, ADMIN_ROLE_PERMISSIONS };
