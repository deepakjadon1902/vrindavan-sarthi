process.env.PORT = '5002';
const path = require('path');
const http = require('http');

async function testRoute(urlPath) {
  const start = Date.now();
  return new Promise((resolve) => {
    http.get(`http://localhost:5002${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const durationMs = Date.now() - start;
        try {
          const json = JSON.parse(data);
          const isArr = Array.isArray(json);
          const count = isArr ? json.length : (Array.isArray(json.data) ? json.data.length : (json.data ? 1 : 0));
          const keys = isArr ? (json[0] ? Object.keys(json[0]).slice(0, 5) : []) : Object.keys(json);
          resolve({
            path: urlPath,
            status: res.statusCode,
            durationMs,
            success: json.success !== false,
            count,
            keys,
            sample: isArr ? (json[0] ? { name: json[0].name || json[0].vehicleName || json[0].title } : null) : (json.data && Array.isArray(json.data) ? { name: json.data[0]?.name } : null)
          });
        } catch (e) {
          resolve({
            path: urlPath,
            status: res.statusCode,
            durationMs,
            error: 'Invalid JSON',
            raw: data.slice(0, 100)
          });
        }
      });
    }).on('error', (err) => {
      resolve({ path: urlPath, error: err.message });
    });
  });
}

(async () => {
  console.log('Requiring backend/server.js on port 5002...');
  const { server, shutdown } = require(path.resolve(__dirname, '../backend/server.js'));

  // Wait a moment for DB connection
  await new Promise(r => setTimeout(r, 2000));

  const routes = [
    '/api/health',
    '/api/hotels',
    '/api/hotels?type=dharamshala',
    '/api/room-types',
    '/api/cabs',
    '/api/tours?withImages=true'
  ];

  console.log('Testing routes:');
  const results = [];
  for (const r of routes) {
    const res = await testRoute(r);
    results.push(res);
    console.log(`Path: ${r} -> Status: ${res.status}, Count: ${res.count}, Latency: ${res.durationMs}ms`);
  }

  // Graceful close
  console.log('Shutting down test server...');
  await shutdown('SIGTERM');
  console.log('Done.');
})();
