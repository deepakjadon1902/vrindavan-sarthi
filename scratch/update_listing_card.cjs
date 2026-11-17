const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../frontend/src/components/shared/ListingCard.tsx');
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Update image container sizing
content = content.replace(
  /<div className=\{\`relative \$\{kind === 'cab' \? 'aspect-\[3\/2\]' : 'aspect-\[4\/3\]'\} w-full overflow-hidden rounded-2xl bg-neutral-100\`\}>/,
  `<div className={\`relative \${kind === 'cab' ? 'h-[160px] sm:h-[175px] md:h-auto md:aspect-[3/2]' : 'aspect-[4/3]'} w-full overflow-hidden rounded-2xl bg-neutral-100\`}>`
);

// If old aspect ratio was still there:
content = content.replace(
  '<div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100">',
  `<div className={\`relative \${kind === 'cab' ? 'h-[160px] sm:h-[175px] md:h-auto md:aspect-[3/2]' : 'aspect-[4/3]'} w-full overflow-hidden rounded-2xl bg-neutral-100\`}>`
);

// 2. Unobtrusive badges and heart icon sizing
content = content.replace(
  `<div className="absolute top-3 left-3 z-10 max-w-[65%]">\n            <span\n              className={\`inline-flex items-center max-w-full truncate rounded-full px-2.5 py-0.5 font-body text-[11px]`,
  `<div className="absolute top-2.5 left-2.5 z-10 max-w-[70%]">\n            <span\n              className={\`inline-flex items-center max-w-full truncate rounded-full px-2 py-0.5 font-body text-[10px]`
);

content = content.replace(
  `className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:scale-110 active:scale-90 transition-transform focus-visible:outline-none">\n            <Heart\n              size={22}`,
  `className="absolute top-2.5 right-2.5 z-10 p-1 rounded-full hover:scale-110 active:scale-90 transition-transform focus-visible:outline-none">\n            <Heart\n              size={18}`
);

// 3. Spacing and typography refinement
content = content.replace(
  '<div className="mt-2.5 space-y-0.5">',
  '<div className="mt-2 space-y-0.5">'
);

content = content.replace(
  'className="font-body text-[15px] font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1"',
  'className="font-body text-[13px] sm:text-[14px] font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1 leading-snug"'
);

content = content.replace(
  '<Star size={12} className="fill-slate-900 text-slate-900" />',
  '<Star size={11} className="fill-slate-900 text-slate-900" />'
);

content = content.replace(
  'className="font-body text-[13px] font-medium text-neutral-500 flex items-center gap-1 line-clamp-1"',
  'className="font-body text-[11px] sm:text-xs font-medium text-neutral-500 flex items-center gap-1 line-clamp-1"'
);

content = content.replace(
  '<MapPin size={13} className="text-amber-800/80 shrink-0" />',
  '<MapPin size={11} className="text-amber-800/80 shrink-0" />'
);

content = content.replace(
  'className="font-body text-[13px] text-neutral-400 line-clamp-1"',
  'className="font-body text-[11px] sm:text-xs text-neutral-400 line-clamp-1"'
);

content = content.replace(
  'className="font-body text-[16px] font-bold tracking-tight"',
  'className="font-body text-[13px] sm:text-[14px] font-bold text-slate-900 tracking-tight"'
);

fs.writeFileSync(file, content, 'utf8');
console.log('ListingCard.tsx successfully updated with Airbnb-style compact proportions!');
