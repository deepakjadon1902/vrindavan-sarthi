const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { sendEmail } = require('../backend/utils/email');

(async () => {
  console.log('Testing sendEmail with Resend sandbox delivered@resend.dev...');
  try {
    const res = await sendEmail({
      to: 'delivered@resend.dev',
      subject: 'Test delivery diagnostic',
      text: 'Testing Resend connectivity from diagnostic script',
      html: '<p>Testing Resend connectivity from diagnostic script</p>',
      attachments: [{
        filename: 'test.pdf',
        content: Buffer.from('%PDF-1.4 test dummy content'),
        contentType: 'application/pdf',
      }],
    });
    console.log('sendEmail success result:', res);
  } catch (err) {
    console.error('sendEmail failed:', err.message, err.code, err);
  }
})();
