import { __esc, __getLocals, __setLocal, __setRequestContext, buildDefaultBreadcrumbs } from '@kuratchi/js/runtime/context.js';
import { Router } from '@kuratchi/js/runtime/router.js';
import {
  initCspNonce,
  validateRpcRequest,
  validateActionRequest,
  validateQueryOverride,
  parseQueryArgs,
  type RpcSecurityConfig,
  type ActionSecurityConfig,
} from '@kuratchi/js/runtime/security.js';
import {
  SchemaValidationError,
  parseRpcArgsPayload,
  validateSchemaInput,
} from '@kuratchi/js/runtime/schema.js';
import type { MiddlewareContext, MiddlewareDefinition, PageRenderOutput, PageRenderResult, RuntimeDefinition } from '@kuratchi/js/runtime/types.js';

export interface GeneratedAssetEntry {
  content: string;
  mime: string;
  etag: string;
}

export interface GeneratedApiRoute {
  pattern: string;
  __api: true;
  [method: string]: unknown;
}

export interface GeneratedPageRoute {
  pattern: string;
  load?: (params: Record<string, string>) => Promise<unknown> | unknown;
  actions?: Record<string, (...args: any[]) => Promise<unknown> | unknown>;
  rpc?: Record<string, (...args: any[]) => Promise<unknown> | unknown>;
  rpcSchemas?: Record<string, any>;
  /** Allowed query function names for this route (for query override validation) */
  allowedQueries?: string[];
  render: (data: Record<string, any>) => PageRenderOutput;
}

export interface SecurityOptions {
  /**
   * Content Security Policy directive string.
   * Use the literal placeholder `{NONCE}` to opt into per-request nonces on the
   * framework's injected inline scripts, e.g. `script-src 'self' 'nonce-{NONCE}'`.
   */
  contentSecurityPolicy?: string | null;
  /** Strict-Transport-Security header value */
  strictTransportSecurity?: string | null;
  /** Permissions-Policy header value */
  permissionsPolicy?: string | null;
}

export interface GeneratedWorkerOptions {
  routes: Array<GeneratedPageRoute | GeneratedApiRoute>;
  layout: (content: string, head?: string) => Promise<string> | string;
  layoutActions: Record<string, (...args: any[]) => Promise<unknown> | unknown>;
  assetsPrefix: string;
  assets: Record<string, GeneratedAssetEntry>;
  errorPages: Record<number, (detail?: string) => string>;
  middlewareDefinition?: MiddlewareDefinition;
  /** @deprecated Use middlewareDefinition */
  runtimeDefinition?: RuntimeDefinition;
  initializeRequest?: (ctx: MiddlewareContext) => Promise<void> | void;
  preRouteChecks?: (ctx: MiddlewareContext) => Promise<Response | null | undefined> | Response | null | undefined;
  /** Security configuration */
  security?: SecurityOptions;
}

type MiddlewareEntry = [string, NonNullable<MiddlewareDefinition[string]>];

