import { describe, expect, test } from 'bun:test';

import { createGeneratedWorker } from '../src/runtime/generated-worker.ts';

// Reusable worker factory with one RPC endpoint and one action endpoint so we can
// exercise the framework's only two runtime guarantees: strict same-origin on RPC,
// same-origin on POST actions. Auth is explicitly NOT a framework concern.

function makeWorker(security: Parameters<typeof createGeneratedWorker>[0]['security'] = {}) {
  return createGeneratedWorker({
    routes: [
      {
        pattern: '/rpc',
        rpc: {
          echo: async () => 'ok',
        },
        actions: {
          save: async () => {},
        },
        render: () => '<!doctype html><html><head></head><body><p>rpc</p><script>window.__ran=1</script></body></html>',
      },
    ],
    layout: (content) => content,
    layoutActions: {},
    assetsPrefix: '/assets/',
    assets: {},
    errorPages: {},
    security,
  });
}

function rpcUrl() {
  return 'https://example.com/rpc?_rpc=echo';
}

describe('RPC strict same-origin gate', () => {
  test('rejects requests with neither Sec-Fetch-Site nor Origin (non-browser client)', async () => {
    const worker = makeWorker();
    const res = await worker.fetch(
      new Request(rpcUrl()),
      {},
      {} as ExecutionContext,
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/same-origin/);
  });

  test('rejects cross-origin Sec-Fetch-Site', async () => {
    const worker = makeWorker();
    const res = await worker.fetch(
      new Request(rpcUrl(), { headers: { 'sec-fetch-site': 'cross-site' } }),
      {},
      {} as ExecutionContext,
    );
    expect(res.status).toBe(403);
  });

  test('rejects Origin header from a different origin', async () => {
    const worker = makeWorker();
    const res = await worker.fetch(
      new Request(rpcUrl(), { headers: { origin: 'https://attacker.example' } }),
      {},
      {} as ExecutionContext,
    );
    expect(res.status).toBe(403);
  });

  test('accepts Sec-Fetch-Site: same-origin', async () => {
    const worker = makeWorker();
    const res = await worker.fetch(
      new Request(rpcUrl(), { headers: { 'sec-fetch-site': 'same-origin' } }),
      {},
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
  });

  test('accepts matching Origin when Sec-Fetch-Site is absent', async () => {
    const worker = makeWorker();
    const res = await worker.fetch(
      new Request(rpcUrl(), { headers: { origin: 'https://example.com' } }),
      {},
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
  });

  test('no CSRF cookie or token is ever required or emitted by the framework', async () => {
    const worker = makeWorker();
    const res = await worker.fetch(
      new Request(rpcUrl(), { headers: { 'sec-fetch-site': 'same-origin' } }),
      {},
      {} as ExecutionContext,
    );
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).not.toMatch(/__kuratchi_csrf/);
  });
});

describe('Action same-origin gate', () => {
  test('rejects cross-origin POSTs even when Sec-Fetch-Site is absent', async () => {
    const worker = makeWorker();
    const body = new FormData();
    body.append('_action', 'save');
    const res = await worker.fetch(
      new Request('https://example.com/rpc', {
        method: 'POST',
        headers: { origin: 'https://attacker.example' },
        body,
      }),
      {},
      {} as ExecutionContext,
    );
    expect(res.status).toBe(403);
  });

  test('accepts same-origin form POST without any CSRF token', async () => {
    const worker = makeWorker();
    const body = new FormData();
    body.append('_action', 'save');
    const res = await worker.fetch(
      new Request('https://example.com/rpc', {
        method: 'POST',
        headers: { origin: 'https://example.com' },
        body,
      }),
      {},
      {} as ExecutionContext,
    );
    // Action handler returns no explicit redirect; framework defaults to 303 back to pathname.
    expect([200, 303]).toContain(res.status);
  });
});

describe('CSP nonce opt-in', () => {
  test('no nonce attribute is emitted when the policy does not opt in', async () => {
    const worker = makeWorker({ contentSecurityPolicy: "default-src 'self'" });
    const res = await worker.fetch(
      new Request('https://example.com/rpc', { headers: { 'sec-fetch-site': 'same-origin' } }),
      {},
      {} as ExecutionContext,
    );
    const html = await res.text();
    expect(html).not.toMatch(/nonce=/);
    expect(res.headers.get('content-security-policy')).toBe("default-src 'self'");
  });

  test('stamps a per-request nonce onto every <script> and substitutes {NONCE} in the CSP header', async () => {
    const worker = makeWorker({
      contentSecurityPolicy: "script-src 'self' 'nonce-{NONCE}'",
    });
    const res = await worker.fetch(
      new Request('https://example.com/rpc', { headers: { 'sec-fetch-site': 'same-origin' } }),
      {},
      {} as ExecutionContext,
    );
    const html = await res.text();
    const csp = res.headers.get('content-security-policy') || '';
    // Extract the nonce from the CSP header
    const headerMatch = csp.match(/'nonce-([^']+)'/);
    expect(headerMatch).not.toBeNull();
    const nonce = headerMatch![1];
    expect(nonce.length).toBeGreaterThan(8);
    // Every inline <script> should carry the same nonce
    expect(html).toContain(`<script nonce="${nonce}">window.__ran=1</script>`);
    // Placeholder must be fully replaced
    expect(csp).not.toMatch(/\{NONCE\}/);
  });

  test('nonce differs across requests', async () => {
    const worker = makeWorker({
      contentSecurityPolicy: "script-src 'self' 'nonce-{NONCE}'",
    });
    const fetchOnce = async () => {
      const res = await worker.fetch(
        new Request('https://example.com/rpc', { headers: { 'sec-fetch-site': 'same-origin' } }),
        {},
        {} as ExecutionContext,
      );
      const csp = res.headers.get('content-security-policy') || '';
      return csp.match(/'nonce-([^']+)'/)![1];
    };
    const a = await fetchOnce();
    const b = await fetchOnce();
    expect(a).not.toBe(b);
  });
});
