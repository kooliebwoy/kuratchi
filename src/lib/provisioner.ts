import { CloudflareClient, CloudflareClientConfig, PrimaryLocationHint } from './cloudflare';
import { DEFAULT_WORKER_SCRIPT } from './worker-template';

export interface KuratchiProvisionerConfig extends CloudflareClientConfig {}

export class KuratchiProvisioner {
    private static instance: KuratchiProvisioner;
    private cf: CloudflareClient;

    private constructor(config: KuratchiProvisionerConfig) {
        this.cf = new CloudflareClient(config);
    }

    public static getInstance(config: KuratchiProvisionerConfig): KuratchiProvisioner {
        if (!KuratchiProvisioner.instance) {
            KuratchiProvisioner.instance = new KuratchiProvisioner(config);
        }
        return KuratchiProvisioner.instance;
    }

    /**
     * Creates a Cloudflare D1 database, generates an API token, and deploys a Worker
     * bound to that database with the token injected as a secret binding.
     * If no workerScript is provided, uses the SDK's DEFAULT_WORKER_SCRIPT.
     */
    async provisionDatabase(databaseName: string, options: { workerScript?: string; location?: PrimaryLocationHint } = {}): Promise<{ database: any; apiToken: string }> {
        const { workerScript, location } = options;

        const databaseResp = await this.cf.createDatabase(databaseName, location);
        const database = databaseResp?.result ?? databaseResp; // Support both wrapped and raw responses
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
            { type: 'secret_text', name: 'API_KEY', text: apiToken }
        ];

        const scriptToUpload = workerScript || DEFAULT_WORKER_SCRIPT;
        await this.cf.uploadWorkerModule(databaseName, scriptToUpload, bindings);
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

    /**
     * Deletes a Cloudflare D1 database by id.
     */
    async deleteDatabase(databaseId: string): Promise<void> {
        await this.cf.deleteDatabase(databaseId);
    }
}
