const { execSync } = require('child_process');

try {
  const psScript = `Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq 18984 -or $_.ProcessId -eq 26704 } | Select-Object ProcessId, ParentProcessId, CommandLine, ExecutablePath | ConvertTo-Json`;
  const result = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
  console.log(result);
} catch (e) {
  console.error(e);
}