export function createGeneratedWorker(opts: GeneratedWorkerOptions) {
  const router = new Router();
  const middlewareEntries = __getMiddlewareEntries(opts.middlewareDefinition ?? opts.runtimeDefinition);
  for (let i = 0; i < opts.routes.length; i++) {
    router.add(opts.routes[i].pattern, i);
  }

  // Security configuration with defaults
  const securityConfig: RuntimeSecurityConfig = {
    contentSecurityPolicy: opts.security?.contentSecurityPolicy ?? null,
    strictTransportSecurity: opts.security?.strictTransportSecurity ?? null,
    permissionsPolicy: opts.security?.permissionsPolicy ?? null,
  };
  const cspUsesNonce = !!(securityConfig.contentSecurityPolicy && securityConfig.contentSecurityPolicy.includes('{NONCE}'));

  // Initialize configurable security headers
  __initSecurityHeaders(securityConfig);

  return {
    async fetch(request: Request, env: Record<string, any>, ctx: ExecutionContext): Promise<Response> {
      __setRequestContext(ctx, request, env);

      const middlewareCtx: MiddlewareContext = {
        request,
        env,
        ctx,
        url: new URL(request.url),
        params: {},
        locals: __getLocals(),
      };

      // Generate a per-request CSP nonce only when the policy opts in via {NONCE}.
      // Otherwise skip; most apps don't configure a CSP and we avoid the work.
      if (cspUsesNonce) {
        initCspNonce();
      }

      if (opts.initializeRequest) {
        await opts.initializeRequest(middlewareCtx);
      }

      const coreFetch = async (): Promise<Response> => {
        const { url } = middlewareCtx;

        const preRoute = opts.preRouteChecks ? await opts.preRouteChecks(middlewareCtx) : null;
        if (preRoute instanceof Response) {
          return __secHeaders(preRoute);
        }

        if (url.pathname.startsWith(opts.assetsPrefix)) {
          const name = url.pathname.slice(opts.assetsPrefix.length);
          const asset = opts.assets[name];
          if (asset) {
            if (request.headers.get('if-none-match') === asset.etag) {
              return new Response(null, { status: 304 });
            }
            return new Response(asset.content, {
              headers: {
                'content-type': asset.mime,
                'cache-control': 'public, max-age=31536000, immutable',
                'etag': asset.etag,
              },
            });
          }
          return __secHeaders(new Response('Not Found', { status: 404 }));
        }

        // Serve client module assets at /__kuratchi/ path
        if (url.pathname.startsWith('/__kuratchi/')) {
          const name = url.pathname.slice(1); // Remove leading slash, keep __kuratchi/
          const asset = opts.assets[name];
          if (asset) {
            if (request.headers.get('if-none-match') === asset.etag) {
              return new Response(null, { status: 304 });
            }
            return new Response(asset.content, {
              headers: {
                'content-type': asset.mime,
                'cache-control': 'public, max-age=31536000, immutable',
                'etag': asset.etag,
              },
            });
          }
        }

        const match = router.match(url.pathname);
        if (!match) {
          return __secHeaders(new Response(await opts.layout(__renderError(opts.errorPages, 404)), {
            status: 404,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }));
        }

        middlewareCtx.params = match.params;
        __setLocal('params', match.params);

        const route = opts.routes[match.index];

        if ('__api' in route && route.__api) {
          return __dispatchApiRoute(route, middlewareCtx);
        }

        const pageRoute = route as GeneratedPageRoute;

        // Validate and parse query override if present
        const queryFn = request.headers.get('x-kuratchi-query-fn') || '';
        const queryArgsRaw = request.headers.get('x-kuratchi-query-args') || '[]';
        let queryArgs: any[] = [];
        
        if (queryFn) {
          // Validate query function is allowed for this route
          const allowedQueries = pageRoute.allowedQueries || [];
          // Also allow RPC functions as queries
          const rpcFunctions = pageRoute.rpc ? Object.keys(pageRoute.rpc) : [];
          const allAllowed = [...allowedQueries, ...rpcFunctions];
          
          if (allAllowed.length > 0) {
            const queryValidation = validateQueryOverride(queryFn, allAllowed);
            if (!queryValidation.valid) {
              return __secHeaders(new Response(JSON.stringify({ ok: false, error: queryValidation.reason }), {
                status: 403,
                headers: { 'content-type': 'application/json' },
              }));
            }
          }
          
          // Parse and validate query arguments
          const argsValidation = parseQueryArgs(queryArgsRaw);
          if (!argsValidation.valid) {
            return __secHeaders(new Response(JSON.stringify({ ok: false, error: argsValidation.reason }), {
              status: 400,
              headers: { 'content-type': 'application/json' },
            }));
          }
          queryArgs = argsValidation.args as any[];
        }
        
        __setLocal('__queryOverride', queryFn ? { fn: queryFn, args: queryArgs } : null);
        if (!__getLocals().__breadcrumbs) {
          __setLocal('breadcrumbs', buildDefaultBreadcrumbs(url.pathname, match.params));
        }

        const rpcResponse = await __handleRpc(pageRoute, middlewareCtx, securityConfig);
        if (rpcResponse) return rpcResponse;

        if (request.method === 'POST') {
          const actionResponse = await __handleAction(pageRoute, opts.layoutActions, opts.layout, middlewareCtx, securityConfig);
          if (actionResponse) return actionResponse;
        }

        try {
          const loaded = pageRoute.load ? await pageRoute.load(match.params) : {};
          const data = (__isObject(loaded) ? loaded : { value: loaded }) as Record<string, any>;
          data.params = match.params;
          data.breadcrumbs = __getLocals().__breadcrumbs ?? [];
          const allActions = Object.assign({}, pageRoute.actions, opts.layoutActions || {});
          Object.keys(allActions).forEach((key) => {
            if (!(key in data)) data[key] = { error: undefined, loading: false, success: false };
          });
          return await __renderPage(opts.layout, pageRoute, data);
        } catch (err: any) {
          if (err?.isRedirectError) {
            const redirectTo = err.location || url.pathname;
            const redirectStatus = Number(err.status) || 303;
            return __attachCookies(new Response(null, { status: redirectStatus, headers: { location: redirectTo } }));
          }
          const handled = await __runMiddlewareError(middlewareEntries, middlewareCtx, err);
          if (handled) return __secHeaders(handled);
          console.error('[kuratchi] Route load/render error:', err);
          const pageErrStatus = err?.isPageError && err.status ? err.status : 500;
          const errDetail = __sanitizeErrorDetail(err);
          return __secHeaders(new Response(await opts.layout(__renderError(opts.errorPages, pageErrStatus, errDetail)), {
            status: pageErrStatus,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }));
        }
      };

      try {
        const requestResponse = await __runMiddlewareRequest(middlewareEntries, middlewareCtx, async () => {
          return __runMiddlewareRoute(middlewareEntries, middlewareCtx, coreFetch);
        });
        return await __runMiddlewareResponse(middlewareEntries, middlewareCtx, requestResponse);
      } catch (err) {
        const handled = await __runMiddlewareError(middlewareEntries, middlewareCtx, err);
        if (handled) return __secHeaders(handled);
        throw err;
      }
    },
  };
}

