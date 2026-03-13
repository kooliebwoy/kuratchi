import type { RouteContext } from '@kuratchi/js';
import { handleCorsPreflight, jsonResponse, requirePlatformToken } from '$server/api/utils';
import { createAiSession, getAiSession } from '$server/database/ai-sessions';
import { signAgentConnectionToken } from '$server/ai/live-auth';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const AGENT_NAME = 'KuratchiIdeSession';
const CONNECTION_TTL_MS = 12 * 60 * 60 * 1000;

function buildSessionKey(organizationId: string, sessionId: string): string {
  return `${organizationId}:${sessionId}`;
}

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const body = await ctx.request.json().catch(() => ({})) as Record<string, unknown>;
  const requestedSessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const sessionId = requestedSessionId || crypto.randomUUID();

  let session = await getAiSession(sessionId, auth.organizationId);
  if (!session) {
    session = await createAiSession({
      id: sessionId,
      organizationId: auth.organizationId,
      model: typeof body.model === 'string' && body.model.trim() ? body.model.trim() : DEFAULT_MODEL,
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'New session',
      messageCount: 0,
    });
  }

  const secret = String((ctx.env as Record<string, any>).AUTH_SECRET || '').trim();
  if (!secret) {
    return jsonResponse({ success: false, error: 'AUTH_SECRET is required for live agent connections' }, 500);
  }

  const connectionToken = await signAgentConnectionToken({
    organizationId: auth.organizationId,
    sessionId,
    agent: AGENT_NAME,
    name: buildSessionKey(auth.organizationId, sessionId),
    exp: Date.now() + CONNECTION_TTL_MS,
  }, secret);

  const expiresAt = new Date(Date.now() + CONNECTION_TTL_MS).toISOString();

  return jsonResponse({
    success: true,
    data: {
      session,
      agent: {
        agent: AGENT_NAME,
        name: buildSessionKey(auth.organizationId, sessionId),
        host: ctx.url.host,
        protocol: ctx.url.protocol === 'https:' ? 'wss' : 'ws',
        query: { token: connectionToken },
        expiresAt,
      },
    },
  });
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
