/**
 * Worker Deployment
 * Handles D1 worker script upload and configuration
 */

import { CloudflareClient } from '../../utils/cloudflare.js';
import { DEFAULT_D1_WORKER_SCRIPT } from './worker-template.js';
import type { PrimaryLocationHint } from '../../utils/cloudflare.js';

export interface DeployWorkerOptions {
  scriptName: string;
  databaseName: string;
  gatewayKey: string;
  cloudflareClient: CloudflareClient;
  location?: PrimaryLocationHint;
}

/**
 * Deploy or update the internal D1 worker with database binding
 * Each database gets its own worker with a dedicated D1 database
 */
export async function deployWorker(options: DeployWorkerOptions): Promise<{ databaseId: string; workerName: string }> {
  const { scriptName, databaseName, gatewayKey, cloudflareClient, location } = options;
  
  if (!gatewayKey) {
    throw new Error('gatewayKey is required to deploy worker');
  }
  
  // Use CloudflareClient's deployD1Worker method
  return await cloudflareClient.deployD1Worker({
    workerName: scriptName,
    databaseName,
    workerScript: DEFAULT_D1_WORKER_SCRIPT,
    gatewayKey,
    location
  });
}

/**
 * Check if worker is deployed
 */
export async function isWorkerDeployed(scriptName: string, cloudflareClient: CloudflareClient): Promise<boolean> {
  try {
    await cloudflareClient.getWorkerScript(scriptName);
    return true;
  } catch {
    return false;
  }
}