async function __dispatchApiRoute(route: GeneratedApiRoute, middlewareCtx: MiddlewareContext): Promise<Response> {
  const { request } = middlewareCtx;
  const method = request.method;
  if (method === 'OPTIONS') {
    const handler = route.OPTIONS;
    if (typeof handler === 'function') return __secHeaders(await handler(middlewareCtx));
    const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
      .filter((name) => typeof route[name] === 'function')
      .join(', ');
    return __secHeaders(new Response(null, { status: 204, headers: { Allow: allowed, 'Access-Control-Allow-Methods': allowed } }));
  }
  const handler = route[method];
  if (typeof handler !== 'function') {
    const allowed = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
      .filter((name) => typeof route[name] === 'function')
      .join(', ');
    return __secHeaders(new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', Allow: allowed },
    }));
  }
  return __secHeaders(await handler(middlewareCtx));
}

interface RuntimeSecurityConfig {
  contentSecurityPolicy: string | null;
  strictTransportSecurity: string | null;
  permissionsPolicy: string | null;
}

async function __handleRpc(
  route: GeneratedPageRoute,
  middlewareCtx: MiddlewareContext,
  securityConfig: RuntimeSecurityConfig,
): Promise<Response | null> {
  const { request, url } = middlewareCtx;
  const rpcName = url.searchParams.get('_rpc');
  const hasRouteRpc = rpcName && route.rpc && Object.hasOwn(route.rpc, rpcName);
  if (!(request.method === 'GET' && rpcName && hasRouteRpc)) {
    return null;
  }

  // Validate RPC request origin. Auth is the developer's responsibility (guard
  // inside the handler or via an auth-library helper); the framework only
  // guarantees the request originated from a same-origin browser fetch.
  const rpcSecConfig: RpcSecurityConfig = {
    allowedMethods: ['GET', 'POST'],
    requireSameOrigin: true,
  };
  const rpcValidation = validateRpcRequest(request, url, rpcSecConfig);
  if (!rpcValidation.valid) {
    return __secHeaders(new Response(JSON.stringify({ ok: false, error: rpcValidation.reason || 'Forbidden' }), {
      status: rpcValidation.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }));
  }

  try {
    const rpcArgs = parseRpcArgsPayload(url.searchParams.get('_args'));
    const rpcFn = route.rpc![rpcName!];
    const rpcSchema = route.rpcSchemas?.[rpcName!];
    const validatedArgs = validateSchemaInput(rpcSchema, rpcArgs);
    const rpcResult = await rpcFn(...validatedArgs);
    return __attachCookies(new Response(JSON.stringify({ ok: true, data: rpcResult }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }));
  } catch (err: any) {
    if (err instanceof SchemaValidationError || err?.isSchemaValidationError) {
      return __secHeaders(new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 400,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      }));
    }
    console.error('[kuratchi] RPC error:', err);
    const errMsg = __sanitizeErrorMessage(err);
    return __secHeaders(new Response(JSON.stringify({ ok: false, error: errMsg }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }));
  }
}

