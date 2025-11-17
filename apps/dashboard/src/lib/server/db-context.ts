/**
 * Database Context Helper
 * 
 * Architecture:
 * - Platform Superadmin: Has organizationId set to their "active org" (can switch between customer orgs)
 * - Customer Admin: Has organizationId set to their org (which IS their admin DB)
 * - Customer User: Has organizationId set to their org
 * 
 * The SDK's organizationPlugin already handles routing based on session.organizationId,
 * so we just use orgDatabaseClient() for everything except platform-only operations.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { database } from 'kuratchi-sdk';
import { env } from '$env/dynamic/private';
import { sitesSchema } from '$lib/schemas/sites';

/**
 * Get the database for the current user
 * - If no orgId provided: Returns admin DB for superadmins, org DB for regular users
 * - If orgId provided: Returns that specific organization's database
 */
export async function getDatabase(locals: RequestEvent['locals'], orgId?: string) {
  // If orgId specified, get that specific org's database
  if (orgId) {
    const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.(orgId);
    if (!orgDb) {
      error(500, `Organization database not available for org: ${orgId}`);
    }
    return orgDb;
  }
  
  // Check if user is superadmin
  const isSuperadmin = locals.kuratchi?.superadmin?.isSuperadmin?.();
  
  // Superadmins get admin DB by default (unless they have an active org override)
  if (isSuperadmin) {
    const activeOrgId = locals.kuratchi?.superadmin?.getActiveOrgId?.();
    
    // If superadmin has an active org, use that org's DB
    if (activeOrgId) {
      const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.(activeOrgId);
      if (!orgDb) {
        error(500, 'Organization database not available');
      }
      return orgDb;
    }
    
    // Otherwise use admin DB
    const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
    if (!adminDb) {
      error(500, 'Admin database not available');
    }
    return adminDb;
  }
  
  // Regular users get their org DB
  const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.();
  if (!orgDb) {
    error(500, 'Organization database not available. User must belong to an organization.');
  }
  
  return orgDb;
}

/**
 * Get admin database access (for normal operations that need admin DB)
 * This is used for storing site metadata, database records, etc.
 */
export async function getAdminDatabase(locals: RequestEvent['locals']) {
  const adminDb = await locals.kuratchi?.getAdminDb?.();
  if (!adminDb) {
    error(500, 'Admin database not available');
  }
  
  return adminDb;
}

/**
 * Get admin database with superadmin check (for explicit superadmin-only operations)
 * Use this for operations that should only be accessible to superadmins
 */
export async function getSuperadminDatabase(locals: RequestEvent['locals']) {
  const isSuperadmin = locals.kuratchi?.superadmin?.isSuperadmin?.();
  
  if (!isSuperadmin) {
    error(403, 'Superadmin access required');
  }
  
  const adminDb = await locals.kuratchi?.getAdminDb?.();
  if (!adminDb) {
    error(500, 'Admin database not available');
  }
  
  return adminDb;
}

/**
 * Force organization database access
 */
export async function getOrganizationDatabase(locals: RequestEvent['locals'], orgIdOverride?: string) {
  const orgDb = await (locals.kuratchi as any)?.orgDatabaseClient?.(orgIdOverride);
  if (!orgDb) {
    error(500, 'Organization database not available');
  }
  
  return orgDb;
}

export interface SiteDatabaseContext {
  site: {
    id: string;
    name: string | null;
    subdomain: string | null;
    description: string | null;
    databaseId: string | null;
    dbuuid: string | null;
    workerName: string | null;
    metadata: Record<string, unknown> | null;
  };
  siteDb: Awaited<ReturnType<ReturnType<typeof database.instance>['ormClient']>>;
}

/**
 * Resolve a site-specific database client (typed ORM)
 */
export async function getSiteDatabase(
  locals: RequestEvent['locals'],
  siteId: string,
  options?: { skipMigrations?: boolean }
): Promise<SiteDatabaseContext> {
  const orgDb = await getDatabase(locals);
  const siteResult = await orgDb.sites
    .where({ id: siteId, deleted_at: { isNullish: true } })
    .one();

  if (!siteResult.success || !siteResult.data) {
    error(404, 'Site not found');
  }

  const site = siteResult.data as SiteDatabaseContext['site'];

  if (!site.databaseId) {
    error(500, 'Site database reference missing');
  }

  const adminDb = await (locals.kuratchi as any)?.getAdminDb?.();
  if (!adminDb) {
    error(500, 'Admin database not available');
  }

  const dbRecordResult = await adminDb.databases
    .where({ id: site.databaseId, deleted_at: { isNullish: true } })
    .first();

  if (!dbRecordResult.success || !dbRecordResult.data) {
    error(500, 'Site database record not found');
  }

  const dbRecord = dbRecordResult.data as {
    name: string | null;
    workerName: string | null;
    dbuuid: string | null;
  };

  const tokenResult = await adminDb.dbApiTokens
    .where({
      databaseId: site.databaseId,
      revoked: false,
      deleted_at: { isNullish: true }
    })
    .first();

  if (!tokenResult.success || !tokenResult.data) {
    error(500, 'Site database token not found');
  }

  const databaseName = dbRecord?.name || dbRecord?.dbuuid || site.dbuuid || site.databaseId;
  const scriptName = dbRecord?.workerName || site.workerName || undefined;
  if (!databaseName) {
    error(500, 'Site database name unavailable');
  }

  const gatewayKey = env.KURATCHI_GATEWAY_KEY;
  if (!gatewayKey) {
    error(500, 'KURATCHI_GATEWAY_KEY not configured');
  }

  const instance = database.instance();
  const siteDb = await instance.ormClient({
    databaseName,
    dbToken: tokenResult.data.token,
    gatewayKey,
    schema: sitesSchema,
    scriptName,
    skipMigrations: options?.skipMigrations
  });

  return { site, siteDb };
}
