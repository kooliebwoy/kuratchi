// Default Durable Objects SQLite Worker script
// Provides HTTP endpoints that forward to a DO instance keyed by x-db-name header
// Bindings expected:
// - env.DO (durable object namespace) with class KuratchiDoInternal
// - env.API_KEY (secret master gateway key)

export const DEFAULT_DO_WORKER_SCRIPT = `export default {
  async fetch(request, env, ctx) {
    // CORS
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-db-name, x-db-token',
      'Access-Control-Expose-Headers': ''
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });

    // Enforce master gateway key
    const auth = request.headers.get('Authorization');
    const expected = 'Bearer ' + env.API_KEY;
    if (!auth || auth !== expected) return new Response(JSON.stringify({ error: 'Invalid or missing gateway key' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });

    // Require per-database token header; validate signature, db name and expiry with gateway key
    const dbToken = request.headers.get('x-db-token');
    if (!dbToken) return new Response(JSON.stringify({ error: 'Missing x-db-token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });

    const dbName = request.headers.get('x-db-name');
    if (!dbName) return new Response(JSON.stringify({ error: 'x-db-name required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

    // Validate token: format db.rnd.exp.sig, db must match header, exp in future, HMAC-SHA256 over (db + '.' + rnd + '.' + exp) with env.API_KEY
    const parts = dbToken.split('.');
    if (parts.length !== 4) return new Response(JSON.stringify({ error: 'Invalid token format' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    const [tDb, rnd, expStr, sigB64] = parts;
    if (!tDb || !rnd || !expStr || !sigB64) return new Response(JSON.stringify({ error: 'Malformed token' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    if (tDb !== dbName) return new Response(JSON.stringify({ error: 'Token db mismatch' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    const expNum = Number(expStr);
    if (!Number.isFinite(expNum) || expNum < Date.now()) return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });

    const payload = tDb + '.' + rnd + '.' + expNum;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(env.API_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    // base64url encode (inline, avoid arrow/function declarations for CF parser)
    const _bytes = new Uint8Array(sig);
    let _s = '';
    for (let i = 0; i < _bytes.length; i++) {
      _s += String.fromCharCode(_bytes[i]);
    }
    let b64 = btoa(_s);
    b64 = b64.replace(/=/g, '');
    if (b64.indexOf('+') !== -1) { b64 = b64.split('+').join('-'); }
    b64 = b64.replace(/\//g, '_');
    const _okSig = (function() { return b64 === sigB64; })();
    if (!_okSig) {
      return new Response(JSON.stringify({ error: 'Invalid token signature' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // Route to DO instance
    const id = env.DO.idFromName(dbName);
    const stub = env.DO.get(id);
    const url = new URL(request.url);
    url.pathname = '/do' + url.pathname; // namespace under the DO route
    const forwarded = new Request(url.toString(), request);
    const resp = await stub.fetch(forwarded);

    // Merge CORS headers
    const headers = new Headers(resp.headers);
    headers.set('Content-Type', 'application/json');
    for (const [k, v] of Object.entries(cors)) headers.set(k, v as string);
    const body = await resp.text();
    return new Response(body, { status: resp.status, headers });
  }
};

export class KuratchiDoInternal {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });

    try {
      switch (url.pathname) {
        case '/do/api/run':
          return this.handleRun(request);
        case '/do/api/exec':
          return this.handleExec(request);
        case '/do/api/batch':
          return this.handleBatch(request);
        case '/do/api/raw':
          return this.handleRaw(request);
        case '/do/api/first':
          return this.handleFirst(request);
        default:
          return new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  async handleRun(request) {
    const { query, params } = await request.json();
    let stmt = this.state.storage.sql.prepare(query);
    if (params && params.length) stmt = stmt.bind(...params);
    const result = await stmt.run();
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async handleExec(request) {
    const { query } = await request.json();
    const result = await this.state.storage.sql.exec(query);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async handleBatch(request) {
    const { batch } = await request.json();
    const stmts = batch.map(({ query, params }) => {
      const s = this.state.storage.sql.prepare(query);
      return params ? s.bind(...params) : s;
    });
    const results = await this.state.storage.sql.batch(stmts);
    return new Response(JSON.stringify(results), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async handleRaw(request) {
    const { query, params, columnNames = false } = await request.json();
    let stmt = this.state.storage.sql.prepare(query);
    if (params && params.length) stmt = stmt.bind(...params);
    const result = await stmt.raw({ columnNames });
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async handleFirst(request) {
    const { query, params, columnName } = await request.json();
    let stmt = this.state.storage.sql.prepare(query);
    if (params && params.length) stmt = stmt.bind(...params);
    const result = columnName ? await stmt.first(columnName) : await stmt.first();
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}
`;
