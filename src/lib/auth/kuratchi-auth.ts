import { KuratchiD1 } from '../d1/kuratchi-d1.js';
import { CloudflareClient } from '../cloudflare.js';
import { KuratchiDO } from '../do/kuratchi-do.js';
import { KuratchiKV } from '../kv/kuratchi-kv.js';
import { KuratchiR2 } from '../r2/kuratchi-r2.js';
import { KuratchiQueues } from '../queues/kuratchi-queues.js';
import { AuthService } from './AuthService.js';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { parseSessionCookie, signState, verifyState } from './utils.js';
import { adminSchemaDsl } from '../schema/admin.js';
import { organizationSchemaDsl } from '../schema/organization.js';
import { normalizeSchema } from '../schema/normalize.js';
import { createClientFromJsonSchema, type TableApi } from '../orm/kuratchi-orm.js';
import { KuratchiHttpClient } from '../d1Legacy/internal-http-client.js';

// Consolidated SvelteKit handle and types (previously in sveltekit.ts)
export const KURATCHI_SESSION_COOKIE = 'kuratchi_session';

// Utility to allow sync or async returns
type MaybePromise<T> = T | Promise<T>;

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
  // Optional: master gateway key for DO-backed org databases
  KURATCHI_GATEWAY_KEY?: string;
};

export interface CreateAuthHandleOptions {
  cookieName?: string;
  // Optional override to provide an admin DB client. Can be async.
  getAdminDb?: (event: RequestEvent) => MaybePromise<any>;
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
      KURATCHI_ADMIN_DB_TOKEN: pick('KURATCHI_ADMIN_DB_TOKEN'),
      KURATCHI_GATEWAY_KEY: pick('KURATCHI_GATEWAY_KEY')
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
    // Provide top-level mirrors for common patterns: locals.user / locals.session
    if (typeof locals.user === 'undefined') locals.user = null;
    if (typeof locals.session === 'undefined') locals.session = null;

