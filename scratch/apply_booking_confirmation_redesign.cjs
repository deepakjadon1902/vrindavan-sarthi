const fs = require('fs');

let code = fs.readFileSync('frontend/src/pages/user/BookingConfirmation.tsx', 'utf8');

code = code.replace(
  'className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-crimson px-4 font-body text-sm font-bold text-white hover:bg-brand-crimson/90 transition-colors shadow-sm disabled:opacity-60"',
  'className="btn-emerald w-full py-3 text-sm font-bold shadow-sm disabled:opacity-60"'
);

code = code.replace(
  'className="inline-flex items-center gap-1.5 rounded-xl bg-brand-crimson px-3.5 py-2 font-body text-xs font-bold text-white hover:bg-brand-crimson/90 transition-colors shadow-sm"',
  'className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 font-body text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"'
);

code = code.replace(
  ": 'bg-brand-crimson font-bold text-white hover:bg-brand-crimson/90 shadow-sm'",
  ": 'btn-emerald font-bold text-white shadow-sm'"
);

fs.writeFileSync('frontend/src/pages/user/BookingConfirmation.tsx', code, 'utf8');
console.log('Successfully updated BookingConfirmation.tsx button colors');
