import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KuratchiDO } from '../lib/do/kuratchi-do.js';
import { validateSignedDbToken } from '../lib/do/token.js';

describe('KuratchiDO HTTP integration (mocked gateway)', () => {
  const accountId = 'acc_test';
  const apiToken = 'cf_test_token';
  const workersSubdomain = 'example.workers.dev';
  const scriptName = 'kuratchi-do-internal';
  const gatewayKey = 'MASTER_KEY_XYZ';

  let cleanupFetch: (() => void) | null = null;

  beforeEach(() => {
    if (cleanupFetch) { cleanupFetch(); cleanupFetch = null; }
  });

  function mockGatewayFetch() {
    const orig = globalThis.fetch as any;
    vi.spyOn(globalThis as any, 'fetch').mockImplementation(async (input: any, init?: any) => {
      const req = new Request(typeof input === 'string' ? input : input.url, init);
      const auth = req.headers.get('Authorization');
      const dbName = req.headers.get('x-db-name');
      const dbToken = req.headers.get('x-db-token');

      // Enforce master key
      if (!auth || auth !== 'Bearer ' + gatewayKey) {
        return new Response(JSON.stringify({ error: 'Invalid or missing gateway key' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      if (!dbName) {
        return new Response(JSON.stringify({ error: 'x-db-name required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (!dbToken) {
        return new Response(JSON.stringify({ error: 'Missing x-db-token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const v = await validateSignedDbToken(dbName, dbToken, gatewayKey);
      if (!v.ok) {
        return new Response(JSON.stringify({ error: 'Invalid token', reason: v.reason }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      // Simulate DO response
      const body = await req.json();
      return new Response(JSON.stringify({ success: true, echo: body || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    cleanupFetch = () => { (globalThis.fetch as any).mockRestore?.(); (globalThis as any).fetch = orig; };
  }

  it('createDatabase -> client.query succeeds with valid gatewayKey + dbToken', async () => {
    mockGatewayFetch();
    const doSvc = new KuratchiDO({ apiToken, accountId, workersSubdomain, scriptName });
    // avoid real uploadWorker during test
    (doSvc as any).ensureWorker = async () => {};
    const databaseName = 'org_acme';

    const { token } = await doSvc.createDatabase({ databaseName, gatewayKey });
    const db = doSvc.database({ databaseName, dbToken: token, gatewayKey });
    const res = await db.query('select 1');
    expect(res.success).toBe(true);
  });

  it('fails with 401 when db token is missing', async () => {
    mockGatewayFetch();
    const doSvc = new KuratchiDO({ apiToken, accountId, workersSubdomain, scriptName });
    (doSvc as any).ensureWorker = async () => {};
    const databaseName = 'org_no_token';

    const { token } = await doSvc.createDatabase({ databaseName, gatewayKey });
    // intentionally omit x-db-token by passing empty dbToken
    const client = (doSvc as any).getClient({ databaseName, dbToken: undefined, gatewayKey });
    const res = await client.query('select 1');
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('Missing x-db-token');
  });

  it('fails with 401 when gateway key is invalid', async () => {
    mockGatewayFetch();
    const doSvc = new KuratchiDO({ apiToken, accountId, workersSubdomain, scriptName });
    (doSvc as any).ensureWorker = async () => {};
    const databaseName = 'org_bad_gw';

    const { token } = await doSvc.createDatabase({ databaseName, gatewayKey });
    const db = doSvc.database({ databaseName, dbToken: token, gatewayKey: 'WRONG' });
    const res = await db.query('select 1');
    expect(res.success).toBe(false);
    expect(String(res.error)).toContain('Invalid or missing gateway key');
  });
});
