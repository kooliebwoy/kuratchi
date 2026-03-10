import { env } from 'cloudflare:workers';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-d1-bookmark, x-r2-metadata',
  'Access-Control-Expose-Headers': 'x-d1-bookmark',
};

export function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function getDispatcher() {
  const dispatcher = (env as any).DISPATCHER;
  if (!dispatcher) throw new Error('Dispatcher unavailable');
  return dispatcher;
}

export function handleCorsPreflight(): Response {
  return new Response(null, {
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
    },
  });
}

export async function requirePlatformToken(request: Request): Promise<{ organizationId: string } | Response> {
  const { getPlatformTokenOrgMap } = await import('./cache');
  const token = extractBearerToken(request);
  if (!token || !token.startsWith('kdbp_')) {
    return jsonResponse({ error: 'Platform token required (kdbp_ prefix)' }, 401);
  }
  const tokenOrgMap = await getPlatformTokenOrgMap();
  const orgId = tokenOrgMap.get(token);
  if (orgId === undefined) {
    return jsonResponse({ error: 'Invalid platform token' }, 401);
  }
  return { organizationId: orgId };
}
