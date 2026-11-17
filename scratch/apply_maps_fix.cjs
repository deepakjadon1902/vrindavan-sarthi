const fs = require('fs');
const path = 'frontend/src/lib/maps.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `export const getGoogleMapNavigationUrl = (input: MapInput) => {
  const query = buildMapQuery(input);
  if (!query) return '';
  return \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(query)}\`;
};`;

const replacement = `export const getGoogleMapNavigationUrl = (input: MapInput) => {
  const query = buildMapQuery(input);
  if (!query) return '';
  return \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(query)}\`;
};

export const resolvePropertyDirectionsUrl = (input: MapInput): string | null => {
  const raw = String(input.mapValue || '').trim();
  if (/^https?:\\/\\//i.test(raw)) {
    return raw;
  }
  const name = String(input.name || '').trim();
  const location = String(input.location || '').trim();
  if (!name && !location) {
    return null;
  }
  const parts = [name, location, input.nearestTemple ? \`Near \${input.nearestTemple}\` : '', 'Vrindavan'].filter(Boolean);
  return \`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(parts.join(', '))}\`;
};`;

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
console.log('Successfully updated maps.ts');
