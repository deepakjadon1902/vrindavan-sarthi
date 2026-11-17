const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/RoomTypeDetail.tsx', 'utf8');

// Remove unused SimpleBookingPanel import
code = code.replace("import SimpleBookingPanel from '@/components/shared/SimpleBookingPanel';\r\n", "");
code = code.replace("import SimpleBookingPanel from '@/components/shared/SimpleBookingPanel';\n", "");

// Find and remove the hidden dead block
const hiddenStart = code.indexOf('<div className="hidden" aria-hidden="true">');
if (hiddenStart !== -1) {
  const hiddenEnd = code.indexOf('</div>\r\n              </div>\r\n            )}', hiddenStart);
  const hiddenEndAlt = code.indexOf('</div>\n              </div>\n            )}', hiddenStart);
  const endIdx = hiddenEnd !== -1 ? hiddenEnd : hiddenEndAlt;
  if (endIdx !== -1) {
    // Remove from hiddenStart to endIdx + 6 ('</div>')
    code = code.slice(0, hiddenStart) + code.slice(endIdx + 6);
    console.log('Removed dead hidden block from RoomTypeDetail.tsx');
  } else {
    console.log('Could not find end of hidden block');
  }
} else {
  console.log('Could not find start of hidden block');
}

fs.writeFileSync('frontend/src/pages/RoomTypeDetail.tsx', code, 'utf8');
