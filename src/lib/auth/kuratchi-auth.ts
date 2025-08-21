import { KuratchiD1 } from '../d1/kuratchi-d1.js';
import { AuthService } from './AuthService.js';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { parseSessionCookie, signState, verifyState } from './utils.js';
import { adminSchema, organizationSchema, validateAdminSchema, validateOrganizationSchema } from '../schema/index.js'
import { drizzle as drizzleSqliteProxy } from 'drizzle-orm/sqlite-proxy';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { KuratchiHttpClient } from '../d1/internal-http-client.js';
import type { QueryResult } from '../d1/internal-http-client.js';

// Consolidated SvelteKit handle and types (previously in sveltekit.ts)
export const KURATCHI_SESSION_COOKIE = 'kuratchi_session';

// Utility to allow sync or async returns
type MaybePromise<T> = T | Promise<T>;

// Supported admin DB (Kuratchi admin CLI HTTP client)
type KuratchiHttpLike = {
  query: (sql: string, params?: any[]) => Promise<QueryResult<any>>;
  getDrizzleProxy?: () => any;
  drizzleProxy?: () => any;
};
export type AdminDbLike = KuratchiHttpLike;

// Env shape consumed by the auth handle
export type AuthHandleEnv = {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  ORIGIN?: string;
  RESEND_CLUTCHCMS_AUDIENCE?: string;
  KURATCHI_AUTH_SECRET: string;
  CLOUDFLARE_WORKERS_SUBDOMAIN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  AUTH_WEBHOOK_SECRET?: string;
  KURATCHI_ADMIN_DB_NAME?: string;
  KURATCHI_ADMIN_DB_TOKEN?: string;
};

export interface CreateAuthHandleOptions {
  cookieName?: string;
  // Optional override to provide an admin DB client. Can be async.
  getAdminDb?: (event: RequestEvent) => MaybePromise<AdminDbLike>;
  // Optional override to provide env. Can be async. Defaults to $env/dynamic/private values.
  getEnv?: (event: RequestEvent) => MaybePromise<AuthHandleEnv>;
}

