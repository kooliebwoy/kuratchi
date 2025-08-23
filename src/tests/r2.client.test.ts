import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KuratchiR2HttpClient } from '../lib/r2/internal-http-client.js';

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

describe('KuratchiR2HttpClient', () => {
  const cfg = { bucketName: 'b1', workersSubdomain: 'example.workers.dev', apiToken: 't' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('put sends correct POST with headers and body', async () => {
    mockFetchOnce({ success: true });
    const c = new KuratchiR2HttpClient(cfg);
    const res = await c.put('docs/readme.txt', 'hello', { httpMetadata: { contentType: 'text/plain' } });
    expect(res.success).toBe(true);
    const f = (globalThis.fetch as any);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://b1.example.workers.dev/api/put');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Authorization']).toBe('Bearer t');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ key: 'docs/readme.txt', value: 'hello', options: { httpMetadata: { contentType: 'text/plain' } } });
  });

  it('get passes json flag and returns value', async () => {
    mockFetchOnce({ success: true, value: { a: 1 }, size: 10 });
    const c = new KuratchiR2HttpClient(cfg);
    const res = await c.get<{ a: number }>('data/u.json', { json: true });
    expect(res.success).toBe(true);
    expect(res.value).toEqual({ a: 1 });
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('https://b1.example.workers.dev/api/get');
    expect(JSON.parse(init.body)).toEqual({ key: 'data/u.json', json: true });
  });

  it('returns JSON error for non-OK response', async () => {
    mockFetchOnce({ code: 500, message: 'fail' }, { ok: false, status: 500 });
    const c = new KuratchiR2HttpClient(cfg);
    const res = await c.list({ prefix: 'x/' });
    expect(res.success).toBe(false);
    expect(res.error).toBe(JSON.stringify({ code: 500, message: 'fail' }));
  });
});
