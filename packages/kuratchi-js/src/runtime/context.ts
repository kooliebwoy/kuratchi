/**
 * Request-scoped context.
 *
 * Env bindings: use `import { env } from 'cloudflare:workers'` directly.
 * Request/ctx/locals: set per-request by the framework, accessed via helpers.
 *
 * Workers are single-threaded per request â€” module-scoped
 * variables are safe and require no Node.js compat flags.
 */

import { __getDoSelf } from './do.js';
import { __setRequestParams, __setRequestState } from './request.js';

let __ctx: any = null;
let __request: Request | null = null;
let __env: Record<string, any> | null = null;
let __locals: Record<string, any> = {};

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export class RedirectError extends Error {
  readonly isRedirectError = true;
  readonly location: string;
  readonly status: number;

  constructor(path: string, status = 303) {
    super(`Redirect to ${path}`);
    this.name = 'RedirectError';
    this.location = path;
    this.status = status;
  }
}

/** Called by the framework at the start of each request */
export function __setRequestContext(ctx: any, request: Request, env?: Record<string, any>): void {
  __ctx = ctx;
  __request = request;
  __env = env ?? null;
  __locals = {};
  __setRequestState(request);

  // Expose context on globalThis for @kuratchi/auth and other packages
  // Workers are single-threaded per request — this is safe
  (globalThis as any).__kuratchi_context__ = {
    get request() { return __request; },
    get locals() { return __locals; },
  };
}

/**
 * Push a new request context for the duration of a DO RPC call.
 * Saves current state and returns a restore function.
 * @internal
 */
export function __pushRequestContext(rpcContext: any, ctx: any, env: any): () => void {
  const prevCtx = __ctx;
  const prevRequest = __request;
  const prevEnv = __env;
  const prevLocals = __locals;
  __ctx = ctx;
  __request = rpcContext?.request ?? __request;
  __env = env ?? __env;
  __locals = rpcContext?.locals ? { ...rpcContext.locals } : {};
  return () => {
    __ctx = prevCtx;
    __request = prevRequest;
    __env = prevEnv;
    __locals = prevLocals;
  };
}


/** Get the execution context (Worker: ExecutionContext, DO: DurableObjectState) */
export function getCtx(): any {
  const doSelf = __getDoSelf();
  if (doSelf) return doSelf.ctx;
  if (!__ctx) throw new Error('getCtx() called outside of a request context');
  return __ctx;
}

/** Get the current environment bindings */
export function getEnv<T = Record<string, any>>(): T {
  const doSelf = __getDoSelf();
  if (doSelf) return doSelf.env as T;
  if (!__env) throw new Error('getEnv() called outside of a request context');
  return __env as T;
}

/** Get the current request */
export function getRequest(): Request {
  if (!__request) throw new Error('getRequest() called outside of a request context');
  return __request;
}

/** Get request-scoped locals (session, auth, custom data) */
export function getLocals<T = Record<string, any>>(): T {
  return __locals as T;
}

/** Get matched route params for the current request (e.g. { slug: 'my-post' }) */
export function getParams<T = Record<string, string>>(): T {
  return (__locals?.params ?? {}) as T;
}

/** Get one matched route param by key (e.g. getParam('slug')) */
export function getParam(name: string): string | undefined {
  return (__locals?.params ?? {})[name];
}

/**
 * Server-side redirect helper for actions/load logic.
 * Throws a redirect signal consumed by the framework's PRG flow.
 */
export function redirect(path: string, status = 303): never {
  __locals.__redirectTo = path;
  __locals.__redirectStatus = status;
  throw new RedirectError(path, status);
}

/** Backward-compatible alias for redirect() */
export function goto(path: string, status = 303): never {
  redirect(path, status);
}

export function setBreadcrumbs(items: BreadcrumbItem[]): void {
  __locals.__breadcrumbs = items;
}

