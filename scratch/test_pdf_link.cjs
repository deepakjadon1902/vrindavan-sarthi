const fs = require('fs');
const { buildPdf } = require('../backend/utils/invoicePdf');

console.log('Testing PDF generator...');
const mock = {
  bookingId: 'VVS-DR-20261023-191395',
  totalAmount: 1299
};
const res = buildPdf({
  title: 'Test Invoice',
  sections: [{ title: 'Test', rows: [['Key', 'Value']] }]
});
console.log('PDF bytes generated:', res.length);
