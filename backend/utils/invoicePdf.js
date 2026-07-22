const escapePdfText = (value) =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const buildPdf = ({ title = 'Vrindavan Sarthi Invoice', lines = [], sections = [] } = {}) => {
  const sectionLines = (Array.isArray(sections) ? sections : []).flatMap((section) => {
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    return [
      '',
      String(section?.title || ''),
      ...rows.map(([label, value]) => `${label}: ${value}`),
    ].filter(Boolean);
  });
  const safeLines = [title, 'Vrindavan Sarthi', 'Thank you for choosing us.', '', ...lines, ...sectionLines].map(escapePdfText);
  const content = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    ...safeLines.slice(0, 34).map((line, index) => `${index === 0 ? '' : '0 -20 Td'}(${line}) Tj`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];

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
