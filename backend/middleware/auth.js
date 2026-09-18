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

module.exports = { protect, authorize };
