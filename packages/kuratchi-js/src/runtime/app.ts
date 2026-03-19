/**
 * Core application — the Worker fetch() handler.
 *
 * Takes an AppConfig, returns a standard Cloudflare Worker fetch handler.
 */

import { Router, filePathToPattern } from './router.js';
import type { AppConfig, Env, RouteContext, RouteModule, ApiRouteModule, LayoutModule, PageRenderOutput, PageRenderResult } from './types.js';

/**
 * Create a Cloudflare Worker fetch handler from an AppConfig.
 */
export function createApp<E extends Env = Env>(config: AppConfig<E>) {
  const router = new Router();
  const routes: (RouteModule | ApiRouteModule)[] = config.routes ?? [];
  const layouts: Record<string, LayoutModule> = config.layouts ?? {};
  // Register routes
  for (let i = 0; i < routes.length; i++) {
    router.add(routes[i].pattern, i);
  }

  // The Worker fetch handler
  return {
    async fetch(request: Request, env: E, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);

      // Build base context (params filled in after routing)
      const context: RouteContext<E> = {
        request,
        env,
        ctx,
        params: {},
        locals: {},
        url,
      };

      // --- Static files from public/ ---
      // Handled by wrangler's [site] config, not here.

      // --- Route matching ---
      const match = router.match(url.pathname);

      // Build the final handler (route dispatch)
      const routeHandler = async (): Promise<Response> => {
        if (!match) {
          return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/html' } });
        }

        const route = routes[match.index];
        context.params = match.params;

        // --- API routes: dispatch to method handler ---
        if ('__api' in route && route.__api) {
          const method = request.method;
          if (method === 'OPTIONS') {
            const handler = (route as any)['OPTIONS'];
            if (typeof handler === 'function') return handler(context);
            const allowed = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
              .filter(m => typeof (route as any)[m] === 'function').join(', ');
            return new Response(null, {
              status: 204,
              headers: { 'Allow': allowed, 'Access-Control-Allow-Methods': allowed },
            });
          }
          const handler = (route as any)[method];
          if (typeof handler !== 'function') {
            const allowed = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']
              .filter(m => typeof (route as any)[m] === 'function').join(', ');
            return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
              status: 405,
              headers: { 'content-type': 'application/json', 'Allow': allowed },
            });
          }
          return handler(context);
        }

        // From here, route is a page route (RouteModule)
        const pageRoute = route as RouteModule;

        // --- RPC calls: POST ?/_rpc/functionName ---
        if (request.method === 'POST' && url.searchParams.has('_rpc')) {
          const fnName = url.searchParams.get('_rpc')!;
          const rpcFn = pageRoute.rpc?.[fnName];
          if (!rpcFn) {
            return new Response(JSON.stringify({ error: `RPC function '${fnName}' not found` }), {
              status: 404,
              headers: { 'content-type': 'application/json' },
            });
          }
          try {
            const body = await request.json() as { args?: any[] };
            const result = await rpcFn(body.args ?? [], env, context);
            return new Response(JSON.stringify(result), {
              headers: { 'content-type': 'application/json' },
            });
          } catch (err: any) {
            return new Response(JSON.stringify({ error: err.message }), {
              status: 500,
              headers: { 'content-type': 'application/json' },
            });
          }
        }

        // --- Form actions: POST ?/actionName ---
        if (request.method === 'POST') {
          const actionParam = [...url.searchParams.keys()].find(k => k.startsWith('/'));
          if (actionParam) {
            const actionName = actionParam.slice(1); // remove leading /
            const actionFn = pageRoute.actions?.[actionName];
            if (!actionFn) {
              return new Response(`Action '${actionName}' not found`, { status: 404 });
            }
            try {
              const formData = await request.formData();
              const actionResult = await actionFn(formData, env, context);

              // After action, re-run load and re-render with action result
              const loadData = pageRoute.load ? await pageRoute.load(context) : {};
              const data = { ...loadData, actionResult, actionName };
              return renderPage(pageRoute, data, layouts);
            } catch (err: any) {
              // Re-render with error
              const loadData = pageRoute.load ? await pageRoute.load(context) : {};
              const data = { ...loadData, actionError: err.message, actionName };
              return renderPage(pageRoute, data, layouts);
            }
          }
        }

        // --- GET: load + render ---
        try {
          const data = pageRoute.load ? await pageRoute.load(context) : {};
          return renderPage(pageRoute, data, layouts);
        } catch (err: any) {
          return new Response(`Server Error: ${err.message}`, {
            status: 500,
            headers: { 'content-type': 'text/html' },
          });
        }
      };

      return routeHandler();
    },
  };
}

/** Render a page through its layout */
function renderPage(
  route: RouteModule,
  data: Record<string, any>,
  layouts: Record<string, LayoutModule>
): Response {
  const rendered = normalizeRenderOutput(route.render(data));
  const layoutName = route.layout ?? 'default';
  const layout = layouts[layoutName];

  const html = layout
    ? layout.render({ content: rendered.html, data, head: rendered.head })
    : rendered.html;

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function normalizeRenderOutput(output: PageRenderOutput): PageRenderResult {
  if (typeof output === 'string') {
    return { html: output, head: '' };
  }
  return {
    html: typeof output?.html === 'string' ? output.html : '',
    head: typeof output?.head === 'string' ? output.head : '',
    fragments: output && typeof output === 'object' && !Array.isArray(output) && typeof (output as { fragments?: unknown }).fragments === 'object'
      ? ((output as { fragments?: Record<string, string> }).fragments ?? {})
      : {},
  };
}