async function __handleAction(
  route: GeneratedPageRoute,
  layoutActions: Record<string, (...args: any[]) => Promise<unknown> | unknown>,
  layout: (content: string, head?: string) => Promise<string> | string,
  middlewareCtx: MiddlewareContext,
  securityConfig: RuntimeSecurityConfig,
): Promise<Response | null> {
  const { request, url, params } = middlewareCtx;
  if (request.method !== 'POST') return null;

  // Validate origin before reading the body. Blocks cross-origin form POSTs; auth
  // is the developer's responsibility inside the action handler itself.
  const actionSecConfig: ActionSecurityConfig = { requireSameOrigin: true };
  const actionValidation = validateActionRequest(request, url, actionSecConfig);
  if (!actionValidation.valid) {
    return __secHeaders(new Response(actionValidation.reason || 'Forbidden', { status: actionValidation.status }));
  }

  const formData = await request.formData();
  const actionName = formData.get('_action');
  const actionKey = typeof actionName === 'string' ? actionName : null;
  const actionFn = (actionKey && route.actions && Object.hasOwn(route.actions, actionKey) ? route.actions[actionKey] : null)
    || (actionKey && layoutActions && Object.hasOwn(layoutActions, actionKey) ? layoutActions[actionKey] : null);
  if (!(actionKey && actionFn)) {
    return null;
  }

  const argsStr = formData.get('_args');
  const isFetchAction = argsStr !== null;
  try {
    if (isFetchAction) {
      const parsed = JSON.parse(String(argsStr));
      const args = Array.isArray(parsed) ? parsed : [];
      await actionFn(...args);
    } else {
      await actionFn(formData);
    }
  } catch (err: any) {
    if (err?.isRedirectError) {
      const redirectTo = err.location || url.pathname;
      const redirectStatus = Number(err.status) || 303;
      if (isFetchAction) {
        return __attachCookies(__secHeaders(new Response(JSON.stringify({ ok: true, redirectTo, redirectStatus }), {
          headers: { 'content-type': 'application/json' },
        })));
      }
      return __attachCookies(new Response(null, { status: redirectStatus, headers: { location: redirectTo } }));
    }
    console.error('[kuratchi] Action error:', err);
    if (isFetchAction) {
      const errMsg = __sanitizeErrorMessage(err);
      return __secHeaders(new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }));
    }
    const loaded = route.load ? await route.load(params) : {};
    const data = (__isObject(loaded) ? loaded : { value: loaded }) as Record<string, any>;
    data.params = params;
    data.breadcrumbs = __getLocals().__breadcrumbs ?? [];
    const allActions = Object.assign({}, route.actions, layoutActions || {});
    Object.keys(allActions).forEach((key) => {
      if (!(key in data)) data[key] = { error: undefined, loading: false, success: false };
    });
    const errMsg = __sanitizeErrorMessage(err, 'Action failed');
    data[actionKey] = { error: errMsg, loading: false, success: false };
    return await __renderPage(layout, route, data);
  }

  if (isFetchAction) {
    return __attachCookies(new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    }));
  }

  const locals = __getLocals();
  const redirectTo = locals.__redirectTo || url.pathname;
  const redirectStatus = Number(locals.__redirectStatus) || 303;
  return __attachCookies(new Response(null, { status: redirectStatus, headers: { location: redirectTo } }));
}

