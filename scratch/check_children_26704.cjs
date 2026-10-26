const { execSync } = require('child_process');

try {
  const psScript = `Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq 26704 } | Select-Object ProcessId, ParentProcessId, CommandLine, ExecutablePath | ConvertTo-Json`;
  const result = execSync(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
  console.log('Children of PID 26704 (vrindavan-sarthi nodemon):', result);
} catch (e) {
  console.error(e);
}
