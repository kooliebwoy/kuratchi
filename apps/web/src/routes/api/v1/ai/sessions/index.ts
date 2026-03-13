import type { RouteContext } from '@kuratchi/js';
import { handleCorsPreflight, jsonResponse, requirePlatformToken } from '$server/api/utils';
import { createAiSession, listAiSessions } from '$server/database/ai-sessions';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const sessions = await listAiSessions(auth.organizationId);
  return jsonResponse({ success: true, data: sessions });
}

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const body = await ctx.request.json().catch(() => ({})) as Record<string, unknown>;
  const sessionId = typeof body.sessionId === 'string' && body.sessionId.trim()
    ? body.sessionId.trim()
    : crypto.randomUUID();

  const session = await createAiSession({
    id: sessionId,
    organizationId: auth.organizationId,
    model: typeof body.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL,
    title: typeof body.title === 'string' ? body.title : 'New session',
    messageCount: 0,
  });

  return jsonResponse({ success: true, data: session }, 201);
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
