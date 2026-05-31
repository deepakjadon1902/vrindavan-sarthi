const express = require('express');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/email');

const router = express.Router();

const normalize = (value) => String(value || '').trim();
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalize(value));

const getContactRecipient = async () => {
  const envTo = normalize(process.env.CONTACT_TO_EMAIL || process.env.ADMIN_EMAIL);
  if (isEmail(envTo)) return envTo;

  const settings = await Settings.findOne().select('adminEmail').lean();
  const adminEmail = normalize(settings?.adminEmail);
  if (isEmail(adminEmail)) return adminEmail;

  return '';
};

router.post('/', async (req, res) => {
  try {
    const name = normalize(req.body?.name);
    const email = normalize(req.body?.email).toLowerCase();
    const phone = normalize(req.body?.phone);
    const subject = normalize(req.body?.subject);
    const message = normalize(req.body?.message);

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, subject and message are required' });
    }
    if (!isEmail(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    if (message.length > 5000) return res.status(400).json({ success: false, message: 'Message is too long' });

    const to = await getContactRecipient();
    if (!to) {
      return res.status(500).json({ success: false, message: 'Contact email is not configured' });
    }

    const lines = [
      'New Vrindavan Sarthi contact message',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : '',
      `Subject: ${subject}`,
      '',
      message,
    ].filter(Boolean);

    await sendEmail({
      to,
      replyTo: email,
      subject: `Contact: ${subject}`,
      text: lines.join('\n'),
    });

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    const code = err?.code === 'RESEND_SEND_FAILED' ? 502 : 500;
    res.status(code).json({ success: false, message: err.message || 'Message could not be sent' });
  }
});

module.exports = router;
