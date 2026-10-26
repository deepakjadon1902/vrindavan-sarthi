const fs = require('fs');
let code = fs.readFileSync('backend/tests/verify_all_email_flows_integration.js', 'utf8');

// Replace ensureBookingInvoiceNotification calls with testOpts
code = code.replace(/ensureBookingInvoiceNotification\(([^,\)]+)\)/g, 'ensureBookingInvoiceNotification($1, { queueFactory: () => null })');
code = code.replace(/markBookingPaidFromRazorpay\(([^,\)]+), ([^\)]+)\)/g, 'markBookingPaidFromRazorpay($1, { ...$2, queueFactory: () => null })');

fs.writeFileSync('backend/tests/verify_all_email_flows_integration.js', code, 'utf8');
console.log('Successfully updated verify_all_email_flows_integration.js with queueFactory mock');
