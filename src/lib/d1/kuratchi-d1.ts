import { KuratchiHttpClient as InternalKuratchi } from './internal-http-client.js';
import { CloudflareClient, type PrimaryLocationHint } from '../cloudflare.js';
import { DEFAULT_WORKER_SCRIPT } from './worker-template.js';
import type { DatabaseSchema } from '../orm/json-schema.js';
import {
  createClientFromJsonSchema,
  createTypedClientFromMapping,
  type TableApi,
  type TableApiTyped,
} from '../orm/kuratchi-orm.js';
import type { MigrationJournal } from '../orm/index.js';
import type {
  User as AdminUser,
  Session as AdminSession,
  PasswordResetToken as AdminPasswordResetToken,
  MagicLinkToken as AdminMagicLinkToken,
  OAuthAccount as AdminOAuthAccount,
  OrganizationUser as AdminOrganizationUser,
  Organization as AdminOrganization,
  Activity as AdminActivity,
  Database as AdminDatabase,
  DBApiToken as AdminDBApiToken,
  EmailVerificationToken as AdminEmailVerificationToken,
} from '../schema/admin.js';
import type {
  User as OrgUser,
  Session as OrgSession,
  PasswordResetToken as OrgPasswordResetToken,
  EmailVerificationToken as OrgEmailVerificationToken,
  MagicLinkToken as OrgMagicLinkToken,
  OAuthAccount as OrgOAuthAccount,
  Activity as OrgActivity,
  Role as OrgRole,
} from '../schema/organization.js';

export type { PrimaryLocationHint } from '../cloudflare.js';

export interface D1Options {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
}

// Runtime-agnostic migration types
export type MigrationBundle = {
  journal: MigrationJournal;
  migrations: Record<string, string | (() => Promise<string>)>;
};

export class KuratchiD1 {
  private cf: CloudflareClient;
  private workersSubdomain: string;

