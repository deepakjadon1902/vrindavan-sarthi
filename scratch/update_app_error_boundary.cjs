const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../frontend/src/App.tsx');
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!content.includes('import ErrorBoundary')) {
  content = content.replace(
    'import SEOBreadcrumbs from "@/components/SEOBreadcrumbs";',
    'import SEOBreadcrumbs from "@/components/SEOBreadcrumbs";\nimport ErrorBoundary from "@/components/ErrorBoundary";'
  );
}

content = content.replace(
  '<main>{children}</main>',
  '<main><ErrorBoundary>{children}</ErrorBoundary></main>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('App.tsx successfully updated with ErrorBoundary!');
