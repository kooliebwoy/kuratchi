import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudflareClient } from '../../src/lib/cloudflare.js';

// Helper to make a mock fetch Response
function mockJsonResponse(data: any, init: Partial<Response> = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

describe('CloudflareClient (D1)', () => {
  const apiToken = 'test-token';
  const accountId = 'acct_123';
  const base = 'https://api.cloudflare.com/client/v4';
  let client: CloudflareClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new CloudflareClient({ apiToken, accountId, endpointBase: base });
  });

  it('getDatabase sends GET to specific database id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse({ result: { id: 'db_1' } })
    );

    const res = await client.getDatabase('db_1');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/accounts/${accountId}/d1/database/db_1`);
    expect(init.method).toBe('GET');
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
    expect(res).toEqual({ result: { id: 'db_1' } });
  });

  it('getWorkerScript sends GET to worker script endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse({ id: 'script' })
    );

    const res = await client.getWorkerScript('mydb');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/accounts/${accountId}/workers/scripts/mydb`);
    expect(init.method).toBe('GET');
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
    expect(res).toEqual({ id: 'script' });
  });

  it('deleteWorkerScript uses force=true to delete despite bindings', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse({})
    );

    await client.deleteWorkerScript('mydb');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/accounts/${accountId}/workers/scripts/mydb?force=true`);
    expect(init.method).toBe('DELETE');
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
  });

  it('createDatabase sends POST with name and optional location', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse({ result: { id: 'db_1', name: 'mydb' } })
    );

    const res = await client.createDatabase('mydb');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/accounts/${accountId}/d1/database`);
    expect(init.method).toBe('POST');
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
    expect((init.headers as any)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ name: 'mydb' });

    expect(res).toEqual({ result: { id: 'db_1', name: 'mydb' } });
  });

  it('deleteDatabase sends DELETE to database id (best-effort worker cleanup)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse({ success: true })
    );

    const res = await client.deleteDatabase('db_1');

    // Should make at least one call to DELETE the DB; may also call listDatabases and attempt worker deletion
    const calls = fetchSpy.mock.calls as Array<[string, RequestInit]>;
    const matched = calls.find(([url, init]) => url === `${base}/accounts/${accountId}/d1/database/db_1` && init.method === 'DELETE');
    expect(matched).toBeTruthy();
    // Ensure auth header is present on that call
    const init = matched![1];
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
    expect(res).toEqual({ success: true });
  });

  it('listDatabases sends GET to databases endpoint', async () => {
    const mockResult = { result: [{ id: 'db_1' }, { id: 'db_2' }] };
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse(mockResult)
    );

    const res = await client.listDatabases();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/accounts/${accountId}/d1/database`);
    expect(init.method).toBe('GET');
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
    expect(res).toEqual(mockResult);
  });

  it('enableReadReplication sends PUT with mode auto', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse({ success: true })
    );

    const res = await client.enableReadReplication('db_1');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/accounts/${accountId}/d1/database/db_1`);
    expect(init.method).toBe('PUT');
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
    expect((init.headers as any)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ read_replication: { mode: 'auto' } });
    expect(res).toEqual({ success: true });
  });

  it('disableReadReplication sends PUT with mode disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue(
      mockJsonResponse({ success: true })
    );

    const res = await client.disableReadReplication('db_1');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/accounts/${accountId}/d1/database/db_1`);
    expect(init.method).toBe('PUT');
    expect((init.headers as any).Authorization).toBe(`Bearer ${apiToken}`);
    expect((init.headers as any)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ read_replication: { mode: 'disabled' } });
    expect(res).toEqual({ success: true });
  });
});
