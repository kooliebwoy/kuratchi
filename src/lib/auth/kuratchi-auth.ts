import { KuratchiDatabase } from '../database/kuratchi-database.js';
import { env } from '$env/dynamic/private';
import { AuthService } from './auth-helper.js';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { parseSessionCookie, signState, verifyState } from '../utils/auth.js';
import { adminSchemaDsl } from '../schema/admin.js';
import { organizationSchemaDsl } from '../schema/organization.js';
import { normalizeSchema } from '../orm/normalize.js';
import { createClientFromJsonSchema, type TableApi } from '../orm/kuratchi-orm.js';

// Minimal DO-backed HTTP client for admin DB access (avoids missing D1 client)
class MinimalDoHttpClient {
  private endpoint: string;
  private dbName: string;
  private dbToken?: string;
  private gatewayKey?: string;

  constructor(cfg: { workersSubdomain: string; databaseName: string; dbToken?: string; gatewayKey?: string; scriptName?: string }) {
    const script = cfg.scriptName || 'kuratchi-do-internal';
    this.endpoint = `https://${script}.${cfg.workersSubdomain}`;
    this.dbName = cfg.databaseName;
    this.dbToken = cfg.dbToken;
    this.gatewayKey = cfg.gatewayKey;

    try {
      Object.defineProperty(this, 'dbToken', { enumerable: false, configurable: false, writable: true });
      Object.defineProperty(this, 'gatewayKey', { enumerable: false, configurable: false, writable: true });
    } catch {}
  }

  async query(sql: string, params: any[] = []) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-db-name': this.dbName };
    if (this.gatewayKey) headers['Authorization'] = `Bearer ${this.gatewayKey}`;
    if (this.dbToken) headers['x-db-token'] = this.dbToken;

    const res = await fetch(`${this.endpoint}/api/run`, { method: 'POST', headers, body: JSON.stringify({ query: sql, params }) });

    if (!res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        return { success: false, error: JSON.stringify(json) } as any;
      }

