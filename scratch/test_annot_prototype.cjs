const fs = require('fs');

function testPdfAnnotations() {
  const PAGE = { width: 595.28, height: 841.89, margin: 32 };
  const stream = `BT /F2 14 Tf 40 800 Td (Vrindavan Sarthi) Tj ET
BT /F1 10 Tf 40 780 Td (Click here to Open in Google Maps) Tj ET
0.114 0.306 0.847 RG 1 w 40 778 m 220 778 l S`;

  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(null);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const annots = [
    `<< /Type /Annot /Subtype /Link /Rect [40 776 220 792] /Border [0 0 0] /A << /S /URI /URI (https://maps.app.goo.gl/xU2hPPUnLcnnVMyk6) >> >>`
  ];

  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Annots [ ${annots.join(' ')} ] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`);
  objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);

  objects[1] = '<< /Type /Pages /Kids [5 0 R] /Count 1 >>';

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
    chunks.push(Buffer.from(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`, 'utf8'));
  }
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, 'utf8'));
  
  const buf = Buffer.concat(chunks);
  fs.writeFileSync('scratch/test_annot.pdf', buf);
  console.log('Generated test_annot.pdf successfully, size:', buf.length);
}

testPdfAnnotations();
