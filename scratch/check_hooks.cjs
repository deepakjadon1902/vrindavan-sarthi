const fs = require('fs');
const path = require('path');

function scanDir(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, results);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const hooks = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useReducer', 'useId', 'useLayoutEffect'];
const files = scanDir(path.resolve('frontend/src'));

const issues = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const hook of hooks) {
    // Matches hook usage like: useMemo( or useMemo<
    const hookUsageRegex = new RegExp('\\b' + hook + '\\s*(\\(|<)', 'g');
    const matches = content.match(hookUsageRegex);
    if (matches && matches.length > 0) {
      // Check if hook is imported
      const isImported = new RegExp('import\\s*\\{[^}]*\\b' + hook + '\\b[^}]*\\}\\s*from\\s*[\'\"]react[\'\"]').test(content);
      const isReactPrefixed = content.includes('React.' + hook);
      
      // If used but not imported from 'react' and not all usages are React.hook
      if (!isImported) {
        // Count total usages vs React.hook usages
        const totalUsages = matches.length;
        const prefixedMatches = (content.match(new RegExp('\\bReact\\.' + hook + '\\s*(\\(|<)', 'g')) || []).length;
        if (totalUsages > prefixedMatches) {
          issues.push({
            file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
            hook,
            bareUsages: totalUsages - prefixedMatches
          });
        }
      }
    }
  }
}

console.log('Hook scan issues found:', JSON.stringify(issues, null, 2));
