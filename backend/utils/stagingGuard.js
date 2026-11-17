const fs = require('fs');
const path = require('path');

/**
 * VRINDAVAN SARTHI — STAGING ENVIRONMENT ISOLATION GUARD
 * 
 * Guarantees that destructive test seeding, migrations, or persistent
 * acceptance tests CANNOT execute against the production MongoDB cluster.
 */

function assertIsolatedStagingEnvironment(uriToValidate) {
  if (!uriToValidate || typeof uriToValidate !== 'string') {
    throw new Error('STAGING_GUARD_FAIL: No MongoDB URI provided to staging guard.');
  }

  // 1. Check against production .env if it exists
  const prodEnvPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(prodEnvPath)) {
    const prodContent = fs.readFileSync(prodEnvPath, 'utf8');
    const prodMatch = prodContent.match(/^\s*MONGO_URI\s*=\s*(.+)$/m);
    if (prodMatch) {
      const prodUri = prodMatch[1].trim();
      if (uriToValidate.trim() === prodUri) {
        throw new Error('FATAL SECURITY VIOLATION: Target URI is identical to the production MONGO_URI! Refusing execution.');
      }
    }
  }

  // 2. Reject known production cluster signatures or unauthenticated default database targets
  const normalized = uriToValidate.toLowerCase();
  if (normalized.includes('mongodb.net') && !normalized.includes('-staging') && !normalized.includes('-test')) {
    // If it's on Atlas, it must have an explicit staging/test identifier
    const dbName = extractDatabaseName(uriToValidate);
    if (!dbName || (!dbName.endsWith('_staging') && !dbName.endsWith('_test'))) {
      throw new Error(`FATAL SECURITY VIOLATION: Atlas cluster targeted without explicit staging database identifier: "${dbName}". Refusing execution.`);
    }
  }

  // 3. Database name check
  const dbName = extractDatabaseName(uriToValidate);
  const allowedDatabases = ['vrindavan_sarthi_staging', 'vrindavan_sarthi_test'];
  if (!allowedDatabases.includes(dbName)) {
    throw new Error(`FATAL SECURITY VIOLATION: Database name "${dbName}" is not in the allowed staging database list [${allowedDatabases.join(', ')}]. Refusing execution.`);
  }

  return {
    isIsolated: true,
    dbName,
    host: extractHost(uriToValidate),
    timestamp: new Date().toISOString(),
  };
}

function extractDatabaseName(uri) {
  try {
    const clean = uri.split('?')[0];
    const parts = clean.split('/');
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

function extractHost(uri) {
  try {
    const match = uri.match(/@([^/?]+)/) || uri.match(/mongodb:\/\/(?:[^@]+@)?([^/?]+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

module.exports = {
  assertIsolatedStagingEnvironment,
  extractDatabaseName,
  extractHost,
};
