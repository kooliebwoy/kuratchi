import type { RouteContext } from '@kuratchi/js';

export function GET(ctx: RouteContext): Response {
  return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString() }), {
    headers: { 'content-type': 'application/json' },
  });
}
