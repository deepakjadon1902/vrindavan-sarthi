const fs = require('fs');
const path = require('path');

const COMPANY_NAME = 'Vrindavan Sarthi';
const COMPANY_ADDRESS = 'Raja Wala Mandir, In front of Giriraj Ji Maharaj, Govardhan, Mathura, Uttar Pradesh 281502';
const COMPANY_PHONE = '8679820256';
const COMPANY_EMAIL = 'vrindavansarthi108@gmail.com';

const PAGE = { width: 612, height: 792, margin: 34 };
const COLORS = {
  ink: [31, 41, 55],
  muted: [107, 114, 128],
  border: [226, 232, 240],
  soft: [248, 250, 252],
  cream: [255, 248, 231],
  gold: [202, 148, 26],
  crimson: [139, 26, 26],
  green: [22, 101, 52],
  white: [255, 255, 255],
};

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const isFilled = (value) => value !== undefined && value !== null && clean(value) !== '';
const money = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;
const normalizeInvoiceText = (value) =>
  clean(value)
    .replace(/VrindavanSarthi/gi, 'Vrindavan Sarthi')
    .replace(/\bTotalINR\b/gi, 'Total INR')
    .replace(/\bTotal\s+INR\b/gi, 'Total INR');
const todayText = () => new Date().toLocaleDateString('en-IN');
const logoPath = path.resolve(__dirname, '../../frontend/public/vrindasarthi logo.jpeg');

