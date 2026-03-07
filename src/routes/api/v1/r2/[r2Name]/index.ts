import type { RouteContext } from '@kuratchi/js';
import { extractBearerToken, getDispatcher, jsonResponse, CORS_HEADERS, handleCorsPreflight } from '$server/api/utils';
import { resolveR2Bucket, validateToken } from '$server/api/cache';

async function handleR2(ctx: RouteContext, objectKey: string): Promise<Response> {
  const { request, params } = ctx;
  const r2Name = params.r2Name;

  const bearerToken = extractBearerToken(request);
  if (!bearerToken) return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);

  const entry = await resolveR2Bucket(r2Name);
  if (!entry) return jsonResponse({ error: 'R2 bucket not found' }, 404);
  if (!await validateToken(bearerToken, entry)) return jsonResponse({ error: 'Invalid API token' }, 401);

  try {
    const dispatcher = getDispatcher();
    const userWorker = dispatcher.get(entry.workerName);

    const url = new URL(request.url);
    const internalUrl = `https://r2.internal/${objectKey}${url.search}`;

    const proxyHeaders = new Headers();
    const ct = request.headers.get('content-type');
    if (ct) proxyHeaders.set('content-type', ct);
    const meta = request.headers.get('x-r2-metadata');
    if (meta) proxyHeaders.set('x-r2-metadata', meta);

    const res = await userWorker.fetch(internalUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    });

    const responseHeaders = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(k, v);
    }
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, PUT, DELETE, HEAD, OPTIONS');

    return new Response(res.body, { status: res.status, headers: responseHeaders });
  } catch (err) {
    return jsonResponse({ error: `Dispatch failed: ${err}` }, 502);
  }
}

// List objects (no key)
export async function GET(ctx: RouteContext): Promise<Response> {
  return handleR2(ctx, '');
}

export async function PUT(ctx: RouteContext): Promise<Response> {
  return handleR2(ctx, '');
}

export async function DELETE(ctx: RouteContext): Promise<Response> {
  return handleR2(ctx, '');
}

export async function HEAD(ctx: RouteContext): Promise<Response> {
  return handleR2(ctx, '');
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
