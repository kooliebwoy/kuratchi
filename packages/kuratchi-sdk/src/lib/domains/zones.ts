import { safeGetClient } from './client.js';
import type { CloudflareAPIResponse } from '../utils/cloudflare.js';
// Import Cloudflare SDK types instead of redefining
import type { Zone } from 'cloudflare/resources/zones';
import type {
  DnsRecord,
  DnsRecordCreateParams,
  DnsRecordUpdateParams
} from 'cloudflare/resources/dns/records';

export interface ListZonesOptions {
  page?: number;
  per_page?: number;
  order?: 'name' | 'status' | 'account.id' | 'account.name';
  direction?: 'asc' | 'desc';
  match?: 'all' | 'any';
  name?: string;
  account?: {
    id?: string;
    name?: string;
  };
  status?: Zone['status'];
}

export interface ListDnsRecordsOptions {
  type?: string;
  name?: string;
  content?: string;
  page?: number;
  per_page?: number;
  order?: string;
  direction?: 'asc' | 'desc';
  match?: 'all' | 'any';
}

/**
 * List all DNS zones
 * @param options - Filter and pagination options
 * @returns Promise resolving to zones list or null if client unavailable
 */
export async function listZones(options?: ListZonesOptions): Promise<Zone[] | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.listZones(options);
    if (response.success && Array.isArray(response.result)) {
      return response.result as Zone[];
    }
    console.warn('[Kuratchi Domains] Failed to list zones:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error listing zones:', error);
    return null;
  }
}

/**
 * Get zone details by zone ID
 * @param zoneId - Zone identifier
 * @returns Promise resolving to zone details or null
 */
export async function getZone(zoneId: string): Promise<Zone | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.getZone(zoneId);
    if (response.success && response.result) {
      return response.result as Zone;
    }
    console.warn('[Kuratchi Domains] Failed to get zone:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error getting zone:', error);
    return null;
  }
}

/**
 * Find zone by domain name
 * @param name - Domain name (e.g., 'example.com')
 * @returns Promise resolving to zone or null if not found
 */
export async function findZoneByName(name: string): Promise<Zone | null> {
  const zones = await listZones({ name, per_page: 1 });
  return zones && zones.length > 0 ? zones[0] : null;
}

/**
 * Create a new DNS zone
 * @param name - Domain name (e.g., 'example.com')
 * @returns Promise resolving to created zone or null
 */
export async function createZone(name: string): Promise<Zone | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.createZone(name);
    if (response.success && response.result) {
      return response.result as Zone;
    }
    console.warn('[Kuratchi Domains] Failed to create zone:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error creating zone:', error);
    return null;
  }
}

/**
 * Delete a DNS zone
 * @param zoneId - Zone identifier
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function deleteZone(zoneId: string): Promise<boolean> {
  const client = safeGetClient();
  if (!client) return false;
  
  try {
    const response = await client.deleteZone(zoneId);
    if (response.success) {
      return true;
    }
    console.warn('[Kuratchi Domains] Failed to delete zone:', response.errors);
    return false;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error deleting zone:', error);
    return false;
  }
}

/**
 * Pause/disable a DNS zone
 * @param zoneId - Zone identifier
 * @returns Promise resolving to updated zone or null
 */
export async function pauseZone(zoneId: string): Promise<Zone | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.pauseZone(zoneId);
    if (response.success && response.result) {
      return response.result as Zone;
    }
    console.warn('[Kuratchi Domains] Failed to pause zone:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error pausing zone:', error);
    return null;
  }
}

/**
 * Unpause/enable a DNS zone
 * @param zoneId - Zone identifier
 * @returns Promise resolving to updated zone or null
 */
export async function unpauseZone(zoneId: string): Promise<Zone | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.unpauseZone(zoneId);
    if (response.success && response.result) {
      return response.result as Zone;
    }
    console.warn('[Kuratchi Domains] Failed to unpause zone:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error unpausing zone:', error);
    return null;
  }
}