const getJpegSize = (buffer) => {
  if (!buffer || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
};

const loadLogo = () => {
  try {
    const data = fs.readFileSync(logoPath);
    const size = getJpegSize(data);
    if (!size) return null;
    return { data, ...size };
  } catch {
    return null;
  }
};

const escapePdfText = (value) =>
  normalizeInvoiceText(value)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const rgb = ([r, g, b]) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;

const textWidth = (text, fontSize = 10) => clean(text).length * fontSize * 0.48;

const wrapText = (value, maxWidth, fontSize = 10) => {
  const words = clean(value).split(' ').filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (textWidth(next, fontSize) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

class PdfCanvas {
  constructor(documentLabel = 'TAX INVOICE') {
    this.documentLabel = clean(documentLabel) || 'TAX INVOICE';
    this.pages = [];
    this.ops = [];
    this.y = PAGE.height - PAGE.margin;
    this.pageNo = 0;
    this.newPage();
  }

  newPage() {
    if (this.ops.length) this.pages.push(this.ops.join('\n'));
    this.ops = [];
    this.pageNo += 1;
    this.y = PAGE.height - PAGE.margin;
    this.header();
  }

  finish() {
    this.footer();
    this.pages.push(this.ops.join('\n'));
    return this.pages;
  }

  ensure(height) {
    if (this.y - height < PAGE.margin + 34) {
      this.footer();
      this.newPage();
    }
  }

  rect(x, y, width, height, color = COLORS.white, stroke = null) {
    this.ops.push(`${rgb(color)} rg`);
    if (stroke) this.ops.push(`${rgb(stroke)} RG`);
    this.ops.push(`${x} ${y} ${width} ${height} re ${stroke ? 'B' : 'f'}`);
  }

  line(x1, y1, x2, y2, color = COLORS.border, width = 1) {
    this.ops.push(`${rgb(color)} RG`);
    this.ops.push(`${width} w`);
    this.ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }

  image(name, x, y, width, height) {
    this.ops.push('q');
    this.ops.push(`${width} 0 0 ${height} ${x} ${y} cm`);
    this.ops.push(`/${name} Do`);
    this.ops.push('Q');
  }

  text(value, x, y, { size = 10, font = 'F1', color = COLORS.ink } = {}) {
    this.ops.push(`${rgb(color)} rg`);
    this.ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  }

  centeredText(value, y, { size = 10, font = 'F1', color = COLORS.ink } = {}) {
    const text = normalizeInvoiceText(value);
    const x = (PAGE.width - textWidth(text, size)) / 2;
    this.text(text, Math.max(PAGE.margin, x), y, { size, font, color });
  }

  wrapped(value, x, y, width, { size = 10, font = 'F1', color = COLORS.ink, lineHeight = 13 } = {}) {
    const lines = wrapText(value, width, size);
    lines.forEach((line, index) => this.text(line, x, y - index * lineHeight, { size, font, color }));
    return lines.length * lineHeight;
  }

  header() {
    this.rect(0, PAGE.height - 78, PAGE.width, 78, COLORS.cream);
    this.rect(0, PAGE.height - 78, 8, 78, COLORS.gold);
    this.rect(24, 724, 42, 42, COLORS.white, COLORS.gold);
    if (PdfCanvas.hasLogo) {
      this.image('Logo', 27, 727, 36, 36);
    } else {
      this.text('VS', 38, 742, { size: 12, font: 'F2', color: COLORS.crimson });
    }
    this.text(COMPANY_NAME, 82, 750, { size: 17, font: 'F2', color: COLORS.crimson });
    this.wrapped(COMPANY_ADDRESS, 84, 733, 370, { size: 7.8, color: COLORS.muted, lineHeight: 9 });
    this.text(`Phone: ${COMPANY_PHONE} | Email: ${COMPANY_EMAIL}`, 84, 710, { size: 7.8, color: COLORS.muted });
    this.text(`Generated: ${todayText()}`, 482, 750, { size: 8, color: COLORS.muted });
    this.y = 676;
  }

  footer() {
    this.line(PAGE.margin, 42, PAGE.width - PAGE.margin, 42, COLORS.border, 0.6);
    this.text(`For any inquiry or support, contact ${COMPANY_PHONE} or ${COMPANY_EMAIL}.`, PAGE.margin, 30, { size: 8, color: COLORS.muted });
    this.text('This is a system-generated document. Please keep it for booking, payment, and support records.', PAGE.margin, 18, { size: 8, color: COLORS.muted });
    this.text(`Page ${this.pageNo}`, PAGE.width - PAGE.margin - 36, 26, { size: 8, color: COLORS.muted });
  }

  title(title, subtitle = '') {
    this.ensure(54);
    this.text(title, PAGE.margin, this.y, { size: 18, font: 'F2', color: COLORS.ink });
    if (subtitle) this.text(subtitle, PAGE.margin, this.y - 17, { size: 9, color: COLORS.muted });
    this.y -= subtitle ? 34 : 24;
  }

  section(title, rows = []) {
    const filtered = rows.filter(([, value]) => isFilled(value));
    if (!filtered.length) return;
    this.ensure(38);
    this.text(title.toUpperCase(), PAGE.margin, this.y, { size: 9, font: 'F2', color: COLORS.crimson });
    this.y -= 12;
    const labelWidth = 154;
    const valueWidth = PAGE.width - PAGE.margin * 2 - labelWidth;
    filtered.forEach(([label, value]) => {
      const valueLines = wrapText(value, valueWidth - 20, 9.5);
      const rowHeight = Math.max(26, valueLines.length * 12 + 12);
      this.ensure(rowHeight + 4);
      const top = this.y;
      this.rect(PAGE.margin, top - rowHeight, labelWidth, rowHeight, COLORS.soft, COLORS.border);
      this.rect(PAGE.margin + labelWidth, top - rowHeight, valueWidth, rowHeight, COLORS.white, COLORS.border);
      this.wrapped(label, PAGE.margin + 10, top - 15, labelWidth - 18, { size: 8.8, font: 'F2', color: COLORS.muted, lineHeight: 10 });
      this.wrapped(value, PAGE.margin + labelWidth + 10, top - 15, valueWidth - 20, { size: 9.5, color: COLORS.ink, lineHeight: 12 });
      this.y -= rowHeight;
    });
    this.y -= 16;
  }

  summary(title, rows = [], totalLabel = 'Grand Total', totalAmount = 0) {
    const filtered = rows.filter(([, value]) => isFilled(value));
    const width = 250;
    const x = PAGE.width - PAGE.margin - width;
    const height = this.summaryBox(title, filtered, totalLabel, totalAmount, x, this.y, width);
    this.y -= height + 18;
  }

  summaryBox(title, rows = [], totalLabel = 'Grand Total', totalAmount = 0, x = PAGE.margin, y = this.y, width = 250) {
    const filtered = rows.filter(([, value]) => isFilled(value));
    const rowHeight = 22;
    const height = 44 + filtered.length * rowHeight + 34;
    this.rect(x, y - height, width, height, COLORS.cream, COLORS.border);
    this.text(title.toUpperCase(), x + 14, y - 20, { size: 9, font: 'F2', color: COLORS.crimson });
    let cursor = y - 42;
    filtered.forEach(([label, value]) => {
      this.text(label, x + 14, cursor, { size: 9, color: COLORS.muted });
      const val = clean(value);
      this.text(val, x + width - 14 - Math.min(120, textWidth(val, 9)), cursor, { size: 9, font: 'F2', color: COLORS.ink });
      cursor -= rowHeight;
    });
    this.line(x + 14, cursor + 6, x + width - 14, cursor + 6, COLORS.border, 0.8);
    const label = normalizeInvoiceText(totalLabel).replace(/^(Grand\s+)?Total(\s+Payable)?$/i, 'Total INR');
    this.text(label, x + 14, cursor - 10, { size: 11, font: 'F2', color: COLORS.ink });
    const total = Number(totalAmount || 0).toLocaleString('en-IN');
    this.text(total, x + width - 14 - Math.min(130, textWidth(total, 12)), cursor - 10, { size: 12, font: 'F2', color: COLORS.crimson });
    return height;
  }

  note(text) {
    if (!isFilled(text)) return;
    this.ensure(54);
    const lineHeight = 12;
    const height = wrapText(text, PAGE.width - PAGE.margin * 2 - 28, 9).length * lineHeight + 24;
    this.rect(PAGE.margin, this.y - height + 8, PAGE.width - PAGE.margin * 2, height, COLORS.soft, COLORS.border);
    this.wrapped(text, PAGE.margin + 14, this.y - 18, PAGE.width - PAGE.margin * 2 - 28, { size: 9, color: COLORS.muted, lineHeight });
    this.y -= height + 12;
  }

  compactSection(title, rows = [], x = PAGE.margin, width = PAGE.width - PAGE.margin * 2) {
    const filtered = rows.filter(([, value]) => isFilled(value));
    if (!filtered.length) return;
    const rowHeight = 15;
    const height = 24 + filtered.length * rowHeight;
    this.ensure(height + 8);
    this.rect(x, this.y - height, width, height, COLORS.white, COLORS.border);
    this.text(title.toUpperCase(), x + 10, this.y - 15, { size: 8, font: 'F2', color: COLORS.crimson });
    let cursor = this.y - 31;
    filtered.forEach(([label, value]) => {
      this.text(label, x + 10, cursor, { size: 8, color: COLORS.muted });
      const lines = wrapText(value, width - 118, 8.2);
      this.wrapped(lines.join(' '), x + 114, cursor, width - 124, { size: 8.2, color: COLORS.ink, lineHeight: 9 });
      cursor -= rowHeight;
    });
    this.y -= height + 8;
  }
}

PdfCanvas.hasLogo = false;

const splitRows = (rows = []) => {
  const result = {
    invoice: [],
    customer: [],
    service: [],
    fulfilment: [],
    payment: [],
    notes: [],
  };
  const customerKeys = ['Customer', 'Mobile', 'Email'];
  const paymentKeys = ['Base Amount', 'Room Amount', 'Hotel GST / Hotel Taxes', 'GST', 'Convenience Fee', 'Platform Convenience Fee', 'Advance Paid', 'Advance Paid Online', 'Balance Payable', 'Balance Payable at Property', 'Payment Option', 'Payment Method', 'Payment Status', 'UPI Transaction ID', 'Unit Price', 'Quantity', 'Grand Total', 'Total Payable'];
  const fulfilmentKeys = ['Check-in / Travel Date', 'Check-out', 'Pickup Time', 'Route', 'Shipping Address', 'Courier', 'AWB Number', 'Tracking ID', 'Order Status', 'Booking Status', 'Verification Stage', 'Shipped At', 'Delivered At'];
  const invoiceKeys = ['Booking ID', 'Order ID', 'Invoice ID', 'Created On', 'Issued On'];

  rows.forEach(([label, value]) => {
    if (!isFilled(value)) return;
    if (invoiceKeys.includes(label)) result.invoice.push([label, value]);
    else if (customerKeys.includes(label)) result.customer.push([label, value]);
    else if (paymentKeys.includes(label)) result.payment.push([label, value]);
    else if (fulfilmentKeys.includes(label)) result.fulfilment.push([label, value]);
    else if (/notes?|info|reason/i.test(label)) result.notes.push([label, value]);
    else result.service.push([label, value]);
  });
  return result;
};

const buildPdf = ({ title = `${COMPANY_NAME} Invoice`, documentLabel, lines = [], sections = [], totalLabel = 'Grand Total', totalAmount = 0 } = {}) => {
  const logo = loadLogo();
  PdfCanvas.hasLogo = Boolean(logo);
  const canvas = new PdfCanvas(documentLabel || title);
  const allRows = (Array.isArray(sections) ? sections : []).flatMap((section) => Array.isArray(section?.rows) ? section.rows : []);
  const grouped = splitRows(allRows);
  const invoiceId = grouped.invoice.find(([label]) => /^(Booking|Order|Invoice) ID$/.test(label))?.[1] || title.replace(/^Invoice\s*/i, '');

  canvas.title(title, invoiceId ? `Reference: ${invoiceId}` : 'Booking and payment document');
  const topY = canvas.y + 8;
  const summaryWidth = 250;
  const gutter = 18;
  const leftWidth = PAGE.width - PAGE.margin * 2 - summaryWidth - gutter;
  const summaryX = PAGE.width - PAGE.margin - summaryWidth;
  const summaryHeight = canvas.summaryBox('Payment Summary', grouped.payment, totalLabel, totalAmount, summaryX, topY, summaryWidth);
  canvas.y = topY;
  canvas.compactSection('Invoice Information', grouped.invoice, PAGE.margin, leftWidth);
  canvas.compactSection('Customer Details', grouped.customer, PAGE.margin, leftWidth);
  canvas.compactSection('Service / Item Details', grouped.service, PAGE.margin, leftWidth);
  canvas.compactSection('Travel / Delivery Details', grouped.fulfilment, PAGE.margin, leftWidth);
  canvas.y = Math.min(canvas.y, topY - summaryHeight) - 12;

  if (grouped.notes.length) {
    canvas.compactSection('Additional Notes', grouped.notes);
  }
  lines.filter(isFilled).forEach((line) => canvas.note(line));
  canvas.note(`Support: ${COMPANY_PHONE} | ${COMPANY_EMAIL}. Share the invoice reference number for faster help.`);

  const pageStreams = canvas.finish();
  const objects = [];
  const pageObjectNumbers = [];
  const fontRegularObjectNo = 3;
  const fontBoldObjectNo = 4;
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(null);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  let logoObjectNo = null;
  if (logo) {
    logoObjectNo = objects.length + 1;
    objects.push({
      binary: true,
      data: logo.data,
      header: `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>`,
    });
  }

  pageStreams.forEach((stream) => {
    const pageNo = objects.length + 1;
    const contentNo = pageNo + 1;
    pageObjectNumbers.push(pageNo);
    const xObjects = logoObjectNo ? `/XObject << /Logo ${logoObjectNo} 0 R >> ` : '';
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${fontRegularObjectNo} 0 R /F2 ${fontBoldObjectNo} 0 R >> ${xObjects}>> /Contents ${contentNo} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  const chunks = [Buffer.from('%PDF-1.4\n', 'utf8')];
  const byteLength = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(byteLength());
    chunks.push(Buffer.from(`${i + 1} 0 obj\n`, 'utf8'));
    if (obj && typeof obj === 'object' && obj.binary) {
      chunks.push(Buffer.from(`${obj.header}\nstream\n`, 'utf8'));
      chunks.push(obj.data);
      chunks.push(Buffer.from('\nendstream\n', 'utf8'));
    } else {
      chunks.push(Buffer.from(String(obj), 'utf8'));
      chunks.push(Buffer.from('\n', 'utf8'));
    }
    chunks.push(Buffer.from('endobj\n', 'utf8'));
  });
  const xrefStart = byteLength();
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, 'utf8'));
  for (let i = 1; i < offsets.length; i += 1) {
    chunks.push(Buffer.from(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`, 'utf8'));
  }
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, 'utf8'));
  return Buffer.concat(chunks);
};

module.exports = { buildPdf };
