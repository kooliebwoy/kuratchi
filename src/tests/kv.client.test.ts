import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KuratchiKVHttpClient } from '../lib/kv/internal-http-client.js';

function mockFetchOnce(response: any, init?: { ok?: boolean; status?: number; headers?: Record<string, string> }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 400);
  const headers = init?.headers ?? { 'content-type': 'application/json' };
  (globalThis as any).fetch = vi.fn(async () => ({
    ok,
    status,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] || headers[k] || null,
    },
    json: async () => response,
    text: async () => JSON.stringify(response),
  }));
}

describe('KuratchiKVHttpClient', () => {
  const cfg = { namespaceName: 'ns1', workersSubdomain: 'example.workers.dev', apiToken: 't' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('put sends correct POST with headers and body', async () => {
    mockFetchOnce({ success: true });
    const c = new KuratchiKVHttpClient(cfg);
    const res = await c.put('greeting', 'hello', { expirationTtl: 60 });
    expect(res.success).toBe(true);
    const f = (globalThis.fetch as any);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://ns1.example.workers.dev/api/put');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Authorization']).toBe('Bearer t');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ key: 'greeting', value: 'hello', options: { expirationTtl: 60 } });
  });

  it('returns JSON error for non-OK response', async () => {
    mockFetchOnce({ code: 123, message: 'bad' }, { ok: false, status: 500 });
    const c = new KuratchiKVHttpClient(cfg);
    const res = await c.get('nope');
    expect(res.success).toBe(false);
    expect(res.error).toBe(JSON.stringify({ code: 123, message: 'bad' }));
  });

  it('get passes json flag and returns server payload', async () => {
    mockFetchOnce({ success: true, value: { a: 1 } });
    const c = new KuratchiKVHttpClient(cfg);
    const res = await c.get<{ a: number }>('user:1', { json: true });
    expect(res.success).toBe(true);
    expect(res.value).toEqual({ a: 1 });
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('https://ns1.example.workers.dev/api/get');
    expect(JSON.parse(init.body)).toEqual({ key: 'user:1', json: true, cacheTtl: undefined });
  });
});
