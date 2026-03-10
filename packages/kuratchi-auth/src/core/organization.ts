/**
 * @kuratchi/auth â€” Organization API
 *
 * Multi-tenant DO-backed database orchestrator.
 * Manages the DO namespace binding and provides stub access.
 *
 * The DO exposes explicit RPC methods (createUser, getUserByEmail,
 * createSession, getSession, deleteSession) that use the ORM
 * internally. No proxy needed â€” credentials.ts calls them directly.
 *
 * Configuration lives in `auth.organizations` in kuratchi.config.ts:
 * ```ts
 * organizations: {
 *   binding: 'ORG_DB',
 * }
 * ```
 *
 * @example
 * ```ts
 * import { getOrgClient, getOrgStubByName } from '@kuratchi/auth';
 *
 * // Get stub by DO name (from session cookie or admin lookup)
 * const stub = getOrgStubByName(doName);
 * const user = await stub.getUserByEmail('user@example.com');
 *
 * // Get stub by org ID (resolves via admin DB)
 * const stub = await getOrgClient(organizationId);
 * const sites = await stub.query({ table: 'sites', method: 'many', args: [{}] });
 * ```
 */

import { env } from 'cloudflare:workers';
import { kuratchiORM } from '@kuratchi/orm';
import { getAuthDbBinding } from './config.js';

// ============================================================================
// Types
// ============================================================================

export interface OrganizationConfig {
  /** DO namespace binding name in env (e.g. 'ORG_DB') */
  binding: string;
}

export interface OrgDatabaseInfo {
  databaseName: string;
  organizationId: string;
}

// ============================================================================
// Module state
// ============================================================================

let _config: OrganizationConfig | null = null;

/**
 * Configure organization multi-tenancy. Called by the compiler.
 */
export function configureOrganization(config: OrganizationConfig): void {
  _config = config;
}

// ============================================================================
// Framework context
// ============================================================================

function _getEnv(): Record<string, any> {
  return env as unknown as Record<string, any>;
}

function _getDoNamespace(): any {
  if (!_config) return null;
  const env = _getEnv();
  return env[_config.binding] || null;
}

function _getAdminDb(): Record<string, any> {
  return kuratchiORM(() => {
    const env = _getEnv();
    const bindingName = getAuthDbBinding();
    const binding = env[bindingName];
    if (!binding) throw new Error(`[kuratchi/auth] No ${bindingName} binding found.`);
    return binding;
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get a DO stub by its DO name (for direct RPC calls).
 * The stub exposes the OrganizationDO's RPC methods:
 *   stub.createUser(), stub.getUserByEmail(), stub.createSession(),
 *   stub.getSession(), stub.deleteSession(), stub.query()
 */
export function getOrgStubByName(doName: string): any | null {
  const doNamespace = _getDoNamespace();
  if (!doNamespace) return null;
  const doId = doNamespace.idFromName(doName);
  return doNamespace.get(doId);
}

/**
 * Resolve the DO name for an organization by its ID.
 * Looks up the `organizations` table in the admin D1 via ORM.
 */
export async function resolveOrgDatabaseName(organizationId: string): Promise<string | null> {
  try {
    const adminDb = _getAdminDb();
    const result = await adminDb.organizations.where({ id: organizationId }).first();
    return result.data?.doName || null;
  } catch {
    return null;
  }
}

/**
 * Get a DO stub for an organization by its organization ID.
 * Resolves the DO name from admin D1, then returns the stub.
 */
export async function getOrgClient(organizationId: string): Promise<any | null> {
  const doName = await resolveOrgDatabaseName(organizationId);
  if (!doName) {
    console.warn(`[kuratchi/auth organization] No database found for org: ${organizationId}`);
    return null;
  }
  return getOrgStubByName(doName);
}

/**
 * Create a new organization database (DO provisioning).
 * Returns the generated database name.
 */
export async function createOrgDatabase(params: {
  organizationId: string;
  organizationName: string;
}): Promise<{ databaseName: string }> {
  const doNamespace = _getDoNamespace();
  if (!doNamespace) {
    throw new Error('[kuratchi/auth organization] DO namespace not available');
  }

  const sanitizedName = params.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 32);
  const databaseName = `org-${sanitizedName}-${crypto.randomUUID().substring(0, 8)}`;

  // Touch the DO to provision it (constructor runs initDO â†’ creates tables)
  const doId = doNamespace.idFromName(databaseName);
  doNamespace.get(doId);

  return { databaseName };
}

/**
 * Get database info for an organization.
 */
export async function getOrgDatabaseInfo(organizationId: string): Promise<OrgDatabaseInfo | null> {
  const databaseName = await resolveOrgDatabaseName(organizationId);
  if (!databaseName) return null;
  return { databaseName, organizationId };
}

/**
 * Check if the organizations plugin is configured and DO namespace is available.
 */
export function isOrgAvailable(): boolean {
  return !!_getDoNamespace();
}



