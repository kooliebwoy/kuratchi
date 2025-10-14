/**
 * Worker Endpoint Readiness
 * Wait for worker endpoint to become responsive
 */

import type { D1Client } from '../core/types.js';

export interface WaitForWorkerOptions {
  client: D1Client;
  timeoutMs?: number;
  intervalMs?: number;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for worker endpoint to be ready
 */
export async function waitForWorker(options: WaitForWorkerOptions): Promise<boolean> {
  const { client, timeoutMs = 30000, intervalMs = 2000 } = options;
  const deadline = Date.now() + timeoutMs;
  
  while (true) {
    try {
      const result = await client.query('SELECT 1 as test');
      
      // Check if query succeeded
      if (result && result.success === true) {
        return true;
      }
      
      if (Date.now() > deadline) {
        break;
      }
      
      await sleep(intervalMs);
    } catch {
      if (Date.now() > deadline) {
        break;
      }
      await sleep(intervalMs);
    }
  }
  
  return false;
}

/**
 * Check if worker is ready (single attempt)
 */
export async function isWorkerReady(client: D1Client): Promise<boolean> {
  try {
    const result = await client.query('SELECT 1 as test');
    return result && result.success === true;
  } catch {
    return false;
  }
}
