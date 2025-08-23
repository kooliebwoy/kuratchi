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

    constructor(config: CloudflareClientConfig) {
        this.apiToken = config.apiToken;
        this.accountId = config.accountId;
        this.base = config.endpointBase || 'https://api.cloudflare.com/client/v4';
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
        return this.request(`/accounts/${this.accountId}/storage/kv/namespaces`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
    }

    /** List KV Namespaces */
    async listKVNamespaces(): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/storage/kv/namespaces`, {
            method: 'GET'
        });
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

        return this.request(`/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}`, {
            method: 'DELETE'
        });
    }

    // ===== R2 Buckets =====
    /** Create an R2 bucket */
    async createR2Bucket(name: string): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/r2/buckets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
    }

    /** List R2 buckets */
    async listR2Buckets(): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/r2/buckets`, {
            method: 'GET'
        });
    }

    /** Delete an R2 bucket by name and attempt to delete a Worker script named after it */
    async deleteR2Bucket(name: string): Promise<CloudflareAPIResponse<any>> {
        // Best-effort: delete worker with same name
        try {
            await this.deleteWorkerScript(name);
        } catch {
            // ignore worker deletion errors to ensure bucket deletion proceeds
        }
        return this.request(`/accounts/${this.accountId}/r2/buckets/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
    }

    /** Upload a Workers script (module syntax) with provided bindings */
    async uploadWorkerModule(scriptName: string, workerScript: string, bindings: Array<unknown>): Promise<CloudflareAPIResponse<any>> {
        const form = new FormData();
        const mainModule = 'worker.js';
        form.append(mainModule, new File([workerScript], mainModule, { type: 'application/javascript+module' }));
        form.append('metadata', JSON.stringify({
            bindings,
            main_module: mainModule,
            compatibility_date: '2025-08-17',
            placement: { mode: 'smart' },
            compatibility_flags: ['nodejs_compat']
        }));

        const res = await fetch(`${this.base}/accounts/${this.accountId}/workers/scripts/${scriptName}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${this.apiToken}`
            },
            body: form
        });
        if (!res.ok) {
            const raw = await res.text();
            let errBody: any = undefined;
            try { errBody = JSON.parse(raw); } catch { errBody = raw; }
            throw new Error(`Failed to upload worker: ${typeof errBody === 'string' ? errBody : JSON.stringify(errBody)}`);
        }
        return res.json() as Promise<CloudflareAPIResponse<any>>;
    }

    /** Enable a Workers.dev subdomain for a script */
    async enableWorkerSubdomain(scriptName: string): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/workers/scripts/${scriptName}/subdomain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true, previews_enabled: true })
        });
    }

    /** Get a Worker script (metadata or content). Success indicates it exists. */
    async getWorkerScript(scriptName: string): Promise<any> {
        return this.request(`/accounts/${this.accountId}/workers/scripts/${scriptName}`, {
            method: 'GET'
        });
    }

    /** Delete a Worker script by name (force=true to remove along with bindings/objects) */
    async deleteWorkerScript(scriptName: string): Promise<void> {
        await this.request(`/accounts/${this.accountId}/workers/scripts/${scriptName}?force=true`, {
            method: 'DELETE'
        });
    }

    // ===== Queues =====
    /** Create a Queue */
    async createQueue(queueName: string): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/queues`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queue_name: queueName })
        });
    }

    /** List Queues */
    async listQueues(): Promise<CloudflareAPIResponse<any>> {
        return this.request(`/accounts/${this.accountId}/queues`, {
            method: 'GET'
        });
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
        return this.request(`/accounts/${this.accountId}/queues/${encodeURIComponent(target)}`, {
            method: 'DELETE'
        });
    }
}
