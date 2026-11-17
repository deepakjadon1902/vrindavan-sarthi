const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/utils/bookingReceiptPdf.js');
let code = fs.readFileSync(filePath, 'utf8');

// Normalize to \n
code = code.replace(/\r\n/g, '\n');

// Add drawCircularLogo helper method
const helperTarget = `  drawPeacockFeather(x, y, scale = 0.5, angle = 0) {`;
const helperReplacement = `  drawCircularLogo(cx, cy, radius, logoData) {
    const kappa = 0.5522847498;
    const d = radius * kappa;
    if (logoData) {
      this.currentOps.push('q');
      this.currentOps.push(\`\${cx.toFixed(2)} \${(cy + radius).toFixed(2)} m\`);
      this.currentOps.push(\`\${(cx + d).toFixed(2)} \${(cy + radius).toFixed(2)} \${(cx + radius).toFixed(2)} \${(cy + d).toFixed(2)} \${(cx + radius).toFixed(2)} \${cy.toFixed(2)} c\`);
      this.currentOps.push(\`\${(cx + radius).toFixed(2)} \${(cy - d).toFixed(2)} \${(cx + d).toFixed(2)} \${(cy - radius).toFixed(2)} \${cx.toFixed(2)} \${(cy - radius).toFixed(2)} c\`);
      this.currentOps.push(\`\${(cx - d).toFixed(2)} \${(cy - radius).toFixed(2)} \${(cx - radius).toFixed(2)} \${(cy - d).toFixed(2)} \${(cx - radius).toFixed(2)} \${cy.toFixed(2)} c\`);
      this.currentOps.push(\`\${(cx - radius).toFixed(2)} \${(cy + d).toFixed(2)} \${(cx - d).toFixed(2)} \${(cy + radius).toFixed(2)} \${cx.toFixed(2)} \${(cy + radius).toFixed(2)} c\`);
      this.currentOps.push('h W n');
      this.currentOps.push(\`\${(radius * 2).toFixed(2)} 0 0 \${(radius * 2).toFixed(2)} \${(cx - radius).toFixed(2)} \${(cy - radius).toFixed(2)} cm\`);
      this.currentOps.push('/Logo Do');
      this.currentOps.push('Q');
      this.circle(cx, cy, radius, null, COLORS.accentGold, 1);
    } else {
      this.circle(cx, cy, radius, COLORS.primaryGreen, COLORS.accentGold, 1);
      this.text('VS', cx - radius * 0.45, cy - radius * 0.25, { size: radius * 0.65, font: 'F2', color: COLORS.white });
    }
  }

  drawPeacockFeather(x, y, scale = 0.5, angle = 0) {`;

if (code.includes(helperTarget)) {
  code = code.replace(helperTarget, helperReplacement);
  console.log('[SUCCESS] Added drawCircularLogo helper');
} else {
  console.error('[FAIL] Could not find helperTarget');
}

// Update Footer to use drawCircularLogo
const oldFootLogo = `    // Left Block: Circular Logo & Brand Identity
    const footLogoX = this.margin + 16;
    const footLogoY = 84;
    if (logoData) {
      this.currentOps.push('q');
      this.clipCircle(footLogoX, footLogoY, 14);
      this.currentOps.push('/Logo Do');
      this.currentOps.push('Q');
      this.circle(footLogoX, footLogoY, 14, null, COLORS.accentGold, 1);
    } else {
      this.circle(footLogoX, footLogoY, 14, COLORS.primaryGreen, COLORS.accentGold, 1);
      this.text('VS', footLogoX - 6, footLogoY - 4, { size: 9, font: 'F2', color: COLORS.white });
    }`;

const newFootLogo = `    // Left Block: Circular Logo & Brand Identity
    const footLogoX = this.margin + 16;
    const footLogoY = 84;
    this.drawCircularLogo(footLogoX, footLogoY, 14, logoData);`;

if (code.includes(oldFootLogo)) {
  code = code.replace(oldFootLogo, newFootLogo);
  console.log('[SUCCESS] Replaced footLogo with drawCircularLogo');
} else {
  console.error('[FAIL] Could not find oldFootLogo');
}

fs.writeFileSync(filePath, code.replace(/\n/g, '\r\n'), 'utf8');
console.log('Saved bookingReceiptPdf.js with drawCircularLogo');
