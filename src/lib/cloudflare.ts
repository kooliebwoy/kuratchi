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
            let errBody: any = undefined;
            try { errBody = await res.json(); } catch { errBody = await res.text(); }
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
            let errBody: any = undefined;
            try { errBody = await res.json(); } catch { errBody = await res.text(); }
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
}
