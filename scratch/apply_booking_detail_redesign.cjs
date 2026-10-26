const fs = require('fs');

let code = fs.readFileSync('frontend/src/pages/user/BookingDetail.tsx', 'utf8');

code = code.replace(
  'className="w-full py-3 rounded-2xl bg-brand-crimson text-white font-body text-sm font-bold hover:bg-brand-crimson/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"',
  'className="btn-emerald w-full py-3 text-sm font-bold shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"'
);

fs.writeFileSync('frontend/src/pages/user/BookingDetail.tsx', code, 'utf8');
console.log('Successfully updated BookingDetail.tsx button colors');