      const text = await res.text();
      return { success: false, error: `API ${res.status}: ${text.slice(0, 200)}...` } as any;
    }

    return res.json();
  }
}

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
  KURATCHI_ADMIN_DB_NAME?: string;
  KURATCHI_ADMIN_DB_TOKEN?: string;
  KURATCHI_ADMIN_DB_ID?: string;
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
      KURATCHI_ADMIN_DB_NAME: pick('KURATCHI_ADMIN_DB_NAME'),
      KURATCHI_ADMIN_DB_TOKEN: pick('KURATCHI_ADMIN_DB_TOKEN'),
      KURATCHI_ADMIN_DB_ID: pick('KURATCHI_ADMIN_DB_ID'),
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
        const GW = env.KURATCHI_GATEWAY_KEY || env.GATEWAY_KEY;
        const required = ['KURATCHI_ADMIN_DB_NAME', 'KURATCHI_ADMIN_DB_TOKEN', 'CLOUDFLARE_WORKERS_SUBDOMAIN'];
        const adminMissing = required.filter((k) => !env?.[k]);
        if (!GW) adminMissing.push('KURATCHI_GATEWAY_KEY');
        if (adminMissing.length) throw new Error(`[Kuratchi] Missing required environment variables: ${adminMissing.join(', ')}`);
        // Use minimal DO-backed HTTP client for admin DB
        const http = new MinimalDoHttpClient({
          databaseName: env.KURATCHI_ADMIN_DB_NAME,
          workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
          dbToken: env.KURATCHI_ADMIN_DB_TOKEN,
          gatewayKey: GW
        } as any);
        const schema = normalizeSchema(adminSchemaDsl as any);
        adminDbInst = createClientFromJsonSchema((sql, params) => http.query(sql, params || []), schema as any);
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
      // Build minimal SDK object inline to avoid relying on missing ../kuratchi.js during dev
      const auth = new KuratchiAuth({
        apiToken: env.CLOUDFLARE_API_TOKEN,
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
        resendApiKey: env.RESEND_API_KEY || '',
        emailFrom: env.EMAIL_FROM || '',
        origin: env.ORIGIN || '',
        resendAudience: env.RESEND_CLUTCHCMS_AUDIENCE,
        authSecret: env.KURATCHI_AUTH_SECRET,
        adminDbName: env.KURATCHI_ADMIN_DB_NAME || 'kuratchi-admin',
        adminDbToken: env.KURATCHI_ADMIN_DB_TOKEN || '',
        adminDbId: env.KURATCHI_ADMIN_DB_ID || '',
        // Wire DO gateway key when present so DO-backed org flows work
        gatewayKey: env.KURATCHI_GATEWAY_KEY
      } as any);
      sdk = { auth } as any;
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

    // Helper: look up organizationId by email in admin DB
    const findOrganizationIdByEmail = async (email: string): Promise<string | null> => {
      try {
        const adminDb = await getAdminDbLazy().catch(() => null);
        if (!adminDb) return null;
        const res = await (adminDb as any).organizationUsers
          .where({ email, deleted_at: { is: null } } as any)
          .first();
        const row = (res as any)?.data;
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

        const auth = await (await getAuthApi() as any).forOrganization(orgId);
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
        const auth = await (await getAuthApi() as any).forOrganization(orgId);
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
        const auth = await (await getAuthApi() as any).forOrganization(orgId);
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
          const authService = await (await getAuthApi() as any).forOrganization(orgId);
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

export interface AuthConfig {
    resendApiKey: string;
    emailFrom: string;
    origin: string;
    resendAudience?: string;
    authSecret: string;
    workersSubdomain: string;
    accountId: string;
    apiToken: string;
    // Admin DB credentials - will auto-create HTTP client
    adminDbName: string;
    adminDbToken: string;
    adminDbId: string;
    // Optional master gateway key for DO-backed org databases (required if using DO)
    gatewayKey?: string;
}

export class KuratchiAuth {
private kuratchiDO: KuratchiDatabase;
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
        
        // Initialize KuratchiDatabase instance (DO-only)
        this.kuratchiDO = new KuratchiDatabase({
            apiToken: config.apiToken,
            accountId: config.accountId,
            workersSubdomain: config.workersSubdomain
        });
        
        // Initialize admin DB runtime client (DO-backed HTTP client)
        if (!config.adminDbName || !config.adminDbToken || !config.gatewayKey) {
            throw new Error('KuratchiAuth requires adminDbName, adminDbToken, and gatewayKey');
        }
        console.log(`[kuratchi] Creating admin DB client (DO): name=${config.adminDbName}`);
        const adminHttp = new MinimalDoHttpClient({
            workersSubdomain: config.workersSubdomain,
            databaseName: config.adminDbName,
            dbToken: config.adminDbToken,
            gatewayKey: config.gatewayKey
        } as any);
        const schema = normalizeSchema(adminSchemaDsl as any);
        this.adminDb = createClientFromJsonSchema(
            (sql, params) => adminHttp.query(sql, params || []),
            schema as any
        ) as Record<string, TableApi>;

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

                // DO-only: build runtime ORM client using KuratchiDatabase.client()
                if (!this.config.gatewayKey) {
                    throw new Error('[KuratchiAuth] gatewayKey is required in config to use DO-backed organization databases');
                }
                const orgClient = await this.kuratchiDO.client({
                    databaseName,
                    dbToken: effectiveToken!,
                    gatewayKey: this.config.gatewayKey!,
                    schema: organizationSchemaDsl as any
                });
                const authService = new AuthService(
                    orgClient as any,
                    this.buildEnv(this.adminDb)
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

            // 2) Provision database idempotently (DO-only)
            const dbName = (org as any).organizationName || `org-${(org as any).id}`;

            // First check if database with this name already exists
            let dbRow: any | null = null;
            const dbId = crypto.randomUUID();
            console.log(`[kuratchi] Checking for existing database with name: ${dbName}`);
            
            const existing = await (this.adminDb as any).databases
                .where({ name: String(dbName), deleted_at: { is: null } } as any)
                .first();
                
            if ((existing as any)?.data) {
                console.log(`[kuratchi] Found existing database record`);
                dbRow = (existing as any).data;
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
                
                // Insert database record with null dbuuid for DO
                await (this.adminDb as any).databases.insert({
                    id: dbId,
                    name: String(dbName),
                    dbuuid: null,
                    organizationId: org.id,
                    isActive: true
                });
                
                // Get the inserted record
                const inserted = await (this.adminDb as any).databases.where({ id: dbId } as any).first();
                dbRow = (inserted as any)?.data;

                // Insert API token for the org DB (since we just created it)
                const tokenId = crypto.randomUUID();
                tokenRow = {
                    id: tokenId,
                    token: apiToken!,
                    name: 'primary',
                    databaseId: dbRow.id,
                    revoked: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                console.log(`[kuratchi] Inserting API token: databaseId=${dbRow.id}`);
                await (this.adminDb as any).dbApiTokens.insert(tokenRow);
            }

            // 5) DO-only: no KV/R2/Queues provisioning

            // 6) Optionally migrate the organization's database schema
            // 6) Migrations applied during DO createDatabase() when migrate !== false

            // 7) Seed initial organization user and create a session
            // Build an organization-scoped AuthService using the just-provisioned DB
            // Debug: verify database record exists before calling getOrganizationAuthService
            console.log(`[kuratchi] Looking for database record for org ${(org as any).id}`);
            const debugDbCheck = await (this.adminDb as any).databases
                .where({ organizationId: (org as any).id, deleted_at: { is: null } })
                .first();
            console.log(`[kuratchi] Database record found:`, (debugDbCheck as any)?.data ? 'YES' : 'NO');
            if ((debugDbCheck as any)?.data) {
                console.log(`[kuratchi] Database record:`, JSON.stringify((debugDbCheck as any).data, null, 2));
            }
            
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

            const now = new Date().toISOString();

            // Soft-delete DB tokens for this DB
            if (db?.id) {
                await (this.adminDb as any).dbApiTokens.update({ databaseId: db.id } as any, { revoked: true as any, deleted_at: now as any });
                await (this.adminDb as any).databases.update({ id: db.id } as any, { deleted_at: now as any });
            }

            // DO-only: no KV/R2/Queues resources to delete

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

// Convenience namespace API, colocated with the class to avoid polluting index.ts
function getAuthEnv() {
  const pick = (key: string) => {
    const v = env?.[key];
    return v !== undefined && v !== null && String(v).length > 0 ? String(v) : undefined;
  };
  return {
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
    KURATCHI_ADMIN_DB_NAME: pick('KURATCHI_ADMIN_DB_NAME'),
    KURATCHI_ADMIN_DB_TOKEN: pick('KURATCHI_ADMIN_DB_TOKEN'),
    KURATCHI_ADMIN_DB_ID: pick('KURATCHI_ADMIN_DB_ID'),
    KURATCHI_GATEWAY_KEY: pick('KURATCHI_GATEWAY_KEY')
  };
}

export const auth = {
  // Create an auth instance (reads env by default)
  instance(cfg?: Partial<AuthConfig>): KuratchiAuth {
    const authEnv = getAuthEnv();
    const required = ['KURATCHI_AUTH_SECRET', 'CLOUDFLARE_WORKERS_SUBDOMAIN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
    const missing = required.filter(k => !authEnv[k as keyof typeof authEnv]);
    if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    
    return new KuratchiAuth({
      resendApiKey: cfg?.resendApiKey || authEnv.RESEND_API_KEY || '',
      emailFrom: cfg?.emailFrom || authEnv.EMAIL_FROM || '',
      origin: cfg?.origin || authEnv.ORIGIN || '',
      resendAudience: cfg?.resendAudience || authEnv.RESEND_CLUTCHCMS_AUDIENCE,
      authSecret: cfg?.authSecret || authEnv.KURATCHI_AUTH_SECRET!,
      workersSubdomain: cfg?.workersSubdomain || authEnv.CLOUDFLARE_WORKERS_SUBDOMAIN!,
      accountId: cfg?.accountId || authEnv.CLOUDFLARE_ACCOUNT_ID!,
      apiToken: cfg?.apiToken || authEnv.CLOUDFLARE_API_TOKEN!,
      adminDbName: cfg?.adminDbName || authEnv.KURATCHI_ADMIN_DB_NAME || 'kuratchi-admin',
      adminDbToken: cfg?.adminDbToken || authEnv.KURATCHI_ADMIN_DB_TOKEN || '',
      adminDbId: cfg?.adminDbId || authEnv.KURATCHI_ADMIN_DB_ID || '',
      gatewayKey: cfg?.gatewayKey || authEnv.KURATCHI_GATEWAY_KEY
    });
  },

  // Admin auth helper: auto-config from env
  async admin(cfg?: Partial<AuthConfig>) {
    const instance = auth.instance(cfg);
    return {
      instance,
      createOrganization: instance.createOrganization.bind(instance),
      listOrganizations: instance.listOrganizations.bind(instance),
      getOrganization: instance.getOrganization.bind(instance),
      deleteOrganization: instance.deleteOrganization.bind(instance),
      authenticate: instance.authenticate.bind(instance),
      forOrganization: instance.forOrganization.bind(instance)
    };
  },

  // SvelteKit handle helper
  handle(options: CreateAuthHandleOptions = {}) {
    return createAuthHandle(options);
  },

  // Sign-in helpers that auto-resolve organization
  signIn: {
    async magicLink(email: string, options?: { redirectTo?: string; organizationId?: string; instance?: KuratchiAuth }) {
      const instance = options?.instance || auth.instance();
      return instance.signIn.magicLink.send(email, options);
    },
    
    async credentials(email: string, password: string, options?: { organizationId?: string; ipAddress?: string; userAgent?: string; redirectTo?: string; instance?: KuratchiAuth }) {
      const instance = options?.instance || auth.instance();
      return instance.signIn.credentials.authenticate(email, password, options);
    },
    
    oauth: {
      google: {
        startUrl(params: { organizationId: string; redirectTo?: string; instance?: KuratchiAuth }) {
          const instance = params.instance || auth.instance();
          return instance.signIn.oauth.google.startUrl(params);
        }
      }
    }
  }
};
