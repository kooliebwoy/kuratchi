import { dev } from '$app/environment';
import type { Handle, RequestEvent } from '@sveltejs/kit';
import { KuratchiDatabase } from '../database/kuratchi-database.js';
import { parseSessionCookie, signState, verifyState } from '../utils/auth.js';
// Legacy v1 handle - uses example schemas as defaults for backward compatibility
import { adminSchemaDsl } from '../schema/admin.example.js';
import { organizationSchemaDsl } from '../schema/organization.example.js';
import { normalizeSchema } from '../orm/normalize.js';
import { createClientFromJsonSchema } from '../orm/kuratchi-orm.js';
import { ensurePlatformEnv, runWithPlatform } from '../utils/platform-context.js';
import { KuratchiAuth } from './kuratchi-auth.js';
import type { 
  CreateAuthHandleOptions, 
  KURATCHI_SESSION_COOKIE,
  AuthHandleEnv 
} from './types.js';

// Re-export the session cookie constant
export { KURATCHI_SESSION_COOKIE } from './types.js';

export function createAuthHandle(options: CreateAuthHandleOptions = {}): Handle {
  const cookieName = options.cookieName || 'kuratchi_session';
  const sessionMutators = options.sessionMutators ?? [];
  const guards = options.guards ?? [];

  const getEnv = options.getEnv || (async (event: RequestEvent) => {
    let dynamicEnv: any = undefined;
    try {
      const mod: any = await import('$env/dynamic/private');
      dynamicEnv = mod?.env;
    } catch {}
    const platformEnv = (event as any)?.platform?.env;
    const pick = (key: string) => {
      const fromDynamic = dynamicEnv?.[key];
      if (fromDynamic !== undefined && fromDynamic !== null && String(fromDynamic).length > 0) return String(fromDynamic);
      const fromPlatform = platformEnv?.[key];
      if (fromPlatform !== undefined && fromPlatform !== null && String(fromPlatform).length > 0) return String(fromPlatform);
      return undefined;
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
    } as AuthHandleEnv;
  });

  return async ({ event, resolve }) => {
    if (!event || typeof event !== 'object') {
      return resolve(event);
    }

    await ensurePlatformEnv(event as RequestEvent, { dev });

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
    locals.kuratchi.orgDatabaseClient = async (orgIdOverride?: string, options?: { schema?: any }) => {
      if (typeof window !== 'undefined') throw new Error('[Kuratchi] orgDatabaseClient() is server-only');
      const rawCookie = event.cookies.get(cookieName);
      const parsed = rawCookie ? await parseSessionCookie((await getEnv(event as any)).KURATCHI_AUTH_SECRET, rawCookie) : null;
      const currentOrg = orgIdOverride || locals.kuratchi?.session?.organizationId || parsed?.orgId;
      if (!currentOrg || currentOrg === 'admin') throw new Error('[Kuratchi] organizationId is required');
      const auth = await getAuthApi();
      return await (auth as any).getOrganizationDb(currentOrg, options);
    };

    // Attach KV namespaces if configured
    if (options.kvNamespaces && typeof options.kvNamespaces === 'object') {
      locals.kuratchi.kv = {};
      const platform = (event as any).platform;
      const platformEnv = platform?.env;
      
      for (const [friendlyName, bindingName] of Object.entries(options.kvNamespaces)) {
        if (platformEnv && platformEnv[bindingName]) {
          locals.kuratchi.kv[friendlyName] = platformEnv[bindingName];
        } else {
          // Namespace not available, set to null with warning
          locals.kuratchi.kv[friendlyName] = null;
          if (dev) {
            console.warn(`[Kuratchi KV] Binding "${bindingName}" (${friendlyName}) not found in platform.env. Check your wrangler.toml.`);
          }
        }
      }
    }

    // Attach R2 buckets if configured
    if (options.r2Buckets && typeof options.r2Buckets === 'object') {
      locals.kuratchi.r2 = {};
      const platform = (event as any).platform;
      const platformEnv = platform?.env;
      
      for (const [friendlyName, bindingName] of Object.entries(options.r2Buckets)) {
        if (platformEnv && platformEnv[bindingName]) {
          locals.kuratchi.r2[friendlyName] = platformEnv[bindingName];
        } else {
          // Bucket not available, set to null with warning
          locals.kuratchi.r2[friendlyName] = null;
          if (dev) {
            console.warn(`[Kuratchi R2] Binding "${bindingName}" (${friendlyName}) not found in platform.env. Check your wrangler.toml.`);
          }
        }
      }
    }

    // Attach D1 databases if configured
    if (options.d1Databases && typeof options.d1Databases === 'object') {
      locals.kuratchi.d1 = {};
      const platform = (event as any).platform;
      const platformEnv = platform?.env;
      
      for (const [friendlyName, bindingName] of Object.entries(options.d1Databases)) {
        if (platformEnv && platformEnv[bindingName]) {
          locals.kuratchi.d1[friendlyName] = platformEnv[bindingName];
        } else {
          // Database not available, set to null with warning
          locals.kuratchi.d1[friendlyName] = null;
          if (dev) {
            console.warn(`[Kuratchi D1] Binding "${bindingName}" (${friendlyName}) not found in platform.env. Check your wrangler.toml.`);
          }
        }
      }
    }

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
        // Use database module's HTTP client for admin DB
        const db = new KuratchiDatabase({
          apiToken: env.CLOUDFLARE_API_TOKEN!,
          accountId: env.CLOUDFLARE_ACCOUNT_ID!,
          workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN!
        });
        const http = db.httpClient({
          databaseName: env.KURATCHI_ADMIN_DB_NAME,
          dbToken: env.KURATCHI_ADMIN_DB_TOKEN,
          gatewayKey: GW
        });
        const schema = normalizeSchema(adminSchemaDsl as any);
        adminDbInst = createClientFromJsonSchema((sql, params) => http.query(sql, params || []), schema as any);
      }
      return adminDbInst;
    };

    // Helpers: request info and subscription status (handle scope)
    const getRequestInfo = () => {
      const ip = (event as any).getClientAddress?.()
        || event.request.headers.get('cf-connecting-ip')
        || event.request.headers.get('x-forwarded-for')
        || undefined;
      const userAgent = event.request.headers.get('user-agent') || undefined;
      return { ipAddress: ip, userAgent } as { ipAddress?: string; userAgent?: string };
    };
    const getIsSubscribed = async (organizationId?: string | null): Promise<boolean> => {
      try {
        if (!organizationId || organizationId === 'admin') return false;
        const adminDb = await getAdminDbLazy().catch(() => null);
        if (!adminDb) return false;
        const res = await (adminDb as any).organizations.where({ id: organizationId } as any).first();
        const org = (res as any)?.data;
        if (!org) return false;
        const subId = (org as any)?.stripeSubscriptionId;
        const status = (org as any)?.status;
        return !!subId && status !== 'inactive';
      } catch { return false; }
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
      // Resolve schemas if host app provides them (preferred over SDK discovery)
      let orgSchemaOverride: any = undefined;
      let adminSchemaOverride: any = undefined;
      if (options.getOrganizationSchema) {
        try {
          orgSchemaOverride = await options.getOrganizationSchema(event as any as RequestEvent);
        } catch {}
      }
      if (options.getAdminSchema) {
        try {
          adminSchemaOverride = await options.getAdminSchema(event as any as RequestEvent);
        } catch {}
      }
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
        gatewayKey: env.KURATCHI_GATEWAY_KEY,
        // Prefer host-provided schemas to avoid $lib import resolution from the SDK
        ...(orgSchemaOverride ? { organizationSchema: orgSchemaOverride } : {}),
        ...(adminSchemaOverride ? { adminSchema: adminSchemaOverride } : {})
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
                const reqInfo = getRequestInfo();
                const isSubscribed = await getIsSubscribed((res.session as any)?.organizationId);
                const merged = { ...res.session, ...reqInfo, isSubscribed, user: sanitizeUser(res.user) };
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
            const reqInfo = getRequestInfo();
            const isSubscribed = await getIsSubscribed(sessionData.organizationId || orgId);
            const merged = { ...sessionData, ...reqInfo, isSubscribed, organizationId: sessionData.organizationId || orgId, user: safeUser };
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

    // Allow optional session mutators to enhance locals/session before guards run
    if (sessionMutators.length > 0) {
      const currentSession = locals.session ?? locals.kuratchi?.session ?? null;
      for (const mutator of sessionMutators) {
        try {
          await mutator({ event: event as RequestEvent, locals, session: currentSession });
        } catch (err) {
          console.warn('[Kuratchi][sessionMutator] error:', err);
        }
      }
    }

    // Evaluate guard rules; first guard returning a Response short-circuits the pipeline
    if (guards.length > 0) {
      for (const guard of guards) {
        try {
          const result = await guard({ event: event as RequestEvent, locals, session: locals.session ?? locals.kuratchi?.session ?? null });
          if (result instanceof Response) {
            return result;
          }
        } catch (err) {
          console.warn('[Kuratchi][guard] error:', err);
        }
      }
    }

    return runWithPlatform((event as RequestEvent).platform, () => resolve(event));
  };
}
