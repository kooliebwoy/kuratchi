import { KuratchiD1 } from './d1/index.js';
import { KuratchiAuth } from './auth/kuratchi-auth.js';
export type { PrimaryLocationHint } from './d1/index.js';

/**
 * Public options for the Kuratchi SDK
 */
export interface KuratchiOptions {
    // Cloudflare API auth and account for D1
    apiToken: string;
    accountId: string;
    endpointBase?: string; // default https://api.cloudflare.com/client/v4
    // Workers subdomain host
    workersSubdomain: string; // e.g. <account>.workers.dev
    // Auth configuration (optional)
    auth?: {
        resendApiKey: string;
        emailFrom: string;
        origin: string;
        resendAudience?: string;
        authSecret: string;
        // Bound D1 database for admin (e.g., platform.env.DB)
        adminDb: any;
    };
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
    public d1: KuratchiD1;
    public auth?: KuratchiAuth;

    constructor(config: KuratchiOptions) {
        this.d1 = new KuratchiD1({
            apiToken: config.apiToken,
            accountId: config.accountId,
            endpointBase: config.endpointBase,
            workersSubdomain: config.workersSubdomain,
        });
        
        // Initialize auth if config is provided
        if (config.auth) {
            this.auth = new KuratchiAuth({
                ...config.auth,
                workersSubdomain: config.workersSubdomain,
                accountId: config.accountId,
                apiToken: config.apiToken
            });
        }
    }
}
