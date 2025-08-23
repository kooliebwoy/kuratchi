// Cloudflare Queues Producer + Consumer Worker with minimal HTTP interface
// - Producer over HTTP (send, send-batch, health) with Bearer token (env.API_KEY)
// - Consumer via queue() with explicit ack/retry semantics
// - CORS handling
// - Endpoints:
//   POST /api/send         { body, contentType?, delaySeconds? }
//   POST /api/send-batch   { messages: [{ body, contentType?, delaySeconds? }] }
//   GET  /api/health
// Bindings:
//   - env.QUEUE (type: queue) used as PRODUCER binding
//   - To CONSUME, attach this Worker as a consumer of the queue in your Wrangler config

export const DEFAULT_QUEUES_PRODUCER_WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors();
    }

    // Require Authorization header
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    if (!token || token !== env.API_KEY) {
      return json({ success: false, error: 'unauthorized' }, 401);
    }

    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return json({ success: true, ok: true });
      }
      if (request.method === 'POST' && url.pathname === '/api/send') {
        return await handleSend(request, env);
      }
      if (request.method === 'POST' && url.pathname === '/api/send-batch') {
        return await handleSendBatch(request, env);
      }
      return json({ success: false, error: 'not_found' }, 404);
    } catch (err) {
      return json({ success: false, error: (err && err.message) || 'error' }, 500);
    }
  }
  ,
  async queue(batch, env, ctx) {
    // Example consumer logic with explicit ack/retry
    for (const msg of batch.messages) {
      try {
        // Handle message body (string/bytes/json depending on publisher)
        // Replace with your actual processing logic
        console.log('processing message', { id: msg.id, ts: msg.timestamp });
        msg.ack();
      } catch (err) {
        console.error('message processing failed; scheduling retry', err);
        msg.retry({ delaySeconds: 60 });
      }
    }
    // Alternatively, use batch-level helpers:
    // batch.ackAll();
    // batch.retryAll({ delaySeconds: 60 });
  }
};

function cors(extra = {}) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...extra
    }
  });
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extra
    }
  });
}

async function handleSend(request, env) {
  const { body, contentType, delaySeconds } = await request.json();
  if (typeof body === 'undefined') return json({ success: false, error: 'body_required' }, 400);
  const options = {};
  if (contentType) options.contentType = contentType;
  if (typeof delaySeconds === 'number') options.delaySeconds = delaySeconds;
  await env.QUEUE.send(body, options);
  return json({ success: true });
}

async function handleSendBatch(request, env) {
  const { messages } = await request.json();
  if (!Array.isArray(messages)) return json({ success: false, error: 'messages_array_required' }, 400);
  const batch = messages.map((m) => {
    const entry = { body: m.body };
    if (m && typeof m.contentType !== 'undefined') entry.contentType = m.contentType;
    if (m && typeof m.delaySeconds === 'number') entry.delaySeconds = m.delaySeconds;
    return entry;
  });
  await env.QUEUE.sendBatch(batch);
  return json({ success: true, count: batch.length });
}
`;
