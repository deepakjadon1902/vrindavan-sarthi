const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../frontend/src/components/shared/ListingCard.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100">',
  '<div className={`relative ${kind === \'cab\' ? \'aspect-[3/2]\' : \'aspect-[4/3]\'} w-full overflow-hidden rounded-2xl bg-neutral-100`}>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('ListingCard.tsx successfully refined!');