async function __renderPage(
  layout: (content: string, head?: string) => Promise<string> | string,
  route: GeneratedPageRoute,
  data: Record<string, any>,
): Promise<Response> {
  const rendered = __normalizeRenderOutput(route.render(data));

  // Inject workflow poll metadata if workflowStatus(..., { poll }) was called during render.
  // The client bridge reads this <script> and re-fetches the page on the interval.
  const poll = __getLocals().__kuratchiPoll as { interval: string | number; done: boolean } | undefined;
  let html = rendered.html;
  const responseHeaders: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' };
  if (poll && !poll.done) {
    const payload = JSON.stringify({ interval: poll.interval });
    html = `${html}\n<script type="application/json" id="__kuratchi_poll">${payload.replace(/</g, '\\u003c')}</script>`;
  }
  if (poll?.done) {
    responseHeaders['x-kuratchi-poll-done'] = '1';
  }

  let body = await layout(html, rendered.head || '');

  // If the developer configured a CSP with the `{NONCE}` opt-in, stamp the per-request
  // nonce onto every <script> tag the framework emitted. No-op when nonce is absent.
  const nonce = (__getLocals().__cspNonce as string | undefined) || '';
  if (nonce) {
    body = __stampScriptNonces(body, nonce);
  }

  return __attachCookies(new Response(body, { headers: responseHeaders }));
}

/**
 * Add `nonce="..."` to every `<script` opening tag in the rendered HTML unless the tag
 * already carries a nonce. Idempotent and safe on strings (no DOM traversal available).
 */
function __stampScriptNonces(html: string, nonce: string): string {
  return html.replace(/<script\b(?![^>]*\bnonce=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);
}

function __renderError(errorPages: Record<number, (detail?: string) => string>, status: number, detail?: string): string {
  const custom = errorPages[status];
  if (custom) return custom(detail);
  const title = __errorMessages[status] || 'Error';
  const detailHtml = detail
    ? '<p style="font-family:ui-monospace,monospace;font-size:0.8rem;color:#555;background:#111;padding:0.5rem 1rem;border-radius:6px;max-width:480px;margin:1rem auto 0;word-break:break-word">' + __esc(detail) + '</p>'
    : '';
  return '<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem">'
    + '<div>'
    + '<p style="font-size:5rem;font-weight:700;margin:0;color:#333;line-height:1">' + status + '</p>'
    + '<p style="font-size:1rem;color:#555;margin:0.5rem 0 0;letter-spacing:0.05em">' + __esc(title) + '</p>'
    + detailHtml
    + '</div>'
    + '</div>';
}

function __isSameOrigin(request: Request, url: URL): boolean {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === url.origin;
  } catch {
    return false;
  }
}

function __secHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(__configuredSecHeaders)) {
    if (response.headers.has(key)) continue;
    if (key === 'Content-Security-Policy' && value.includes('{NONCE}')) {
      const nonce = (__getLocals().__cspNonce as string | undefined) || '';
      response.headers.set(key, nonce ? value.replace(/\{NONCE\}/g, nonce) : value);
      continue;
    }
    response.headers.set(key, value);
  }
  return response;
}

function __attachCookies(response: Response): Response {
  const locals = __getLocals();
  const cookies = locals.__setCookieHeaders;
  if (cookies && cookies.length > 0) {
    // Clone the response properly to avoid body stream issues with WARP/proxy layers.
    const cloned = response.clone();
    const newHeaders = new Headers(cloned.headers);
    for (const header of cookies) newHeaders.append('Set-Cookie', header);
    const newResponse = new Response(cloned.body, {
      status: cloned.status,
      statusText: cloned.statusText,
      headers: newHeaders,
    });
    return __secHeaders(newResponse);
  }
  return __secHeaders(response);
}

async function __runMiddlewareRequest(
  middlewareEntries: MiddlewareEntry[],
  ctx: MiddlewareContext,
  next: () => Promise<Response>,
): Promise<Response> {
  let idx = -1;
  async function dispatch(i: number): Promise<Response> {
    if (i <= idx) throw new Error('[kuratchi middleware] next() called multiple times in request phase');
    idx = i;
    const entry = middlewareEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.request !== 'function') return dispatch(i + 1);
    return step.request(ctx, () => dispatch(i + 1));
  }
  return dispatch(0);
}