    // Cookie helpers live under kuratchi
    const sanitizeUser = (u: any) => {
      if (!u || typeof u !== 'object') return u;
      const { password_hash, ...rest } = u as any;
      return rest;
    };
    locals.kuratchi.setSessionCookie = (value: string, opts?: { expires?: Date }) => {
      const expires = opts?.expires;
      const isHttps = new URL(event.request.url).protocol === 'https:';
      event.cookies.set(cookieName, value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        path: '/',
        ...(expires ? { expires } : {})
      });
    };
    locals.kuratchi.clearSessionCookie = () => {
      event.cookies.delete(cookieName, { path: '/' });
    };
    // Server-only helper to get org ORM client
    locals.kuratchi.orgDatabaseClient = async (orgIdOverride?: string) => {
      if (typeof window !== 'undefined') throw new Error('[Kuratchi] orgDatabaseClient() is server-only');
      const rawCookie = event.cookies.get(cookieName);
      const parsed = rawCookie ? await parseSessionCookie((await getEnv(event as any)).KURATCHI_AUTH_SECRET, rawCookie) : null;
      const currentOrg = orgIdOverride || locals.kuratchi?.session?.organizationId || parsed?.orgId;
      if (!currentOrg || currentOrg === 'admin') throw new Error('[Kuratchi] organizationId is required');
      const auth = await getAuthApi();
      return await (auth as any).getOrganizationDb(currentOrg);
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
      if (sdk) {
        // Ensure sdk helpers (including auth) are present on locals every request
        Object.assign(locals.kuratchi, sdk);
        return sdk;
      }
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
          adminDb,
          // Wire DO gateway key when present so DO-backed org flows work
          gatewayKey: env.KURATCHI_GATEWAY_KEY
        }
      });
      // Expose the SDK instance under locals.kuratchi, preserving existing helpers
      Object.assign(locals.kuratchi, sdk);
      // Batteries-included: wrap credentials.authenticate to set cookie automatically
      try {
        const authApi = (sdk as any).auth as KuratchiAuth;
        const original = authApi?.signIn?.credentials?.authenticate;
        if (typeof original === 'function') {
          authApi.signIn.credentials.authenticate = async (email: string, password: string, options?: any) => {
            const res: any = await original.call(authApi, email, password, options);
            if (res?.success && res.cookie) {
              const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              locals.kuratchi.setSessionCookie(res.cookie, { expires });
              // Populate locals immediately for this request
              if (res.user) {
                const safeUser = sanitizeUser(res.user);
                locals.kuratchi.user = safeUser;
                locals.user = safeUser;
              }
              if (res.session) {
                const merged = { ...res.session, user: sanitizeUser(res.user) };
                locals.kuratchi.session = merged;
                locals.session = merged;
              }
            }
            return res;
          };
        }
        // Also wrap createOrganization to set cookie if sessionCookie is returned
        const originalCreateOrg = (authApi as any)?.createOrganization;
        if (typeof originalCreateOrg === 'function') {
          (authApi as any).createOrganization = async (...args: any[]) => {
            const result = await originalCreateOrg.apply(authApi, args);
            const cookie = (result as any)?.sessionCookie || (result as any)?.cookie;
            if (cookie) {
              const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              locals.kuratchi.setSessionCookie(cookie, { expires });
              // Parse cookie to discover organizationId, then validate and populate locals
              try {
                const env = await getEnv(event as any);
                const parsed = await parseSessionCookie(env.KURATCHI_AUTH_SECRET, cookie);
                const orgId = parsed?.orgId;
                if (orgId && typeof (authApi as any).forOrganization === 'function') {
                  const orgAuth = await (authApi as any).forOrganization(orgId);
                  const { sessionData, user } = await orgAuth.validateSessionToken(cookie);
                  if (sessionData && user) {
                    const safeUser = sanitizeUser(user);
                    locals.kuratchi.user = safeUser;
                    const merged = { ...sessionData, user: safeUser };
                    locals.kuratchi.session = merged;
                    locals.user = safeUser;
                    locals.session = merged;
                  }
                }
              } catch {}
            }
            return result;
          };
        }
      } catch {}
      return sdk;
    };

    // Helper to get the Auth API (narrowed to KuratchiAuth)
    const getAuthApi = async (): Promise<KuratchiAuth> => {
      const k = await getKuratchi();
      return k.auth as KuratchiAuth;
    };

    // Ensure SDK and auth API are attached on every request for batteries-included DX
    try {
      await getKuratchi();
      (locals.kuratchi as any).auth = await getAuthApi();
    } catch {}

    // Helper: look up organizationId by email in admin DB (Kuratchi HTTP client only)
    const findOrganizationIdByEmail = async (email: string): Promise<string | null> => {
      try {
        const adminDb = await getAdminDbLazy().catch(() => null);
        if (!adminDb || typeof (adminDb as any).query !== 'function') return null;
        const sql = 'SELECT organizationId FROM organizationUsers WHERE email = ? AND deleted_at IS NULL LIMIT 1';
        const res = await (adminDb as KuratchiHttpClient).query(sql, [email]);
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
          return new Response(JSON.stringify({ success: false, error: 'email_not_configured' }), { status: 500, headers: { 'content-type': 'application/json' } });

        if (!email) return new Response(JSON.stringify({ success: false, error: 'email_required' }), { status: 400, headers: { 'content-type': 'application/json' } });
        if (!orgId) orgId = await findOrganizationIdByEmail(email);
        if (!orgId) return new Response(JSON.stringify({ success: false, error: 'organization_not_found_for_email' }), { status: 404, headers: { 'content-type': 'application/json' } });

        const auth = await (await getAuthApi()).forOrganization(orgId);
        const tokenData = await auth.createMagicLinkToken(email, redirectTo);
        const origin = env.ORIGIN || `${url.protocol}//${url.host}`;
        const link = `${origin}/auth/magic/callback?token=${encodeURIComponent(tokenData.token)}&org=${encodeURIComponent(orgId)}`;
        await auth.sendMagicLink(email, link);
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: 'send_failed', detail: e?.message || String(e) }), { status: 500, headers: { 'content-type': 'application/json' } });
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
        const cookie = await auth.upsertSession({ userId: user.id, organizationId: orgId });
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
            const safeUser = sanitizeUser(user);
            locals.kuratchi.user = safeUser;
            const merged = { ...sessionData, organizationId: sessionData.organizationId || orgId, user: safeUser };
            locals.kuratchi.session = merged;
            // populate mirrors
            locals.user = safeUser;
            locals.session = merged;
          } else {
            // Session invalid or expired
            locals.kuratchi.clearSessionCookie();
            locals.user = null;
            locals.session = null;
          }
        }
      } catch (e) {
        // On any parsing/validation error, clear cookie silently
        locals.kuratchi.clearSessionCookie();
        locals.user = null;
        locals.session = null;
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
    // Optional master gateway key for DO-backed org databases (required if using DO)
    gatewayKey?: string;
}

