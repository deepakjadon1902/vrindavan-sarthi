const fs = require('fs');
let cm = fs.readFileSync('backend/utils/customerMessages.js', 'utf8');

const oldLogoNorm = `const logoUrl = () => {
  const base = clean(process.env.FRONTEND_BASE_URL || process.env.PUBLIC_SITE_URL);
  if (!base) return '';
  try {
    return new URL('/vrindasarthi%20logo.jpeg', base).toString();
  } catch {
    return '';
  }
};`.replace(/\n/g, '\r\n');

const newLogoNorm = `const logoUrl = () => {
  // Reliable, publicly accessible production asset URL (HTTPS verified)
  return 'https://www.vrindavansarthi.in/vrindavan_sarthi_official_logo.jpg';
};`.replace(/\n/g, '\r\n');

if (cm.includes(oldLogoNorm)) {
  cm = cm.replace(oldLogoNorm, newLogoNorm);
  console.log('Successfully updated logoUrl in customerMessages.js (CRLF)');
} else {
  // try LF
  const oldLogoLF = oldLogoNorm.replace(/\r\n/g, '\n');
  const newLogoLF = newLogoNorm.replace(/\r\n/g, '\n');
  if (cm.includes(oldLogoLF)) {
    cm = cm.replace(oldLogoLF, newLogoLF);
    console.log('Successfully updated logoUrl in customerMessages.js (LF)');
  } else {
    console.log('logoUrl target still not found');
  }
}

const oldTableNorm = `const tableHtml = (rows) => \`
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:14px">
    \${rows
      .filter(([, value]) => value !== undefined && value !== null && clean(value) !== '')
      .map(([label, value]) => \`
        <tr>
          <td style="padding:10px 12px;border:1px solid #eadfc7;background:#fff8ea;color:#6f4b12;font:600 13px Arial,sans-serif;width:38%">\${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border:1px solid #eadfc7;color:#2b2018;font:13px Arial,sans-serif">\${escapeHtml(value)}</td>
        </tr>
      \`)
      .join('')}
  </table>
\`;`.replace(/\n/g, '\r\n');

const newTableNorm = `const tableHtml = (rows) => \`
  <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin-top:14px;table-layout:fixed">
    \${rows
      .filter(([, value]) => value !== undefined && value !== null && clean(value) !== '')
      .map(([label, value]) => \`
        <tr>
          <td style="padding:10px 12px;border:1px solid #eadfc7;background:#fff8ea;color:#6f4b12;font:600 13px Arial,sans-serif;width:36%;vertical-align:top;word-wrap:break-word">\${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border:1px solid #eadfc7;color:#2b2018;font:13px Arial,sans-serif;width:64%;vertical-align:top;word-wrap:break-word;word-break:break-word;overflow-wrap:break-word">\${escapeHtml(value)}</td>
        </tr>
      \`)
      .join('')}
  </table>
\`;`.replace(/\n/g, '\r\n');

if (cm.includes(oldTableNorm)) {
  cm = cm.replace(oldTableNorm, newTableNorm);
  console.log('Successfully updated tableHtml (CRLF)');
} else {
  const oldTableLF = oldTableNorm.replace(/\r\n/g, '\n');
  const newTableLF = newTableNorm.replace(/\r\n/g, '\n');
  if (cm.includes(oldTableLF)) {
    cm = cm.replace(oldTableLF, newTableLF);
    console.log('Successfully updated tableHtml (LF)');
  }
}

fs.writeFileSync('backend/utils/customerMessages.js', cm, 'utf8');
