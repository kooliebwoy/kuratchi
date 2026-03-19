import { getAgentByName, routeAgentRequest } from 'agents';
import type { RuntimeDefinition } from '@kuratchi/js';
import { jsonResponse } from '$server/api/utils';
import { verifyAgentConnectionToken } from '$server/ai/live-auth';
import { resolveSiteRequest } from '$server/database/sites';

const AGENT_PREFIX = '/agents/';
const IDE_LIVE_PATH = '/api/v1/ai/ide/live';

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
  sites: {
    async request(ctx, next) {
      const siteResponse = await resolveSiteRequest(ctx.request);
      if (siteResponse) return siteResponse;
      return next();
    },
  },
  agents: {
    async request(ctx, next) {
      if (!ctx.url.pathname.startsWith(AGENT_PREFIX) && ctx.url.pathname !== IDE_LIVE_PATH) {
        return next();
      }

      console.log('[kuratchi live] incoming agent request', {
        path: ctx.url.pathname,
        hasToken: Boolean(ctx.url.searchParams.get('token')),
        upgrade: ctx.request.headers.get('upgrade') || '',
      });

      const secret = extractSecret(ctx.env as Record<string, any>);
      if (!secret) {
        console.log('[kuratchi live] missing AUTH_SECRET');
        return jsonResponse({ success: false, error: 'AUTH_SECRET is required for live agent connections' }, 500);
      }

      const token = ctx.url.searchParams.get('token')?.trim();
      if (!token) {
        console.log('[kuratchi live] missing token');
        return jsonResponse({ success: false, error: 'Missing agent connection token' }, 401);
      }

      const payload = await verifyAgentConnectionToken(token, secret);
      if (!payload) {
        console.log('[kuratchi live] invalid token');
        return jsonResponse({ success: false, error: 'Invalid or expired agent connection token' }, 401);
      }

      if (ctx.url.pathname === IDE_LIVE_PATH) {
        const agent = await getAgentByName(
          (ctx.env as any).KURATCHI_IDE_SESSION,
          payload.name,
        );
        const response = await agent.fetch(ctx.request);
        console.log('[kuratchi live] forwarded custom live route', {
          session: payload.name,
          status: response.status,
        });
        return response;
      }

      const pathParts = ctx.url.pathname.split('/').filter(Boolean);
      const requestedAgent = pathParts[1] || '';
      const requestedName = pathParts[2] || '';
      const expectedAgent = camelToKebab(payload.agent);

      if (requestedAgent !== expectedAgent || requestedName !== payload.name) {
        console.log('[kuratchi live] token mismatch', {
          requestedAgent,
          expectedAgent,
          requestedName,
          expectedName: payload.name,
        });
        return jsonResponse({ success: false, error: 'Agent connection token does not match the requested session' }, 403);
      }

      const agentResponse = await routeAgentRequest(ctx.request, ctx.env, {
        props: {
          organizationId: payload.organizationId,
          sessionId: payload.sessionId,
        },
      });

      console.log('[kuratchi live] routed standard agent request', {
        session: payload.name,
        status: agentResponse?.status ?? 404,
      });

      return agentResponse ?? jsonResponse({ success: false, error: 'Agent route not found' }, 404);
    },
  },
};

export default runtime;
