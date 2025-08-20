// Kuratchi CLI example config
//
// Copy this file to `kuratchi.config.mjs` and adjust values as needed.
// Prefer reading secrets from environment variables.
//
// Recognized keys:
// - accountId
// - apiToken
// - workersSubdomain
//
// Supported env var names (either name works):
// - CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID
// - CF_API_TOKEN | CLOUDFLARE_API_TOKEN
// - CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN

export default {
  // Cloudflare Account ID
  accountId: process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || 'YOUR_ACCOUNT_ID',

  // Cloudflare API Token (least-privilege recommended)
  apiToken: process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || 'YOUR_API_TOKEN',

  // Your Workers subdomain, e.g., "example.workers.dev"
  workersSubdomain: process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || 'your-subdomain.workers.dev',
};
