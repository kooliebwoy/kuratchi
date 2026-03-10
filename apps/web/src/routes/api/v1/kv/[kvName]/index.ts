import type { RouteContext } from '@kuratchi/js';
import { extractBearerToken, getDispatcher, jsonResponse, CORS_HEADERS, handleCorsPreflight } from '$server/api/utils';
import { resolveKvNamespace, validateToken } from '$server/api/cache';

export async function POST(ctx: RouteContext): Promise<Response> {
  const { request, params } = ctx;
  const kvName = params.kvName;

  const bearerToken = extractBearerToken(request);
  if (!bearerToken) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const entry = await resolveKvNamespace(kvName);
  if (!entry) return jsonResponse({ error: 'KV namespace not found' }, 404);
  if (!await validateToken(bearerToken, entry)) return jsonResponse({ error: 'Invalid API token' }, 401);

  try {
    const dispatcher = getDispatcher();
    const userWorker = dispatcher.get(entry.workerName);
    const body = await request.text();

    const res = await userWorker.fetch('https://kv.internal/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...CORS_HEADERS };
    return new Response(res.body, { status: res.status, headers: responseHeaders });
  } catch (err) {
    return jsonResponse({ error: `Dispatch failed: ${err}` }, 502);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
