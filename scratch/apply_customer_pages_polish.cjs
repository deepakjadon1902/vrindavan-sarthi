const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function replaceInFile(filePath, replacements) {
  const fullPath = path.join(repoRoot, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  let count = 0;
  for (const [target, replacement] of replacements) {
    if (content.includes(target)) {
      content = content.replace(target, replacement);
      count++;
    } else {
      console.warn(`Warning: Target not found in ${filePath}:\n${target}`);
    }
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated ${filePath} (${count}/${replacements.length} replaced)`);
}

// 1. Cabs.tsx
replaceInFile('frontend/src/pages/Cabs.tsx', [
  [
    'className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"',
    'className="btn-emerald inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"'
  ],
  [
    'className="btn-gold mt-5 rounded-lg px-5 py-2 text-sm"',
    'className="btn-emerald mt-5 rounded-lg px-5 py-2 text-sm"'
  ]
]);

// 2. CabDetail.tsx
replaceInFile('frontend/src/pages/CabDetail.tsx', [
  [
    'className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-body text-sm font-bold"',
    'className="btn-emerald inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-body text-sm font-bold shadow-md"'
  ],
  [
    'className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block"',
    'className="btn-emerald px-6 py-2 rounded-lg text-sm mt-4 inline-block"'
  ]
]);

// 3. Tours.tsx
replaceInFile('frontend/src/pages/Tours.tsx', [
  [
    'className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"',
    'className="btn-emerald inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"'
  ],
  [
    'className="btn-gold mt-5 rounded-lg px-5 py-2 text-sm"',
    'className="btn-emerald mt-5 rounded-lg px-5 py-2 text-sm"'
  ]
]);

// 4. TourDetail.tsx
replaceInFile('frontend/src/pages/TourDetail.tsx', [
  [
    'className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-body text-sm font-bold"',
    'className="btn-emerald inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-body text-sm font-bold shadow-md"'
  ],
  [
    'className="btn-gold px-6 py-2 rounded-lg text-sm mt-4 inline-block"',
    'className="btn-emerald px-6 py-2 rounded-lg text-sm mt-4 inline-block"'
  ]
]);

// 5. MyBookings.tsx
replaceInFile('frontend/src/pages/user/MyBookings.tsx', [
  [
    'className="btn-gold px-6 py-3 rounded-lg text-sm inline-flex items-center gap-2 font-semibold"',
    'className="btn-emerald px-6 py-3 rounded-lg text-sm inline-flex items-center gap-2 font-semibold"'
  ],
  [
    'className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-body text-xs font-semibold text-foreground hover:bg-secondary hover:text-brand-crimson transition-colors disabled:opacity-50 shadow-sm"',
    'className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 text-emerald-900 px-3 py-1.5 font-body text-xs font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50 shadow-2xs"'
  ]
]);

// 6. About.tsx
replaceInFile('frontend/src/pages/About.tsx', [
  [
    'className="btn-gold inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm"',
    'className="btn-emerald inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm"'
  ],
  [
    'className="btn-crimson inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm"',
    'className="btn-emerald inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm"'
  ]
]);

// 7. Contact.tsx
replaceInFile('frontend/src/pages/Contact.tsx', [
  [
    'className="btn-crimson px-8 py-3.5 rounded-xl flex items-center gap-2 w-full justify-center disabled:opacity-60"',
    'className="btn-emerald px-8 py-3.5 rounded-xl flex items-center gap-2 w-full justify-center disabled:opacity-60"'
  ]
]);

// 8. Profile.tsx
replaceInFile('frontend/src/pages/user/Profile.tsx', [
  [
    'className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium"',
    'className="btn-emerald px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium"'
  ],
  [
    'className="btn-crimson px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium"',
    'className="btn-emerald px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 font-medium"'
  ]
]);

console.log('All customer pages successfully polished with unified tokens!');