export function createAuthHandle(options: CreateAuthHandleOptions = {}): Handle {
  const cookieName = options.cookieName || KURATCHI_SESSION_COOKIE;

  const getEnv = options.getEnv || (async (_event: RequestEvent) => {
    let dynamicEnv: any = undefined;
    try {
      const mod: any = await import('$env/dynamic/private');
      dynamicEnv = mod?.env;
    } catch {}
    const env = dynamicEnv || {};
    const pick = (key: string) => {
      const v = env?.[key];
      return v !== undefined && v !== null && String(v).length > 0 ? String(v) : undefined;
    };
    return {
      // Prefer new names; keep compatibility fallbacks where applicable
      RESEND_API_KEY: pick('RESEND_EMAIL_API_KEY') || pick('KURATCHI_RESEND_API_KEY') || pick('RESEND_API_KEY'),
      EMAIL_FROM: pick('KURATCHI_EMAIL_FROM') || pick('EMAIL_FROM'),
      ORIGIN: pick('KURATCHI_ORIGIN') || pick('ORIGIN'),
      RESEND_CLUTCHCMS_AUDIENCE: pick('KURATCHI_RESEND_CLUTCHCMS_AUDIENCE') || pick('RESEND_CLUTCHCMS_AUDIENCE'),
      KURATCHI_AUTH_SECRET: pick('KURATCHI_AUTH_SECRET')!,
      CLOUDFLARE_WORKERS_SUBDOMAIN: pick('KURATCHI_CLOUDFLARE_WORKERS_SUBDOMAIN') || pick('CLOUDFLARE_WORKERS_SUBDOMAIN')!,
      CLOUDFLARE_ACCOUNT_ID: pick('KURATCHI_CLOUDFLARE_ACCOUNT_ID') || pick('CLOUDFLARE_ACCOUNT_ID')!,
      CLOUDFLARE_API_TOKEN: pick('KURATCHI_CLOUDFLARE_API_TOKEN') || pick('CLOUDFLARE_API_TOKEN')!,
      GOOGLE_CLIENT_ID: pick('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: pick('GOOGLE_CLIENT_SECRET'),
      AUTH_WEBHOOK_SECRET: pick('AUTH_WEBHOOK_SECRET'),
      KURATCHI_ADMIN_DB_NAME: pick('KURATCHI_ADMIN_DB_NAME'),
      KURATCHI_ADMIN_DB_TOKEN: pick('KURATCHI_ADMIN_DB_TOKEN')
    } as any;
  });

  // Helpers moved to utils.ts: signState, verifyState

  return async ({ event, resolve }) => {
    // Initialize locals defaults and helpers
    const locals: any = event.locals;
    // Single namespace only
    if (!locals.kuratchi) locals.kuratchi = {};
    // Initialize only user/session placeholders; leave auth alone (will be provided by SDK)
    if (typeof locals.kuratchi.user === 'undefined') locals.kuratchi.user = null;
    if (typeof locals.kuratchi.session === 'undefined') locals.kuratchi.session = null;

    // Cookie helpers live under kuratchi
    locals.kuratchi.setSessionCookie = (value: string, opts?: { expires?: Date }) => {
      const expires = opts?.expires;
      event.cookies.set(cookieName, value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        ...(expires ? { expires } : {})
      });
    };
    locals.kuratchi.clearSessionCookie = () => {
      event.cookies.delete(cookieName, { path: '/' });
    };
    // No top-level mirrors; use locals.kuratchi only

    const url = new URL(event.request.url);
    const pathname = url.pathname;

    // Resolve env strictly and fail fast on the minimal values needed at this point
    const env = await getEnv(event as any as RequestEvent) as any;
    if (!env?.KURATCHI_AUTH_SECRET) {
      return new Response('[Kuratchi] Missing required environment variables: KURATCHI_AUTH_SECRET', { status: 500 });
    }

    // Lazily create admin DB and KuratchiAuth only when needed
    let adminDbInst: any | null = null;
    const getAdminDbLazy = async (): Promise<any> => {
      if (adminDbInst) return adminDbInst;
      if (options.getAdminDb) {
        adminDbInst = await options.getAdminDb(event as any as RequestEvent);
      } else {
        const adminMissing = ['KURATCHI_ADMIN_DB_NAME', 'KURATCHI_ADMIN_DB_TOKEN', 'CLOUDFLARE_WORKERS_SUBDOMAIN'].filter((k) => !env?.[k]);
        if (adminMissing.length) throw new Error(`[Kuratchi] Missing required environment variables: ${adminMissing.join(', ')}`);
        adminDbInst = new KuratchiHttpClient({
          databaseName: env.KURATCHI_ADMIN_DB_NAME,
          workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
          apiToken: env.KURATCHI_ADMIN_DB_TOKEN
        });
      }
      return adminDbInst;
    };

    let sdk: any = null;
    const getKuratchi = async (): Promise<any> => {
      if (sdk) return sdk;
      // Validate Cloudflare env required for KuratchiAuth usage
      const cfMissing = ['CLOUDFLARE_WORKERS_SUBDOMAIN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'].filter((k) => !env?.[k]);
      if (cfMissing.length) throw new Error(`[Kuratchi] Missing required environment variables: ${cfMissing.join(', ')}`);
      const adminDb = await getAdminDbLazy();
      const { Kuratchi } = await import('../kuratchi.js');
      sdk = new Kuratchi({
        apiToken: env.CLOUDFLARE_API_TOKEN,
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
        auth: {
          resendApiKey: env.RESEND_API_KEY || '',
          emailFrom: env.EMAIL_FROM || '',
          origin: env.ORIGIN || '',
          resendAudience: env.RESEND_CLUTCHCMS_AUDIENCE,
          authSecret: env.KURATCHI_AUTH_SECRET,
          adminDb
        }
      });
      // Expose the SDK instance under locals.kuratchi, preserving existing helpers
      Object.assign(locals.kuratchi, sdk);
      return sdk;
    };

    // Helper to get the Auth API (narrowed to KuratchiAuth)
    const getAuthApi = async (): Promise<KuratchiAuth> => {
      const k = await getKuratchi();
      return k.auth as KuratchiAuth;
    };

    // Helper: look up organizationId by email in admin DB (Kuratchi HTTP client only)
    const findOrganizationIdByEmail = async (email: string): Promise<string | null> => {
      try {
        const adminDb = await getAdminDbLazy().catch(() => null);
        if (!adminDb || typeof (adminDb as any).query !== 'function') return null;
        const sql = 'SELECT organizationId FROM organizationUsers WHERE email = ? AND deleted_at IS NULL LIMIT 1';
        const res = await (adminDb as KuratchiHttpLike).query(sql, [email]);
        const rows = (res && (res.results ?? res.data)) || [];
        const row = Array.isArray(rows) ? rows[0] : null;
        return row?.organizationId || null;
      } catch {
        return null;
      }
    };

    // Magic Link: send (/auth/magic/send)
    if (pathname === '/auth/magic/send' && event.request.method.toUpperCase() === 'POST') {
      try {
        const body = await event.request.json().catch(() => ({}));
        const email = (body?.email || '').trim();
        let redirectTo = body?.redirectTo || url.searchParams.get('redirectTo') || '/';
        let orgId = body?.organizationId || url.searchParams.get('org');

        if (!env.RESEND_API_KEY || !env.EMAIL_FROM)
          return new Response(JSON.stringify({ ok: false, error: 'email_not_configured' }), { status: 500, headers: { 'content-type': 'application/json' } });

        if (!email) return new Response(JSON.stringify({ ok: false, error: 'email_required' }), { status: 400, headers: { 'content-type': 'application/json' } });
        if (!orgId) orgId = await findOrganizationIdByEmail(email);
        if (!orgId) return new Response(JSON.stringify({ ok: false, error: 'organization_not_found_for_email' }), { status: 404, headers: { 'content-type': 'application/json' } });

        const auth = await (await getAuthApi()).forOrganization(orgId);
        const tokenData = await auth.createMagicLinkToken(email, redirectTo);
        const origin = env.ORIGIN || `${url.protocol}//${url.host}`;
        const link = `${origin}/auth/magic/callback?token=${encodeURIComponent(tokenData.token)}&org=${encodeURIComponent(orgId)}`;
        await auth.sendMagicLink(email, link);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: 'send_failed', detail: e?.message || String(e) }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
    }

    // Magic Link: callback (/auth/magic/callback)
    if (pathname === '/auth/magic/callback' && event.request.method.toUpperCase() === 'GET') {
      const token = url.searchParams.get('token') || '';
      const orgId = url.searchParams.get('org') || '';
      if (!token || !orgId) return new Response('Bad Request', { status: 400 });
      try {
        const auth = await (await getAuthApi()).forOrganization(orgId);
        const result = await auth.verifyMagicLink(token);
        if (!result.success || !result.cookie) return new Response('Unauthorized', { status: 401 });
        // 30d cookie expiry
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        locals.kuratchi.setSessionCookie(result.cookie, { expires });
        const dest = result.redirectTo || url.searchParams.get('redirectTo') || '/';
        return new Response(null, { status: 303, headers: { Location: dest } });
      } catch (e) {
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    // OAuth (Google): start (/auth/oauth/google/start)
    if (pathname === '/auth/oauth/google/start' && event.request.method.toUpperCase() === 'GET') {
      const overrideOrgId = url.searchParams.get('org') || '';
      const redirectTo = url.searchParams.get('redirectTo') || '/';
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ORIGIN) return new Response('OAuth not configured', { status: 500 });
      const payload: Record<string, any> = { redirectTo, ts: Date.now(), n: crypto.randomUUID() };
      if (overrideOrgId) payload.orgId = overrideOrgId;
      const state = await signState(env.KURATCHI_AUTH_SECRET, payload);
      const redirect_uri = `${env.ORIGIN}/auth/oauth/google/callback`;
      const scope = encodeURIComponent('openid email profile');
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&include_granted_scopes=true&state=${encodeURIComponent(state)}`;
      return new Response(null, { status: 302, headers: { Location: authUrl } });
    }

    // OAuth (Google): callback (/auth/oauth/google/callback)
    if (pathname === '/auth/oauth/google/callback' && event.request.method.toUpperCase() === 'GET') {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.ORIGIN) return new Response('OAuth not configured', { status: 500 });
      const code = url.searchParams.get('code') || '';
      const state = url.searchParams.get('state') || '';
      const payload = await verifyState(env.KURATCHI_AUTH_SECRET, state);
      if (!code || !payload) return new Response('Bad Request', { status: 400 });
      const redirectTo = (payload as any)?.redirectTo || '/';
      const ts = (payload as any)?.ts;
      const stateOrgId: string | undefined = (payload as any)?.orgId;
      // Optional: state TTL 10 minutes
      if (typeof ts === 'number' && Date.now() - ts > 10 * 60 * 1000) return new Response('State expired', { status: 400 });

      try {
        // Exchange code for tokens
        const redirect_uri = `${env.ORIGIN}/auth/oauth/google/callback`;
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID!,
            client_secret: env.GOOGLE_CLIENT_SECRET!,
            redirect_uri,
            grant_type: 'authorization_code'
          })
        });
        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          return new Response(`Token exchange failed: ${errText}`, { status: 401 });
        }
        const tokenJson = await tokenRes.json();
        const access_token: string = tokenJson.access_token;
        const refresh_token: string | undefined = tokenJson.refresh_token;
        const id_token: string | undefined = tokenJson.id_token;
        const token_type: string | undefined = tokenJson.token_type;
        const scope: string | undefined = tokenJson.scope;
        const expires_in: number | undefined = tokenJson.expires_in;
        const expires_at = expires_in ? Date.now() + expires_in * 1000 : null;

        // Fetch userinfo
        const ures = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        if (!ures.ok) {
          const errText = await ures.text();
          return new Response(`Failed to fetch userinfo: ${errText}`, { status: 401 });
        }
        const u = await ures.json();
        const providerAccountId = String(u.sub);
        const email = u.email as string | undefined;
        const name = (u.name as string | undefined) ?? null;
        const image = (u.picture as string | undefined) ?? null;

        // Resolve organization
        let orgId = stateOrgId || '';
        if (!orgId && email) {
          orgId = (await findOrganizationIdByEmail(email)) || '';
        }
        if (!orgId) return new Response('organization_not_found_for_email', { status: 404 });

        // Link or create user, then create session
        const auth = await (await getAuthApi()).forOrganization(orgId);
        const user = await auth.getOrCreateUserFromOAuth({
          provider: 'google',
          providerAccountId,
          email,
          name,
          image,
          tokens: {
            access_token,
            refresh_token,
            expires_at,
            scope,
            token_type,
            id_token
          }
        });
        const cookie = await auth.upsertSession({ userId: user.id });
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        locals.kuratchi.setSessionCookie(cookie, { expires });
        return new Response(null, { status: 303, headers: { Location: redirectTo || '/' } });
      } catch (e: any) {
        return new Response(`OAuth callback error: ${e?.message || String(e)}`, { status: 500 });
      }
    }

    const cookieVal = event.cookies.get(cookieName);
    if (cookieVal && env?.KURATCHI_AUTH_SECRET) {
      try {
        const parsed = await parseSessionCookie(env.KURATCHI_AUTH_SECRET, cookieVal);
        const orgId = parsed?.orgId;
        if (orgId && orgId !== 'admin') {
          const authService = await (await getAuthApi()).forOrganization(orgId);
          const { sessionData, user } = await authService.validateSessionToken(cookieVal);
          if (sessionData && user) {
            // Expose current org-scoped AuthService under kuratchi.auth.org
            if (!locals.kuratchi.auth) {
              // ensure sdk/auth is initialized and attached
              await getKuratchi();
            }
            (locals.kuratchi as any).auth = await getAuthApi();
            (locals.kuratchi as any).auth.org = authService;
            locals.kuratchi.user = user;
            locals.kuratchi.session = sessionData;
          } else {
            // Session invalid or expired
            locals.kuratchi.clearSessionCookie();
          }
        }
      } catch (e) {
        // On any parsing/validation error, clear cookie silently
        locals.kuratchi.clearSessionCookie();
      }
    }

    return resolve(event);
  };
}

interface AuthConfig {
    resendApiKey: string;
    emailFrom: string;
    origin: string;
    resendAudience?: string;
    authSecret: string;
    workersSubdomain: string;
    accountId: string;
    apiToken: string;
    // Bound admin D1 database (e.g., platform.env.DB)
    adminDb: any;
}

export class KuratchiAuth {
    private kuratchiD1: KuratchiD1;
    private adminDb: any;
    private organizationServices: Map<string, AuthService>;
    private config: AuthConfig;
    public signIn: {
        magicLink: {
            send: (email: string, options?: { redirectTo?: string; organizationId?: string }) => Promise<{ ok: true }>
        };
        oauth: {
            google: {
                startUrl: (params: { organizationId: string; redirectTo?: string }) => string;
            }
        };
    };
    
    constructor(
        config: AuthConfig
    ) {
        this.config = config;
        // Prevent accidental exposure of secrets via console.log / util.inspect
        try {
            Object.defineProperty(this, 'config', { enumerable: false, configurable: false, writable: true });
        } catch {}
        this.organizationServices = new Map();
        
        // Initialize KuratchiD1 instance
        this.kuratchiD1 = new KuratchiD1({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        
        // Initialize admin DB for admin operations
        const admin = config.adminDb as any;
        const isKuratchiClient = !!(admin && typeof admin.query === 'function' && (typeof admin.getDrizzleProxy === 'function' || typeof admin.drizzleProxy === 'function'));
        if (isKuratchiClient) {
            const proxy = (typeof admin.getDrizzleProxy === 'function') ? admin.getDrizzleProxy() : admin.drizzleProxy();
            this.adminDb = drizzleSqliteProxy(proxy, { schema: adminSchema });
        } else {
            throw new Error('Unsupported adminDb: expected KuratchiHttpClient');
        }

        // Validate admin DB contract using KuratchiHttpClient adapter
        const adminAdapter = {
            query: async (sql: string, params?: any[]) => {
                const res = await admin.query(sql, params || []);
                const results = (res && (res.results ?? res.data)) ?? [];
                return { success: res?.success !== false, results } as any;
            }
        };
        void validateAdminSchema(adminAdapter as any);

        // Batteries-included sign-in API (organization-aware)
        // Usage:
        //   await kuratchi.auth.signIn.magicLink.send('a@b.co', { redirectTo: '/', organizationId?: 'org...' })
        //   const url = kuratchi.auth.signIn.oauth.google.startUrl({ organizationId: 'org...', redirectTo: '/' })
        this.signIn = {
            magicLink: {
                send: async (email: string, options?: { redirectTo?: string; organizationId?: string }) => {
                    const redirectTo = options?.redirectTo;
                    let orgId: string | undefined = options?.organizationId;
                    if (!orgId) orgId = await this.findOrganizationIdByEmail(email);
                    if (!orgId) throw new Error('organization_not_found_for_email');

                    const auth = await this.getOrganizationAuthService(orgId);
                    const tokenData = await auth.createMagicLinkToken(email, redirectTo);
                    const origin = this.config.origin;
                    const link = `${origin}/auth/magic/callback?token=${encodeURIComponent(tokenData.token)}&org=${encodeURIComponent(orgId)}`;
                    await auth.sendMagicLink(email, link, { from: this.config.emailFrom });
                    return { ok: true } as const;
                }
            },
            oauth: {
                google: {
                    startUrl: (params: { organizationId: string; redirectTo?: string }) => {
                        const u = new URL(`${this.config.origin}/auth/oauth/google/start`);
                        u.searchParams.set('org', params.organizationId);
                        if (params.redirectTo) u.searchParams.set('redirectTo', params.redirectTo);
                        return u.toString();
                    }
                }
            }
        };
        }

        // Node.js inspect and JSON serialization redaction
        toJSON() {
            return {
                signIn: '[api]',
                // expose minimal safe surface
                forOrganization: '[function]',
                createOrganization: '[function]',
                listOrganizations: '[function]',
                getOrganization: '[function]',
                deleteOrganization: '[function]'
            } as any;
        }

        [Symbol.for('nodejs.util.inspect.custom')]() {
            return this.toJSON();
        }
    
        private buildEnv(adminClient: any) {
            return {
                ADMIN_DB: adminClient,
                RESEND_API_KEY: this.config.resendApiKey,
                EMAIL_FROM: this.config.emailFrom,
                ORIGIN: this.config.origin,
                RESEND_CLUTCHCMS_AUDIENCE: this.config.resendAudience || '',
                KURATCHI_AUTH_SECRET: this.config.authSecret
            };
        }
        
        private async findOrganizationIdByEmail(email: string): Promise<string | undefined> {
            try {
                const mapping = await this.adminDb.query.OrganizationUsers.findFirst({
                    where: and(
                        eq(adminSchema.OrganizationUsers.email, email),
                        isNull(adminSchema.OrganizationUsers.deleted_at)
                    )
                });
                return (mapping as any)?.organizationId || undefined;
            } catch {
                return undefined;
            }
        }
    
        /**
         * Get or create AuthService for a specific organization
         */
        private async getOrganizationAuthService(organizationId: string): Promise<AuthService> {
            if (!this.organizationServices.has(organizationId)) {
                // Resolve the organization's database name from admin DB
                const dbRecord = await this.adminDb.query.Databases.findFirst({
                    where: and(
                        eq(adminSchema.Databases.organizationId, organizationId),
                        isNull(adminSchema.Databases.deleted_at)
                    ),
                    orderBy: desc(adminSchema.Databases.created_at)
                });
                if (!dbRecord || !dbRecord.name) {
                    throw new Error(`No database found for organization ${organizationId}`);
                }

                const databaseName = dbRecord.name;

                // Determine API token by looking up latest valid DB token
                const tokenCandidates = await this.adminDb.query.DBApiTokens.findMany({
                    where: and(
                        eq(adminSchema.DBApiTokens.databaseId, dbRecord.id),
                        isNull(adminSchema.DBApiTokens.deleted_at),
                        eq(adminSchema.DBApiTokens.revoked, false)
                    ),
                    orderBy: desc(adminSchema.DBApiTokens.created_at)
                });
                const nowMs = Date.now();
                const isNotExpired = (exp: any) => {
                    if (!exp) return true; // no expiry
                    if (exp instanceof Date) return exp.getTime() > nowMs;
                    if (typeof exp === 'number') return exp > nowMs;
                    // attempt to parse if string
                    const t = new Date(exp as any).getTime();
                    return !Number.isNaN(t) ? t > nowMs : true;
                };
                const valid = tokenCandidates.find((t: any) => isNotExpired((t as any).expires));
                if (!valid) {
                    throw new Error(`No valid API token found for organization database ${dbRecord.id}`);
                }
                const effectiveToken = (valid as any).token as string;

                // Get client for organization database
                const organizationClient = this.kuratchiD1.getClient({
                    databaseName,
                    apiToken: effectiveToken!
                });
                
                // Validate organization DB contract
                await validateOrganizationSchema(organizationClient);

                // Get Drizzle proxy with organization schema
                const orgDrizzleProxy = this.kuratchiD1.getDrizzleClient({
                    databaseName,
                    apiToken: effectiveToken!
                });
                
                const drizzleDB = drizzleSqliteProxy(orgDrizzleProxy as any, { schema: organizationSchema });
                
                const authService = new AuthService(
                    drizzleDB as any,
                    this.buildEnv(organizationClient),
                    organizationSchema
                );
                
                this.organizationServices.set(organizationId, authService);
            }
            
            return this.organizationServices.get(organizationId)!;
        }
    
        // Admin operations using adminDb directly
        // Creates organization, provisions DB, optionally migrates org schema, seeds initial user, and creates a session
        async createOrganization(
            data: any,
            options?: {
                migrate?: boolean; // default true
                migrationsDir?: string; // default 'org' (expects /migrations-org/ when using Vite loader)
                migrationsPath?: string; // optional absolute/relative FS path to migrations folder (./migrations-org)
            }
        ) {
            // 1) Create organization row
            const orgId = crypto.randomUUID();
            const [org] = await this.adminDb.insert(adminSchema.Organizations)
                .values({
                    ...data,
                    id: orgId
                })
                .returning();
            if (!org) throw new Error('Failed to create organization');

            // 2) Provision D1 database for this org
            const dbName = (org as any).organizationSlug || (org as any).organizationName || `org-${orgId}`;
            const { database, apiToken } = await this.kuratchiD1.createDatabase(String(dbName));

            // 3) Persist database metadata
            const dbId = crypto.randomUUID();
            const [dbRow] = await this.adminDb.insert(adminSchema.Databases)
                .values({
                    id: dbId,
                    name: database?.name ?? String(dbName),
                    dbuuid: database?.uuid ?? database?.id,
                    organizationId: org.id
                })
                .returning();
            if (!dbRow) throw new Error('Failed to persist organization database');

            // 4) Store API token for the org DB
            const [tokenRow] = await this.adminDb.insert(adminSchema.DBApiTokens)
                .values({
                    id: crypto.randomUUID(),
                    token: apiToken,
                    name: 'primary',
                    databaseId: dbRow.id
                })
                .returning();
            if (!tokenRow) throw new Error('Failed to persist organization DB API token');

            // 5) Optionally migrate the organization's database schema
            const shouldMigrate = options?.migrate !== false;
            const migrationsDir = options?.migrationsDir || 'org';
            let migrationStrategy: 'vite' | 'fs' | 'skipped' | 'failed' = 'skipped';
            if (shouldMigrate) {
                try {
                    // Prefer Vite-based loader when available
                    await this.kuratchiD1.database({ databaseName: String(database?.name || dbName), apiToken })
                        .migrateAuto(migrationsDir);
                    migrationStrategy = 'vite';
                } catch {
                    // Optional secondary path: filesystem loader if a migrationsPath was provided
                    if (options?.migrationsPath) {
                        try {
                            const root = options.migrationsPath;
                            const mod = await import('../d1/migrations-handler.js');
                            const createFsMigrationLoader = (mod as any).createFsMigrationLoader as (r: string) => Promise<any>;
                            if (typeof createFsMigrationLoader !== 'function') throw new Error('createFsMigrationLoader not found');
                            const loader = await createFsMigrationLoader(root);
                            await this.kuratchiD1.database({ databaseName: String(database?.name || dbName), apiToken })
                                .migrateWithLoader(migrationsDir, loader);
                            migrationStrategy = 'fs';
                        } catch {
                            migrationStrategy = 'failed';
                        }
                    } else {
                        migrationStrategy = 'failed';
                    }
                }
            }

            // 6) Seed initial organization user and create a session
            // Build an organization-scoped AuthService using the just-provisioned DB
            const orgAuth = await this.getOrganizationAuthService(orgId);
            let createdUser: any = null;
            let sessionCookie: string | null = null;
            if (data?.email) {
                // Allow passing password; AuthService will hash if plain provided
                createdUser = await orgAuth.createUser({
                    email: data.email,
                    password: data.password,
                    name: data.name || data.organizationName || null,
                    firstName: data.firstName || null,
                    lastName: data.lastName || null,
                    role: data.role || 'owner'
                }, false);
                sessionCookie = await orgAuth.upsertSession({ userId: createdUser.id });
            }

            // 7) Create OrganizationUsers mapping in admin DB
            if (data?.email) {
                await this.adminDb.insert(adminSchema.OrganizationUsers)
                    .values({
                        id: crypto.randomUUID(),
                        email: data.email,
                        organizationId: org.id,
                        organizationSlug: (org as any).organizationSlug || null
                    })
                    .returning();
            }

            return {
                organization: org ?? null,
                database: dbRow,
                token: tokenRow,
                migration: { strategy: migrationStrategy },
                user: createdUser,
                sessionCookie
            };
        }
    
        async listOrganizations() {
            return await this.adminDb.query.Organizations.findMany({
                where: isNull(adminSchema.Organizations.deleted_at),
                orderBy: desc(adminSchema.Organizations.created_at)
            });
        }
    
        async getOrganization(id: string) {
            return await this.adminDb.query.Organizations.findFirst({
                where: and(
                    eq(adminSchema.Organizations.id, id),
                    isNull(adminSchema.Organizations.deleted_at)
                )
            });
        }

        /**
         * Delete an organization: delete D1 database and soft-delete related admin records.
         */
        async deleteOrganization(organizationId: string) {
            // Find active database for this org
            const db = await this.adminDb.query.Databases.findFirst({
                where: and(
                    eq(adminSchema.Databases.organizationId, organizationId),
                    isNull(adminSchema.Databases.deleted_at)
                ),
                orderBy: desc(adminSchema.Databases.created_at)
            });

            // Best-effort delete in Cloudflare if we have a uuid
            if (db?.dbuuid) {
                try {
                    await this.kuratchiD1.deleteDatabase(db.dbuuid);
                } catch (e) {
                    console.error('Failed to delete Cloudflare D1 database for org', organizationId, e);
                }
            }

            const now = new Date().toISOString();

            // Soft-delete DB tokens for this DB
            if (db?.id) {
                await this.adminDb
                    .update(adminSchema.DBApiTokens)
                    .set({ revoked: true as any, deleted_at: now as any })
                    .where(eq(adminSchema.DBApiTokens.databaseId, db.id));

                // Soft-delete database row
                await this.adminDb
                    .update(adminSchema.Databases)
                    .set({ deleted_at: now as any })
                    .where(eq(adminSchema.Databases.id, db.id));
            }

            // Soft-delete organization
            await this.adminDb
                .update(adminSchema.Organizations)
                .set({ deleted_at: now as any })
                .where(eq(adminSchema.Organizations.id, organizationId));

            return true;
        }
    
    async authenticate(email: string, password: string) {
        const mapping = await this.adminDb.query.OrganizationUsers.findFirst({
            where: and(
                eq(adminSchema.OrganizationUsers.email, email),
                isNull(adminSchema.OrganizationUsers.deleted_at)
            ),
            with: { Organization: true }
        });
        if (!mapping || !mapping.organizationId) return null;
        
        // Get the organization to retrieve details
        const org = await this.getOrganization(mapping.organizationId);
        if (!org) return null;
        
        // Resolve organization AuthService using the per-database token from admin DB
        const orgAuth = await this.getOrganizationAuthService(mapping.organizationId);
        return orgAuth.createAuthSession(email, password);
    }

    /**
     * Return an organization-scoped AuthService without duplicating methods.
     * Usage: const auth = await kuratchi.auth.forOrganization(organizationId); await auth.createUser(...)
     */
    async forOrganization(
        organizationId: string
    ): Promise<AuthService> {
        return this.getOrganizationAuthService(organizationId);
    }

    /**
     * SvelteKit handle wrapper for clean usage: kuratchi.auth.handle()
     * Delegates to createAuthHandle() which reads env and ADMIN_DB from event.platform.env by default.
     */
    handle(options: CreateAuthHandleOptions = {}): Handle {
        // Delegate to createAuthHandle. It will read env via $env/dynamic/private
        // and build the admin Kuratchi HTTP client from KURATCHI_ADMIN_DB_NAME/TOKEN.
        return createAuthHandle({ ...options });
    }
}
