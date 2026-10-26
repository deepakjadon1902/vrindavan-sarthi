const { execSync } = require('child_process');
const fs = require('fs');

try {
  // Use powershell Get-Process with formatting
  const psScript = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | Select-Object ProcessId, CommandLine | ConvertTo-Json`;
  const result = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const procs = JSON.parse(result);
  console.log(`Found ${procs.length} node processes:`);
  for (const p of procs) {
    console.log(`PID ${p.ProcessId}: ${p.CommandLine ? p.CommandLine.slice(0, 150) : 'N/A'}`);
  }
} catch (err) {
  console.error('Error listing node processes:', err.message);
}
