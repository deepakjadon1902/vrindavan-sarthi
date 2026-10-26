const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../backend/routes/booking.routes.js');
let content = fs.readFileSync(file, 'utf8');

const invoiceRouteMarker = "router.get('/:id/invoice', optionalProtect, async (req, res) => {";
const targetBlock = [
  "router.get('/:id/invoice', optionalProtect, async (req, res) => {",
  "  try {",
  "    res.set('Cache-Control', 'no-store');",
  "    const booking = await Booking.findById(req.params.id).lean();"
].join('\r\n');

const replacementBlock = [
  "router.get('/:id/invoice', optionalProtect, async (req, res) => {",
  "  try {",
  "    res.set('Cache-Control', 'no-store');",
  "    const rawId = String(req.params.id || '').trim();",
  "    if (!rawId) return res.status(400).json({ success: false, message: 'Booking ID is required' });",
  "    const isObjectId = /^[0-9a-fA-F]{24}$/.test(rawId);",
  "    const query = isObjectId ? { $or: [{ _id: rawId }, { bookingId: rawId }] } : { bookingId: rawId };",
  "    const booking = await Booking.findOne(query).lean();"
].join('\r\n');

if (!content.includes(targetBlock)) {
  console.error('Target block not found in booking.routes.js');
  process.exit(1);
}

content = content.replace(targetBlock, replacementBlock);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated router.get("/:id/invoice") in booking.routes.js');
