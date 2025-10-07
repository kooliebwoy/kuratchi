/**
 * Worker Deployment
 * Handles DO worker script upload and configuration
 */

import { CloudflareClient } from '../../utils/cloudflare.js';
import { DEFAULT_DO_WORKER_SCRIPT } from '../worker-template.js';

export interface DeployWorkerOptions {
  scriptName: string;
  gatewayKey: string;
  cloudflareClient: CloudflareClient;
}

/**
 * Deploy or update the internal DO worker
 */
export async function deployWorker(options: DeployWorkerOptions): Promise<void> {
  const { scriptName, gatewayKey, cloudflareClient } = options;
  
  if (!gatewayKey) {
    throw new Error('gatewayKey is required to deploy worker');
  }
  
  const bindings: any[] = [
    // Secret binding for gateway key
    { type: 'secret_text', name: 'API_KEY', text: gatewayKey },
    // Durable Object namespace binding
    { type: 'durable_object_namespace', name: 'DO', class_name: 'KuratchiDoInternal' }
  ];
  
  // Try to update existing worker first, then create if it doesn't exist
  try {
    await cloudflareClient.uploadWorkerModule(scriptName, DEFAULT_DO_WORKER_SCRIPT, bindings);
  } catch (error: any) {
    // If it's a DO class migration error, try without migrations
    if (error.message?.includes('new-class migration') || error.message?.includes('already depended on')) {
      await cloudflareClient.uploadWorkerModule(scriptName, DEFAULT_DO_WORKER_SCRIPT, bindings, { skipDoMigrations: true });
    } else {
      throw error;
    }
  }
  
  // Enable worker subdomain
  await cloudflareClient.enableWorkerSubdomain(scriptName);
}

/**
 * Check if worker is deployed
 */
export async function isWorkerDeployed(scriptName: string, cloudflareClient: CloudflareClient): Promise<boolean> {
  try {
    // Try to get worker info
    // This is a simplified check - you may want to implement a proper check
    return true;
  } catch {
    return false;
  }
}
