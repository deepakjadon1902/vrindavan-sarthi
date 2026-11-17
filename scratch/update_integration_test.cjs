const fs = require('fs');
let code = fs.readFileSync('backend/tests/verify_all_email_flows_integration.js', 'utf8');
code = code.replace(/customerFullName:/g, "userId: new mongoose.Types.ObjectId(), itemId: 'mock_item_1', customerFullName:");
fs.writeFileSync('backend/tests/verify_all_email_flows_integration.js', code, 'utf8');
console.log('Updated verify_all_email_flows_integration.js');
