/**
 * VRINDAVAN SARTHI — STAGING SERVER RUNNER
 * 
 * Safely starts the backend on port 5001 connected ONLY to local staging MongoDB.
 */
const path = require('path');
const dotenv = require('dotenv');
const { assertIsolatedStagingEnvironment } = require('../utils/stagingGuard');

// Force-load staging environment
const stagingEnvPath = path.resolve(__dirname, '../.env.staging');
const result = dotenv.config({ path: stagingEnvPath, override: true });
if (result.error) {
  console.error('Failed to load backend/.env.staging:', result.error.message);
  process.exit(1);
}

// Ensure staging environment isolation
assertIsolatedStagingEnvironment(process.env.MONGO_URI);
process.env.PORT = process.env.PORT || '5001';
process.env.NODE_ENV = 'staging';

console.log('[STAGING_RUNNER] Verified isolated MongoDB URI:', process.env.MONGO_URI);
console.log('[STAGING_RUNNER] Starting Express on port:', process.env.PORT);

// Start the server
require('../server');