async function __runMiddlewareRoute(
  middlewareEntries: MiddlewareEntry[],
  ctx: MiddlewareContext,
  next: () => Promise<Response>,
): Promise<Response> {
  let idx = -1;
  async function dispatch(i: number): Promise<Response> {
    if (i <= idx) throw new Error('[kuratchi middleware] next() called multiple times in route phase');
    idx = i;
    const entry = middlewareEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.route !== 'function') return dispatch(i + 1);
    return step.route(ctx, () => dispatch(i + 1));
  }
  return dispatch(0);
}

async function __runMiddlewareResponse(
  middlewareEntries: MiddlewareEntry[],
  ctx: MiddlewareContext,
  response: Response,
): Promise<Response> {
  let out = response;
  for (const [, step] of middlewareEntries) {
    if (typeof step.response !== 'function') continue;
    out = await step.response(ctx, out);
    if (!(out instanceof Response)) {
      throw new Error('[kuratchi] middleware response hook must return a Response');
    }
  }
  return out;
}

async function __runMiddlewareError(
  middlewareEntries: MiddlewareEntry[],
  ctx: MiddlewareContext,
  error: unknown,
): Promise<Response | null> {
  for (const [name, step] of middlewareEntries) {
    if (typeof step.error !== 'function') continue;
    try {
      const handled = await step.error(ctx, error);
      if (handled instanceof Response) return handled;
    } catch (hookErr) {
      console.error('[kuratchi middleware] error handler failed in step', name, hookErr);
    }
  }
  return null;
}

function __isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function __normalizeRenderOutput(output: PageRenderOutput): PageRenderResult {
  if (typeof output === 'string') {
    return { html: output, head: '' };
  }
  return {
    html: typeof output?.html === 'string' ? output.html : '',
    head: typeof output?.head === 'string' ? output.head : '',
  };
}

function __getMiddlewareEntries(middlewareDefinition: MiddlewareDefinition | undefined): MiddlewareEntry[] {
  return Object.entries(middlewareDefinition ?? {}).filter(
    (entry): entry is MiddlewareEntry => !!entry[1] && typeof entry[1] === 'object',
  );
}

function __isDevMode(): boolean {
  return !!(globalThis as Record<string, any>).__kuratchi_DEV__;
}

/**
 * Sanitize error messages for client responses.
 * In production, only expose safe error messages to prevent information leakage.
 * In dev mode, expose full error details for debugging.
 */
function __sanitizeErrorMessage(err: any, fallback: string = 'Internal Server Error'): string {
  // Always allow explicit user-facing errors (ActionError, PageError)
  if (err?.isActionError || err?.isPageError) {
    return err.message || fallback;
  }
  // In dev mode, expose full error message for debugging
  if (__isDevMode() && err?.message) {
    return err.message;
  }
  // In production, use generic message to prevent information leakage
  return fallback;
}

/**
 * Sanitize error details for HTML error pages.
 * Returns undefined in production to hide error details.
 */
function __sanitizeErrorDetail(err: any): string | undefined {
  // PageError messages are always safe to show
  if (err?.isPageError) {
    return err.message;
  }
  // In dev mode, show error details
  if (__isDevMode() && err?.message) {
    return err.message;
  }
  // In production, hide error details
  return undefined;
}

const __defaultSecHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

let __configuredSecHeaders: Record<string, string> = { ...__defaultSecHeaders };

function __initSecurityHeaders(config: RuntimeSecurityConfig): void {
  __configuredSecHeaders = { ...__defaultSecHeaders };
  if (config.contentSecurityPolicy) {
    __configuredSecHeaders['Content-Security-Policy'] = config.contentSecurityPolicy;
  }
  if (config.strictTransportSecurity) {
    __configuredSecHeaders['Strict-Transport-Security'] = config.strictTransportSecurity;
  }
  if (config.permissionsPolicy) {
    __configuredSecHeaders['Permissions-Policy'] = config.permissionsPolicy;
  }
}

const __errorMessages: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};
