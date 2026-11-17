const fs = require('fs');
const findings = JSON.parse(fs.readFileSync('scratch/audit_findings.json', 'utf8'));
const issueCounts = {};
const issuesByRoute = {};

findings.forEach(f => {
  if (f.issues && f.issues.length > 0) {
    f.issues.forEach(iss => {
      const key = iss.type;
      issueCounts[key] = (issueCounts[key] || 0) + 1;
      if (!issuesByRoute[f.route]) issuesByRoute[f.route] = {};
      if (!issuesByRoute[f.route][f.viewport]) issuesByRoute[f.route][f.viewport] = [];
      issuesByRoute[f.route][f.viewport].push(iss);
    });
  }
});

console.log('Issue counts:', JSON.stringify(issueCounts, null, 2));
console.log('\nRoutes with issues:');
for (const r in issuesByRoute) {
  console.log(`\n--- ${r} ---`);
  for (const vp in issuesByRoute[r]) {
    console.log(`  ${vp}:`, JSON.stringify(issuesByRoute[r][vp]));
  }
}
