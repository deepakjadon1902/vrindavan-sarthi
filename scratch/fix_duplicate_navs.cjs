const fs = require('fs');

// 1. Profile.tsx
let profile = fs.readFileSync('frontend/src/pages/user/Profile.tsx', 'utf8');
profile = profile.replace("import Navbar from '@/components/layout/Navbar';\r\n", "");
profile = profile.replace("import Navbar from '@/components/layout/Navbar';\n", "");
profile = profile.replace("import Footer from '@/components/layout/Footer';\r\n", "");
profile = profile.replace("import Footer from '@/components/layout/Footer';\n", "");
profile = profile.replace(
  "  return (\r\n    <>\r\n      <Navbar />\r\n      <div className=\"min-h-screen bg-background pt-20 pb-8 px-4\">",
  "  return (\r\n    <div className=\"min-h-screen bg-background pt-20 sm:pt-24 pb-8 px-4\">"
);
profile = profile.replace(
  "  return (\n    <>\n      <Navbar />\n      <div className=\"min-h-screen bg-background pt-20 pb-8 px-4\">",
  "  return (\n    <div className=\"min-h-screen bg-background pt-20 sm:pt-24 pb-8 px-4\">"
);
profile = profile.replace(
  "      </div>\r\n      <Footer />\r\n    </>\r\n  );",
  "      </div>\r\n  );"
);
profile = profile.replace(
  "      </div>\n      <Footer />\n    </>\n  );",
  "      </div>\n  );"
);
fs.writeFileSync('frontend/src/pages/user/Profile.tsx', profile, 'utf8');
console.log('Profile.tsx updated');

// 2. BookingDetail.tsx
let bookingDetail = fs.readFileSync('frontend/src/pages/user/BookingDetail.tsx', 'utf8');
bookingDetail = bookingDetail.replace("import Navbar from '@/components/layout/Navbar';\r\n", "");
bookingDetail = bookingDetail.replace("import Navbar from '@/components/layout/Navbar';\n", "");
bookingDetail = bookingDetail.replace("import Footer from '@/components/layout/Footer';\r\n", "");
bookingDetail = bookingDetail.replace("import Footer from '@/components/layout/Footer';\n", "");

// loading state
bookingDetail = bookingDetail.replace(
  "    return (\r\n      <>\r\n        <Navbar />\r\n        <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">",
  "    return (\r\n      <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">"
);
bookingDetail = bookingDetail.replace(
  "    return (\n      <>\n        <Navbar />\n        <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">",
  "    return (\n      <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">"
);
bookingDetail = bookingDetail.replace(
  "        </div>\r\n        <Footer />\r\n      </>\r\n    );",
  "        </div>\r\n    );"
);
bookingDetail = bookingDetail.replace(
  "        </div>\n        <Footer />\n      </>\n    );",
  "        </div>\n    );"
);

// not found state
bookingDetail = bookingDetail.replace(
  "    return (\r\n      <>\r\n        <Navbar />\r\n        <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">",
  "    return (\r\n      <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">"
);
bookingDetail = bookingDetail.replace(
  "    return (\n      <>\n        <Navbar />\n        <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">",
  "    return (\n      <div className=\"min-h-screen bg-background pt-24 pb-16 px-4 flex items-center justify-center\">"
);
bookingDetail = bookingDetail.replace(
  "        </div>\r\n        <Footer />\r\n      </>\r\n    );",
  "        </div>\r\n    );"
);
bookingDetail = bookingDetail.replace(
  "        </div>\n        <Footer />\n      </>\n    );",
  "        </div>\n    );"
);

// main return
bookingDetail = bookingDetail.replace(
  "  return (\r\n    <>\r\n      <Navbar />\r\n      <div className=\"min-h-screen bg-[#faf8f5] pt-20 pb-16 px-4 sm:px-6 lg:px-8\">",
  "  return (\r\n    <div className=\"min-h-screen bg-[#faf8f5] pt-20 sm:pt-24 pb-16 px-4 sm:px-6 lg:px-8\">"
);
bookingDetail = bookingDetail.replace(
  "  return (\n    <>\n      <Navbar />\n      <div className=\"min-h-screen bg-[#faf8f5] pt-20 pb-16 px-4 sm:px-6 lg:px-8\">",
  "  return (\n    <div className=\"min-h-screen bg-[#faf8f5] pt-20 sm:pt-24 pb-16 px-4 sm:px-6 lg:px-8\">"
);
bookingDetail = bookingDetail.replace(
  "      </div>\r\n      <Footer />\r\n    </>\r\n  );",
  "      </div>\r\n  );"
);
bookingDetail = bookingDetail.replace(
  "      </div>\n      <Footer />\n    </>\n  );",
  "      </div>\n  );"
);

fs.writeFileSync('frontend/src/pages/user/BookingDetail.tsx', bookingDetail, 'utf8');
console.log('BookingDetail.tsx updated');

// 3. BookingConfirmation.tsx
let confirm = fs.readFileSync('frontend/src/pages/user/BookingConfirmation.tsx', 'utf8');
confirm = confirm.replace(
  '<div className="min-h-[75vh] px-4 py-8 sm:py-12 bg-background">',
  '<div className="min-h-[75vh] px-4 pt-20 sm:pt-24 pb-8 sm:pb-12 bg-background">'
);
confirm = confirm.replace(
  '<div className="min-h-[70vh] px-4 py-16 flex items-center justify-center">',
  '<div className="min-h-[70vh] px-4 pt-24 pb-16 flex items-center justify-center">'
);
confirm = confirm.replace(
  '<div className="min-h-[70vh] px-4 py-16 flex items-center justify-center">',
  '<div className="min-h-[70vh] px-4 pt-24 pb-16 flex items-center justify-center">'
);
fs.writeFileSync('frontend/src/pages/user/BookingConfirmation.tsx', confirm, 'utf8');
console.log('BookingConfirmation.tsx updated');
