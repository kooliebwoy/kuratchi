import { getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { getDatabase } from '$lib/server/db-context';
import { getAnalyticsForHostname, type AnalyticsResult } from '$lib/server/analytics';

// Helpers
const guardedQuery = <R>(fn: () => Promise<R>) => {
  return query(async () => {
    const { locals: { session } } = getRequestEvent();
    if (!session?.user) error(401, 'Unauthorized');
    return fn();
  });
};

// ============== QUERIES ==============

/**
 * Get analytics data for a specific site
 * Uses zone-level Cloudflare Web Analytics and filters by hostname
 */
export const getAnalyticsData = guardedQuery(async (): Promise<AnalyticsResult> => {
  const { url, locals } = getRequestEvent();
  const siteId = url.searchParams.get('siteId');
  const period = (url.searchParams.get('period') || '7d') as '1d' | '7d' | '30d' | '90d';
  
  if (!siteId) {
    return { error: 'Site ID required' };
  }

  const db = await getDatabase(locals);
  if (!db) return { error: 'Database not available' };

  const siteResult = await db.sites.where({ id: siteId }).one();
  if (!siteResult.success || !siteResult.data) return { error: 'Site not found' };

  const site = siteResult.data;
  
  // Build the hostname for this site
  const hostname = site.subdomain ? `${site.subdomain}.kuratchi.site` : null;
  if (!hostname) {
    return { error: 'Site has no subdomain configured' };
  }

  // Use the server utility to fetch analytics
  return getAnalyticsForHostname(hostname, period);
});

// Note: Per-site provisioning removed.
// Analytics uses zone-level Cloudflare Web Analytics with hostname filtering.
// Set CF_ANALYTICS_ZONE_TAG environment variable to your zone's Web Analytics site tag.