export function getBreadcrumbs(): BreadcrumbItem[] {
  return (__locals.__breadcrumbs ?? []) as BreadcrumbItem[];
}

export function breadcrumbsHome(label = 'Home', href = '/'): BreadcrumbItem {
  return { label, href };
}

export function breadcrumbsPrev(label: string, href: string): BreadcrumbItem {
  return { label, href };
}

export function breadcrumbsNext(label: string, href: string): BreadcrumbItem {
  return { label, href };
}

export function breadcrumbsCurrent(label: string): BreadcrumbItem {
  return { label, current: true };
}

function titleizeSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  if (!decoded) return '';
  return decoded
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Build a reasonable default breadcrumb trail from pathname + params */
export function buildDefaultBreadcrumbs(pathname: string, _params: Record<string, string> = {}): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Home', current: true }];

  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
  let acc = '';
  for (let i = 0; i < parts.length; i++) {
    acc += `/${parts[i]}`;
    const isLast = i === parts.length - 1;
    items.push({
      label: titleizeSegment(parts[i]),
      href: isLast ? undefined : acc,
      current: isLast,
    });
  }
  return items;
}

/** Set a value on request-scoped locals (used by framework internals) */
export function __setLocal(key: string, value: any): void {
  __locals[key] = value;
  if (key === 'params') __setRequestParams(value);
}

/** Get the full locals object reference (used by framework internals) */
export function __getLocals(): Record<string, any> {
  return __locals;
}

/** HTML-escape a value for safe output in templates */
export function __esc(v: any): string {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert a value to a raw HTML string (unsafe, no escaping). */
export function __rawHtml(v: any): string {
  if (v == null) return '';
  return String(v);
}

/** Best-effort HTML sanitizer for {@html ...} template output. */
export function __sanitizeHtml(v: any): string {
  let html = __rawHtml(v);
  // Remove dangerous elements entirely
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
  html = html.replace(/<embed\b[^>]*>/gi, '');
  html = html.replace(/<base\b[^>]*>/gi, '');
  html = html.replace(/<meta\b[^>]*>/gi, '');
  html = html.replace(/<link\b[^>]*>/gi, '');
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
  html = html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
  // Remove all event handlers (on*)
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: URLs in href, src, xlink:href, action, formaction, data
  html = html.replace(/\s(href|src|xlink:href|action|formaction|data)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
  html = html.replace(/\s(href|src|xlink:href|action|formaction|data)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"');
  // Remove vbscript: URLs
  html = html.replace(/\s(href|src|xlink:href|action|formaction|data)\s*=\s*(["'])\s*vbscript:[\s\S]*?\2/gi, ' $1="#"');
  html = html.replace(/\s(href|src|xlink:href|action|formaction|data)\s*=\s*vbscript:[^\s>]+/gi, ' $1="#"');
  // Remove data: URLs in src (can contain scripts)
  html = html.replace(/\ssrc\s*=\s*(["'])\s*data:[\s\S]*?\1/gi, ' src="#"');
  html = html.replace(/\ssrc\s*=\s*data:[^\s>]+/gi, ' src="#"');
  // Remove srcdoc (can contain arbitrary HTML)
  html = html.replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove form-related dangerous attributes
  html = html.replace(/\sformaction\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove SVG-specific dangerous elements
  html = html.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
  html = html.replace(/<use\b[^>]*>/gi, '');
  return html;
}

/** Get CSRF token for form injection (used by template compiler) */
export function __getCsrfToken(): string {
  return __locals.__csrfToken || '';
}

/** Sign a fragment ID for secure polling (used by template compiler) */
export function __signFragment(fragmentId: string): string {
  const token = __locals.__csrfToken || '';
  const routePath = __locals.__currentRoutePath || '/';
  const payload = `${fragmentId}:${routePath}:${token}`;
  // FNV-1a hash for fast, consistent signing
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return `${fragmentId}:${hash.toString(36)}`;
}



