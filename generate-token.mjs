#!/usr/bin/env node

// Generate a new admin DB token for the correct database name
import { createSignedDbToken } from './dist/do/token.js';

const dbName = 'seven-test';
const gatewayKey = "3f69c989cbb52d93a3b2d5b70b449ac4";

if (!gatewayKey) {
  console.error('KURATCHI_GATEWAY_KEY environment variable is required');
  process.exit(1);
}

try {
  const token = await createSignedDbToken(dbName, gatewayKey);
  console.log(`New token for database '${dbName}':`);
  console.log(token);
  console.log(`\nUpdate your environment variable:`);
  console.log(`export KURATCHI_ADMIN_DB_TOKEN="${token}"`);
} catch (error) {
  console.error('Error generating token:', error);
  process.exit(1);
}
