const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const f = process.env.RESEND_FROM || '';
console.log('RESEND_FROM info:', {
  length: f.length,
  hasAngle: f.includes('<'),
  raw: f, // safe because email address like noreply@vrindavansarthi.in is not a secret
});

const smtpUser = process.env.SMTP_USER || '';
console.log('SMTP_USER info:', {
  length: smtpUser.length,
  user: smtpUser,
});