/**
 * Purge zone cache
 * @param zoneId - Zone identifier
 * @param options - Cache purge options
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function purgeZoneCache(
  zoneId: string, 
  options?: { 
    purge_everything?: boolean; 
    files?: string[]; 
    tags?: string[]; 
    hosts?: string[]; 
    prefixes?: string[] 
  }
): Promise<boolean> {
  const client = safeGetClient();
  if (!client) return false;
  
  try {
    const response = await client.purgeZoneCache(zoneId, options);
    if (response.success) {
      return true;
    }
    console.warn('[Kuratchi Domains] Failed to purge cache:', response.errors);
    return false;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error purging cache:', error);
    return false;
  }
}

// ===== DNS Records Management =====

/**
 * List DNS records for a zone
 * @param zoneId - Zone identifier
 * @param options - Filter and pagination options
 * @returns Promise resolving to DNS records list or null
 */
export async function listDnsRecords(zoneId: string, options?: ListDnsRecordsOptions): Promise<DnsRecord[] | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.listDnsRecords(zoneId, options);
    if (response.success && Array.isArray(response.result)) {
      return response.result as DnsRecord[];
    }
    console.warn('[Kuratchi Domains] Failed to list DNS records:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error listing DNS records:', error);
    return null;
  }
}

/**
 * Create a DNS record
 * @param zoneId - Zone identifier
 * @param record - DNS record data
 * @returns Promise resolving to created record or null
 */
export async function createDnsRecord(zoneId: string, record: DnsRecordCreateParams): Promise<DnsRecord | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.createDnsRecord(zoneId, record);
    if (response.success && response.result) {
      return response.result as DnsRecord;
    }
    console.warn('[Kuratchi Domains] Failed to create DNS record:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error creating DNS record:', error);
    return null;
  }
}

/**
 * Update a DNS record
 * @param zoneId - Zone identifier
 * @param recordId - DNS record identifier
 * @param record - Updated DNS record data
 * @returns Promise resolving to updated record or null
 */
export async function updateDnsRecord(zoneId: string, recordId: string, record: DnsRecordUpdateParams): Promise<DnsRecord | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.updateDnsRecord(zoneId, recordId, record);
    if (response.success && response.result) {
      return response.result as DnsRecord;
    }
    console.warn('[Kuratchi Domains] Failed to update DNS record:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error updating DNS record:', error);
    return null;
  }
}

/**
 * Delete a DNS record
 * @param zoneId - Zone identifier
 * @param recordId - DNS record identifier
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function deleteDnsRecord(zoneId: string, recordId: string): Promise<boolean> {
  const client = safeGetClient();
  if (!client) return false;
  
  try {
    const response = await client.deleteDnsRecord(zoneId, recordId);
    if (response.success) {
      return true;
    }
    console.warn('[Kuratchi Domains] Failed to delete DNS record:', response.errors);
    return false;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error deleting DNS record:', error);
    return false;
  }
}

// ===== Zone Settings =====

/**
 * Get zone settings
 * @param zoneId - Zone identifier
 * @returns Promise resolving to zone settings or null
 */
export async function getZoneSettings(zoneId: string): Promise<any | null> {
  const client = safeGetClient();
  if (!client) return null;
  
  try {
    const response = await client.getZoneSettings(zoneId);
    if (response.success && response.result) {
      return response.result;
    }
    console.warn('[Kuratchi Domains] Failed to get zone settings:', response.errors);
    return null;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error getting zone settings:', error);
    return null;
  }
}

/**
 * Update a zone setting
 * @param zoneId - Zone identifier
 * @param setting - Setting name (e.g., 'ssl', 'security_level')
 * @param value - New setting value
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function updateZoneSetting(zoneId: string, setting: string, value: any): Promise<boolean> {
  const client = safeGetClient();
  if (!client) return false;
  
  try {
    const response = await client.updateZoneSetting(zoneId, setting, value);
    if (response.success) {
      return true;
    }
    console.warn('[Kuratchi Domains] Failed to update zone setting:', response.errors);
    return false;
  } catch (error) {
    console.warn('[Kuratchi Domains] Error updating zone setting:', error);
    return false;
  }
}