  constructor(config: D1Options) {
    this.cf = new CloudflareClient({
      apiToken: config.apiToken,
      accountId: config.accountId,
      endpointBase: config.endpointBase,
    });
    this.workersSubdomain = config.workersSubdomain;
    // Hide internal client from logs
    try {
      Object.defineProperty(this, 'cf', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  async createDatabase(databaseName: string, options: { location?: PrimaryLocationHint } = {}) {
    const { database, apiToken } = await this.provisionDatabase(databaseName, {
      location: options.location,
    });
    // Best-effort: wait for the worker HTTP endpoint to become responsive
    try {
      const workerName = (database as any)?.name || databaseName;
      await this.waitForWorkerEndpoint(workerName, apiToken);
    } catch {
      // Non-fatal; migrations may still succeed shortly after
    }
    return { database, apiToken };
  }

  async deleteDatabase(databaseId: string) {
    await this.cf.deleteDatabase(databaseId);
  }

  getClient(cfg: { databaseName: string; apiToken: string; bookmark?: string }) {
    const client = new InternalKuratchi({
      databaseName: cfg.databaseName,
      workersSubdomain: this.workersSubdomain,
      apiToken: cfg.apiToken,
    });
    if (cfg.bookmark) (client as any).setSessionBookmark?.(cfg.bookmark);
    return client;
  }

  getDrizzleClient(cfg: { databaseName: string; apiToken: string; bookmark?: string }) {
    return this.getClient(cfg).getDrizzleProxy();
  }

  // Top-level sugar: create a property-based client; schema is required
  client(cfg: { databaseName: string; apiToken: string; bookmark?: string }, options: { schema: 'admin' }): AdminTypedClient;
  client(cfg: { databaseName: string; apiToken: string; bookmark?: string }, options: { schema: 'organization' }): OrganizationTypedClient;
  client(cfg: { databaseName: string; apiToken: string; bookmark?: string }, options: { schema: DatabaseSchema }): Record<string, TableApi>;
  client(
    cfg: { databaseName: string; apiToken: string; bookmark?: string },
    options: { schema: DatabaseSchema | 'admin' | 'organization' }
  ): any {
    const exec = (sql: string, params?: any[]) => this.getClient(cfg).query(sql, params);
    if (!options?.schema) {
      throw new Error('KuratchiD1.client requires a schema: "admin", "organization", or DatabaseSchema');
    }
    if (options.schema === 'admin') return createAdminClient(exec);
    if (options.schema === 'organization') return createOrganizationClient(exec);
    return createClientFromJsonSchema(exec, options.schema);
  }

  database(cfg: { databaseName: string; apiToken: string; bookmark?: string }) {
    return {
      query: <T>(sql: string, params: any[] = []) => this.getClient(cfg).query<T>(sql, params),
      drizzleProxy: () => this.getDrizzleClient(cfg),
      migrate: (dirName: string) => this.migrateVite(cfg, dirName),
      getClient: () => this.getClient(cfg),
      client: (
        options: { schema: DatabaseSchema | 'admin' | 'organization' }
      ): Record<string, TableApi> | AdminTypedClient | OrganizationTypedClient => {
        const exec = (sql: string, params?: any[]) => this.getClient(cfg).query(sql, params);
        if (!options?.schema) {
          throw new Error('KuratchiD1.database().client requires a schema: "admin", "organization", or DatabaseSchema');
        }
        if (options.schema === 'admin') return createAdminClient(exec);
        if (options.schema === 'organization') return createOrganizationClient(exec);
        return createClientFromJsonSchema(exec, options.schema);
      },
    };
  }

  private async applyBundle(
    cfg: { databaseName: string; apiToken: string },
    bundle: { journal: { entries: any[] }, migrations: Record<string, string | (() => Promise<string>)> }
  ) {
    const client = this.getClient(cfg);
    const normalized: Record<string, any> = {};
    for (const [k, v] of Object.entries(bundle.migrations)) {
      normalized[k] = v as any;
    }
    return client.migrate({ journal: bundle.journal, migrations: normalized as any });
  }

  private async migrateVite(
    cfg: { databaseName: string; apiToken: string },
    dirName: string
  ) {
    try {
      const mod = await import('../orm/loader.js');
      const loadMigrations = (mod as any).loadMigrations as (d: string) => Promise<{
        journal: MigrationJournal;
        migrations: Record<string, () => Promise<string>>;
      }>;
      if (typeof loadMigrations !== 'function') {
        throw new Error('loadMigrations() not found in ORM loader module');
      }
      const bundle = await loadMigrations(dirName);
      return this.applyBundle(cfg, bundle);
    } catch (err: any) {
      const hint = 'This method requires a Vite environment with import.meta.glob support.';
      err.message = `${err.message}\n${hint}`;
      throw err;
    }
  }

  // Ensure Worker endpoint is reachable before attempting migrations
  private async waitForWorkerEndpoint(databaseName: string, apiToken: string) {
    const client = this.getClient({ databaseName, apiToken });
    const deadline = Date.now() + 30_000; // up to 30s
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    while (true) {
      try {
        const res: any = await client.query('SELECT 1');
        // makeRequest returns { success: false, error } on non-2xx; otherwise returns JSON payload
        if (!res || res.success === false) {
          if (Date.now() > deadline) break;
          await sleep(500);
          continue;
        }
        return true;
      } catch {
        if (Date.now() > deadline) break;
        await sleep(500);
      }
    }
    return false;
  }

  /**
   * Creates a Cloudflare D1 database, generates an API token, and deploys a Worker
   * bound to that database with the token injected as a secret binding.
   * If no workerScript is provided, uses the SDK's DEFAULT_WORKER_SCRIPT.
   */
  private async provisionDatabase(
    databaseName: string,
    options: { workerScript?: string; location?: PrimaryLocationHint } = {}
  ): Promise<{ database: any; apiToken: string }> {
    const { workerScript, location } = options;

    const databaseResp = await this.cf.createDatabase(databaseName, location);
    const database = (databaseResp as any)?.result ?? databaseResp; // Support both wrapped and raw responses
    if (!database || !database.uuid) {
      throw new Error('Failed to create database in Cloudflare');
    }

    // Ensure read replication is enabled so session bookmarks are supported
    try {
      await this.cf.enableReadReplication(database.uuid);
    } catch {
      // Non-fatal; continue provisioning even if this fails
    }

    const apiToken = crypto.randomUUID();

    const bindings = [
      { type: 'd1', name: 'DB', id: database.uuid },
      { type: 'secret_text', name: 'API_KEY', text: apiToken },
    ];

    const scriptToUpload = workerScript || DEFAULT_WORKER_SCRIPT;
    await this.cf.uploadWorkerModule(databaseName, scriptToUpload, bindings as any);
    await this.cf.enableWorkerSubdomain(databaseName);

    // Poll for readiness instead of fixed timeout
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const deadline = Date.now() + 20_000; // 20s max

    // Ensure database is queryable via API (GET by id succeeds)
    while (true) {
      try {
        await this.cf.getDatabase(database.uuid);
        break;
      } catch {
        if (Date.now() > deadline) break;
        await sleep(500);
      }
    }

    // Ensure worker script is visible via API (GET script succeeds)
    while (true) {
      try {
        await this.cf.getWorkerScript(databaseName);
        break;
      } catch {
        if (Date.now() > deadline) break;
        await sleep(500);
      }
    }

    return { database, apiToken };
  }

  // Redact internals on logs
  toJSON() {
    return {
      database: '[api]',
      migrate: '[api]'
    } as any;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toJSON();
  }
}

// ---- Typed clients for known schemas ----
type AdminRowMap = {
  users: AdminUser;
  session: AdminSession;
  passwordResetTokens: AdminPasswordResetToken;
  magicLinkTokens: AdminMagicLinkToken;
  emailVerificationToken: AdminEmailVerificationToken;
  oauthAccounts: AdminOAuthAccount;
  organizationUsers: AdminOrganizationUser;
  organizations: AdminOrganization;
  activity: AdminActivity;
  databases: AdminDatabase;
  dbApiTokens: AdminDBApiToken;
};

type OrganizationRowMap = {
  users: OrgUser;
  session: OrgSession;
  passwordResetTokens: OrgPasswordResetToken;
  emailVerificationToken: OrgEmailVerificationToken;
  magicLinkTokens: OrgMagicLinkToken;
  activity: OrgActivity;
  roles: OrgRole;
  oauthAccounts: OrgOAuthAccount;
};

export type AdminTypedClient = { [K in keyof AdminRowMap]: TableApiTyped<AdminRowMap[K]> };
export type OrganizationTypedClient = { [K in keyof OrganizationRowMap]: TableApiTyped<OrganizationRowMap[K]> };

function createAdminClient(exec: (sql: string, params?: any[]) => Promise<any>): AdminTypedClient {
  const mapping = {
    users: 'users',
    session: 'session',
    passwordResetTokens: 'passwordResetTokens',
    magicLinkTokens: 'magicLinkTokens',
    emailVerificationToken: 'emailVerificationToken',
    oauthAccounts: 'oauthAccounts',
    organizationUsers: 'organizationUsers',
    organizations: 'organizations',
    activity: 'activity',
    databases: 'databases',
    dbApiTokens: 'dbApiTokens',
  } as const;
  return createTypedClientFromMapping<AdminRowMap>(exec, mapping as any);
}

function createOrganizationClient(exec: (sql: string, params?: any[]) => Promise<any>): OrganizationTypedClient {
  const mapping = {
    users: 'users',
    session: 'session',
    passwordResetTokens: 'passwordResetTokens',
    emailVerificationToken: 'emailVerificationToken',
    magicLinkTokens: 'magicLinkTokens',
    activity: 'activity',
    roles: 'roles',
    oauthAccounts: 'oauthAccounts',
  } as const;
  return createTypedClientFromMapping<OrganizationRowMap>(exec, mapping as any);
}
