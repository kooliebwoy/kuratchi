export const DEFAULT_R2_WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // Auth
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token || token !== env.API_KEY) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    try {
      if (request.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);

      switch (url.pathname) {
        case '/api/get':
          return await handleGet(request, env);
        case '/api/put':
          return await handlePut(request, env);
        case '/api/delete':
          return await handleDelete(request, env);
        case '/api/list':
          return await handleList(request, env);
        default:
          return json({ success: false, error: 'not_found' }, 404);
      }
    } catch (e) {
      return json({ success: false, error: (e && e.message) || String(e) }, 500);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(),
      ...extra
    }
  });
}

async function handleGet(request, env) {
  const { key, json: asJson = false } = await request.json();
  if (!key) return json({ success: false, error: 'key_required' }, 400);
  const obj = await env.R2.get(key);
  if (!obj) return json({ success: true, value: null });
  const text = await obj.text();
  const value = asJson ? safeJsonParse(text) : text;
  return json({
    success: true,
    value,
    size: obj.size,
    etag: obj.etag,
    httpMetadata: obj.httpMetadata,
    customMetadata: obj.customMetadata ?? null
  });
}

function safeJsonParse(t) {
  try { return JSON.parse(t); } catch { return t; }
}

async function handlePut(request, env) {
  const { key, value, options } = await request.json();
  if (!key) return json({ success: false, error: 'key_required' }, 400);
  if (value == null) return json({ success: false, error: 'value_required' }, 400);
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  const isJson = typeof value !== 'string';
  const httpMetadata = options?.httpMetadata ?? (isJson ? { contentType: 'application/json' } : undefined);
  await env.R2.put(key, body, { ...options, httpMetadata });
  return json({ success: true });
}

async function handleDelete(request, env) {
  const { key } = await request.json();
  if (!key) return json({ success: false, error: 'key_required' }, 400);
  await env.R2.delete(key);
  return json({ success: true });
}

async function handleList(request, env) {
  const { prefix, limit, cursor, delimiter } = await request.json();
  const res = await env.R2.list({ prefix, limit, cursor, delimiter });
  return json({ success: true, ...res });
}
`;
