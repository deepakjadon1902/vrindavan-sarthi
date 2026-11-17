const { execSync } = require('child_process');

try {
  const netstat = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
  const lines = netstat.split('\r\n');
  const targetPids = [18984, 26704, 28152, 27028, 4308, 15756];
  console.log('Listening sockets for target PIDs:');
  for (const line of lines) {
    if (line.includes('LISTENING')) {
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[parts.length - 1], 10);
      if (targetPids.includes(pid) || parts[1].includes(':5000') || parts[1].includes(':5001') || parts[1].includes(':5002') || parts[1].includes(':8081') || parts[1].includes(':8082')) {
        console.log(`Port: ${parts[1]} | PID: ${pid}`);
      }
    }
  }
} catch (e) {
  console.error(e.message);
}
