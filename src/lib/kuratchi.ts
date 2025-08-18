import { KuratchiHttpClient as InternalKuratchi } from './internal-http-client.js';
import { CloudflareClientConfig, PrimaryLocationHint } from './cloudflare';
export type { PrimaryLocationHint } from './cloudflare.js';
import { KuratchiProvisioner } from './provisioner';

/**
 * Public options for the Kuratchi SDK
 */
export interface KuratchiOptions {
    // Cloudflare API auth and account
    apiToken: string;
    accountId: string;
    endpointBase?: string; // default https://api.cloudflare.com/client/v4
    // Workers subdomain host
    workersSubdomain: string; // e.g. <account>.workers.dev
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

/**
 * Kuratchi — Public SDK surface for provisioning and querying D1
 */
export class Kuratchi {
    private provisioner: KuratchiProvisioner;
    private workersSubdomain: string;

    constructor(config: KuratchiOptions) {
        this.provisioner = KuratchiProvisioner.getInstance({
            apiToken: config.apiToken,
            accountId: config.accountId,
            endpointBase: config.endpointBase,
        });
        this.workersSubdomain = config.workersSubdomain;
    }

    /**
     * Provisions a new D1 database and deploys the SDK's default Worker bound to it.
     * Returns { database, apiToken } (stateless; does not mutate SDK state).
     */
    async createDatabase(databaseName: string, options: { location?: PrimaryLocationHint } = {}) {
        const { database, apiToken } = await this.provisioner.provisionDatabase(databaseName, {
            location: options.location,
        });
        return { database, apiToken };
    }

    /**
     * Deletes a D1 database by id.
     */
    async deleteDatabase(databaseId: string) {
        await this.provisioner.deleteDatabase(databaseId);
    }

    /**
     * Stateless helpers: operate on a specific database without SDK-held state
     */
    getClient(cfg: { databaseName: string; apiToken: string; bookmark?: string }) {
        const client = new InternalKuratchi({
            databaseName: cfg.databaseName,
            workersSubdomain: this.workersSubdomain,
            apiToken: cfg.apiToken,
        });
        // Optionally seed the read-replication session bookmark header
        if (cfg.bookmark) client.setSessionBookmark?.(cfg.bookmark);
        return client;
    }

    getDrizzleClient(cfg: { databaseName: string; apiToken: string; bookmark?: string }) {
        return this.getClient(cfg).getDrizzleProxy();
    }

    // Removed token-based session helpers; read-replication is handled via bookmark header.

    /**
     * Create a stateless, lightweight handle bound to a specific database/token.
     * This only captures config and constructs an internal client per call.
     */
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

    /**
     * @deprecated Use database(cfg) instead. Will be removed in a future release.
     */
    db(cfg: { databaseName: string; apiToken: string; bookmark?: string }) {
        return this.database(cfg);
    }

    /**
     * Run migrations using a provided bundle (journal + migrations map).
     * The app must prepare this bundle; see your build tooling for globbing.
     */
    async migrate(
        cfg: { databaseName: string; apiToken: string },
        bundle: { journal: { entries: any[] }, migrations: Record<string, string | (() => Promise<string>)> }
    ) {
        const client = this.getClient(cfg);
        // Normalize possible lazy functions
        const normalized: Record<string, any> = {};
        for (const [k, v] of Object.entries(bundle.migrations)) {
            normalized[k] = v as any;
        }
        return client.migrate({ journal: bundle.journal, migrations: normalized as any });
    }

    /**
     * Runtime-agnostic migration entrypoint. Provide a loader that knows how to
     * fetch the journal and SQL text for a given directory identifier.
     */
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

    // Note: Vite-specific helpers removed to keep the SDK runtime-agnostic and stateless

    /**
     * Opinionated one-call migration for Vite-based apps (e.g., SvelteKit Workers).
     * Uses import.meta.glob under the hood via a small helper module. This method
     * dynamically imports the helper so non-Vite consumers are unaffected.
     */
    private async migrateAuto(
        cfg: { databaseName: string; apiToken: string },
        dirName: string
    ) {
        try {
            // Dynamic import to avoid bundling Vite-specific code for non-Vite users
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
}
