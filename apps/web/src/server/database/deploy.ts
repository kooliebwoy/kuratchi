import { env } from 'cloudflare:workers';

// -- D1 Gateway Worker Script ---------------------------------------
// Internal-only worker deployed per database into the dispatch namespace.
// No auth -- only reachable via the DISPATCHER binding from kuratchi-db.
// Bindings: env.DB (D1 database)
//
// Single endpoint: POST /
// Body variants:
//   { sql, params? }             -> run (returns rows as objects)
//   { sql, params?, raw: true }  -> raw (returns rows as arrays)
//   { sql, exec: true }          -> exec (DDL/write, no results)
//   { batch: [{ sql, params? }] } -> batch (multiple statements)

export const D1_WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    try {
      const body = await request.json();
      const response = await withTablesInitialized(body, env, handleRequest);
      return response;
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  }
};

function shouldRetry(err, nextAttempt) {
  const errMsg = String(err);
  const isRetryable = errMsg.includes('Network connection lost') || errMsg.includes('storage caused object to be reset') || errMsg.includes('reset because its code was updated');
  return nextAttempt <= 5 && isRetryable;
}

async function retryWhile(fn, shouldRetryFn) {
  let attempt = 1;
  while (true) {
    try { return await fn(); }
    catch (err) {
      if (shouldRetryFn(err, attempt)) { attempt++; continue; }
      throw err;
    }
  }
}

async function handleRequest(body, env) {
  const tsStart = Date.now();

  // Batch mode
  if (body.batch) {
    return await retryWhile(async () => {
      const stmts = body.batch.map(item => {
        let stmt = env.DB.prepare(item.sql);
        if (item.params && item.params.length > 0) stmt = stmt.bind(...item.params);
        return stmt;
      });
      const results = await env.DB.batch(stmts);
      return Response.json({
        success: true,
        results: results.map(r => r.results || []),
        d1Latency: Date.now() - tsStart,
      });
    }, shouldRetry);
  }

  // Exec mode (DDL/write-only)
  if (body.exec) {
    return await retryWhile(async () => {
      const stmt = env.DB.prepare(body.sql);
      const resp = await stmt.run();
      return Response.json({
        success: resp.success ?? true,
        results: [],
        meta: resp.meta,
        d1Latency: Date.now() - tsStart,
      });
    }, shouldRetry);
  }

  // Raw mode (array-of-arrays)
  if (body.raw) {
    return await retryWhile(async () => {
      let stmt = env.DB.prepare(body.sql);
      if (body.params && body.params.length > 0) stmt = stmt.bind(...body.params);
      const resp = await stmt.raw();
      return Response.json({
        success: true,
        results: resp,
        d1Latency: Date.now() - tsStart,
      });
    }, shouldRetry);
  }

  // Default: run (returns rows as objects)
  return await retryWhile(async () => {
    let stmt = env.DB.prepare(body.sql);
    if (body.params && body.params.length > 0) stmt = stmt.bind(...body.params);
    const resp = await stmt.all();
    return Response.json({
      success: true,
      results: resp.results || [],
      d1Latency: Date.now() - tsStart,
      servedByRegion: resp.meta?.served_by_region || '',
      servedByPrimary: resp.meta?.served_by_primary || '',
    });
  }, shouldRetry);
}

async function withTablesInitialized(body, env, handler) {
  try { return await handler(body, env); }
  catch (e) {
    const errMsg = String(e);
    if (errMsg.includes('no such table') || errMsg.includes('SQLITE_ERROR')) {
      await initTables(env);
      return await handler(body, env);
    }
    throw e;
  }
}

async function initTables(env) {
  await env.DB.exec('CREATE TABLE IF NOT EXISTS migrations_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL UNIQUE, created_at INTEGER);');
}
`;

// -- Token generation -----------------------------------------------
// Token format: {dbName}.{rnd}.{expMs}.{hmac-sha256-base64url}
// Validated at the edge in src/server/runtime.hook.ts.

export async function generateDbToken(
  dbName: string,
  gatewayKey: string,
  expiryMs = 365 * 24 * 60 * 60 * 1000 // 1 year default
): Promise<string> {
  const rnd = crypto.randomUUID().replace(/-/g, '');
  const exp = Date.now() + expiryMs;
  const payload = `${dbName}.${rnd}.${exp}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(gatewayKey),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));

  const bytes = new Uint8Array(sig);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  const b64 = btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${payload}.${b64}`;
}

// -- Workers for Platforms: deploy to dispatch namespace ------------

export async function deployDbWorker(options: {
  accountId: string;
  apiToken: string;
  namespace: string;
  workerName: string;
  d1DatabaseId: string;
}): Promise<void> {
  const { accountId, apiToken, namespace, workerName, d1DatabaseId } = options;

  const form = new FormData();
  form.append(
    'worker.js',
    new File([D1_WORKER_SCRIPT], 'worker.js', { type: 'application/javascript+module' })
  );
  form.append('metadata', JSON.stringify({
    main_module: 'worker.js',
    compatibility_date: '2026-02-26',
    compatibility_flags: ['nodejs_compat'],
    bindings: [
      { type: 'd1', name: 'DB', id: d1DatabaseId },
    ],
  }));

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${workerName}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to deploy DB worker to namespace: ${res.status} ${err}`);
  }
}

export async function deleteDbWorker(options: {
  accountId: string;
  apiToken: string;
  namespace: string;
  workerName: string;
}): Promise<void> {
  const { accountId, apiToken, namespace, workerName } = options;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/dispatch/namespaces/${namespace}/scripts/${workerName}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiToken}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete DB worker from namespace: ${res.status} ${err}`);
  }
}

// -- Dispatch a query through the Workers for Platforms dispatcher --

export async function dispatchQuery(
  workerName: string,
  body: string,
  bookmark?: string,
): Promise<Response> {
  const dispatcher = (env as any).DISPATCHER;

  if (!dispatcher) {
    throw new Error('DISPATCHER binding not available -- check wrangler.jsonc dispatch_namespaces');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bookmark) headers['x-d1-bookmark'] = bookmark;

  const userWorker = dispatcher.get(workerName);
  return userWorker.fetch('https://db.internal/', {
    method: 'POST',
    headers,
    body,
  });
}
