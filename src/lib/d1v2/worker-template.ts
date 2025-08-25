// D1v2 Router Worker script
// Single worker that routes SQL to multiple D1 databases bound as env["DB_<name>"]
// Auth: Authorization: Bearer <API_KEY> (gateway key) + x-db-name + x-db-token (signed with API_KEY)
// Supports D1 session bookmarks via x-d1-bookmark request/response header

export const DEFAULT_D1V2_WORKER_SCRIPT = `export default {
  async fetch(request, env, ctx) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-db-name, x-db-token, x-d1-bookmark',
      'Access-Control-Expose-Headers': 'x-d1-bookmark',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // Gateway auth
    const auth = request.headers.get('Authorization') || '';
    const expected = \'Bearer \'+env.API_KEY;
    if (auth !== expected) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    const dbName = request.headers.get('x-db-name');
    const dbToken = request.headers.get('x-db-token') || '';
    if (!dbName) {
      return new Response(JSON.stringify({ error: 'missing_db_name' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // Validate token signature (HMAC-SHA256 with API_KEY)
    const valid = await validateSignedDbToken(dbName, dbToken, env.API_KEY);
    if (!valid.ok) {
      return new Response(JSON.stringify({ error: 'invalid_db_token', reason: valid.reason }), { status: 401, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    const bindingName = 'DB_' + dbName;
    const db = env[bindingName];
    if (!db) {
      return new Response(JSON.stringify({ error: 'db_not_bound', db: dbName }), { status: 404, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    const url = new URL(request.url);
    const endpoint = url.pathname;

    // Session bookmark
    const bookmark = request.headers.get('x-d1-bookmark') ?? 'first-unconstrained';
    const session = db.withSession(bookmark);

    try {
      let response;
      switch (endpoint) {
        case '/api/run':
          response = await handleRun(request, session);
          break;
        case '/api/exec':
          response = await handleExec(request, db);
          break;
        case '/api/batch':
          response = await handleBatch(request, session);
          break;
        case '/api/raw':
          response = await handleRaw(request, session);
          break;
        case '/api/first':
          response = await handleFirst(request, session);
          break;
        default:
          response = new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      headers.set('x-d1-bookmark', session.getBookmark() ?? '');
      const body = await response.text();
      return new Response(body, { status: response.status, headers });
    } catch (err) {
      const headers = new Headers({ 'Content-Type': 'application/json', ...cors });
      headers.set('x-d1-bookmark', session.getBookmark() ?? '');
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
    }
  }
};

async function handleRun(request, session) {
  const { query, params } = await request.json();
  let stmt = session.prepare(query);
  if (params && params.length) stmt = stmt.bind(...params);
  const result = await stmt.run();
  return new Response(JSON.stringify(result), { status: 200 });
}
async function handleExec(request, db) {
  const { query } = await request.json();
  const result = await db.exec(query);
  return new Response(JSON.stringify(result), { status: 200 });
}
async function handleBatch(request, session) {
  const { batch } = await request.json();
  const stmts = batch.map(({ query, params }) => {
    const stmt = session.prepare(query);
    return params ? stmt.bind(...params) : stmt;
  });
  const results = await session.batch(stmts);
  return new Response(JSON.stringify(results), { status: 200 });
}
async function handleRaw(request, session) {
  const { query, params, columnNames = false } = await request.json();
  let stmt = session.prepare(query);
  if (params && params.length) stmt = stmt.bind(...params);
  const result = await stmt.raw({ columnNames });
  return new Response(JSON.stringify(result), { status: 200 });
}
async function handleFirst(request, session) {
  const { query, params, columnName } = await request.json();
  let stmt = session.prepare(query);
  if (params && params.length) stmt = stmt.bind(...params);
  const result = columnName ? await stmt.first(columnName) : await stmt.first();
  return new Response(JSON.stringify(result), { status: 200 });
}

// --- Minimal token helpers (inline to avoid imports) ---
function b64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
  const b = atob ? atob(b64 + pad) : Buffer.from(b64 + pad, 'base64').toString('binary');
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
async function hmacSha256(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return new Uint8Array(sig);
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a[i] ^ b[i];
  return res === 0;
}
async function validateSignedDbToken(dbName, token, secret) {
  try {
    const parts = (token || '').split('.');
    if (parts.length !== 4) return { ok: false, reason: 'malformed' };
    const [tDb, rnd, expStr, sigB64] = parts;
    if (!tDb || !rnd || !expStr || !sigB64) return { ok: false, reason: 'malformed' };
    if (tDb !== dbName) return { ok: false, reason: 'dbname_mismatch' };
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) return { ok: false, reason: 'expired' };
    const payload = tDb + '.' + rnd + '.' + exp;
    const expected = await hmacSha256(secret, payload);
    const got = b64urlToBytes(sigB64);
    if (!timingSafeEqual(expected, got)) return { ok: false, reason: 'bad_sig' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error' };
  }
}
`;
