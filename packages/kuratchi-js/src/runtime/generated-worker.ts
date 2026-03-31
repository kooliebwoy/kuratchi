import { __esc, __getLocals, __setLocal, __setRequestContext, buildDefaultBreadcrumbs } from './context.js';
import { Router } from './router.js';
import {
  initCsrf,
  getCsrfCookieHeader,
  validateCsrf,
  validateRpcRequest,
  validateActionRequest,
  validateSignedFragment,
  validateQueryOverride,
  parseQueryArgs,
  CSRF_DEFAULTS,
  type RpcSecurityConfig,
  type ActionSecurityConfig,
} from './security.js';
import {
  SchemaValidationError,
  parseRpcArgsPayload,
  validateSchemaInput,
} from './schema.js';
import type { PageRenderOutput, PageRenderResult, RuntimeContext, RuntimeDefinition } from './types.js';

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
  /** Enable CSRF protection (default: true) */
  csrfEnabled?: boolean;
  /** CSRF cookie name (default: '__kuratchi_csrf') */
  csrfCookieName?: string;
  /** CSRF header name (default: 'x-kuratchi-csrf') */
  csrfHeaderName?: string;
  /** Require authentication for RPC (default: false) */
  rpcRequireAuth?: boolean;
  /** Require authentication for form actions (default: false) */
  actionRequireAuth?: boolean;
  /** Content Security Policy directive string */
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
  runtimeDefinition?: RuntimeDefinition;
  workflowStatusRpc?: Record<string, (instanceId: string) => Promise<unknown>>;
  initializeRequest?: (ctx: RuntimeContext) => Promise<void> | void;
  preRouteChecks?: (ctx: RuntimeContext) => Promise<Response | null | undefined> | Response | null | undefined;
  /** Security configuration */
  security?: SecurityOptions;
}

type RuntimeEntry = [string, NonNullable<RuntimeDefinition[string]>];

