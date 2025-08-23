import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KuratchiQueuesPullHttpClient } from '../lib/queues/pull-http-client.js';

function mockFetchOnce(response: any, init?: { ok?: boolean; status?: number; headers?: Record<string, string> }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 400);
  const headers = init?.headers ?? { 'content-type': 'application/json' };
  (globalThis as any).fetch = vi.fn(async () => ({
    ok,
    status,
    headers: {
      get: (k: string) => (headers as any)[k.toLowerCase()] || (headers as any)[k] || null,
    },
    json: async () => response,
    text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
  }));
}

describe('KuratchiQueuesPullHttpClient', () => {
  const cfg = { accountId: 'acc', apiToken: 't', queueId: 'qid' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pull posts to /messages/pull with auth and options', async () => {
    mockFetchOnce({ success: true, result: { messages: [] } });
    const c = new KuratchiQueuesPullHttpClient(cfg);
    const res = await c.pull({ batchSize: 50, visibilityTimeoutMs: 6000 });
    expect(res.success).toBe(true);
    const f = (globalThis.fetch as any);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/queues/qid/messages/pull');
    expect(init.method).toBe('POST');
    expect(init.headers['authorization']).toBe('Bearer t');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ visibility_timeout_ms: 6000, batch_size: 50 });
  });

  it('pull sends empty object when options omitted', async () => {
    mockFetchOnce({ success: true, result: { messages: [] } });
    const c = new KuratchiQueuesPullHttpClient(cfg);
    await c.pull();
    const [, init] = (globalThis.fetch as any).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({});
  });

  it('ack posts to /messages/ack with normalized acks and retries', async () => {
    mockFetchOnce({ success: true });
    const c = new KuratchiQueuesPullHttpClient(cfg);
    const res = await c.ack({ acks: ['a1', { lease_id: 'a2' }], retries: [{ lease_id: 'r1', delay_seconds: 10 }] });
    expect(res.success).toBe(true);
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/queues/qid/messages/ack');
    expect(JSON.parse(init.body)).toEqual({ acks: [{ lease_id: 'a1' }, { lease_id: 'a2' }], retries: [{ lease_id: 'r1', delay_seconds: 10 }] });
  });

  it('throws on non-OK response for pull', async () => {
    mockFetchOnce({ code: 500, message: 'fail' }, { ok: false, status: 500 });
    const c = new KuratchiQueuesPullHttpClient(cfg);
    await expect(c.pull()).rejects.toThrow(/Queues pull failed/);
  });

  it('throws on non-OK response for ack', async () => {
    mockFetchOnce({ code: 401, message: 'unauthorized' }, { ok: false, status: 401 });
    const c = new KuratchiQueuesPullHttpClient(cfg);
    await expect(c.ack({ acks: [] })).rejects.toThrow(/Queues ack failed/);
  });
});
