// Default D1 Database Worker script used by the SDK (legacy single-DB)
// Implements D1 Session bookmarks per https://developers.cloudflare.com/d1/best-practices/read-replication/
// Binding name expected: env.DB (D1)

export const DEFAULT_WORKER_SCRIPT = `export default {
  async fetch(request, env, ctx) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-d1-bookmark',
      // Ensure the client can read the bookmark header
      'Access-Control-Expose-Headers': 'x-d1-bookmark',
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

    // Authorization
    const authHeader = request.headers.get('Authorization');
    const expected = \`Bearer \${env.API_KEY}\`;
    if (!authHeader || authHeader !== expected) {
      return new Response(JSON.stringify({ error: 'Invalid or missing API key' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Session bookmark handling
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const bookmark = request.headers.get('x-d1-bookmark') ?? 'first-unconstrained';
    const session = env.DB.withSession(bookmark);

    try {
      let response;
      switch (endpoint) {
        case '/api/run':
          response = await handleRun(request, session);
          break;
        case '/api/exec':
          response = await handleExec(request, env);
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
          response = new Response(JSON.stringify({ error: 'Invalid endpoint' }), { status: 404 });
      }

      // Merge CORS headers and attach latest bookmark
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');
      for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
      headers.set('x-d1-bookmark', session.getBookmark() ?? '');

      const body = await response.text();
      return new Response(body, { status: response.status, headers });
    } catch (error) {
      const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders });
      headers.set('x-d1-bookmark', session.getBookmark() ?? '');
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers
      });
    }
  }
};

// Handler functions (operate on a D1 Session)
async function handleRun(request, session) {
  const { query, params } = await request.json();
  let stmt = session.prepare(query);
  if (params && params.length > 0) {
    stmt = stmt.bind(...params);
  }
  const result = await stmt.run();
  return new Response(JSON.stringify(result), { status: 200 });
}

async function handleExec(request, env) {
  const { query } = await request.json();
  const result = await env.DB.exec(query);
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
  if (params && params.length > 0) {
    stmt = stmt.bind(...params);
  }
  const result = await stmt.raw({ columnNames });
  return new Response(JSON.stringify(result), { status: 200 });
}

async function handleFirst(request, session) {
  const { query, params, columnName } = await request.json();
  let stmt = session.prepare(query);
  if (params && params.length > 0) {
    stmt = stmt.bind(...params);
  }
  const result = columnName ? await stmt.first(columnName) : await stmt.first();
  return new Response(JSON.stringify(result), { status: 200 });
}
`;
