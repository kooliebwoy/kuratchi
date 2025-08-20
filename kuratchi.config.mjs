// Kuratchi CLI config template
//
// This file is discovered automatically by the Kuratchi CLI.
// You can keep secrets in environment variables and reference them here.
//
// Recognized keys:
// - accountId
// - apiToken
// - workersSubdomain (e.g., "your-subdomain.workers.dev")
//
// Env vars supported (either name works):
// - CF_ACCOUNT_ID | CLOUDFLARE_ACCOUNT_ID
// - CF_API_TOKEN | CLOUDFLARE_API_TOKEN
// - CF_WORKERS_SUBDOMAIN | CLOUDFLARE_WORKERS_SUBDOMAIN

export default {
  // Cloudflare Account ID
  accountId: process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || '',

  // Cloudflare API Token (least-privilege recommended)
  apiToken: process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '',

  // Your Workers subdomain, e.g., "example.workers.dev"
  workersSubdomain: process.env.CF_WORKERS_SUBDOMAIN || process.env.CLOUDFLARE_WORKERS_SUBDOMAIN || '',
};
