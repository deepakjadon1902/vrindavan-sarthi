const fs = require('fs');
const path = require('path');

function test2PagePdf() {
  const width = 595.28;
  const height = 841.89;

  // Page 1 stream
  const p1Ops = [
    '0.1 0.4 0.2 rg',
    'BT /F2 20 Tf 50 780 Td (Page 1: Vrindavan Sarthi Booking Voucher) Tj ET',
    '0.2 0.2 0.2 rg',
    'BT /F1 12 Tf 50 750 Td (This is the primary booking confirmation voucher.) Tj ET',
  ];
  const p1Stream = p1Ops.join('\n');

  // Page 2 stream
  const p2Ops = [
    '0.6 0.1 0.1 rg',
    'BT /F2 20 Tf 50 780 Td (Page 2: Guest Guidelines and Policies) Tj ET',
    '0.2 0.2 0.2 rg',
    'BT /F1 12 Tf 50 750 Td (This is the second page with all verified terms and policies.) Tj ET',
  ];
  const p2Stream = p2Ops.join('\n');

  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>'); // 1
  objects.push('<< /Type /Pages /Kids [5 0 R 6 0 R] /Count 2 >>'); // 2
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); // 3
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'); // 4
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 7 0 R >>`); // 5 (Page 1)
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 8 0 R >>`); // 6 (Page 2)
  objects.push(`<< /Length ${Buffer.byteLength(p1Stream, 'utf8')} >>\nstream\n${p1Stream}\nendstream`); // 7 (Content 1)
  objects.push(`<< /Length ${Buffer.byteLength(p2Stream, 'utf8')} >>\nstream\n${p2Stream}\nendstream`); // 8 (Content 2)

  const chunks = [Buffer.from('%PDF-1.4\n', 'utf8')];
  const byteLength = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(byteLength());
    chunks.push(Buffer.from(`${i + 1} 0 obj\n${obj}\nendobj\n`, 'utf8'));
  });
  const xrefStart = byteLength();
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, 'utf8'));
  for (let i = 1; i < offsets.length; i += 1) {
    const off = String(offsets[i]).padStart(10, '0');
    chunks.push(Buffer.from(`${off} 00000 n \n`, 'utf8'));
  }
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, 'utf8'));
  const buf = Buffer.concat(chunks);
  fs.writeFileSync('scratch/test_2page.pdf', buf);
  console.log('Successfully wrote scratch/test_2page.pdf! Size:', buf.length);
}

test2PagePdf();
