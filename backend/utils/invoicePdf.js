const COMPANY_NAME = 'Vrindavan Sarthi Enterprises';
const COMPANY_ADDRESS = 'Raja wala mandir, Infront of Giriraj ji Maharaj, Goverdhan, Mathura, Uttar Pradesh 281502';
const COMPANY_PHONE = '+91 8218303066';
const COMPANY_EMAIL = 'vrindavansarthi108@gmail.com';

const PAGE = { width: 612, height: 792, margin: 42 };
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
const todayText = () => new Date().toLocaleDateString('en-IN');

const escapePdfText = (value) =>
  clean(value)
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

  text(value, x, y, { size = 10, font = 'F1', color = COLORS.ink } = {}) {
    this.ops.push(`${rgb(color)} rg`);
    this.ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  }

  wrapped(value, x, y, width, { size = 10, font = 'F1', color = COLORS.ink, lineHeight = 13 } = {}) {
    const lines = wrapText(value, width, size);
    lines.forEach((line, index) => this.text(line, x, y - index * lineHeight, { size, font, color }));
    return lines.length * lineHeight;
  }

  header() {
    this.rect(0, PAGE.height - 96, PAGE.width, 96, COLORS.cream);
    this.rect(0, PAGE.height - 96, 8, 96, COLORS.gold);
    this.text(COMPANY_NAME, PAGE.margin, 736, { size: 20, font: 'F2', color: COLORS.crimson });
    this.wrapped(COMPANY_ADDRESS, PAGE.margin, 718, 330, { size: 8.5, color: COLORS.muted, lineHeight: 10 });
    this.text(`Phone: ${COMPANY_PHONE}`, PAGE.margin, 694, { size: 8.5, color: COLORS.muted });
    this.text(`Email: ${COMPANY_EMAIL}`, PAGE.margin, 682, { size: 8.5, color: COLORS.muted });
    this.wrapped(this.documentLabel, 408, 730, 160, { size: 15, font: 'F2', color: COLORS.ink, lineHeight: 17 });
    this.text(`Generated: ${todayText()}`, 462, 712, { size: 8.5, color: COLORS.muted });
    this.y = 656;
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
    this.y -= subtitle ? 42 : 30;
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
    const rowHeight = 22;
    const height = 44 + filtered.length * rowHeight + 34;
    this.ensure(height);
    this.rect(x, this.y - height, width, height, COLORS.cream, COLORS.border);
    this.text(title.toUpperCase(), x + 14, this.y - 20, { size: 9, font: 'F2', color: COLORS.crimson });
    let cursor = this.y - 42;
    filtered.forEach(([label, value]) => {
      this.text(label, x + 14, cursor, { size: 9, color: COLORS.muted });
      const val = clean(value);
      this.text(val, x + width - 14 - Math.min(120, textWidth(val, 9)), cursor, { size: 9, font: 'F2', color: COLORS.ink });
      cursor -= rowHeight;
    });
    this.line(x + 14, cursor + 6, x + width - 14, cursor + 6, COLORS.border, 0.8);
    this.text(totalLabel, x + 14, cursor - 10, { size: 11, font: 'F2', color: COLORS.ink });
    const total = money(totalAmount);
    this.text(total, x + width - 14 - Math.min(130, textWidth(total, 12)), cursor - 10, { size: 12, font: 'F2', color: COLORS.crimson });
    this.y -= height + 18;
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
}

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
  const canvas = new PdfCanvas(documentLabel || title);
  const allRows = (Array.isArray(sections) ? sections : []).flatMap((section) => Array.isArray(section?.rows) ? section.rows : []);
  const grouped = splitRows(allRows);
  const invoiceId = grouped.invoice.find(([label]) => /^(Booking|Order|Invoice) ID$/.test(label))?.[1] || title.replace(/^Invoice\s*/i, '');

  canvas.title(title, invoiceId ? `Reference: ${invoiceId}` : 'Booking and payment document');
  canvas.summary('Payment Summary', grouped.payment, totalLabel, totalAmount);
  canvas.section('Invoice Information', grouped.invoice);
  canvas.section('Customer Details', grouped.customer);
  canvas.section('Service / Item Details', grouped.service);
  canvas.section('Travel / Delivery Details', grouped.fulfilment);
  canvas.section('Payment Details', grouped.payment);

  if (grouped.notes.length) {
    canvas.section('Additional Notes', grouped.notes);
  }
  lines.filter(isFilled).forEach((line) => canvas.note(line));
  canvas.note(`For any inquiry, booking help, payment issue, order support, or cancellation assistance, contact Vrindavan Sarthi Enterprises support at ${COMPANY_PHONE} or ${COMPANY_EMAIL}. Please share the invoice reference number shown above for faster support.`);

  const pageStreams = canvas.finish();
  const objects = [];
  const pageObjectNumbers = [];
  const fontRegularObjectNo = 3;
  const fontBoldObjectNo = 4;
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(null);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  pageStreams.forEach((stream) => {
    const pageNo = objects.length + 1;
    const contentNo = pageNo + 1;
    pageObjectNumbers.push(pageNo);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${fontRegularObjectNo} 0 R /F2 ${fontBoldObjectNo} 0 R >> >> /Contents ${contentNo} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
};

module.exports = { buildPdf };
