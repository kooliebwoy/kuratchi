import type { RouteContext } from '@kuratchi/js';
import { getAgentByName } from 'agents';
import { CORS_HEADERS, handleCorsPreflight, jsonResponse, requirePlatformToken } from '$server/api/utils';
import { getAiSession } from '$server/database/ai-sessions';

function buildSessionKey(organizationId: string, sessionId: string): string {
  return `${organizationId}:${sessionId}`;
}

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const sessionId = ctx.params.sessionId;
  const session = await getAiSession(sessionId, auth.organizationId);
  if (!session) {
    return jsonResponse({ success: false, error: 'Session not found' }, 404);
  }

  const stub = await getAgentByName(
    (ctx.env as any).KURATCHI_IDE_SESSION,
    buildSessionKey(auth.organizationId, sessionId),
  );
  const stateResponse = await stub.fetch('https://kuratchi.internal/state');
  const stateData = stateResponse.ok
    ? await stateResponse.json().catch(() => null)
    : null;

  return new Response(JSON.stringify({
    success: true,
    data: {
      ...session,
      state: stateData?.data ?? null,
    },
  }), {
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
