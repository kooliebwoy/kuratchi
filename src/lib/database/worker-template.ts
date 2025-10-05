// Default Durable Objects SQLite Worker script
// Provides HTTP endpoints that forward to a DO instance keyed by x-db-name header
// Bindings expected:
// - env.DO (durable object namespace) with class KuratchiDoInternal
// - env.API_KEY (secret master gateway key)

export const DEFAULT_DO_WORKER_SCRIPT = `import { DurableObject } from 'cloudflare:workers';

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-db-name, x-db-token',
      'Access-Control-Expose-Headers': ''
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

    try {
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
      for (const [k, v] of Object.entries(corsHeaders)) {
        headers.set(k, v);
      }
      const body = await resp.text();
      return new Response(body, { status: resp.status, headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};

export class KuratchiDoInternal extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      switch (url.pathname) {
        case '/do/api/run':
          return await this.handleRun(request);
        case '/do/api/exec':
          return await this.handleExec(request);
        case '/do/api/batch':
          return await this.handleBatch(request);
        case '/do/api/raw':
          return await this.handleRaw(request);
        case '/do/api/first':
          return await this.handleFirst(request);
        case '/do/api/kv/get':
          return await this.handleKvGet(request);
        case '/do/api/kv/put':
          return await this.handleKvPut(request);
        case '/do/api/kv/delete':
          return await this.handleKvDelete(request);
        case '/do/api/kv/list':
          return await this.handleKvList(request);
        default:
          return new Response(JSON.stringify({ error: 'Invalid endpoint' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async handleRun(request) {
    const { query, params } = await request.json();
    // exec() returns a SqlStorageCursor (synchronous)
    const cursor = this.sql.exec(query, ...(params || []));
    const rows = cursor.toArray();
    return new Response(JSON.stringify({ success: true, results: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleExec(request) {
    const { query } = await request.json();
    const cursor = this.sql.exec(query);
    const rows = cursor.toArray();
    return new Response(JSON.stringify({ success: true, results: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleBatch(request) {
    const { batch } = await request.json();
    // Execute atomically using a transaction closure; exec() calls are synchronous (no awaits inside)
    const results = [];
    await this.ctx.storage.transaction(() => {
      for (const item of batch || []) {
        const { query, params } = item || {};
        const cursor = this.sql.exec(query, ...(params || []));
        results.push(cursor.toArray());
      }
    });
    // Ensure any pending writes are flushed
    await this.ctx.storage.sync();
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleRaw(request) {
    // Fallback: execute and return results; storage.sql may not support raw/columnNames directly
    const { query, params } = await request.json();
    const cursor = this.sql.exec(query, ...(params || []));
    const arr = cursor.raw().toArray();
    return new Response(JSON.stringify({ success: true, results: arr }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleFirst(request) {
    // Execute and return the single row (using one()); will throw if != 1 row
    const { query, params, columnName } = await request.json();
    const cursor = this.sql.exec(query, ...(params || []));
    const row = cursor.one();
    const value = columnName ? (row ? row[columnName] : undefined) : row;
    return new Response(JSON.stringify({ success: true, results: value }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleKvGet(request) {
    const body = await request.json();
    const key = body?.key;
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'Key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const type = body?.type || 'json';
    const allowConcurrency = body?.allowConcurrency;
    const noCache = body?.noCache;
    const withMetadata = body?.withMetadata;

    const optsKv: any = {};
    if (allowConcurrency !== undefined) optsKv.allowConcurrency = !!allowConcurrency;
    if (noCache !== undefined) optsKv.noCache = !!noCache;

    let value;
    let metadata;
    if (withMetadata) {
      const result = this.ctx.storage.kv.get(key, { ...optsKv, metadata: true });
      value = result?.value;
      metadata = result?.metadata;
    } else {
      value = this.ctx.storage.kv.get(key, optsKv);
    }

    let responseValue = null;
    let encoding = type;
    if (value !== undefined && value !== null) {
      if (type === 'json' || typeof value === 'object') {
        responseValue = value;
        encoding = 'json';
      } else if (type === 'text' || typeof value === 'string') {
        responseValue = String(value);
        encoding = 'text';
      } else if (type === 'arrayBuffer' || value instanceof ArrayBuffer || value instanceof Uint8Array) {
        const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        responseValue = btoa(binary);
        encoding = 'base64';
      } else {
        responseValue = value;
      }
    }

    return new Response(JSON.stringify({ success: true, value: responseValue, metadata, encoding }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleKvPut(request) {
    const body = await request.json();
    const key = body?.key;
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'Key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const encoding = body?.encoding || 'json';
    const metadata = body?.metadata;
    const allowConcurrency = body?.allowConcurrency;
    const allowUnconfirmed = body?.allowUnconfirmed;
    const expiration = body?.expiration;
    const expirationTtl = body?.expirationTtl;
    const value = body?.value;

    let storedValue = value;
    if (encoding === 'text') {
      storedValue = value == null ? '' : String(value);
    } else if (encoding === 'base64' && typeof value === 'string') {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      storedValue = bytes;
    }

    const optsKv: any = {};
    if (metadata !== undefined) optsKv.metadata = metadata;
    if (allowConcurrency !== undefined) optsKv.allowConcurrency = !!allowConcurrency;
    if (allowUnconfirmed !== undefined) optsKv.allowUnconfirmed = !!allowUnconfirmed;
    if (typeof expiration === 'number') optsKv.expiration = expiration;
    if (typeof expirationTtl === 'number') optsKv.expirationTtl = expirationTtl;

    this.ctx.storage.kv.put(key, storedValue, optsKv);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleKvDelete(request) {
    const body = await request.json();
    const key = body?.key;
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'Key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const allowConcurrency = body?.allowConcurrency;
    const optsKv: any = {};
    if (allowConcurrency !== undefined) optsKv.allowConcurrency = !!allowConcurrency;
    const deleted = this.ctx.storage.kv.delete(key, optsKv);
    return new Response(JSON.stringify({ success: true, deleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async handleKvList(request) {
    const body = await request.json();
    const prefix = body?.prefix;
    const start = body?.start;
    const startAfter = body?.startAfter;
    const end = body?.end;
    const limit = body?.limit;
    const cursor = body?.cursor;
    const allowConcurrency = body?.allowConcurrency;
    const reverse = body?.reverse;

    const optsKv: any = {};
    if (prefix !== undefined) optsKv.prefix = prefix;
    if (start !== undefined) optsKv.start = start;
    if (startAfter !== undefined) optsKv.startAfter = startAfter;
    if (end !== undefined) optsKv.end = end;
    if (limit !== undefined) optsKv.limit = limit;
    if (cursor !== undefined) optsKv.cursor = cursor;
    if (allowConcurrency !== undefined) optsKv.allowConcurrency = !!allowConcurrency;
    if (reverse !== undefined) optsKv.reverse = !!reverse;

    const result = this.ctx.storage.kv.list(optsKv);
    const keys = Array.isArray(result?.keys)
      ? result.keys.map((k) => ({ name: k.name, expiration: k.expiration, metadata: k.metadata }))
      : [];

    return new Response(JSON.stringify({
      success: true,
      keys,
      list_complete: result?.list_complete ?? true,
      cursor: result?.cursor ?? null,
      cacheStatus: result?.cacheStatus || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
`
