import { describe, it, expect, vi } from 'vitest';
import type { Handle } from '@sveltejs/kit';
import { createAuthHandle, KuratchiAuth } from '../lib/auth/kuratchi-auth.js';

function makeAdminDbStub() {
  return {
    async query(_sql: string, _params?: any[]) {
      // minimal shape for schema validators
      if (/sqlite_master/i.test(_sql)) return { success: true, results: [{ name: 'exists' }] } as any;
      if (/PRAGMA\s+table_info/i.test(_sql)) {
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
      return { success: true, results: [] } as any;
    },
    getDrizzleProxy() {
      return async () => ({ rows: [] });
    },
  } as any;
}

function makeEvent(url: string, method: string = 'GET', body?: any, headersInit?: Record<string, string>) {
  const headers = new Headers(headersInit || {});
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(body);
  }
  const request = new Request(url, init);

  const setCalls: any[] = [];
  const deleteCalls: any[] = [];
  const cookies = {
    get: (_name: string) => undefined as any,
    set: (name: string, value: string, options: any) => setCalls.push({ name, value, options }),
    delete: (name: string, options: any) => deleteCalls.push({ name, options }),
  } as any;

  const locals: Record<string, any> = {};

  const event: any = {
    request,
    cookies,
    locals,
    platform: { env: {} },
  };

  return { event, setCalls, deleteCalls };
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
};

describe('credentials authenticate wrapper sets cookie', () => {
  it('sets cookie on success', async () => {
    // Mock organizationId resolution and org service to return a session
    vi.spyOn(KuratchiAuth.prototype as any, 'findOrganizationIdByEmail').mockResolvedValue('org_1');
    const fakeService = {
      createAuthSession: vi.fn().mockResolvedValue({
        user: { id: 'user_1' },
        sessionId: 'cookie_val',
        sessionData: { userId: 'user_1' },
      }),
    };
    vi.spyOn(KuratchiAuth.prototype as any, 'getOrganizationAuthService').mockResolvedValue(fakeService as any);

    const handle = createAuthHandle({
      getEnv: () => envMock as any,
      getAdminDb: () => makeAdminDbStub(),
    });

    // Prime the SDK once so the wrapper is installed (same handle instance retains sdk)
    {
      const { event } = makeEvent('http://localhost:5173/auth/magic/send', 'POST', {
        email: 'prime@example.com',
        organizationId: 'org_1',
        redirectTo: '/',
      });
      await (handle as Handle)({ event: event as any, resolve: () => new Response('fallthrough', { status: 404 }) } as any);
    }

    const { event, setCalls } = makeEvent('http://localhost:5173/__noop');

    // Call handle with a resolve that triggers credentials.authenticate inside the same request
    const res = await (handle as Handle)({
      event: event as any,
      resolve: async () => {
        const out = await (event.locals.kuratchi as any).auth.signIn.credentials.authenticate('a@b.com', 'pw');
        // Return JSON of result for assertions
        return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(setCalls.length).toBe(1);
    expect(setCalls[0].name).toBe('kuratchi_session');
    expect(setCalls[0].value).toBe('cookie_val');
  });

  it('does not set cookie on invalid credentials', async () => {
    vi.spyOn(KuratchiAuth.prototype as any, 'findOrganizationIdByEmail').mockResolvedValue('org_1');
    const fakeService = {
      createAuthSession: vi.fn().mockResolvedValue(null),
    };
    vi.spyOn(KuratchiAuth.prototype as any, 'getOrganizationAuthService').mockResolvedValue(fakeService as any);

    const handle = createAuthHandle({
      getEnv: () => envMock as any,
      getAdminDb: () => makeAdminDbStub(),
    });

    const { event, setCalls } = makeEvent('http://localhost:5173/__noop');

    const res = await (handle as Handle)({
      event: event as any,
      resolve: async () => {
        const out = await (event.locals.kuratchi as any).auth.signIn.credentials.authenticate('a@b.com', 'bad');
        return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('invalid_credentials');
    expect(setCalls.length).toBe(0);
  });
});
