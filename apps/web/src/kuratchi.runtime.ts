import { routeAgentRequest } from 'agents';
import type { RuntimeDefinition } from '@kuratchi/js';
import { jsonResponse } from '$server/api/utils';
import { verifyAgentConnectionToken } from '$server/ai/live-auth';

const AGENT_PREFIX = '/agents/';

function camelToKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function extractSecret(env: Record<string, any>): string {
  return String(env.AUTH_SECRET || '').trim();
}

const runtime: RuntimeDefinition = {
  agents: {
    async request(ctx, next) {
      if (!ctx.url.pathname.startsWith(AGENT_PREFIX)) {
        return next();
      }

      const secret = extractSecret(ctx.env as Record<string, any>);
      if (!secret) {
        return jsonResponse({ success: false, error: 'AUTH_SECRET is required for live agent connections' }, 500);
      }

      const token = ctx.url.searchParams.get('token')?.trim();
      if (!token) {
        return jsonResponse({ success: false, error: 'Missing agent connection token' }, 401);
      }

      const payload = await verifyAgentConnectionToken(token, secret);
      if (!payload) {
        return jsonResponse({ success: false, error: 'Invalid or expired agent connection token' }, 401);
      }

      const pathParts = ctx.url.pathname.split('/').filter(Boolean);
      const requestedAgent = pathParts[1] || '';
      const requestedName = pathParts[2] || '';
      const expectedAgent = camelToKebab(payload.agent);

      if (requestedAgent !== expectedAgent || requestedName !== payload.name) {
        return jsonResponse({ success: false, error: 'Agent connection token does not match the requested session' }, 403);
      }

      const agentResponse = await routeAgentRequest(ctx.request, ctx.env, {
        props: {
          organizationId: payload.organizationId,
          sessionId: payload.sessionId,
        },
      });

      return agentResponse ?? jsonResponse({ success: false, error: 'Agent route not found' }, 404);
    },
  },
};

export default runtime;
