const fs = require('fs');
const path = 'frontend/src/store/bookingStore.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `  partnerWhatsapp?: string;`;

const replacement = `  partnerWhatsapp?: string;
  propertyName?: string;
  propertyLocation?: string;
  propertyAddress?: string;
  googleMapLink?: string;
  nearestTemple?: string;`;

const normalize = (s) => s.replace(/\r\n/g, '\n');
const nContent = normalize(content);
const nTarget = normalize(target);
const nReplacement = normalize(replacement);

if (!nContent.includes(nTarget)) {
  console.error('Target not found in content!');
  process.exit(1);
}

const isCRLF = content.includes('\r\n');
const updatedNorm = nContent.replace(nTarget, nReplacement);
const finalContent = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;

fs.writeFileSync(path, finalContent, 'utf8');
console.log('Successfully updated bookingStore.ts');
