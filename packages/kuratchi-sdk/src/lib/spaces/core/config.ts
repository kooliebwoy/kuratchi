/**
 * Kuratchi Spaces - Configuration
 */

export interface EnvironmentConfig {
  workersSubdomain?: string;
  accountId?: string;
  apiToken?: string;
  scriptName?: string;
  gatewayKey?: string;
  workerUrl?: string;
}

export interface SpacesEnvironmentConfig {
  workerUrl?: string;
  gatewayKey?: string;
}

/**
 * Get spaces-specific environment configuration
 * Uses standard KURATCHI_GATEWAY_KEY for consistency across all SDK features
 */
export function getSpacesEnvironment(): SpacesEnvironmentConfig {
  return {
    workerUrl: process.env.KURATCHI_SPACES_WORKER_URL || '',
    gatewayKey: process.env.KURATCHI_GATEWAY_KEY || process.env.KURATCHI_SPACES_GATEWAY_KEY || ''
  };
}

/**
 * Get Durable Object deployment environment configuration
 * Uses standard KURATCHI_GATEWAY_KEY for consistency
 */
export function getDoEnvironment(): EnvironmentConfig {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    gatewayKey: process.env.KURATCHI_GATEWAY_KEY || process.env.KURATCHI_SPACES_GATEWAY_KEY || '',
    scriptName: process.env.KURATCHI_SPACES_SCRIPT_NAME || 'kuratchi-spaces'
  };
}

/**
 * Validate Spaces environment configuration
 * Uses standard KURATCHI_GATEWAY_KEY
 */
export function validateSpacesEnvironment(config: SpacesEnvironmentConfig): void {
  if (!config.workerUrl) {
    throw new Error('KURATCHI_SPACES_WORKER_URL is required');
  }
  if (!config.gatewayKey) {
    throw new Error('KURATCHI_GATEWAY_KEY is required');
  }
}

/**
 * Validate DO environment configuration
 * Uses standard KURATCHI_GATEWAY_KEY
 */
export function validateDoEnvironment(config: EnvironmentConfig): void {
  if (!config.accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is required');
  }
  if (!config.apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN is required');
  }
  if (!config.gatewayKey) {
    throw new Error('KURATCHI_GATEWAY_KEY is required');
  }
}
