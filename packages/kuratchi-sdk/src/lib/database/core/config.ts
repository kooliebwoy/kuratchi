/**
 * Database Configuration
 * Environment variable resolution and config building
 */

import { env } from '$env/dynamic/private';

export interface EnvironmentConfig {
  workersSubdomain?: string;
  accountId?: string;
  apiToken?: string;
  scriptName?: string;
  gatewayKey?: string;
}

export interface AdminEnvironmentConfig {
  databaseName: string;
  dbToken?: string;
}

/**
 * Get DO-related environment variables
 */
export function getDoEnvironment(): EnvironmentConfig {
  return {
    workersSubdomain: env.CF_WORKERS_SUBDOMAIN || env.CLOUDFLARE_WORKERS_SUBDOMAIN || env.KURATCHI_CF_WORKERS_SUBDOMAIN,
    accountId: env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.KURATCHI_CF_ACCOUNT_ID,
    apiToken: env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || env.KURATCHI_CF_API_TOKEN,
    scriptName: env.SCRIPT_NAME || env.KURATCHI_DO_SCRIPT_NAME || 'kuratchi-do-internal',
    gatewayKey: env.GATEWAY_KEY || env.KURATCHI_GATEWAY_KEY
  };
}

/**
 * Get admin database environment variables
 */
export function getAdminEnvironment(): AdminEnvironmentConfig {
  return {
    databaseName: env.KURATCHI_ADMIN_DB_NAME || 'kuratchi-admin',
    dbToken: env.KURATCHI_ADMIN_DB_TOKEN
  };
}

/**
 * Validate required environment variables for DO operations
 */
export function validateDoEnvironment(config: EnvironmentConfig): { valid: boolean; missing: string[] } {
  const required: (keyof EnvironmentConfig)[] = ['workersSubdomain', 'accountId', 'apiToken'];
  const missing: string[] = [];
  
  for (const key of required) {
    if (!config[key]) {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Validate admin database configuration
 */
export function validateAdminEnvironment(config: AdminEnvironmentConfig): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!config.dbToken) {
    missing.push('dbToken');
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}
