import type { RouteContext } from '@kuratchi/js';
import { getAgentByName } from 'agents';
import { handleCorsPreflight, jsonResponse, CORS_HEADERS, requirePlatformToken } from '$server/api/utils';
import { deriveSessionTitle, upsertAiSession } from '$server/database/ai-sessions';
import { logActivity } from '$server/database/audit';
import { DEFAULT_KURATCHI_AI_MODEL, resolveKuratchiAiModel } from '$server/ai/models';

function buildSessionKey(organizationId: string, sessionId: string): string {
  return `${organizationId}:${sessionId}`;
}

export async function GET(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const sessionId = ctx.url.searchParams.get('sessionId')?.trim();
  if (!sessionId) {
    return jsonResponse({ success: false, error: 'sessionId query parameter is required' }, 400);
  }

  const stub = await getAgentByName(
    (ctx.env as any).KURATCHI_AI_SESSION,
    buildSessionKey(auth.organizationId, sessionId),
  );
  const response = await stub.fetch('https://kuratchi.internal/state');

  return new Response(response.body, {
    status: response.status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

export async function POST(ctx: RouteContext): Promise<Response> {
  const auth = await requirePlatformToken(ctx.request);
  if (auth instanceof Response) return auth;

  const body = await ctx.request.json() as Record<string, unknown>;
  const requestedSessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const sessionId = requestedSessionId || crypto.randomUUID();

  const stub = await getAgentByName(
    (ctx.env as any).KURATCHI_AI_SESSION,
    buildSessionKey(auth.organizationId, sessionId),
  );
  const response = await stub.fetch('https://kuratchi.internal/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...body,
      organizationId: auth.organizationId,
      sessionId,
    }),
  });

  if (response.ok) {
    const payload = await response.clone().json().catch(() => null) as {
      data?: {
        model?: string;
        reply?: string;
        messages?: { role: string; content: string }[];
      };
    } | null;

    const messages = Array.isArray(payload?.data?.messages) ? payload!.data!.messages : [];
    const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? null;
    const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? null;

    await upsertAiSession({
      id: sessionId,
      organizationId: auth.organizationId,
      model: resolveKuratchiAiModel(payload?.data?.model ?? body.model ?? DEFAULT_KURATCHI_AI_MODEL),
      title: deriveSessionTitle(messages),
      lastUserMessage,
      lastAssistantMessage,
      messageCount: messages.length,
    });
  }

  logActivity({
    action: 'ai.chat',
    organizationId: auth.organizationId,
    data: {
      sessionId,
      model: typeof body.model === 'string' ? body.model : null,
    },
    isAdminAction: false,
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json',
      'x-kuratchi-session-id': sessionId,
    },
  });
}

export { handleCorsPreflight as OPTIONS } from '$server/api/utils';
