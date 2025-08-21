import { describe, it, expect, vi } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { createAuthHandle } from '../lib/auth/sveltekit.js';
import * as authModule from '../lib/auth/kuratchi-auth.js';

function makeAdminDbStub(opts?: { slugToOrgId?: Record<string, string>; singleActiveOrgId?: string; emailToOrgId?: Record<string, string> }) {
  return {
    // Minimal HTTP-client like interface used by KuratchiAuth schema validation
    async query(sql: string, params?: any[]) {
      const sqlStr = String(sql);
      // Emulate sqlite_master existence checks
      if (/sqlite_master/i.test(sqlStr)) {
        return { success: true, results: [{ name: 'exists' }] } as any;
      }
      // Emulate PRAGMA table_info(...) returning column names
      if (/PRAGMA\s+table_info/i.test(sqlStr)) {
        const cols = [
          { name: 'id' },
          { name: 'organizationSlug' },
          { name: 'email' },
          { name: 'organizationId' },
          { name: 'sessionToken' },
          { name: 'userId' },
          { name: 'expires' },
          { name: 'token' },
          { name: 'databaseId' },
          { name: 'action' },
        ];
        return { success: true, results: cols } as any;
      }
      // Email -> org mapping lookup used by route helper
      if (/from\s+(?:`|"|\b)?organizationUsers(?:`|"|\b)/i.test(sqlStr) && /email/i.test(sqlStr)) {
        const email = params?.[0];
        const organizationId = opts?.emailToOrgId?.[String(email)];
        return { success: true, results: organizationId ? [{ organizationId }] : [] } as any;
      }
      return { success: true, results: [] } as any;
    },

    // Drizzle proxy shape presence check in KuratchiAuth constructor
    getDrizzleProxy() {
      return async (_sql: string, _params: any[], _method: string) => {
        return { rows: [] };
      };
    },

    prepare(sql: string) {
      const self: any = {
        _sql: sql,
        _params: [] as any[],
        bind: (...args: any[]) => {
          self._params = args;
          return self;
        },
        async all() {
          // Debug SQL disabled (enable via DEBUG_ADMINDB_STUB env)
          if ((globalThis as any).process?.env?.DEBUG_ADMINDB_STUB) {
            // eslint-disable-next-line no-console
            console.log('[adminDbStub] SQL:', sql, 'params:', self._params);
          }
          // Return existence for sqlite_master lookups
          if (typeof sql === 'string' && sql.includes('sqlite_master')) {
            return { results: [{ name: 'exists' }] } as any;
          }
          // PRAGMA table_info(...) should return rows with "name" fields
          if (/PRAGMA\s+table_info/i.test(sql)) {
            const cols = [
              { name: 'id' },
              { name: 'organizationSlug' },
              { name: 'email' },
              { name: 'organizationId' },
              { name: 'sessionToken' },
              { name: 'userId' },
              { name: 'expires' },
              { name: 'token' },
              { name: 'databaseId' },
              { name: 'action' },
            ];
            return { results: cols } as any;
          }
          // Basic emulation for organizations lookup by slug
          const sqlStr = String(sql);
          // Match FROM organizations with optional quoting or aliasing
          if (/(?:from)\s+(?:`|"|\b)?organizations(?:`|"|\b)/i.test(sqlStr)) {
            // slug-based lookup
            if (/organizationSlug/i.test(sqlStr)) {
              // prefer bound param
              if (self._params && self._params.length) {
                const slug = String(self._params[0]);
                const id = opts?.slugToOrgId?.[slug];
                if (id) return { results: [{ id }] } as any;
                return { results: [] } as any;
              }
              // if no bound params, but mapping exists, return first mapping
              const firstId = opts?.slugToOrgId && Object.values(opts.slugToOrgId)[0];
              if (firstId) return { results: [{ id: firstId }] } as any;
              return { results: [] } as any;
            }
            // single-tenant fallback: where status = 'active' and deleted_at is null limit 2
            if (/status/i.test(sqlStr)) {
              if (opts?.singleActiveOrgId) return { results: [{ id: opts.singleActiveOrgId }] } as any;
              return { results: [] } as any;
            }
          }
          // Lookup organizationUsers by email -> organizationId
          if (/(?:from)\s+(?:`|"|\b)?organizationUsers(?:`|"|\b)/i.test(sqlStr)) {
            if (/email/i.test(sqlStr)) {
              if (self._params && self._params.length) {
                const email = String(self._params[0]);
                const organizationId = opts?.emailToOrgId?.[email];
                if (organizationId) return { results: [{ organizationId }] } as any;
                return { results: [] } as any;
              }
              return { results: [] } as any;
            }
          }
          // Default: empty result
          return { results: [] } as any;
        },
        async run() { return { success: true } as any; },
        async first() { const r = await self.all(); return (r as any).results?.[0] ?? null; },
        async get() { const r = await self.all(); return (r as any).results?.[0] ?? null; },
      };
      return self;
    },
  } as any;
}

function makeEvent(opts: {
  url: string;
  method?: string;
  body?: any;
  cookieName?: string;
  headers?: Record<string, string>;
}) {
  const cookieName = opts.cookieName || 'kuratchi_session';
  const headers = new Headers(opts.headers || {});
  const requestInit: RequestInit = { method: opts.method || 'GET', headers };
  if (opts.body !== undefined) {
    headers.set('content-type', 'application/json');
    requestInit.body = JSON.stringify(opts.body);
  }
  const request = new Request(opts.url, requestInit);

  const setCalls: any[] = [];
  const deleteCalls: any[] = [];
  const cookies = {
    get: (name: string) => undefined as any,
    set: (name: string, value: string, options: any) => setCalls.push({ name, value, options }),
    delete: (name: string, options: any) => deleteCalls.push({ name, options }),
  } as any;

  const locals: Record<string, any> = {};

  const event: any = {
    request,
    cookies,
    locals,
    // not used because we pass getEnv/getAdminDb overrides
    platform: { env: {} },
  };

  return { event, setCalls, deleteCalls, cookieName };
}

const envMock = {
  RESEND_API_KEY: 'test-resend',
  EMAIL_FROM: 'noreply@example.com',
  ORIGIN: 'http://localhost:5173',
  RESEND_CLUTCHCMS_AUDIENCE: 'aud',
  KURATCHI_AUTH_SECRET: 'secret',
  CLOUDFLARE_WORKERS_SUBDOMAIN: 'sub',
  CLOUDFLARE_ACCOUNT_ID: 'acc',
  CLOUDFLARE_API_TOKEN: 'token',
  GOOGLE_CLIENT_ID: 'gid',
  GOOGLE_CLIENT_SECRET: 'gsecret',
};

async function runHandle(handle: Handle, url: string, init?: { method?: string; body?: any; headers?: Record<string, string> }) {
  const { event, setCalls } = makeEvent({ url, method: init?.method, body: init?.body, headers: init?.headers });
  const res = await (handle as any)({ event, resolve: () => new Response('fallthrough', { status: 404 }) });
  return { res, setCalls, event };
}

function decodeStatePayloadFromAuthUrl(authUrl: string) {
  const u = new URL(authUrl);
  const state = u.searchParams.get('state');
  if (!state) return null;
  const [p] = state.split('.', 2);
  const b64 = p.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(p.length / 4) * 4, '=');
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json);
}

describe('Auth route aliases', () => {
  it('POST /auth/magic/send calls org service and returns ok with magic link to /auth/magic/callback', async () => {
    // Arrange mock for KuratchiAuth.forOrganization -> fake org service
    const fakeService = {
      createMagicLinkToken: vi.fn().mockResolvedValue({ token: 't123' }),
      sendMagicLink: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(authModule.KuratchiAuth.prototype as any, 'forOrganization').mockResolvedValue(fakeService as any);

    const handle = createAuthHandle({
      getEnv: () => envMock as any,
      getAdminDb: () => makeAdminDbStub(),
    });
    // (negative OAuth callback tests moved below)

    // Act
    const { res } = await runHandle(handle, 'http://localhost:5173/auth/magic/send', {
      method: 'POST',
      body: { email: 'a@b.com', organizationId: 'org_1', redirectTo: '/x' },
    });

    // Assert
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    expect(fakeService.createMagicLinkToken).toHaveBeenCalledWith('a@b.com', '/x');
    expect(fakeService.sendMagicLink).toHaveBeenCalledTimes(1);
    const [, link] = fakeService.sendMagicLink.mock.calls[0];
    expect(link).toContain('/auth/magic/callback');
    expect(link).toContain('token=t123');
    expect(link).toContain('org=org_1');
  });

  it('GET /auth/magic/callback sets cookie and redirects', async () => {
    const fakeService = {
      verifyMagicLink: vi.fn().mockResolvedValue({ success: true, cookie: 'cookie_val', redirectTo: '/dest' }),
    };
    vi.spyOn(authModule.KuratchiAuth.prototype as any, 'forOrganization').mockResolvedValue(fakeService as any);

    const handle = createAuthHandle({ getEnv: () => envMock as any, getAdminDb: () => makeAdminDbStub() });

    const { res, setCalls } = await runHandle(
      handle,
      'http://localhost:5173/auth/magic/callback?token=t123&org=org_1',
    );

    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/dest');
    expect(setCalls.length).toBe(1);
    expect(setCalls[0].name).toBe('kuratchi_session');
    expect(setCalls[0].value).toBe('cookie_val');
  });

  it('GET /auth/oauth/google/start redirects to Google with correct redirect_uri and state', async () => {
    const handle = createAuthHandle({ getEnv: () => envMock as any });

    const { res } = await runHandle(
      handle,
      'http://localhost:5173/auth/oauth/google/start?org=org_1&redirectTo=/'
    );

    expect(res.status).toBe(302);
    const loc = res.headers.get('Location')!;
    expect(loc).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(loc).toContain(encodeURIComponent(envMock.ORIGIN + '/auth/oauth/google/callback'));
    expect(loc).toMatch(/state=[^&]+/);
  });

  it('GET /auth/oauth/google/callback derives org by email mapping when no org override is provided', async () => {
    // Mock org service for OAuth flow
    const fakeService = {
      getOrCreateUserFromOAuth: vi.fn().mockResolvedValue({ id: 'user_1' }),
      upsertSession: vi.fn().mockResolvedValue('cookie_val_2'),
    };
    vi.spyOn(authModule.KuratchiAuth.prototype as any, 'forOrganization').mockResolvedValue(fakeService as any);

    // Admin DB maps email -> organizationId
    const handle = createAuthHandle({
      getEnv: () => envMock as any,
      getAdminDb: () => makeAdminDbStub({ emailToOrgId: { 'oauser@example.com': 'org_email' } }),
    });

    // First call start to obtain a valid signed state (no org override)
    const { res: startRes } = await runHandle(
      handle,
      'http://localhost:5173/auth/oauth/google/start?redirectTo=/welcome'
    );
    expect(startRes.status).toBe(302);
    const startLoc = startRes.headers.get('Location')!;
    const startUrl = new URL(startLoc);
    const state = startUrl.searchParams.get('state')!;

    // Mock token exchange and userinfo
    const fetchSpy = vi.spyOn(globalThis as any, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'at', refresh_token: 'rt', id_token: 'id', token_type: 'Bearer', scope: 'openid email profile', expires_in: 3600
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      sub: '123', email: 'oauser@example.com', name: 'OAuth User', picture: 'http://img'
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    // Now hit the callback with the obtained state
    const { res, setCalls } = await runHandle(
      handle,
      `http://localhost:5173/auth/oauth/google/callback?code=abc&state=${encodeURIComponent(state)}`
    );

    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/welcome');
    expect(setCalls.length).toBe(1);
    expect(setCalls[0].value).toBe('cookie_val_2');
    expect(fakeService.getOrCreateUserFromOAuth).toHaveBeenCalledTimes(1);
    expect(fakeService.upsertSession).toHaveBeenCalledTimes(1);
  });

  it('GET /auth/oauth/google/callback returns 404 when email has no org mapping and no override', async () => {
    const handle = createAuthHandle({
      getEnv: () => envMock as any,
      getAdminDb: () => makeAdminDbStub({}),
    });

    const { res: startRes } = await runHandle(
      handle,
      'http://localhost:5173/auth/oauth/google/start?redirectTo=/x'
    );
    expect(startRes.status).toBe(302);
    const startLoc = startRes.headers.get('Location')!;
    const state = new URL(startLoc).searchParams.get('state')!;

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'at', token_type: 'Bearer', scope: 'openid email profile', expires_in: 3600
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({
      sub: '123', email: 'nomap@example.com', name: 'No Map'
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const { res } = await runHandle(
      handle,
      `http://localhost:5173/auth/oauth/google/callback?code=abc&state=${encodeURIComponent(state)}`
    );
    expect(res.status).toBe(404);
  });

  it('GET /auth/oauth/google/callback returns 401 when token exchange fails', async () => {
    const handle = createAuthHandle({ getEnv: () => envMock as any, getAdminDb: () => makeAdminDbStub({}) });

    const { res: startRes } = await runHandle(
      handle,
      'http://localhost:5173/auth/oauth/google/start'
    );
    expect(startRes.status).toBe(302);
    const state = new URL(startRes.headers.get('Location')!).searchParams.get('state')!;

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response('bad', { status: 400 }));

    const { res } = await runHandle(
      handle,
      `http://localhost:5173/auth/oauth/google/callback?code=abc&state=${encodeURIComponent(state)}`
    );
    expect(res.status).toBe(401);
  });

  it('GET /auth/oauth/google/callback returns 401 when userinfo fetch fails', async () => {
    const handle = createAuthHandle({ getEnv: () => envMock as any, getAdminDb: () => makeAdminDbStub({}) });

    const { res: startRes } = await runHandle(handle, 'http://localhost:5173/auth/oauth/google/start');
    expect(startRes.status).toBe(302);
    const state = new URL(startRes.headers.get('Location')!).searchParams.get('state')!;

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    fetchSpy.mockResolvedValueOnce(new Response('nope', { status: 403 }));

    const { res } = await runHandle(
      handle,
      `http://localhost:5173/auth/oauth/google/callback?code=abc&state=${encodeURIComponent(state)}`
    );
    expect(res.status).toBe(401);
  });
});
