const fs = require('fs');
const path = 'frontend/src/components/discovery/LocationDiscoverySection.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSnippet = 'className="w-[78vw] max-w-[285px] min-w-[250px] shrink-0 snap-start"';
const newSnippet = 'className="w-[calc(50%-5px)] min-w-[calc(50%-5px)] max-w-[calc(50%-5px)] sm:w-[calc(33.333%-11px)] sm:min-w-[calc(33.333%-11px)] sm:max-w-[calc(33.333%-11px)] shrink-0 snap-start"';

if (!content.includes(oldSnippet)) {
  console.error('Target snippet not found in LocationDiscoverySection.tsx');
  process.exit(1);
}

content = content.replace('gap-3.5', 'gap-2.5');
content = content.replace(oldSnippet, newSnippet);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated LocationDiscoverySection.tsx');
