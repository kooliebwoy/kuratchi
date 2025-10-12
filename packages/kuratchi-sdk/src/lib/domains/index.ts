/**
 * Kuratchi Domains - Full DNS zone management for Cloudflare
 * 
 * This module provides comprehensive DNS management capabilities through
 * Cloudflare's API, leveraging the existing CloudflareClient infrastructure.
 * 
 * @example
 * ```typescript
 * import { domains } from 'kuratchi-sdk';
 * 
 * // Create a new zone
 * const zone = await domains.zones.createZone('example.com');
 * 
 * // List all zones
 * const zones = await domains.zones.listZones();
 * 
 * // Add DNS records
 * await domains.zones.createDnsRecord(zone.id, {
 *   type: 'A',
 *   name: 'www',
 *   content: '192.0.2.1'
 * });
 * ```
 * 
 * Required Environment Variables:
 * - CF_API_TOKEN or CLOUDFLARE_API_TOKEN: Your Cloudflare API token
 * - CF_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID: Your Cloudflare account ID
 */

// Re-export all zones functionality
export * from './zones.js';

// Export client utilities (for advanced usage)
export { getCloudflareClient, resetClient } from './client.js';

// Convenience namespace for organized access
import * as zones from './zones.js';

export { zones };

/**
 * Main domains namespace export
 */
export const domains = {
  zones,
  // Future modules can be added here (e.g., ssl, settings, analytics)
};

// Re-export types for better developer experience
export type {
  Zone,
  DnsRecord,
  ListZonesOptions,
  ListDnsRecordsOptions,
  CreateDnsRecordOptions
} from './zones.js';