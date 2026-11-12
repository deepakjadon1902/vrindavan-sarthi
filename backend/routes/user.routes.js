const express = require('express');
const User = require('../models/User');
const Booking = require('../models/Booking');
const SupportTicket = require('../models/SupportTicket');
const { protect, authorize, authorizeAdmin } = require('../middleware/auth');
const { rejectInvalidObjectId } = require('../utils/security');
const { logAdminAction } = require('../utils/adminAuditLogger');

const router = express.Router();

router.param('id', (req, res, next, value) => {
  if (rejectInvalidObjectId(res, value, 'user id')) return;
  next();
});

const isEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// Get all users (admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update admin login credentials (admin)
router.put('/admin-credentials', protect, authorize('admin'), async (req, res) => {
  try {
    const { currentPassword, newEmail, newPassword } = req.body || {};

    if (typeof currentPassword !== 'string' || currentPassword.length < 1) {
      return res.status(400).json({ success: false, message: 'Current password is required' });
    }

    const admin = await User.findById(req.user._id).select('+password');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const ok = await admin.matchPassword(currentPassword);
    if (!ok) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    if (newEmail !== undefined) {
      if (!isEmail(newEmail)) return res.status(400).json({ success: false, message: 'Invalid email' });
      const email = newEmail.trim().toLowerCase();
      if (email !== admin.email) {
        const exists = await User.findOne({ email, _id: { $ne: admin._id } });
        if (exists) return res.status(409).json({ success: false, message: 'Email already in use' });
        admin.email = email;
      }
    }

    if (newPassword !== undefined) {
      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
      }
      admin.password = newPassword;
    }

    await admin.save();
    const safe = await User.findById(admin._id).select('-password');
    res.json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Customer Directory
router.get('/customers', protect, authorizeAdmin('view_customers'), async (req, res) => {
  try {
    const { q, status = 'all', page = 1, limit = 20 } = req.query;
    const filter = { role: 'user' };

    if (status === 'active') filter.isSuspended = { $ne: true };
    if (status === 'suspended') filter.isSuspended = true;

    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }, { phone: re }];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [customers, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      User.countDocuments(filter),
    ]);

    // Aggregate booking totals for returned customers
    const customerIds = customers.map((c) => c._id);
    const bookingStats = await Booking.aggregate([
      { $match: { userId: { $in: customerIds } } },
      {
        $group: {
          _id: '$userId',
          bookingsCount: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [
                { $in: ['$bookingStatus', ['confirmed', 'checked_in', 'checked_out', 'completed', 'settled']] },
                { $ifNull: ['$totalAmount', 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const statsMap = new Map(bookingStats.map((s) => [String(s._id), s]));

    const enriched = customers.map((c) => {
      const stats = statsMap.get(String(c._id)) || { bookingsCount: 0, totalSpent: 0 };
      return {
        ...c,
        bookingsCount: stats.bookingsCount,
        totalSpent: stats.totalSpent,
      };
    });

    res.json({
      success: true,
      data: enriched,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.max(1, Math.ceil(total / parseInt(limit, 10))),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load customers' });
  }
});

// Customer Detail
router.get('/customers/:id', protect, authorizeAdmin('view_customers'), async (req, res) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'user' }).select('-password').lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const [bookings, supportTickets] = await Promise.all([
      Booking.find({ userId: customer._id })
        .sort({ createdAt: -1 })
        .select('bookingId displayBookingId bookingType propertyName totalAmount bookingStatus paymentStatus checkIn checkOut createdAt')
        .lean(),
      SupportTicket.find({ userId: customer._id })
        .sort({ createdAt: -1 })
        .select('ticketId subject category priority status createdAt')
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        customer,
        bookings,
        supportTickets,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load customer profile' });
  }
});

// Suspend / Reactivate Customer
router.put('/customers/:id/suspension', protect, authorizeAdmin('manage_users'), async (req, res) => {
  try {
    const { isSuspended, reason } = req.body;
    if (typeof isSuspended !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isSuspended boolean is required' });
    }
    if (isSuspended && (!reason || !String(reason).trim())) {
      return res.status(400).json({ success: false, message: 'Suspension reason is mandatory' });
    }

    const customer = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const before = { isSuspended: customer.isSuspended, suspensionReason: customer.suspensionReason };
    customer.isSuspended = isSuspended;
    customer.suspensionReason = isSuspended ? String(reason).trim() : '';
    customer.suspendedAt = isSuspended ? new Date() : null;
    customer.suspendedBy = isSuspended ? req.user._id : null;
    await customer.save();

    await logAdminAction({
      actor: req.user,
      action: isSuspended ? 'customer_suspended' : 'customer_reactivated',
      targetEntityType: 'customer',
      targetEntityId: customer._id,
      beforeState: before,
      afterState: { isSuspended: customer.isSuspended, suspensionReason: customer.suspensionReason },
      reason: reason || (isSuspended ? 'Customer suspended' : 'Customer reactivated'),
      req,
    });

    res.json({ success: true, data: customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update customer status' });
  }
});

// Suspend / Reactivate Partner
router.put('/partners/:id/suspension', protect, authorizeAdmin('manage_partners'), async (req, res) => {
  try {
    const { isSuspended, reason } = req.body;
    if (typeof isSuspended !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isSuspended boolean is required' });
    }
    if (isSuspended && (!reason || !String(reason).trim())) {
      return res.status(400).json({ success: false, message: 'Suspension reason is mandatory' });
    }

    const partner = await User.findOne({ _id: req.params.id, role: 'partner' });
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    const before = { isSuspended: partner.isSuspended, suspensionReason: partner.suspensionReason };
    partner.isSuspended = isSuspended;
    partner.suspensionReason = isSuspended ? String(reason).trim() : '';
    partner.suspendedAt = isSuspended ? new Date() : null;
    partner.suspendedBy = isSuspended ? req.user._id : null;
    await partner.save();

    await logAdminAction({
      actor: req.user,
      action: isSuspended ? 'partner_suspended' : 'partner_reactivated',
      targetEntityType: 'partner',
      targetEntityId: partner._id,
      beforeState: before,
      afterState: { isSuspended: partner.isSuspended, suspensionReason: partner.suspensionReason },
      reason: reason || (isSuspended ? 'Partner suspended' : 'Partner reactivated'),
      req,
    });

    res.json({ success: true, data: partner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update partner suspension' });
  }
});

// Admin Users List
router.get('/admin-users', protect, authorizeAdmin('manage_admins'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('name email adminRole isSuspended suspensionReason createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to list admin users' });
  }
});

// Update Admin User Role
router.put('/admin-users/:id/role', protect, authorizeAdmin('manage_admins'), async (req, res) => {
  try {
    const { adminRole } = req.body;
    const allowedRoles = ['super_admin', 'operations_admin', 'finance_admin', 'support_admin'];
    if (!allowedRoles.includes(adminRole)) {
      return res.status(400).json({ success: false, message: `Invalid adminRole. Must be one of: ${allowedRoles.join(', ')}` });
    }

    const targetAdmin = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!targetAdmin) return res.status(404).json({ success: false, message: 'Admin user not found' });

    // Safeguard: Ensure at least one super_admin remains
    if (targetAdmin.adminRole === 'super_admin' && adminRole !== 'super_admin') {
      const superAdminCount = await User.countDocuments({ role: 'admin', adminRole: 'super_admin' });
      if (superAdminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot demote the sole remaining Super Admin' });
      }
    }

    const before = { adminRole: targetAdmin.adminRole };
    targetAdmin.adminRole = adminRole;
    await targetAdmin.save();

    await logAdminAction({
      actor: req.user,
      action: 'admin_role_updated',
      targetEntityType: 'admin_user',
      targetEntityId: targetAdmin._id,
      beforeState: before,
      afterState: { adminRole: targetAdmin.adminRole },
      reason: `Role updated to ${adminRole}`,
      req,
    });

    res.json({ success: true, data: targetAdmin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update admin role' });
  }
});

// Create Admin User
router.post('/admin-users', protect, authorizeAdmin('manage_admins'), async (req, res) => {
  try {
    const { name, email, password, adminRole = 'operations_admin' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    const newAdmin = await User.create({
      name: String(name).trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'admin',
      adminRole,
      phone: req.body?.phone || '0000000000',
    });

    await logAdminAction({
      actor: req.user,
      action: 'admin_user_created',
      targetEntityType: 'admin_user',
      targetEntityId: newAdmin._id,
      afterState: { name: newAdmin.name, email: newAdmin.email, adminRole: newAdmin.adminRole },
      reason: `Admin user created with role ${adminRole}`,
      req,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        adminRole: newAdmin.adminRole,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create admin user' });
  }
});

// Delete user (admin)
router.delete('/:id', protect, authorizeAdmin('manage_admins'), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role === 'admin' && target.adminRole === 'super_admin') {
      const superAdminCount = await User.countDocuments({ role: 'admin', adminRole: 'super_admin' });
      if (superAdminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the sole remaining Super Admin' });
      }
    }
    await User.findByIdAndDelete(req.params.id);
    await logAdminAction({
      actor: req.user,
      action: 'user_deleted',
      targetEntityType: target.role,
      targetEntityId: target._id,
      beforeState: { name: target.name, email: target.email, role: target.role },
      reason: 'Deleted by admin',
      req,
    });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update partner status (admin)
router.put('/:id/partner-status', protect, authorizeAdmin('manage_partners'), async (req, res) => {
  try {
    const status = String(req.body?.partnerStatus || '').trim().toLowerCase();
    const adminRemarks = typeof req.body?.adminRemarks === 'string' ? req.body.adminRemarks.trim() : undefined;
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected' && status !== 'correction_required') {
      return res.status(400).json({ success: false, message: 'Invalid partnerStatus' });
    }
    const updateDoc = { partnerStatus: status };
    if (typeof adminRemarks !== 'undefined') updateDoc.adminRemarks = adminRemarks;
    const user = await User.findByIdAndUpdate(req.params.id, updateDoc, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAdminAction({
      actor: req.user,
      action: `partner_${status}`,
      targetEntityType: 'partner',
      targetEntityId: user._id,
      afterState: { partnerStatus: user.partnerStatus, adminRemarks: user.adminRemarks },
      reason: adminRemarks || `Partner status changed to ${status}`,
      req,
    });

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
