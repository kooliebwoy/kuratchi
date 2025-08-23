import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KuratchiQueuesHttpClient } from '../lib/queues/internal-http-client.js';

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
    text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
  }));
}

describe('KuratchiQueuesHttpClient', () => {
  const cfg = { queueName: 'q1', workersSubdomain: 'example.workers.dev', apiToken: 't' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('send posts to /api/send with auth and body', async () => {
    mockFetchOnce({ success: true });
    const c = new KuratchiQueuesHttpClient(cfg);
    const res = await c.send({ id: 1 }, { contentType: 'json', delaySeconds: 5 });
    expect(res.success).toBe(true);
    const f = (globalThis.fetch as any);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://q1.example.workers.dev/api/send');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Authorization']).toBe('Bearer t');
    expect(JSON.parse(init.body)).toEqual({ body: { id: 1 }, contentType: 'json', delaySeconds: 5 });
  });

  it('sendBatch posts to /api/send-batch', async () => {
    mockFetchOnce({ success: true, count: 2 });
    const c = new KuratchiQueuesHttpClient(cfg);
    const res = await c.sendBatch([{ body: 'a' }, { body: { b: 2 }, contentType: 'json' }]);
    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('https://q1.example.workers.dev/api/send-batch');
    expect(JSON.parse(init.body)).toEqual({ messages: [{ body: 'a' }, { body: { b: 2 }, contentType: 'json' }] });
  });

  it('returns JSON error for non-OK response', async () => {
    mockFetchOnce({ code: 500, message: 'fail' }, { ok: false, status: 500 });
    const c = new KuratchiQueuesHttpClient(cfg);
    const res = await c.health();
    expect(res.success).toBe(false);
    expect((res as any).error).toBe(JSON.stringify({ code: 500, message: 'fail' }));
  });
});
