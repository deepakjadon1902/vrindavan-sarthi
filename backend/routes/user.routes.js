const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

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

// Delete user (admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
