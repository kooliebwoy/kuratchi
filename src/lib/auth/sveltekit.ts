import type { Handle, RequestEvent } from '@sveltejs/kit';
import { KuratchiAuth } from './kuratchi-auth.js';
import { parseSessionCookie } from './utils.js';
import { KuratchiHttpClient } from '../d1/internal-http-client.js';

export const KURATCHI_SESSION_COOKIE = 'kuratchi_session';

export interface CreateAuthHandleOptions {
  cookieName?: string;
  // Optional override to provide an admin DB client. Can be async.
  getAdminDb?: (event: RequestEvent) => any | Promise<any>;
  // Optional override to provide env. Can be async. Defaults to $env/dynamic/private values.
  getEnv?: (event: RequestEvent) =>
    | Promise<{
        RESEND_API_KEY: string;
        EMAIL_FROM: string;
        ORIGIN: string;
        RESEND_CLUTCHCMS_AUDIENCE?: string;
        KURATCHI_AUTH_SECRET: string;
        CLOUDFLARE_WORKERS_SUBDOMAIN: string;
        CLOUDFLARE_ACCOUNT_ID: string;
        CLOUDFLARE_API_TOKEN: string;
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        AUTH_WEBHOOK_SECRET?: string;
        KURATCHI_ADMIN_DB_NAME?: string;
        KURATCHI_ADMIN_DB_TOKEN?: string;
      }>
    | {
        RESEND_API_KEY: string;
        EMAIL_FROM: string;
        ORIGIN: string;
        RESEND_CLUTCHCMS_AUDIENCE?: string;
        KURATCHI_AUTH_SECRET: string;
        CLOUDFLARE_WORKERS_SUBDOMAIN: string;
        CLOUDFLARE_ACCOUNT_ID: string;
        CLOUDFLARE_API_TOKEN: string;
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        AUTH_WEBHOOK_SECRET?: string;
        KURATCHI_ADMIN_DB_NAME?: string;
        KURATCHI_ADMIN_DB_TOKEN?: string;
      };
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

  // Helpers: base64url (works in Node and Workers)
  const toBytes = (input: string | ArrayBuffer | Uint8Array) =>
    typeof input === 'string' ? new TextEncoder().encode(input) : (input instanceof Uint8Array ? input : new Uint8Array(input));
  const bytesToBase64 = (bytes: Uint8Array) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    // @ts-ignore
    return btoa(binary);
  };
  const base64ToBytes = (b64: string) => {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    // @ts-ignore
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };
  const b64urlEncode = (buf: ArrayBuffer | Uint8Array | string) =>
    bytesToBase64(toBytes(buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const b64urlDecode = (str: string) => {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '=');
    const decoded = base64ToBytes(b64);
    return new TextDecoder().decode(decoded);
  };

  // Helpers: HMAC-SHA256 sign/verify for OAuth state
  const importHmacKey = async (secret: string) =>
    crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

  const signState = async (secret: string, payload: Record<string, any>) => {
    const key = await importHmacKey(secret);
    const json = JSON.stringify(payload);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(json));
    return `${b64urlEncode(json)}.${b64urlEncode(new Uint8Array(sig))}`;
  };

  const verifyState = async (secret: string, state: string): Promise<Record<string, any> | null> => {
    try {
      const [p, s] = state.split('.', 2);
      if (!p || !s) return null;
      const json = b64urlDecode(p);
      const key = await importHmacKey(secret);
      const sigBytes = base64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
      const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(json));
      if (!valid) return null;
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  return async ({ event, resolve }) => {
    // Initialize locals defaults and helpers
    const locals: any = event.locals;
    locals.auth = null;
    locals.user = null;
    locals.session = null;

    locals.setSessionCookie = (value: string, opts?: { expires?: Date }) => {
      const expires = opts?.expires;
      event.cookies.set(cookieName, value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        ...(expires ? { expires } : {})
      });
    };
    locals.clearSessionCookie = () => {
      event.cookies.delete(cookieName, { path: '/' });
    };

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

    let kuratchi: KuratchiAuth | null = null;
    const getKuratchi = async (): Promise<KuratchiAuth> => {
      if (kuratchi) return kuratchi;
      // Validate Cloudflare env required for KuratchiAuth usage
      const cfMissing = ['CLOUDFLARE_WORKERS_SUBDOMAIN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'].filter((k) => !env?.[k]);
      if (cfMissing.length) throw new Error(`[Kuratchi] Missing required environment variables: ${cfMissing.join(', ')}`);
      const adminDb = await getAdminDbLazy();
      kuratchi = new KuratchiAuth({
        resendApiKey: env.RESEND_API_KEY || '',
        emailFrom: env.EMAIL_FROM || '',
        origin: env.ORIGIN || '',
        resendAudience: env.RESEND_CLUTCHCMS_AUDIENCE,
        authSecret: env.KURATCHI_AUTH_SECRET,
        workersSubdomain: env.CLOUDFLARE_WORKERS_SUBDOMAIN,
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: env.CLOUDFLARE_API_TOKEN,
        adminDb
      });
      (locals as any).kuratchi = kuratchi;
      return kuratchi;
    };

    // Helper: look up organizationId by email in admin DB, support multiple shapes
    const findOrganizationIdByEmail = async (email: string): Promise<string | null> => {
      try {
        const adminDb = await getAdminDbLazy().catch(() => null);
        if (!adminDb) return null;
        const sql = 'SELECT organizationId FROM organizationUsers WHERE email = ? AND deleted_at IS NULL LIMIT 1';
        // D1 binding shape
        if (typeof adminDb.prepare === 'function') {
          const prepared = adminDb.prepare(sql).bind(email);
          const row = typeof prepared.first === 'function'
            ? await prepared.first()
            : (typeof prepared.get === 'function'
                ? await prepared.get()
                : (() => prepared.all().then((r: any) => (r?.results?.[0] ?? r?.[0] ?? null)))());
          return (row as any)?.organizationId || null;
        }
        // HTTP client shape
        if (typeof adminDb.query === 'function') {
          const res = await adminDb.query(sql, [email]);
          const rows = (res && (res.results ?? res.data)) || [];
          const row = Array.isArray(rows) ? rows[0] : null;
          return row?.organizationId || null;
        }
        // sqlite-proxy function shape
        if (typeof adminDb === 'function') {
          const r = await adminDb(sql, [email], 'get');
          const rows = (r as any)?.rows ?? [];
          const row = Array.isArray(rows) ? rows[0] : null;
          return row?.organizationId || null;
        }
        return null;
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

        const auth = await (await getKuratchi()).forOrganization(orgId);
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
        const auth = await (await getKuratchi()).forOrganization(orgId);
        const result = await auth.verifyMagicLink(token);
        if (!result.success || !result.cookie) return new Response('Unauthorized', { status: 401 });
        // 30d cookie expiry
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        locals.setSessionCookie(result.cookie, { expires });
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
        const auth = await (await getKuratchi()).forOrganization(orgId);
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
        locals.setSessionCookie(cookie, { expires });
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
          const authService = await (await getKuratchi()).forOrganization(orgId);
          const { sessionData, user } = await authService.validateSessionToken(cookieVal);
          if (sessionData && user) {
            locals.auth = authService;
            locals.user = user;
            locals.session = sessionData;
          } else {
            // Session invalid or expired
            locals.clearSessionCookie();
          }
        }
      } catch (e) {
        // On any parsing/validation error, clear cookie silently
        locals.clearSessionCookie();
      }
    }

    return resolve(event);
  };
}
