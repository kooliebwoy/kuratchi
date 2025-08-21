import { KuratchiD1 } from './d1/index.js';
import { KuratchiAuth } from './auth/kuratchi-auth.js';
import { createAuthHandle, type CreateAuthHandleOptions } from './auth/sveltekit.js';
import type { Handle } from '@sveltejs/kit';
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
    public auth: KuratchiAuth | { handle: (options?: CreateAuthHandleOptions) => Handle };

    // Static convenience: use without instantiating Kuratchi
    static auth = {
        handle(options: CreateAuthHandleOptions = {}): Handle {
            return createAuthHandle(options);
        },
        // Static convenience sign-in wrappers using built-in handle routes
        signIn: {
            magicLink: {
                async send(
                    email: string,
                    options?: { redirectTo?: string; organizationId?: string; fetch?: typeof fetch }
                ): Promise<{ ok: true } | { ok: false; error: string }> {
                    const f = options?.fetch ?? (globalThis as any)?.fetch;
                    if (!f) throw new Error('fetch_not_available');
                    const res = await f('/auth/magic/send', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            email,
                            redirectTo: options?.redirectTo,
                            organizationId: options?.organizationId
                        })
                    });
                    const json = await res.json().catch(() => ({ ok: false, error: 'invalid_response' }));
                    return json;
                }
            },
            oauth: {
                google: {
                    startUrl(params: { organizationId: string; redirectTo?: string }) {
                        const u = new URL('/auth/oauth/google/start', 'http://dummy');
                        u.searchParams.set('org', params.organizationId);
                        if (params.redirectTo) u.searchParams.set('redirectTo', params.redirectTo);
                        // Return relative URL path + query
                        return u.pathname + (u.search ? u.search : '');
                    }
                }
            }
        }
    };

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
        } else {
            // Fallback: expose only SvelteKit handle to keep API ergonomic
            this.auth = {
                handle(options: CreateAuthHandleOptions = {}) {
                    return createAuthHandle(options);
                }
            };
        }
    }

    // Redact secrets and internals on logs
    toJSON() {
        return {
            d1: '[api]',
            auth: '[api]'
        } as any;
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.toJSON();
    }
}
