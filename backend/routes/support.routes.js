const express = require('express');
const crypto = require('crypto');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { protect, authorizeAdmin } = require('../middleware/auth');
const { logAdminAction } = require('../utils/adminAuditLogger');

const router = express.Router();

const generateTicketId = () => {
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TKT-${hex}`;
};

// Customer / Public submission (Authenticated)
router.post('/tickets', protect, async (req, res) => {
  try {
    const { category, priority, subject, description, bookingCode } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }

    let bookingId = null;
    let propertyId = null;
    let propertyName = '';

    if (bookingCode) {
      const b = await Booking.findOne({
        $or: [{ bookingId: bookingCode }, { _id: bookingCode.match(/^[0-9a-fA-F]{24}$/) ? bookingCode : null }],
      }).lean();
      if (b) {
        bookingId = b._id;
        propertyId = b.hotelId;
        propertyName = b.propertyName || '';
      }
    }

    const ticket = await SupportTicket.create({
      ticketId: generateTicketId(),
      userId: req.user._id,
      userName: req.user.name || '',
      userEmail: req.user.email || '',
      userPhone: req.user.phone || '',
      bookingId,
      bookingCode: bookingCode || '',
      propertyId,
      propertyName,
      category: category || 'Other',
      priority: priority || 'Medium',
      status: 'Open',
      subject: String(subject).slice(0, 200),
      description: String(description).slice(0, 2000),
      timeline: [
        {
          action: 'created',
          performedBy: req.user.name || 'User',
          performedByRole: req.user.role || 'user',
          note: 'Ticket created',
          timestamp: new Date(),
        },
      ],
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create support ticket' });
  }
});

// Customer: list my tickets (Customer must NEVER see internal notes)
router.get('/tickets/my', protect, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ userId: req.user._id })
      .select('-internalNotes')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load tickets' });
  }
});

// Customer: get my ticket detail by ID (Customer must NEVER see internal notes)
router.get('/tickets/:id', protect, async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, userId: req.user._id })
      .select('-internalNotes')
      .lean();
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load ticket' });
  }
});

// Admin: list all support tickets with filtering
router.get('/admin/tickets', protect, authorizeAdmin('manage_support'), async (req, res) => {
  try {
    const { status, category, priority, q, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (category && category !== 'all') filter.category = category;
    if (priority && priority !== 'all') filter.priority = priority;

    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { ticketId: re },
        { subject: re },
        { userName: re },
        { userEmail: re },
        { bookingCode: re },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      SupportTicket.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.max(1, Math.ceil(total / parseInt(limit, 10))),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load support tickets' });
  }
});

// Admin: get ticket detail
router.get('/admin/tickets/:id', protect, authorizeAdmin('manage_support'), async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('assignedAdminId', 'name email adminRole')
      .lean();

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load ticket' });
  }
});

// Admin: update ticket status / priority / assignment / resolution
router.put('/admin/tickets/:id', protect, authorizeAdmin('manage_support'), async (req, res) => {
  try {
    const { status, priority, assignedAdminId, resolutionNotes } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const beforeState = {
      status: ticket.status,
      priority: ticket.priority,
      assignedAdminId: ticket.assignedAdminId,
      resolutionNotes: ticket.resolutionNotes,
    };

    if (status && ticket.status !== status) {
      ticket.timeline.push({
        action: `status_changed_to_${status.toLowerCase()}`,
        performedBy: req.user.name || 'Admin',
        performedByRole: req.user.adminRole || 'admin',
        note: `Status changed from ${ticket.status} to ${status}`,
        timestamp: new Date(),
      });
      ticket.status = status;
      if (status === 'Resolved') ticket.resolvedAt = new Date();
      if (status === 'Closed') ticket.closedAt = new Date();
    }

    if (priority && ticket.priority !== priority) {
      ticket.timeline.push({
        action: 'priority_updated',
        performedBy: req.user.name || 'Admin',
        performedByRole: req.user.adminRole || 'admin',
        note: `Priority updated to ${priority}`,
        timestamp: new Date(),
      });
      ticket.priority = priority;
    }

    if (assignedAdminId && String(ticket.assignedAdminId) !== String(assignedAdminId)) {
      const adminUser = await User.findById(assignedAdminId).select('name email').lean();
      if (adminUser) {
        ticket.assignedAdminId = adminUser._id;
        ticket.assignedAdminName = adminUser.name || adminUser.email;
        ticket.timeline.push({
          action: 'assigned',
          performedBy: req.user.name || 'Admin',
          performedByRole: req.user.adminRole || 'admin',
          note: `Assigned to ${ticket.assignedAdminName}`,
          timestamp: new Date(),
        });
      }
    }

    if (resolutionNotes) {
      ticket.resolutionNotes = String(resolutionNotes).slice(0, 2000);
    }

    await ticket.save();

    await logAdminAction({
      actor: req.user,
      action: 'support_ticket_updated',
      targetEntityType: 'support_ticket',
      targetEntityId: ticket._id,
      beforeState,
      afterState: {
        status: ticket.status,
        priority: ticket.priority,
        assignedAdminId: ticket.assignedAdminId,
        resolutionNotes: ticket.resolutionNotes,
      },
      reason: resolutionNotes || `Updated to ${ticket.status}`,
      req,
    });

    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update support ticket' });
  }
});

// Admin: add internal note
router.post('/admin/tickets/:id/notes', protect, authorizeAdmin('manage_support'), async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || !String(note).trim()) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.internalNotes.push({
      note: String(note).trim(),
      authorId: req.user._id,
      authorName: req.user.name || req.user.email,
      createdAt: new Date(),
    });

    await ticket.save();

    res.json({ success: true, data: ticket.internalNotes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add internal note' });
  }
});

module.exports = router;
