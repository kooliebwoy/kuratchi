// Default KV Worker script used by the SDK
// Binding name expected: env.KV (KV Namespace)

export const DEFAULT_KV_WORKER_SCRIPT = `export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }

    const authHeader = request.headers.get('Authorization');
    const expected = ` + "`Bearer ${env.API_KEY}`" + `;
    if (!authHeader || authHeader !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid or missing API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }

    const url = new URL(request.url);
    const endpoint = url.pathname;

    try {
      let response;
      switch (endpoint) {
        case '/api/get':
          response = await handleGet(request, env);
          break;
        case '/api/put':
          response = await handlePut(request, env);
          break;
        case '/api/delete':
          response = await handleDelete(request, env);
          break;
        case '/api/list':
          response = await handleList(request, env);
          break;
        default:
          response = new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 404 });
      }

      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      const body = await response.text();
      return new Response(body, { status: response.status, headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }
  }
};

async function handleGet(request, env) {
  const { key, json = false, cacheTtl } = await request.json();
  if (!key) return new Response(JSON.stringify({ success: false, error: 'key_required' }), { status: 400 });
  const options = {};
  if (cacheTtl != null) options.cacheTtl = cacheTtl;
  const type = json ? 'json' : 'text';
  const value = await env.KV.get(key, { type, ...options });
  return new Response(JSON.stringify({ success: true, value }), { status: 200 });
}

async function handlePut(request, env) {
  const { key, value, options } = await request.json();
  if (!key) return new Response(JSON.stringify({ success: false, error: 'key_required' }), { status: 400 });
  if (value == null) return new Response(JSON.stringify({ success: false, error: 'value_required' }), { status: 400 });
  await env.KV.put(key, value, options || {});
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

async function handleDelete(request, env) {
  const { key } = await request.json();
  if (!key) return new Response(JSON.stringify({ success: false, error: 'key_required' }), { status: 400 });
  await env.KV.delete(key);
  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

async function handleList(request, env) {
  const { prefix, limit, cursor } = await request.json();
  const res = await env.KV.list({ prefix, limit, cursor });
  return new Response(JSON.stringify({ success: true, ...res }), { status: 200 });
}
`;
