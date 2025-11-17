// Default D1 SQLite Worker script with Session support
// Provides HTTP endpoints for D1 database access with session bookmarks
// and optional R2 storage operations
// Bindings expected:
// - env.DB (D1 database binding)
// - env.API_KEY (secret master gateway key)
// - env.STORAGE (optional R2 bucket binding)

export const DEFAULT_D1_WORKER_SCRIPT = `

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-db-name, x-db-token, x-d1-bookmark',
      'Access-Control-Expose-Headers': 'x-d1-bookmark'
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Enforce master gateway key
    const auth = request.headers.get('Authorization');
    const expected = \`Bearer \${env.API_KEY}\`;
    if (!auth || auth !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid or missing gateway key' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Require per-database token header; validate signature, db name and expiry with gateway key
    const dbToken = request.headers.get('x-db-token');
    if (!dbToken) {
      return new Response(JSON.stringify({ error: 'Missing x-db-token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const dbName = request.headers.get('x-db-name');
    if (!dbName) {
      return new Response(JSON.stringify({ error: 'x-db-name required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Validate token: format db.rnd.exp.sig, db must match header, exp in future, HMAC-SHA256 over (db + '.' + rnd + '.' + exp) with env.API_KEY
    const parts = dbToken.split('.');
    if (parts.length !== 4) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const [tDb, rnd, expStr, sigB64] = parts;
    if (!tDb || !rnd || !expStr || !sigB64) {
      return new Response(JSON.stringify({ error: 'Malformed token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (tDb !== dbName) {
      return new Response(JSON.stringify({ error: 'Token db mismatch' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    const expNum = Number(expStr);
    if (!Number.isFinite(expNum) || expNum < Date.now()) {
      return new Response(JSON.stringify({ error: 'Token expired' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Verify token signature
    const payload = tDb + '.' + rnd + '.' + expNum;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(env.API_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    
    // Base64url encode signature
    const bytes = new Uint8Array(sig);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    let b64 = btoa(str);
    b64 = b64.replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
    
    if (b64 !== sigB64) {
      return new Response(JSON.stringify({ error: 'Invalid token signature' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Create D1 Session with bookmark
    const bookmark = request.headers.get('x-d1-bookmark') || 'first-unconstrained';
    const session = env.DB.withSession(bookmark);

    try {
      // Handle request with session
      const response = await withTablesInitialized(request, session, env, handleRequest);
      
      // Return the bookmark so we can continue the session in another request
      response.headers.set('x-d1-bookmark', session.getBookmark() || '');
      
      // Merge CORS headers
      for (const [k, v] of Object.entries(corsHeaders)) {
        response.headers.set(k, v);
      }
      
      return response;
    } catch (error) {
      console.error({
        message: 'Failed to handle request',
        error: String(error),
        errorProps: error,
        url: request.url,
        bookmark
      });
      return new Response(JSON.stringify({ error: String(error), errorDetails: error }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

// Retry helper for transient errors
function shouldRetry(err, nextAttempt) {
  const errMsg = String(err);
  const isRetryableError =
    errMsg.includes('Network connection lost') ||
    errMsg.includes('storage caused object to be reset') ||
    errMsg.includes('reset because its code was updated');
  if (nextAttempt <= 5 && isRetryableError) {
    return true;
  }
  return false;
}

async function retryWhile(fn, shouldRetryFn) {
  let attempt = 1;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (shouldRetryFn(err, attempt)) {
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

// Main request handler
async function handleRequest(request, session, env) {
  const { pathname } = new URL(request.url);
  const tsStart = Date.now();

  if (pathname === '/api/run') {
    // Read request body once before retry loop
    const { query, params } = await request.json();
    return await retryWhile(async () => {
      let stmt = session.prepare(query);
      if (params && params.length > 0) {
        stmt = stmt.bind(...params);
      }
      const resp = await stmt.all();
      return Response.json(buildResponse(session, resp, tsStart));
    }, shouldRetry);
  } else if (pathname === '/api/exec') {
    // Read request body once before retry loop
    const { query } = await request.json();
    return await retryWhile(async () => {
      // exec() is not available on sessions, use the raw DB binding
      const resp = await env.DB.exec(query);
      // exec() returns D1ExecResult with different structure
      return Response.json({
        success: true,
        results: [],
        d1Latency: Date.now() - tsStart,
        servedByRegion: resp.meta?.served_by_region || '',
        servedByPrimary: resp.meta?.served_by_primary || '',
        sessionBookmark: session.getBookmark()
      });
    }, shouldRetry);
  } else if (pathname === '/api/batch') {
    // Read request body once before retry loop
    const { batch } = await request.json();
    return await retryWhile(async () => {
      const stmts = batch.map(item => {
        let stmt = session.prepare(item.query);
        if (item.params && item.params.length > 0) {
          stmt = stmt.bind(...item.params);
        }
        return stmt;
      });
      const results = await session.batch(stmts);
      return Response.json({
        success: true,
        results: results.map(r => r.results || []),
        d1Latency: Date.now() - tsStart,
        sessionBookmark: session.getBookmark()
      });
    }, shouldRetry);
  } else if (pathname === '/api/raw') {
    return await retryWhile(async () => {
      const { query, params } = await request.json();
      const stmt = session.prepare(query);
      if (params && params.length > 0) {
        stmt.bind(...params);
      }
      const resp = await stmt.raw();
      return Response.json(buildResponse(session, { results: resp }, tsStart));
    }, shouldRetry);
  } else if (pathname === '/api/first') {
    return await retryWhile(async () => {
      const { query, params, columnName } = await request.json();
      const stmt = session.prepare(query);
      if (params && params.length > 0) {
        stmt.bind(...params);
      }
      const value = await stmt.first(columnName);
      return Response.json({
        success: true,
        results: value,
        d1Latency: Date.now() - tsStart,
        sessionBookmark: session.getBookmark()
      });
    }, shouldRetry);
  } else if (pathname === '/api/storage/get') {
    if (!env.STORAGE) {
      return Response.json({ success: false, error: 'R2 storage not configured' }, { status: 501 });
    }
    const { key } = await request.json();
    if (!key) {
      return Response.json({ success: false, error: 'Missing key parameter' }, { status: 400 });
    }
    try {
      const object = await env.STORAGE.get(key);
      if (!object) {
        return Response.json({ success: false, error: 'Object not found' }, { status: 404 });
      }
      const data = await object.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
      return Response.json({
        success: true,
        results: {
          key,
          data: base64,
          size: object.size,
          httpMetadata: object.httpMetadata,
          customMetadata: object.customMetadata,
          etag: object.etag
        }
      });
    } catch (error) {
      return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
  } else if (pathname === '/api/storage/put') {
    if (!env.STORAGE) {
      return Response.json({ success: false, error: 'R2 storage not configured' }, { status: 501 });
    }
    const { key, data, httpMetadata, customMetadata } = await request.json();
    if (!key || !data) {
      return Response.json({ success: false, error: 'Missing key or data parameter' }, { status: 400 });
    }
    try {
      // Decode base64 data
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const options = {};
      if (httpMetadata) options.httpMetadata = httpMetadata;
      if (customMetadata) options.customMetadata = customMetadata;
      await env.STORAGE.put(key, bytes, options);
      return Response.json({ success: true, results: { key } });
    } catch (error) {
      return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
  } else if (pathname === '/api/storage/delete') {
    if (!env.STORAGE) {
      return Response.json({ success: false, error: 'R2 storage not configured' }, { status: 501 });
    }
    const { key } = await request.json();
    if (!key) {
      return Response.json({ success: false, error: 'Missing key parameter' }, { status: 400 });
    }
    try {
      if (Array.isArray(key)) {
        await env.STORAGE.delete(key);
      } else {
        await env.STORAGE.delete(key);
      }
      return Response.json({ success: true, results: { deleted: key } });
    } catch (error) {
      return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
  } else if (pathname === '/api/storage/list') {
    if (!env.STORAGE) {
      return Response.json({ success: false, error: 'R2 storage not configured' }, { status: 501 });
    }
    const { prefix, limit, cursor, delimiter } = await request.json();
    try {
      const options = {};
      if (prefix) options.prefix = prefix;
      if (limit) options.limit = limit;
      if (cursor) options.cursor = cursor;
      if (delimiter) options.delimiter = delimiter;
      const listed = await env.STORAGE.list(options);
      return Response.json({
        success: true,
        results: {
          objects: listed.objects.map(obj => ({
            key: obj.key,
            size: obj.size,
            uploaded: obj.uploaded,
            etag: obj.etag
          })),
          truncated: listed.truncated,
          cursor: listed.cursor,
          prefixes: listed.delimitedPrefixes
        }
      });
    } catch (error) {
      return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
  } else if (pathname === '/api/storage/head') {
    if (!env.STORAGE) {
      return Response.json({ success: false, error: 'R2 storage not configured' }, { status: 501 });
    }
    const { key } = await request.json();
    if (!key) {
      return Response.json({ success: false, error: 'Missing key parameter' }, { status: 400 });
    }
    try {
      const object = await env.STORAGE.head(key);
      if (!object) {
        return Response.json({ success: false, error: 'Object not found' }, { status: 404 });
      }
      return Response.json({
        success: true,
        results: {
          key,
          size: object.size,
          httpMetadata: object.httpMetadata,
          customMetadata: object.customMetadata,
          etag: object.etag
        }
      });
    } catch (error) {
      return Response.json({ success: false, error: String(error) }, { status: 500 });
    }
  } else if (pathname === '/api/kv/get') {
    // KV operations not supported in D1 - return error
    return Response.json({ success: false, error: 'KV operations not supported in D1 mode' }, { status: 501 });
  } else if (pathname === '/api/kv/put') {
    return Response.json({ success: false, error: 'KV operations not supported in D1 mode' }, { status: 501 });
  } else if (pathname === '/api/kv/delete') {
    return Response.json({ success: false, error: 'KV operations not supported in D1 mode' }, { status: 501 });
  } else if (pathname === '/api/kv/list') {
    return Response.json({ success: false, error: 'KV operations not supported in D1 mode' }, { status: 501 });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

function buildResponse(session, res, tsStart) {
  return {
    success: true,
    results: res.results || [],
    d1Latency: Date.now() - tsStart,
    servedByRegion: res.meta?.served_by_region || '',
    servedByPrimary: res.meta?.served_by_primary || '',
    sessionBookmark: session.getBookmark()
  };
}

// Auto-initialize tables on first error
async function withTablesInitialized(request, session, env, handler) {
  try {
    return await handler(request.clone(), session, env);
  } catch (e) {
    const errMsg = String(e);
    // If it's a "no such table" error, initialize and retry
    if (errMsg.includes('no such table') || errMsg.includes('SQLITE_ERROR')) {
      await initTables(env);
      return await handler(request.clone(), session, env);
    }
    throw e;
  }
}

async function initTables(env) {
  // Create migrations_history table for tracking migrations
  // exec() is not available on sessions, use the raw DB binding
  await env.DB.exec(
    'CREATE TABLE IF NOT EXISTS migrations_history (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL UNIQUE, created_at INTEGER);'
  );
}
`;

// Backward compatibility: export as DEFAULT_DO_WORKER_SCRIPT for existing code
export const DEFAULT_DO_WORKER_SCRIPT = DEFAULT_D1_WORKER_SCRIPT;
