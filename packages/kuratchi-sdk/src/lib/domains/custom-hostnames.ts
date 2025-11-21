import { safeGetClient } from './client.js';
import type { CloudflareAPIResponse, CreateCustomHostnamePayload } from '../utils/cloudflare.js';

export interface CreateCustomHostnameOptions {
  zoneId: string;
  hostname: string;
  originHost: string;
  ssl?: CreateCustomHostnamePayload['ssl'];
  metadata?: Record<string, unknown>;
  customOriginSni?: string;
}

export interface CustomHostnameResult {
  success: boolean;
  hostname?: any;
  error?: string;
}

export async function createCustomHostname(options: CreateCustomHostnameOptions): Promise<CustomHostnameResult> {
  const client = safeGetClient();
  if (!client) {
    return { success: false, error: 'Cloudflare client not available' };
  }

  try {
    const payload: CreateCustomHostnamePayload = {
      hostname: options.hostname,
      custom_origin_server: options.originHost,
      custom_origin_sni: options.customOriginSni,
      ssl: options.ssl ?? {
        method: 'http',
        type: 'dv'
      },
      metadata: options.metadata
    };

    const response = await client.createCustomHostname(options.zoneId, payload);
    if (!response.success) {
      return {
        success: false,
        error: Array.isArray(response.errors) && response.errors.length > 0 ? JSON.stringify(response.errors[0]) : 'Failed to create hostname'
      };
    }

    return {
      success: true,
      hostname: response.result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create custom hostname'
    };
  }
}

export async function getCustomHostname(zoneId: string, hostnameId: string): Promise<CloudflareAPIResponse<any> | null> {
  const client = safeGetClient();
  if (!client) {
    return null;
  }
  try {
    return await client.getCustomHostname(zoneId, hostnameId);
  } catch (error) {
    console.warn('[CustomHostnames] Failed to get custom hostname:', error);
    return null;
  }
}

export async function deleteCustomHostname(zoneId: string, hostnameId: string): Promise<boolean> {
  const client = safeGetClient();
  if (!client) {
    return false;
  }
  try {
    const response = await client.deleteCustomHostname(zoneId, hostnameId);
    return !!response?.success;
  } catch (error) {
    console.warn('[CustomHostnames] Failed to delete custom hostname:', error);
    return false;
  }
}
