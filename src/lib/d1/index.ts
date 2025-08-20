import { KuratchiHttpClient as InternalKuratchi } from './internal-http-client.js';
import { KuratchiProvisioner } from './provisioner.js';
import type { PrimaryLocationHint } from '../cloudflare.js';

export type { PrimaryLocationHint } from '../cloudflare.js';

export interface D1Options {
  apiToken: string;
  accountId: string;
  endpointBase?: string;
  workersSubdomain: string;
}

// Runtime-agnostic migration types
export type MigrationJournal = { entries: { idx: number; tag: string }[] };
export type MigrationBundle = {
  journal: MigrationJournal;
  migrations: Record<string, string | (() => Promise<string>)>;
};
export interface MigrationLoader {
  loadJournal(dir: string): Promise<MigrationJournal>;
  loadSql(dir: string, tag: string): Promise<string>;
}

export class KuratchiD1 {
  private provisioner: KuratchiProvisioner;
  private workersSubdomain: string;

  constructor(config: D1Options) {
    this.provisioner = KuratchiProvisioner.getInstance({
      apiToken: config.apiToken,
      accountId: config.accountId,
      endpointBase: config.endpointBase,
    });
    this.workersSubdomain = config.workersSubdomain;
  }

  async createDatabase(databaseName: string, options: { location?: PrimaryLocationHint } = {}) {
    const { database, apiToken } = await this.provisioner.provisionDatabase(databaseName, {
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
    await this.provisioner.deleteDatabase(databaseId);
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

  database(cfg: { databaseName: string; apiToken: string; bookmark?: string }) {
    return {
      query: <T>(sql: string, params: any[] = []) => this.getClient(cfg).query<T>(sql, params),
      drizzleProxy: () => this.getDrizzleClient(cfg),
      migrate: (bundle: { journal: MigrationJournal; migrations: Record<string, () => Promise<string>> }) =>
        this.migrate(cfg, bundle),
      migrateWithLoader: (dir: string, loader: MigrationLoader) => this.migrateWithLoader(cfg, dir, loader),
      migrateAuto: (dirName: string) => this.migrateAuto(cfg, dirName),
      getClient: () => this.getClient(cfg),
    };
  }

  async migrate(
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

  async migrateWithLoader(
    cfg: { databaseName: string; apiToken: string },
    dir: string,
    loader: MigrationLoader
  ) {
    const journal = await loader.loadJournal(dir);
    const migrations: Record<string, () => Promise<string>> = {};
    for (const entry of journal.entries) {
      const key = `m${String(entry.idx).padStart(4, '0')}`;
      migrations[key] = () => loader.loadSql(dir, entry.tag);
    }
    return this.migrate(cfg, { journal, migrations });
  }

  private async migrateAuto(
    cfg: { databaseName: string; apiToken: string },
    dirName: string
  ) {
    try {
      const mod = await import('./migrations-vite.js');
      const loadMigrations = (mod as any).loadMigrations as (d: string) => Promise<{
        journal: MigrationJournal;
        migrations: Record<string, () => Promise<string>>;
      }>;
      if (typeof loadMigrations !== 'function') {
        throw new Error('loadMigrations() not found in migrations-vite module');
      }
      const bundle = await loadMigrations(dirName);
      return this.migrate(cfg, bundle);
    } catch (err: any) {
      const hint = 'This method requires a Vite environment with import.meta.glob support. ' +
        'If you are not on Vite, use migrateWithLoader() or migrate() with your own bundle.';
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
}