export class KuratchiAuth {
private kuratchiD1: KuratchiD1;
private kuratchiDO: KuratchiDO;
private kuratchiKV: KuratchiKV;
private kuratchiR2: KuratchiR2;
private kuratchiQueues: KuratchiQueues;
private adminDb: any;
private organizationServices: Map<string, AuthService>;
private organizationOrmClients: Map<string, Record<string, TableApi>>;
private config: AuthConfig;
public signIn: {
  magicLink: {
    send: (email: string, options?: { redirectTo?: string; organizationId?: string }) => Promise<{ success: true }>
  };
  credentials: {
    authenticate: (
      email: string,
      password: string,
      options?: { organizationId?: string; ipAddress?: string; userAgent?: string; redirectTo?: string }
    ) => Promise<
      | { success: true; cookie: string; user: any; session: any }
      | { success: false; error: 'invalid_credentials' }
    >
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
        this.organizationOrmClients = new Map();
        
        // Initialize Kuratchi D1 router (v2) instance
        this.kuratchiD1 = new KuratchiD1({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain,
            // Provide Admin DB as the source of truth for initial router bindings
            listDbsForBindings: async () => {
                try {
                    const res = await (this.adminDb as any).databases
                        .where({ deleted_at: { is: null } })
                        .orderBy({ created_at: 'asc' })
                        .many();
                    const rows = ((res as any)?.data ?? []) as Array<any>;
                    return rows
                        .filter((r) => r && r.name && r.dbuuid)
                        .map((r) => ({ name: r.name as string, uuid: r.dbuuid as string }));
                } catch {
                    return [];
                }
            }
        });
        // Initialize KuratchiDO instance (available for DO-backed orgs)
        this.kuratchiDO = new KuratchiDO({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        // Initialize other Cloudflare services (KV, R2, Queues)
        this.kuratchiKV = new KuratchiKV({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        this.kuratchiR2 = new KuratchiR2({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        this.kuratchiQueues = new KuratchiQueues({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        
        // Initialize admin DB runtime client (Kuratchi HTTP client only)
        const admin = config.adminDb as any;
        const isKuratchiClient = !!(admin && typeof admin.query === 'function');
        if (isKuratchiClient) {
            const adminSchema = normalizeSchema(adminSchemaDsl as any);
            this.adminDb = createClientFromJsonSchema(
                (sql, params) => admin.query(sql, params || []),
                adminSchema as any
            ) as Record<string, TableApi>;
        } else {
            throw new Error('Unsupported adminDb: expected KuratchiHttpClient');
        }

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
                    return { success: true } as const;
                }
            },
            credentials: {
                authenticate: async (
                    email: string,
                    password: string,
                    options?: { organizationId?: string; ipAddress?: string; userAgent?: string; redirectTo?: string }
                ) => {
                    let orgId: string | undefined = options?.organizationId;
                    if (!orgId) orgId = await this.findOrganizationIdByEmail(email);
                    if (!orgId) throw new Error('organization_not_found_for_email');

                    const auth = await this.getOrganizationAuthService(orgId);
                    const result = await auth.createAuthSession(
                        email,
                        password,
                        options?.ipAddress,
                        options?.userAgent,
                        orgId
                    );
                    if (!result) return { success: false as const, error: 'invalid_credentials' } as const;
                    return {
                        success: true as const,
                        cookie: result.sessionId,
                        user: result.user,
                        session: result.sessionData,
                    } as const;
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
                const res = await (this.adminDb as any).organizationUsers.where({ email, deleted_at: { is: null } }).first();
                const mapping = (res as any)?.data;
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
                const dbRes = await (this.adminDb as any).databases
                    .where({ organizationId, deleted_at: { is: null } })
                    .orderBy({ created_at: 'desc' })
                    .first();
                const dbRecord = (dbRes as any)?.data;
                if (!dbRecord || !dbRecord.name) {
                    throw new Error(`No database found for organization ${organizationId}`);
                }

                const databaseName = dbRecord.name;

                // Determine API token by looking up latest valid DB token
                const tokenRes = await (this.adminDb as any).dbApiTokens
                    .where({ databaseId: dbRecord.id, deleted_at: { is: null }, revoked: false })
                    .orderBy({ created_at: 'desc' })
                    .many();
                const tokenCandidates = (tokenRes as any)?.data ?? [];
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

                // Decide engine based on presence of dbuuid: if present => D1 (router v2), else assume DO
                const isD1 = !!(dbRecord as any).dbuuid;
                let exec: (sql: string, params?: any[]) => Promise<any>;
                if (isD1) {
                    if (!this.config.gatewayKey) {
                        throw new Error('[KuratchiAuth] gatewayKey is required in config to use D1 router');
                    }
                    const organizationClient = this.kuratchiD1.getClient({
                        databaseName,
                        dbToken: effectiveToken!,
                        gatewayKey: this.config.gatewayKey
                    });
                    exec = (sql: string, params?: any[]) => organizationClient.query(sql, params || []);
                } else {
                    if (!this.config.gatewayKey) {
                        throw new Error('[KuratchiAuth] gatewayKey is required in config to use DO-backed organization databases');
                    }
                    const doClient = this.kuratchiDO.getClient({
                        databaseName,
                        dbToken: effectiveToken!,
                        gatewayKey: this.config.gatewayKey
                    });
                    exec = (sql: string, params?: any[]) => doClient.query(sql, params || []);
                }

                // Build runtime ORM client for organization DB
                const orgSchema = normalizeSchema(organizationSchemaDsl as any);
                const orgClient = createClientFromJsonSchema(
                    (sql, params) => exec(sql, params),
                    orgSchema as any
                ) as Record<string, TableApi>;
                const authService = new AuthService(
                    orgClient as any,
                    this.buildEnv(isD1
                        ? this.kuratchiD1.getClient({ databaseName, dbToken: effectiveToken!, gatewayKey: this.config.gatewayKey! })
                        : this.kuratchiDO.getClient({ databaseName, dbToken: effectiveToken!, gatewayKey: this.config.gatewayKey! })
                    )
                );
                
                this.organizationServices.set(organizationId, authService);
                this.organizationOrmClients.set(organizationId, orgClient);
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
                // Optional resource provisioning
                provisionKV?: boolean;
                provisionR2?: boolean;
                provisionQueues?: boolean;
                kvTitle?: string;
                r2BucketName?: string;
                queueName?: string;
                // Engine selection
                d1?: boolean; // default true
                do?: boolean; // if true, uses Durable Objects engine
                // Optional gateway key for DO; if omitted, uses config.gatewayKey
                gatewayKey?: string;
            }
        ) {
            // 1) Get or create organization row idempotently (whitelist allowed columns)
            const src: any = data || {};
            let org: any | null = null;
            // Prefer matching by slug for idempotency if provided
            if (src.organizationSlug) {
                try {
                    const existing = await (this.adminDb as any).organizations
                        .where({ organizationSlug: src.organizationSlug, deleted_at: { is: null } } as any)
                        .first();
                    org = (existing as any)?.data || null;
                } catch {}
            }
            // If not found by slug, optionally match by email (soft heuristic)
            if (!org && src.email) {
                try {
                    const existing = await (this.adminDb as any).organizations
                        .where({ email: src.email, deleted_at: { is: null } } as any)
                        .first();
                    org = (existing as any)?.data || null;
                } catch {}
            }
            if (!org) {
                // Pre-insert uniqueness check for contact email (better DX)
                if (src.email) {
                    try {
                        const existing = await (this.adminDb as any).organizations
                            .where({ email: src.email, deleted_at: { is: null } })
                            .first();
                        if ((existing as any)?.data) {
                            throw new Error('organization_email_already_exists');
                        }
                    } catch (err) {
                        if (err instanceof Error && err.message.includes('already exists')) throw err;
                    }
                }
                const orgId = crypto.randomUUID();
                const orgValues: any = {
                    id: orgId,
                    organizationName: src.organizationName,
                    organizationSlug: src.organizationSlug,
                    email: src.email,
                    status: src.status ?? 'active',
                };
                try {
                    await (this.adminDb as any).organizations.insert(orgValues);
                    org = orgValues;
                } catch (e) {
                    // Handle race or prior creation: fetch by slug (preferred) or email
                    if (src.organizationSlug) {
                        const existing = await (this.adminDb as any).organizations
                            .where({ organizationSlug: src.organizationSlug, deleted_at: { is: null } } as any)
                            .first();
                        org = (existing as any)?.data || null;
                    }
                    if (!org && src.email) {
                        const existing = await (this.adminDb as any).organizations
                            .where({ email: src.email, deleted_at: { is: null } } as any)
                            .first();
                        org = (existing as any)?.data || null;
                    }
                    if (!org) throw e;
                }
            }

            // 2) Determine engine and provision database idempotently
            const dbName = (org as any).organizationSlug || (org as any).organizationName || `org-${(org as any).id}`;
            const useDO = options?.do === true;
            const useD1 = options?.d1 !== false && !useDO; // default D1 unless DO explicitly selected

            // Insert database row first to enforce name uniqueness and enable idempotency
            let dbRow: any | null = null;
            const dbId = crypto.randomUUID();
            try {
                await (this.adminDb as any).databases.insert({
                    id: dbId,
                    name: String(dbName),
                    dbuuid: useD1 ? '' : null,
                    organizationId: org.id
                });
                const sel = await (this.adminDb as any).databases.where({ id: dbId } as any).first();
                dbRow = (sel as any)?.data || { id: dbId, name: String(dbName), dbuuid: useD1 ? '' : null, organizationId: org.id };
            } catch (e: any) {
                // If name is unique and already exists, fetch it
                const existing = await (this.adminDb as any).databases.where({ name: String(dbName), deleted_at: { is: null } } as any).first();
                dbRow = (existing as any)?.data;
                if (!dbRow) throw e;
            }

            // Check for existing valid API token to avoid re-provisioning
            let apiToken: string | null = null;
            let tokenRow: any | null = null;
            try {
                const tokenRes = await (this.adminDb as any).dbApiTokens
                    .where({ databaseId: dbRow.id, deleted_at: { is: null }, revoked: false } as any)
                    .orderBy({ created_at: 'desc' })
                    .many();
                const tokens = ((tokenRes as any)?.data ?? []) as any[];
                const now = Date.now();
                const notExpired = (exp: any) => {
                    if (!exp) return true;
                    if (exp instanceof Date) return exp.getTime() > now;
                    if (typeof exp === 'number') return exp > now;
                    const t = new Date(exp as any).getTime();
                    return Number.isNaN(t) ? true : t > now;
                };
                const valid = tokens.find((t) => notExpired((t as any).expires));
                if (valid) {
                    apiToken = (valid as any).token;
                    tokenRow = valid;
                }
            } catch {}

            let database: any = null;
            let provisioned = false;

            if (!apiToken) {
                if (useDO) {
                    const gatewayKey = options?.gatewayKey || this.config.gatewayKey;
                    if (!gatewayKey) throw new Error('[KuratchiAuth] gatewayKey required to create DO-backed database');
                    const res = await this.kuratchiDO.createDatabase({
                        databaseName: String(dbName),
                        gatewayKey,
                        migrate: options?.migrate !== false,
                        schema: organizationSchemaDsl as any
                    });
                    apiToken = res.token;
                    database = { name: res.databaseName };
                    provisioned = true;
                    // Ensure dbuuid remains null/empty for DO to signal engine type
                    await (this.adminDb as any).databases.update({ id: dbRow.id } as any, { name: String(dbName) } as any);
                } else {
                    // D1 router v2 path (default)
                    const gatewayKey = options?.gatewayKey || this.config.gatewayKey;
                    if (!gatewayKey) throw new Error('[KuratchiAuth] gatewayKey required to create D1 database');
                    const created = await this.kuratchiD1.createDatabase({
                        databaseName: String(dbName),
                        gatewayKey,
                        migrate: options?.migrate !== false,
                        schema: organizationSchemaDsl as any,
                    });
                    database = created.database;
                    apiToken = created.token;
                    provisioned = true;
                    // Update db row with real D1 uuid
                    await (this.adminDb as any).databases.update(
                        { id: dbRow.id } as any,
                        { name: database?.name ?? String(dbName), dbuuid: (database as any)?.uuid ?? (database as any)?.id } as any
                    );
                }

                // Persist API token for the org DB
                tokenRow = {
                    id: crypto.randomUUID(),
                    token: apiToken!,
                    name: 'primary',
                    databaseId: dbRow.id,
                    revoked: false
                };
                await (this.adminDb as any).dbApiTokens.insert(tokenRow);
            }

            // 5) Optionally provision Cloudflare resources (KV, R2, Queues) and persist admin records
            const doKV = options?.provisionKV === true;
            const doR2 = options?.provisionR2 === true;
            const doQueues = options?.provisionQueues === true;
            const baseName = String((org as any).organizationSlug || (org as any).organizationName || `org-${org.id}`);

            if (doKV && (this.adminDb as any).kvNamespaces && (this.adminDb as any).kvApiTokens) {
                const kvTitle = (options?.kvTitle || `${baseName}-kv`).toString();
                const { namespace, apiToken: kvApiToken } = await this.kuratchiKV.createNamespace(kvTitle);
                const kvRowId = crypto.randomUUID();
                await (this.adminDb as any).kvNamespaces.insert({
                    id: kvRowId,
                    namespaceId: (namespace as any)?.id,
                    title: (namespace as any)?.title || kvTitle,
                    organizationId: org.id
                });
                await (this.adminDb as any).kvApiTokens.insert({
                    id: crypto.randomUUID(),
                    token: kvApiToken,
                    name: 'primary',
                    kvNamespaceId: kvRowId
                });
            }

            if (doR2 && (this.adminDb as any).r2Buckets && (this.adminDb as any).r2ApiTokens) {
                const r2Name = (options?.r2BucketName || `${baseName}-r2`).toString().toLowerCase();
                const { bucket, apiToken: r2ApiToken } = await this.kuratchiR2.createBucket(r2Name);
                const r2RowId = crypto.randomUUID();
                await (this.adminDb as any).r2Buckets.insert({
                    id: r2RowId,
                    name: (bucket as any)?.name || r2Name,
                    organizationId: org.id
                });
                await (this.adminDb as any).r2ApiTokens.insert({
                    id: crypto.randomUUID(),
                    token: r2ApiToken,
                    name: 'primary',
                    r2BucketId: r2RowId
                });
            }

            if (doQueues && (this.adminDb as any).queues && (this.adminDb as any).queueApiTokens) {
                const qName = (options?.queueName || `${baseName}-queue`).toString();
                const { queue, apiToken: qApiToken } = await this.kuratchiQueues.createQueue(qName);
                const qRowId = crypto.randomUUID();
                await (this.adminDb as any).queues.insert({
                    id: qRowId,
                    cfid: (queue as any)?.id || (queue as any)?.queue_id || null,
                    name: (queue as any)?.queue_name || (queue as any)?.name || qName,
                    organizationId: org.id
                });
                await (this.adminDb as any).queueApiTokens.insert({
                    id: crypto.randomUUID(),
                    token: qApiToken,
                    name: 'primary',
                    queueId: qRowId
                });
            }

            // 6) Optionally migrate the organization's database schema
            const shouldMigrate = options?.migrate !== false;
            const migrationsDir = options?.migrationsDir || 'org';
            let migrationStrategy: 'vite' | 'router-init' | 'do-init' | 'skipped' | 'failed' = 'skipped';
            if (shouldMigrate) {
                if (useD1) {
                    // D1v2 path: migrations applied during createDatabase() via schema
                    migrationStrategy = 'router-init';
                } else if (useDO) {
                    // DO path: migrations applied during DO createDatabase()
                    migrationStrategy = 'do-init';
                }
            }

            // 7) Seed initial organization user and create a session
            // Build an organization-scoped AuthService using the just-provisioned DB
            const orgAuth = await this.getOrganizationAuthService((org as any).id);
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

            // 8) Create OrganizationUsers mapping in admin DB (idempotent)
            if (data?.email) {
                try {
                    // Check if mapping already exists
                    const existing = await (this.adminDb as any).organizationUsers
                        .where({ email: data.email, organizationId: org.id, deleted_at: { is: null } } as any)
                        .first();
                    if (!(existing as any)?.data) {
                        await (this.adminDb as any).organizationUsers.insert({
                            id: crypto.randomUUID(),
                            email: data.email,
                            organizationId: org.id,
                            organizationSlug: (org as any).organizationSlug || null
                        });
                    }
                } catch {
                    // Best-effort; ignore duplicate errors
                }
            }

            return {
                success: true as const,
                sessionCookie
            };
        }
    
        async listOrganizations() {
            const res = await (this.adminDb as any).organizations
                .where({ deleted_at: { is: null } })
                .orderBy({ created_at: 'desc' })
                .many();
            return (res as any)?.data ?? [];
        }
    
        async getOrganization(id: string) {
            const res = await (this.adminDb as any).organizations.where({ id, deleted_at: { is: null } } as any).first();
            return (res as any)?.data;
        }

        /**
         * Delete an organization: delete D1 database and soft-delete related admin records.
         */
        async deleteOrganization(organizationId: string) {
            // Find active database for this org
            const dbRes = await (this.adminDb as any).databases
                .where({ organizationId, deleted_at: { is: null } })
                .orderBy({ created_at: 'desc' })
                .first();
            const db = (dbRes as any)?.data;

            // Best-effort delete in Cloudflare if we have a uuid
            if (db?.dbuuid) {
                try {
                    const cf = new CloudflareClient({ apiToken: this.config.apiToken, accountId: this.config.accountId });
                    await cf.deleteDatabase(db.dbuuid);
                } catch (e) {
                    console.error('Failed to delete Cloudflare D1 database for org', organizationId, e);
                }
            }

            const now = new Date().toISOString();

            // Soft-delete DB tokens for this DB
            if (db?.id) {
                await (this.adminDb as any).dbApiTokens.update({ databaseId: db.id } as any, { revoked: true as any, deleted_at: now as any });
                await (this.adminDb as any).databases.update({ id: db.id } as any, { deleted_at: now as any });
            }

            // Best-effort delete KV namespaces
            if ((this.adminDb as any).kvNamespaces) {
            const kvNsRes = await (this.adminDb as any).kvNamespaces.where({ organizationId, deleted_at: { is: null } }).many();
            const kvNamespaces = ((kvNsRes as any)?.data ?? []) as any[];
            for (const ns of kvNamespaces) {
                const nsId = (ns as any).namespaceId;
                if (nsId) {
                    try { await this.kuratchiKV.deleteNamespace(nsId); } catch (e) {
                        console.error('Failed to delete KV namespace for org', organizationId, nsId, e);
                    }
                }
                if ((this.adminDb as any).kvApiTokens) {
                    await (this.adminDb as any).kvApiTokens.update({ kvNamespaceId: (ns as any).id } as any, { revoked: true as any, deleted_at: now as any });
                }
                await (this.adminDb as any).kvNamespaces.update({ id: (ns as any).id } as any, { deleted_at: now as any });
            }
            }

            // Best-effort delete R2 buckets
            if ((this.adminDb as any).r2Buckets) {
            const r2Res = await (this.adminDb as any).r2Buckets.where({ organizationId, deleted_at: { is: null } }).many();
            const r2Buckets = ((r2Res as any)?.data ?? []) as any[];
            for (const b of r2Buckets) {
                const name = (b as any).name;
                if (name) {
                    try { await this.kuratchiR2.deleteBucket(name); } catch (e) {
                        console.error('Failed to delete R2 bucket for org', organizationId, name, e);
                    }
                }
                if ((this.adminDb as any).r2ApiTokens) {
                    await (this.adminDb as any).r2ApiTokens.update({ r2BucketId: (b as any).id } as any, { revoked: true as any, deleted_at: now as any });
                }
                await (this.adminDb as any).r2Buckets.update({ id: (b as any).id } as any, { deleted_at: now as any });
            }
            }

            // Best-effort delete Queues
            if ((this.adminDb as any).queues) {
            const qRes = await (this.adminDb as any).queues.where({ organizationId, deleted_at: { is: null } }).many();
            const queues = ((qRes as any)?.data ?? []) as any[];
            for (const q of queues) {
                const target = (q as any).cfid || (q as any).name;
                if (target) {
                    try { await this.kuratchiQueues.deleteQueue(String(target)); } catch (e) {
                        console.error('Failed to delete Queue for org', organizationId, target, e);
                    }
                }
                if ((this.adminDb as any).queueApiTokens) {
                    await (this.adminDb as any).queueApiTokens.update({ queueId: (q as any).id } as any, { revoked: true as any, deleted_at: now as any });
                }
                await (this.adminDb as any).queues.update({ id: (q as any).id } as any, { deleted_at: now as any });
            }
            }

            // Soft-delete organization
            await (this.adminDb as any).organizations.update({ id: organizationId } as any, { deleted_at: now as any });

            return true;
        }
    
    async authenticate(email: string, password: string) {
        const orgId = await this.findOrganizationIdByEmail(email);
        if (!orgId) return null;
        const org = await this.getOrganization(orgId);
        if (!org) return null;
        const orgAuth = await this.getOrganizationAuthService(orgId);
        return orgAuth.createAuthSession(email, password);
    }

    /**
     * Return an organization-scoped AuthService without duplicating methods.
     * Usage: const auth = await kuratchi.auth.forOrganization(organizationId); await auth.createUser(...)
     */
    async forOrganization(
        organizationId: string
    ): Promise<AuthService> {
        // Prevent client-side usage which could expose credentials via instantiation side-effects
        if (typeof window !== 'undefined') {
            throw new Error('[KuratchiAuth] forOrganization() is server-only. Call this on the server (load, actions, endpoints).');
        }
        return this.getOrganizationAuthService(organizationId);
    }

    // Server-only accessor for organization ORM client
    async getOrganizationDb(organizationId: string): Promise<Record<string, TableApi>> {
        if (typeof window !== 'undefined') {
            throw new Error('[KuratchiAuth] getOrganizationDb() is server-only. Call this on the server (load, actions, endpoints).');
        }
        if (!this.organizationOrmClients.has(organizationId)) {
            await this.getOrganizationAuthService(organizationId);
        }
        const client = this.organizationOrmClients.get(organizationId);
        if (!client) throw new Error(`[KuratchiAuth] Organization ORM client not available for ${organizationId}`);
        return client;
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
