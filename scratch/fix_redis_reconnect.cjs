const fs = require('fs');
let code = fs.readFileSync('backend/config/redis.js', 'utf8');

const target = 
`      reconnectStrategy: (retries) =>
        Math.min(
          30_000,
          500 * Math.max(1, retries)
        ),`;

const rep = 
`      reconnectStrategy: (retries) => {
        if (retries > 3) return false;
        return Math.min(
          3_000,
          500 * Math.max(1, retries)
        );
      },`;

code = code.replace(target.replace(/\n/g, '\r\n'), rep.replace(/\n/g, '\r\n'));
fs.writeFileSync('backend/config/redis.js', code, 'utf8');
console.log('Successfully updated redis.js reconnectStrategy');
