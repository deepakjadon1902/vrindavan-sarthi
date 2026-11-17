const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../frontend/src/components/shared/ImageCarousel.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /heightClass\s*=\s*'[^']+',/,
  "heightClass = 'aspect-[4/3] h-auto min-h-[220px] max-h-[320px] sm:aspect-[16/10] sm:min-h-[260px] sm:max-h-[360px] lg:max-h-[400px]',"
);

content = content.replace(
  /fetchPriority=\{i === 0 \? 'high' : 'auto'\}/,
  "{...(i === 0 ? { fetchpriority: 'high' } : {})} as any"
);

fs.writeFileSync(file, content, 'utf8');
console.log('ImageCarousel.tsx successfully refined!');