export function createGeneratedWorker(opts: GeneratedWorkerOptions) {
  const router = new Router();
  const runtimeEntries = __getRuntimeEntries(opts.runtimeDefinition);
  for (let i = 0; i < opts.routes.length; i++) {
    router.add(opts.routes[i].pattern, i);
  }

  // Security configuration with defaults
  const securityConfig: RuntimeSecurityConfig = {
    csrfEnabled: opts.security?.csrfEnabled ?? true,
    csrfCookieName: opts.security?.csrfCookieName ?? CSRF_DEFAULTS.cookieName,
    csrfHeaderName: opts.security?.csrfHeaderName ?? CSRF_DEFAULTS.headerName,
    rpcRequireAuth: opts.security?.rpcRequireAuth ?? false,
    actionRequireAuth: opts.security?.actionRequireAuth ?? false,
    contentSecurityPolicy: opts.security?.contentSecurityPolicy ?? null,
    strictTransportSecurity: opts.security?.strictTransportSecurity ?? null,
    permissionsPolicy: opts.security?.permissionsPolicy ?? null,
  };

  // Initialize configurable security headers
  __initSecurityHeaders(securityConfig);

  return {
    async fetch(request: Request, env: Record<string, any>, ctx: ExecutionContext): Promise<Response> {
      __setRequestContext(ctx, request, env);

      const runtimeCtx: RuntimeContext = {
        request,
        env,
        ctx,
        url: new URL(request.url),
        params: {},
        locals: __getLocals(),
      };

      // Initialize CSRF token for the request
      if (securityConfig.csrfEnabled) {
        initCsrf(request, securityConfig.csrfCookieName);
      }

      if (opts.initializeRequest) {
        await opts.initializeRequest(runtimeCtx);
      }

      const coreFetch = async (): Promise<Response> => {
        const { url } = runtimeCtx;
        const signedFragmentId = request.headers.get('x-kuratchi-fragment');
        let fragmentId: string | null = null;

        const preRoute = opts.preRouteChecks ? await opts.preRouteChecks(runtimeCtx) : null;
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

        const match = router.match(url.pathname);
        if (!match) {
          return __secHeaders(new Response(await opts.layout(__renderError(opts.errorPages, 404)), {
            status: 404,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }));
        }

        runtimeCtx.params = match.params;
        __setLocal('params', match.params);
        __setLocal('__currentRoutePath', url.pathname);

        const route = opts.routes[match.index];

        if ('__api' in route && route.__api) {
          return __dispatchApiRoute(route, runtimeCtx);
        }

        const pageRoute = route as GeneratedPageRoute;

        // Validate fragment ID if present
        if (signedFragmentId) {
          const fragmentValidation = validateSignedFragment(signedFragmentId, url.pathname);
          if (!fragmentValidation.valid) {
            return __secHeaders(new Response(fragmentValidation.reason || 'Invalid fragment', { status: 403 }));
          }
          fragmentId = fragmentValidation.fragmentId;
        }

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

        const rpcResponse = await __handleRpc(pageRoute, opts.workflowStatusRpc ?? {}, runtimeCtx, securityConfig);
        if (rpcResponse) return rpcResponse;

        if (request.method === 'POST') {
          const actionResponse = await __handleAction(pageRoute, opts.layoutActions, opts.layout, runtimeCtx, fragmentId, securityConfig);
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
          return await __renderPage(opts.layout, pageRoute, data, fragmentId);
        } catch (err: any) {
          if (err?.isRedirectError) {
            const redirectTo = err.location || url.pathname;
            const redirectStatus = Number(err.status) || 303;
            return __attachCookies(new Response(null, { status: redirectStatus, headers: { location: redirectTo } }));
          }
          const handled = await __runRuntimeError(runtimeEntries, runtimeCtx, err);
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
        const requestResponse = await __runRuntimeRequest(runtimeEntries, runtimeCtx, async () => {
          return __runRuntimeRoute(runtimeEntries, runtimeCtx, coreFetch);
        });
        return await __runRuntimeResponse(runtimeEntries, runtimeCtx, requestResponse);
      } catch (err) {
        const handled = await __runRuntimeError(runtimeEntries, runtimeCtx, err);
        if (handled) return __secHeaders(handled);
        throw err;
      }
    },
  };
}

async function __dispatchApiRoute(route: GeneratedApiRoute, runtimeCtx: RuntimeContext): Promise<Response> {
  const { request } = runtimeCtx;
  const method = request.method;
  if (method === 'OPTIONS') {
    const handler = route.OPTIONS;
    if (typeof handler === 'function') return __secHeaders(await handler(runtimeCtx));
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
  return __secHeaders(await handler(runtimeCtx));
}

interface RuntimeSecurityConfig {
  csrfEnabled: boolean;
  csrfCookieName: string;
  csrfHeaderName: string;
  rpcRequireAuth: boolean;
  actionRequireAuth: boolean;
  contentSecurityPolicy: string | null;
  strictTransportSecurity: string | null;
  permissionsPolicy: string | null;
}

async function __handleRpc(
  route: GeneratedPageRoute,
  workflowStatusRpc: Record<string, (instanceId: string) => Promise<unknown>>,
  runtimeCtx: RuntimeContext,
  securityConfig: RuntimeSecurityConfig,
): Promise<Response | null> {
  const { request, url } = runtimeCtx;
  const rpcName = url.searchParams.get('_rpc');
  const hasRouteRpc = rpcName && route.rpc && Object.hasOwn(route.rpc, rpcName);
  const hasWorkflowRpc = rpcName && Object.hasOwn(workflowStatusRpc, rpcName);
  if (!(request.method === 'GET' && rpcName && (hasRouteRpc || hasWorkflowRpc))) {
    return null;
  }

  // Validate RPC request security
  const rpcSecConfig: RpcSecurityConfig = {
    requireAuth: securityConfig.rpcRequireAuth,
    validateCsrf: securityConfig.csrfEnabled,
    allowedMethods: ['GET', 'POST'],
  };
  const rpcValidation = validateRpcRequest(request, rpcSecConfig);
  if (!rpcValidation.valid) {
    return __secHeaders(new Response(JSON.stringify({ ok: false, error: rpcValidation.reason || 'Forbidden' }), {
      status: rpcValidation.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }));
  }

  // Legacy header check (still required for backward compatibility)
  if (request.headers.get('x-kuratchi-rpc') !== '1') {
    return __secHeaders(new Response(JSON.stringify({ ok: false, error: 'Missing RPC header' }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }));
  }

  try {
    const rpcArgs = parseRpcArgsPayload(url.searchParams.get('_args'));
    const rpcFn = hasRouteRpc ? route.rpc![rpcName!] : workflowStatusRpc[rpcName!];
    const rpcSchema = hasRouteRpc ? route.rpcSchemas?.[rpcName!] : undefined;
    const validatedArgs = hasRouteRpc ? validateSchemaInput(rpcSchema, rpcArgs) : rpcArgs;
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
  runtimeCtx: RuntimeContext,
  fragmentId: string | null,
  securityConfig: RuntimeSecurityConfig,
): Promise<Response | null> {
  const { request, url, params } = runtimeCtx;
  if (request.method !== 'POST') return null;

  const formData = await request.formData();

  // Validate action request security
  const actionSecConfig: ActionSecurityConfig = {
    validateCsrf: securityConfig.csrfEnabled,
    requireSameOrigin: true,
  };
  const actionValidation = validateActionRequest(request, url, formData, actionSecConfig);
  if (!actionValidation.valid) {
    return __secHeaders(new Response(actionValidation.reason || 'Forbidden', { status: actionValidation.status }));
  }

  // Check authentication if required
  if (securityConfig.actionRequireAuth) {
    const locals = __getLocals();
    const user = locals.user || locals.session?.user;
    if (!user) {
      return __secHeaders(new Response('Authentication required', { status: 401 }));
    }
  }

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
    return await __renderPage(layout, route, data, fragmentId);
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
  fragmentId: string | null,
): Promise<Response> {
  const rendered = __normalizeRenderOutput(route.render(data));

  if (fragmentId) {
    const fragment = rendered.fragments?.[fragmentId];
    if (typeof fragment !== 'string') {
      return __secHeaders(new Response('Fragment not found', { status: 404 }));
    }
    return __attachCookies(new Response(fragment, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    }));
  }

  return __attachCookies(new Response(await layout(rendered.html, rendered.head || ''), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }));
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
    if (!response.headers.has(key)) response.headers.set(key, value);
  }
  return response;
}

