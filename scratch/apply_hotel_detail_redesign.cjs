const fs = require('fs');

let code = fs.readFileSync('frontend/src/pages/HotelDetail.tsx', 'utf8');

// Replace the obscure brown buttons with btn-emerald
code = code.replace(
  'bg-[#6f5529] px-4 py-3 font-body text-sm font-bold text-white transition-colors group-hover:bg-[#5f471f]',
  'btn-emerald w-full py-3 text-sm font-bold shadow-sm'
);
code = code.replace(
  'bg-[#6f5529] px-4 py-3 font-body text-sm font-bold text-white transition-colors group-hover:bg-[#5f471f]',
  'btn-emerald w-full py-3 text-sm font-bold shadow-sm'
);

// Add mobile sticky action bar before closing container if not present
if (!code.includes('Mobile Sticky Action Bar')) {
  const target = `      </div>\n    </div>\n  );\n};\n\nexport default HotelDetail;`;
  const targetCRLF = `      </div>\r\n    </div>\r\n  );\r\n};\r\n\r\nexport default HotelDetail;`;
  
  const stickyBar = `
        {/* Mobile Sticky Action Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Stays</p>
            <p className="text-sm font-bold text-slate-900 leading-tight">
              {roomTypes.length > 0 ? \`\${roomTypes.length} Room Types\` : 'View Room Types'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('hotel-room-types');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="btn-emerald px-5 py-2.5 text-sm font-bold shadow-sm"
          >
            Select Room
          </button>
        </div>
`;

  if (code.includes(targetCRLF)) {
    code = code.replace(targetCRLF, stickyBar + targetCRLF);
  } else if (code.includes(target)) {
    code = code.replace(target, stickyBar + target);
  } else {
    // fallback insert before last </div>
    const lastDiv = code.lastIndexOf('</div>');
    code = code.slice(0, lastDiv) + stickyBar + code.slice(lastDiv);
  }
}

fs.writeFileSync('frontend/src/pages/HotelDetail.tsx', code, 'utf8');
console.log('Successfully updated HotelDetail.tsx');
