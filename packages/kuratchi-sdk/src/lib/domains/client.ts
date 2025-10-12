import { CloudflareClient, type CloudflareClientConfig } from '../utils/cloudflare.js';
import { getCurrentPlatform } from '../utils/platform-context.js';

/**
 * Get Cloudflare configuration from environment
 */
function getCloudflareConfig(): CloudflareClientConfig {
  const platform = getCurrentPlatform();
  const env = (platform as any)?.env;
  
  // Try to get from platform.env first (for Cloudflare Workers environment)
  let apiToken = env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN;
  let accountId = env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID;
  
  // Fallback to process.env (for development/CLI environments)
  if (!apiToken && typeof process !== 'undefined' && process.env) {
    apiToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    accountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  }
  
  if (!apiToken) {
    throw new Error('Cloudflare API token is required. Set CF_API_TOKEN or CLOUDFLARE_API_TOKEN environment variable.');
  }
  
  if (!accountId) {
    throw new Error('Cloudflare Account ID is required. Set CF_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID environment variable.');
  }
  
  return {
    apiToken,
    accountId
  };
}

let _client: CloudflareClient | undefined;

/**
 * Get or create singleton CloudflareClient instance
 */
export function getCloudflareClient(): CloudflareClient {
  if (!_client) {
    _client = new CloudflareClient(getCloudflareConfig());
  }
  return _client;
}

/**
 * Reset the client instance (useful for testing or config changes)
 */
export function resetClient(): void {
  _client = undefined;
}

class DomainsNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainsNotAvailableError';
  }
}

/**
 * Safe wrapper that catches client creation errors
 */
export function safeGetClient(): CloudflareClient | null {
  try {
    return getCloudflareClient();
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[Kuratchi Domains] ${error.message}`);
    }
    return null;
  }
}