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

/**
 * Get the database for the current user
 * - If no orgId provided: Returns admin DB for superadmins, org DB for regular users
 * - If orgId provided: Returns that specific organization's database
 */
export async function getDatabase(locals: RequestEvent['locals'], orgId?: string) {
  // If orgId specified, get that specific org's database
  if (orgId) {
    const orgDb = await locals.kuratchi?.orgDatabaseClient?.(orgId);
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
      const orgDb = await locals.kuratchi?.orgDatabaseClient?.(activeOrgId);
      if (!orgDb) {
        error(500, 'Organization database not available');
      }
      return orgDb;
    }
    
    // Otherwise use admin DB
    const adminDb = await locals.kuratchi?.getAdminDb?.();
    if (!adminDb) {
      error(500, 'Admin database not available');
    }
    return adminDb;
  }
  
  // Regular users get their org DB
  const orgDb = await locals.kuratchi?.orgDatabaseClient?.();
  if (!orgDb) {
    error(500, 'Organization database not available. User must belong to an organization.');
  }
  
  return orgDb;
}

/**
 * Force admin database access (for superadmin-only operations)
 */
export async function getAdminDatabase(locals: RequestEvent['locals']) {
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
  const orgDb = await locals.kuratchi?.orgDatabaseClient?.(orgIdOverride);
  if (!orgDb) {
    error(500, 'Organization database not available');
  }
  
  return orgDb;
}
