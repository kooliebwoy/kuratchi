import Cloudflare from 'cloudflare';

export type PrimaryLocationHint = 'wnam' | 'enam' | 'weur' | 'eeur' | 'apac' | 'oc';

/**
 * Minimal Cloudflare v4 API response envelope
 */
export interface CloudflareAPIResponse<T = unknown> {
    success: boolean;
    result: T;
    errors: unknown[];
    messages: unknown[];
}

export interface CloudflareClientConfig {
    apiToken: string;
    accountId: string;
    endpointBase?: string; // default https://api.cloudflare.com/client/v4
}

export class CloudflareClient {
    private apiToken: string;
    private accountId: string;
    private base: string;
    private cf: Cloudflare;

    constructor(config: CloudflareClientConfig) {
        this.apiToken = config.apiToken;
        this.accountId = config.accountId;
        this.base = config.endpointBase || 'https://api.cloudflare.com/client/v4';
        this.cf = new Cloudflare({ apiToken: this.apiToken });
    }

    private async request(path: string, init: RequestInit): Promise<any> {
        const res = await fetch(`${this.base}${path}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${this.apiToken}`,
                ...(init.headers || {})
            }
        });
        if (!res.ok) {
            // Read once as text to avoid "Body is unusable" when attempting multiple reads
            const raw = await res.text();
            let errBody: any = undefined;
            try { errBody = JSON.parse(raw); } catch { errBody = raw; }
            throw new Error(`Cloudflare API ${res.status} ${res.statusText}: ${typeof errBody === 'string' ? errBody : JSON.stringify(errBody)}`);
        }
        const ct = res.headers.get('content-type') || '';
        return ct.includes('application/json') ? res.json() : res.text();
    }

    /**
     * Create a D1 database
     * @see https://developers.cloudflare.com/d1/platform/client-api/
     */
    async createDatabase(name: string, location?: PrimaryLocationHint): Promise<CloudflareAPIResponse<any>> {
        const body: any = { name };
        if (location) body.primary_location_hint = location;
        return this.request(`/accounts/${this.accountId}/d1/database`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    /** Delete a D1 database by id and its associated Worker script (named after the database) */
    async deleteDatabase(databaseId: string): Promise<CloudflareAPIResponse<any>> {
        // Best-effort: resolve database name to infer worker script name
        try {
            const list = await this.listDatabases();
            const items: any[] = Array.isArray(list?.result) ? (list.result as any[]) : [];
            const found = items.find((d: any) => d?.uuid === databaseId || d?.id === databaseId);
            const scriptName: string | undefined = found?.name;
            if (scriptName) {
                try {
                    await this.deleteWorkerScript(scriptName);
                } catch {
                    // ignore worker deletion errors to ensure DB deletion proceeds
                }
            }
        } catch {
            // ignore lookup errors and proceed to DB deletion
        }

        return this.request(`/accounts/${this.accountId}/d1/database/${databaseId}`, {
            method: 'DELETE'
        });
    }

    /** List D1 databases in the account */
    async listDatabases(): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/d1/database`, {
            method: 'GET'
        });
    }

    /** Get a D1 database by id */
    async getDatabase(databaseId: string): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/d1/database/${databaseId}`, {
            method: 'GET'
        });
    }

    /** Query a D1 database directly via REST API */
    async queryD1Database(databaseId: string, sql: string, params: any[] = []): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/d1/database/${databaseId}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, params })
        });
    }

    /** Enable read replication on a D1 database */
    async enableReadReplication(databaseId: string): Promise<CloudflareAPIResponse<any>> {
        // https://developers.cloudflare.com/d1/best-practices/read-replication/#enable-read-replication-via-rest-api
        return this.request(`/accounts/${this.accountId}/d1/database/${databaseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read_replication: { mode: 'auto' } })
        });
    }

    /** Disable read replication on a D1 database */
    async disableReadReplication(databaseId: string): Promise<CloudflareAPIResponse<any>> {
        // https://developers.cloudflare.com/d1/best-practices/read-replication/#disable-read-replication-via-rest-api
        return this.request(`/accounts/${this.accountId}/d1/database/${databaseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read_replication: { mode: 'disabled' } })
        });
    }

    // ===== KV Namespaces =====
    /** Create a KV Namespace */
    async createKVNamespace(title: string): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).kv.namespaces.create({ title, account_id: this.accountId });
        return res as any;
    }

    /** List KV Namespaces */
    async listKVNamespaces(): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).kv.namespaces.list({ account_id: this.accountId });
        return res as any;
    }

    /** Delete a KV Namespace by id and attempt to delete a Worker script named after the title */
    async deleteKVNamespace(namespaceId: string): Promise<CloudflareAPIResponse<any>> {
        // Best-effort: resolve namespace title to infer worker script name
        try {
            const list = await this.listKVNamespaces();
            const items: any[] = Array.isArray(list?.result) ? (list.result as any[]) : [];
            const found = items.find((ns: any) => ns?.id === namespaceId);
            const scriptName: string | undefined = found?.title;
            if (scriptName) {
                try {
                    await this.deleteWorkerScript(scriptName);
                } catch {
                    // ignore worker deletion errors to ensure KV deletion proceeds
                }
            }
        } catch {
            // ignore lookup errors and proceed to KV deletion
        }

        const res = await (this.cf as any).kv.namespaces.delete(namespaceId, { account_id: this.accountId });
        return res as any;
    }

    // ===== R2 Buckets =====
    /** Create an R2 bucket */
    async createR2Bucket(name: string): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).r2.buckets.create({ name, account_id: this.accountId });
        return res as any;
    }

    /** List R2 buckets */
    async listR2Buckets(): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).r2.buckets.list({ account_id: this.accountId });
        return res as any;
    }

    /** Delete an R2 bucket by name and attempt to delete a Worker script named after it */
    async deleteR2Bucket(name: string): Promise<CloudflareAPIResponse<any>> {
        // Best-effort: delete worker with same name
        try {
            await this.deleteWorkerScript(name);
        } catch {
            // ignore worker deletion errors to ensure bucket deletion proceeds
        }
        const res = await (this.cf as any).r2.buckets.delete(name, { account_id: this.accountId });
        return res as any;
    }

    /** Upload a Workers script (module syntax) with provided bindings */
    async uploadWorkerModule(scriptName: string, workerScript: string, bindings: Array<unknown>, options?: { skipDoMigrations?: boolean }): Promise<CloudflareAPIResponse<any>> {
        const form = new FormData();
        const mainModule = 'worker.js';
        form.append(mainModule, new File([workerScript], mainModule, { type: 'application/javascript+module' }));

        const durableObjectClasses: string[] = [];
        const processedBindings = bindings.map((binding: any) => {
            if (binding.type === 'durable_object_namespace' && binding.class_name) {
                durableObjectClasses.push(binding.class_name);
            }
            return binding;
        });

        const metadata: any = {
            bindings: processedBindings,
            main_module: mainModule,
            compatibility_date: '2025-08-17',
            placement: { mode: 'smart' },
            compatibility_flags: ['nodejs_compat']
        };
        if (durableObjectClasses.length > 0 && !options?.skipDoMigrations) {
            metadata.migrations = { new_sqlite_classes: durableObjectClasses };
        }
        form.append('metadata', JSON.stringify(metadata));

        // Use direct API call since the SDK doesn't support FormData properly
        const res = await fetch(`${this.base}/accounts/${this.accountId}/workers/scripts/${scriptName}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`
            },
            body: form
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to upload worker: ${res.status} ${error}`);
        }

        return res.json();
    }

    /**
     * Deploy a D1 worker with database binding
     * Creates a D1 database and deploys a worker with the database bound
     */
    async deployD1Worker(options: {
        workerName: string;
        databaseName: string;
        workerScript: string;
        gatewayKey: string;
        location?: PrimaryLocationHint;
    }): Promise<{ databaseId: string; workerName: string }> {
        const { workerName, databaseName, workerScript, gatewayKey, location } = options;

        // Create D1 database
        const dbResponse = await this.createDatabase(databaseName, location);
        if (!dbResponse.success || !dbResponse.result) {
            throw new Error(`Failed to create D1 database: ${JSON.stringify(dbResponse.errors)}`);
        }
        const databaseId = dbResponse.result.uuid || dbResponse.result.id;

        try {
            // Prepare bindings for the worker
            const bindings = [
                // Secret binding for gateway key
                { type: 'secret_text', name: 'API_KEY', text: gatewayKey },
                // D1 database binding
                { type: 'd1', name: 'DB', id: databaseId }
            ];

            // Upload worker with D1 binding
            await this.uploadWorkerModule(workerName, workerScript, bindings);

            // Enable worker subdomain
            await this.enableWorkerSubdomain(workerName);

            return { databaseId, workerName };
        } catch (error) {
            // Cleanup: delete the database if worker deployment fails
            try {
                await this.deleteDatabase(databaseId);
            } catch (cleanupError) {
                console.error('Failed to cleanup database after worker deployment failure:', cleanupError);
            }
            throw error;
        }
    }

    /** Enable a Workers.dev subdomain for a script */
    async enableWorkerSubdomain(scriptName: string): Promise<CloudflareAPIResponse<any>> {
        const res = await fetch(`${this.base}/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: true
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to enable worker subdomain: ${res.status} ${error}`);
        }

        return res.json();
    }

    /** Get a Worker script (metadata or content). Success indicates it exists. */
    async getWorkerScript(scriptName: string): Promise<any> {
        const res = await fetch(`${this.base}/accounts/${this.accountId}/workers/scripts/${scriptName}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`
            }
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to get worker script: ${res.status} ${error}`);
        }

        return res.json();
    }

    /** Delete a Worker script by name (force=true to remove along with bindings/objects) */
    async deleteWorkerScript(scriptName: string): Promise<void> {
        const res = await fetch(`${this.base}/accounts/${this.accountId}/workers/scripts/${scriptName}?force=true`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`
            }
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to delete worker script: ${res.status} ${error}`);
        }
    }

    // ===== Queues =====
    /** Create a Queue */
    async createQueue(queueName: string): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).queues.create({ account_id: this.accountId, queue_name: queueName });
        return res as any;
    }

    /** List Queues */
    async listQueues(): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).queues.list({ account_id: this.accountId });
        return res as any;
    }

    /** Delete a Queue by id or name */
    async deleteQueue(idOrName: string): Promise<CloudflareAPIResponse<any>> {
        let target = idOrName;
        try {
            const list = await this.listQueues();
            const items: any[] = Array.isArray(list?.result) ? (list.result as any[]) : [];
            const found = items.find((q: any) => q?.id === idOrName || q?.queue_id === idOrName || q?.queue_name === idOrName || q?.name === idOrName);
            if (found) {
                target = found.id || found.queue_id || found.name || found.queue_name || target;
            }
        } catch {
            // ignore lookup errors and try with provided value
        }
        const res = await (this.cf as any).queues.delete(target, { account_id: this.accountId });
        return res as any;
    }

    // ===== DNS Zones =====
    /** Create a new DNS zone */
    async createZone(name: string): Promise<CloudflareAPIResponse<any>> {
        // Use official SDK for strong typing
        const res = await this.cf.zones.add({ name, account: { id: this.accountId } } as any);
        return res as any;
    }

    /** List all DNS zones */
    async listZones(options?: { page?: number; per_page?: number; order?: 'name' | 'status' | 'account.id' | 'account.name'; direction?: 'asc' | 'desc'; match?: 'all' | 'any'; name?: string; account?: { id?: string; name?: string }; status?: 'active' | 'pending' | 'initializing' | 'moved' | 'deleted' | 'deactivated' }): Promise<CloudflareAPIResponse<any>> {
        // Directly use SDK; it returns envelope with result array
        const res = await this.cf.zones.browse(options as any);
        return res as any;
    }

    /** Get zone details by ID */
    async getZone(zoneId: string): Promise<CloudflareAPIResponse<any>> {
        // SDK: most resources support a read/get call; fallback to request if missing
        try {
            const fn: any = (this.cf as any).zones?.get || (this.cf as any).zones?.read;
            if (typeof fn === 'function') {
                const res = await fn.call((this.cf as any).zones, zoneId);
                return res as any;
            }
        } catch {}
        return this.request(`/zones/${zoneId}`, { method: 'GET' });
    }

    /** Delete a DNS zone */
    async deleteZone(zoneId: string): Promise<CloudflareAPIResponse<any>> {
        const res = await this.cf.zones.del(zoneId as any);
        return res as any;
    }

    /** Pause (disable) a DNS zone */
    async pauseZone(zoneId: string): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/zones/${zoneId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paused: true })
        });
    }

    /** Unpause (enable) a DNS zone */
    async unpauseZone(zoneId: string): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/zones/${zoneId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paused: false })
        });
    }

    /** Purge zone cache */
    async purgeZoneCache(zoneId: string, options?: { purge_everything?: boolean; files?: string[]; tags?: string[]; hosts?: string[]; prefixes?: string[] }): Promise<CloudflareAPIResponse<any>> {
        const body = options || { purge_everything: true };
        return this.request(`/zones/${zoneId}/purge_cache`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    // ===== DNS Records =====
    /** List DNS records for a zone */
    async listDnsRecords(zoneId: string, options?: { type?: string; name?: string; content?: string; page?: number; per_page?: number; order?: string; direction?: 'asc' | 'desc'; match?: 'all' | 'any' }): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).dns.records.browse(zoneId, options as any);
        return res as any;
    }

    /** Create a DNS record */
    async createDnsRecord(zoneId: string, record: { type: string; name: string; content: string; ttl?: number; priority?: number; proxied?: boolean; comment?: string; tags?: string[] }): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).dns.records.create(zoneId, record as any);
        return res as any;
    }

    /** Update a DNS record */
    async updateDnsRecord(zoneId: string, recordId: string, record: { type: string; name: string; content: string; ttl?: number; priority?: number; proxied?: boolean; comment?: string; tags?: string[] }): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).dns.records.update(zoneId, recordId, record as any);
        return res as any;
    }

    /** Delete a DNS record */
    async deleteDnsRecord(zoneId: string, recordId: string): Promise<CloudflareAPIResponse<any>> {
        const res = await (this.cf as any).dns.records.delete(zoneId, recordId);
        return res as any;
    }

    /** Get zone settings */
    async getZoneSettings(zoneId: string): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/zones/${zoneId}/settings`, { method: 'GET' });
    }

    /** Update zone setting */
    async updateZoneSetting(zoneId: string, setting: string, value: any): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/zones/${zoneId}/settings/${setting}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
    }
}
