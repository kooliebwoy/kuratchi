#!/usr/bin/env node

/**
 * Kuratchi Spaces - Simple Deployment Script
 * This script runs the TypeScript deployment code using tsx
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const deployScript = join(__dirname, 'deploy-spaces.ts');

console.log('🚀 Kuratchi Spaces Deployment\n');

// Run the TypeScript file with tsx
const child = spawn('npx', ['tsx', deployScript], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
