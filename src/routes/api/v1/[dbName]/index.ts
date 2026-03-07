import type { RouteContext } from '@kuratchi/js';
import { extractBearerToken, getDispatcher, jsonResponse, CORS_HEADERS, handleCorsPreflight } from '$server/api/utils';
import { resolveDatabase, validateToken } from '$server/api/cache';

export async function POST(ctx: RouteContext): Promise<Response> {
  const { request, params } = ctx;
  const dbName = params.dbName;

  const bearerToken = extractBearerToken(request);
  if (!bearerToken) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const entry = await resolveDatabase(dbName);
  if (!entry) return jsonResponse({ error: 'Database not found' }, 404);
  if (!await validateToken(bearerToken, entry)) return jsonResponse({ error: 'Invalid API token' }, 401);

  try {
    const dispatcher = getDispatcher();
    const userWorker = dispatcher.get(entry.workerName);
    const body = await request.text();

    const proxyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const bookmark = request.headers.get('x-d1-bookmark');
    if (bookmark) proxyHeaders['x-d1-bookmark'] = bookmark;

    const res = await userWorker.fetch('https://db.internal/', {
      method: 'POST',
      headers: proxyHeaders,
      body,
    });

    const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...CORS_HEADERS };
    const newBookmark = res.headers.get('x-d1-bookmark');
    if (newBookmark) responseHeaders['x-d1-bookmark'] = newBookmark;

    return new Response(res.body, { status: res.status, headers: responseHeaders });
  } catch (err) {
    return jsonResponse({ error: `Dispatch failed: ${err}` }, 502);
  }
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
