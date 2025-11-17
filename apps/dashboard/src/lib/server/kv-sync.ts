/**
 * KV Sync Utilities
 * Helper functions to sync site data to Cloudflare KV for fast lookups
 */

import type { RequestEvent } from '@sveltejs/kit';

export interface SiteKVMapping {
  siteId: string;
  orgId: string;
  databaseId: string;
  dbuuid: string | null;
  workerName: string | null;
}

/**
 * Sync a site's subdomain to KV
 */
export async function syncSiteSubdomainToKV(
  locals: RequestEvent['locals'],
  subdomain: string,
  mapping: SiteKVMapping
): Promise<boolean> {
  try {
    const kv = (locals.kuratchi as any)?.kv?.default;
    if (!kv) {
      console.error('[kv-sync] KV not available');
      return false;
    }

    const kvKey = `site:subdomain:${subdomain}`;
    await kv.put(kvKey, JSON.stringify(mapping));
    console.log('[kv-sync] Synced subdomain to KV:', subdomain);
    return true;
  } catch (err) {
    console.error('[kv-sync] Error syncing subdomain to KV:', err);
    return false;
  }
}

/**
 * Sync a custom domain to KV
 */
export async function syncCustomDomainToKV(
  locals: RequestEvent['locals'],
  domain: string,
  mapping: SiteKVMapping
): Promise<boolean> {
  try {
    const kv = (locals.kuratchi as any)?.kv?.default;
    if (!kv) {
      console.error('[kv-sync] KV not available');
      return false;
    }

    const kvKey = `site:domain:${domain}`;
    await kv.put(kvKey, JSON.stringify(mapping));
    console.log('[kv-sync] Synced custom domain to KV:', domain);
    return true;
  } catch (err) {
    console.error('[kv-sync] Error syncing custom domain to KV:', err);
    return false;
  }
}

/**
 * Remove a custom domain from KV
 */
export async function removeCustomDomainFromKV(
  locals: RequestEvent['locals'],
  domain: string
): Promise<boolean> {
  try {
    const kv = (locals.kuratchi as any)?.kv?.default;
    if (!kv) {
      console.error('[kv-sync] KV not available');
      return false;
    }

    const kvKey = `site:domain:${domain}`;
    await kv.delete(kvKey);
    console.log('[kv-sync] Removed custom domain from KV:', domain);
    return true;
  } catch (err) {
    console.error('[kv-sync] Error removing custom domain from KV:', err);
    return false;
  }
}

/**
 * Sync all verified custom domains for a site to KV
 */
export async function syncSiteCustomDomainsToKV(
  locals: RequestEvent['locals'],
  siteId: string
): Promise<boolean> {
  try {
    const db = await (locals.kuratchi as any)?.orgDatabaseClient?.();
    if (!db) {
      console.error('[kv-sync] Database not available');
      return false;
    }

    // Get site info
    const site = await db.query.sites.findFirst({
      where: (fields: any, { eq }: any) => eq(fields.id, siteId)
    });

    if (!site) {
      console.error('[kv-sync] Site not found:', siteId);
      return false;
    }

    // Get verified custom domains
    const domains = await db.query.siteCustomDomains.findMany({
      where: (fields: any, { eq, and }: any) => and(
        eq(fields.siteId, siteId),
        eq(fields.verified, true)
      )
    });

    if (!domains || domains.length === 0) {
      console.log('[kv-sync] No verified custom domains to sync for site:', siteId);
      return true;
    }

    // Get admin DB to fetch database info
    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    if (!adminDb) {
      console.error('[kv-sync] Admin database not available');
      return false;
    }

    const dbRecord = await adminDb.databases
      .where({ id: site.databaseId, deleted_at: { isNullish: true } })
      .first();

    if (!dbRecord.success || !dbRecord.data) {
      console.error('[kv-sync] Database record not found');
      return false;
    }

    const mapping: SiteKVMapping = {
      siteId: site.id,
      orgId: (locals.session as any)?.organizationId,
      databaseId: site.databaseId,
      dbuuid: dbRecord.data.dbuuid,
      workerName: dbRecord.data.workerName
    };

    // Sync each verified domain
    for (const domain of domains) {
      await syncCustomDomainToKV(locals, domain.domain, mapping);
    }

    console.log('[kv-sync] Synced', domains.length, 'custom domains for site:', siteId);
    return true;
  } catch (err) {
    console.error('[kv-sync] Error syncing site custom domains:', err);
    return false;
  }
}