function __attachCookies(response: Response): Response {
  const locals = __getLocals();
  const cookies = locals.__setCookieHeaders;
  const csrfCookie = getCsrfCookieHeader();
  
  const hasCookies = (cookies && cookies.length > 0) || csrfCookie;
  if (hasCookies) {
    // Clone the response properly to avoid body stream issues with WARP/proxy layers.
    // Using response.clone() ensures the body stream is properly duplicated.
    const cloned = response.clone();
    const newHeaders = new Headers(cloned.headers);
    if (cookies) {
      for (const header of cookies) newHeaders.append('Set-Cookie', header);
    }
    if (csrfCookie) {
      newHeaders.append('Set-Cookie', csrfCookie);
    }
    const newResponse = new Response(cloned.body, {
      status: cloned.status,
      statusText: cloned.statusText,
      headers: newHeaders,
    });
    return __secHeaders(newResponse);
  }
  return __secHeaders(response);
}

async function __runRuntimeRequest(
  runtimeEntries: RuntimeEntry[],
  ctx: RuntimeContext,
  next: () => Promise<Response>,
): Promise<Response> {
  let idx = -1;
  async function dispatch(i: number): Promise<Response> {
    if (i <= idx) throw new Error('[kuratchi runtime] next() called multiple times in request phase');
    idx = i;
    const entry = runtimeEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.request !== 'function') return dispatch(i + 1);
    return await step.request(ctx, () => dispatch(i + 1));
  }
  return dispatch(0);
}

async function __runRuntimeRoute(
  runtimeEntries: RuntimeEntry[],
  ctx: RuntimeContext,
  next: () => Promise<Response>,
): Promise<Response> {
  let idx = -1;
  async function dispatch(i: number): Promise<Response> {
    if (i <= idx) throw new Error('[kuratchi runtime] next() called multiple times in route phase');
    idx = i;
    const entry = runtimeEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.route !== 'function') return dispatch(i + 1);
    return await step.route(ctx, () => dispatch(i + 1));
  }
  return dispatch(0);
}

async function __runRuntimeResponse(
  runtimeEntries: RuntimeEntry[],
  ctx: RuntimeContext,
  response: Response,
): Promise<Response> {
  let out = response;
  for (const [, step] of runtimeEntries) {
    if (typeof step.response !== 'function') continue;
    out = await step.response(ctx, out);
    if (!(out instanceof Response)) {
      throw new Error('[kuratchi runtime] response handlers must return a Response');
    }
  }
  return out;
}

async function __runRuntimeError(
  runtimeEntries: RuntimeEntry[],
  ctx: RuntimeContext,
  error: unknown,
): Promise<Response | null> {
  for (const [name, step] of runtimeEntries) {
    if (typeof step.error !== 'function') continue;
    try {
      const handled = await step.error(ctx, error);
      if (handled instanceof Response) return handled;
    } catch (hookErr) {
      console.error('[kuratchi runtime] error handler failed in step', name, hookErr);
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
    fragments: __isObject(output?.fragments) ? output.fragments as Record<string, string> : {},
  };
}

function __getRuntimeEntries(runtimeDefinition: RuntimeDefinition | undefined): RuntimeEntry[] {
  return Object.entries(runtimeDefinition ?? {}).filter(
    (entry): entry is RuntimeEntry => !!entry[1] && typeof entry[1] === 'object',
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
