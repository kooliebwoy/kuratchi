#!/usr/bin/env node

/**
 * Kuratchi Spaces - CLI Deployment Tool
 * 
 * Usage:
 *   npx kuratchi-spaces-deploy
 *   npx kuratchi-spaces-deploy --script-name my-spaces-worker
 */

import { deploySpacesWorker } from '../src/lib/spaces/deployment/deploy.js';

const args = process.argv.slice(2);
const options = {};

// Parse CLI arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--account-id' && args[i + 1]) {
    options.accountId = args[++i];
  } else if (arg === '--api-token' && args[i + 1]) {
    options.apiToken = args[++i];
  } else if (arg === '--gateway-key' && args[i + 1]) {
    options.gatewayKey = args[++i];
  } else if (arg === '--script-name' && args[i + 1]) {
    options.scriptName = args[++i];
  } else if (arg === '--quiet') {
    options.verbose = false;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Kuratchi Spaces Deployment Tool

Usage:
  npx kuratchi-spaces-deploy [options]

Options:
  --account-id <id>      Cloudflare Account ID (or use CLOUDFLARE_ACCOUNT_ID)
  --api-token <token>    Cloudflare API Token (or use CLOUDFLARE_API_TOKEN)
  --gateway-key <key>    Kuratchi Gateway Key (or use KURATCHI_GATEWAY_KEY)
  --script-name <name>   Worker script name (default: kuratchi-spaces)
  --quiet               Suppress output
  --help, -h            Show this help message

Environment Variables:
  CLOUDFLARE_ACCOUNT_ID  Your Cloudflare account ID
  CLOUDFLARE_API_TOKEN   Your Cloudflare API token (needs Workers Scripts Write)
  KURATCHI_GATEWAY_KEY   Your Kuratchi gateway key

Example:
  # Using environment variables
  export CLOUDFLARE_ACCOUNT_ID=abc123
  export CLOUDFLARE_API_TOKEN=your-token
  export KURATCHI_GATEWAY_KEY=your-key
  npx kuratchi-spaces-deploy

  # Using CLI arguments
  npx kuratchi-spaces-deploy \\
    --account-id abc123 \\
    --api-token your-token \\
    --gateway-key your-key \\
    --script-name my-custom-spaces

After deployment:
  Set KURATCHI_SPACES_WORKER_URL to the worker URL shown
    `);
    process.exit(0);
  }
}

// Run deployment
deploySpacesWorker(options)
  .then((result) => {
    if (!result.success) {
      console.error('\n❌ Deployment failed:', result.error);
      console.error('\n💡 Tip: Run with --help for usage information');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment error:', error.message);
    console.error('\n💡 Tip: Run with --help for usage information');
    process.exit(1);
  });
