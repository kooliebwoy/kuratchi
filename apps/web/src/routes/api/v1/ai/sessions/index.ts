import type { RouteContext } from '@kuratchi/js';
import { handleCorsPreflight, jsonResponse, requirePlatformToken } from '$server/api/utils';
import { createAiSession, listAiSessions } from '$server/database/ai-sessions';
import { DEFAULT_KURATCHI_AI_MODEL, resolveKuratchiAiModel } from '$server/ai/models';

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
    model: resolveKuratchiAiModel(body.model ?? DEFAULT_KURATCHI_AI_MODEL),
    title: typeof body.title === 'string' ? body.title : 'New session',
    messageCount: 0,
  });

  return jsonResponse({ success: true, data: session }, 201);
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
