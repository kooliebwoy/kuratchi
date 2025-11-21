/**
 * Turnstile Plugin - Cloudflare bot protection integration
 * Provides server-side verification for Cloudflare Turnstile challenges
 * and exposes helper data to SvelteKit locals for rendering widgets.
 */

import { dev } from '$app/environment';
import type { AuthPlugin, PluginContext } from '../core/plugin.js';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const DEFAULT_FIELD_NAMES = ['cf-turnstile-response', 'turnstileToken', 'turnstile_token'];
const DEFAULT_HEADER_NAMES = ['cf-turnstile-token', 'x-turnstile-token'];
const DEFAULT_REMOTE_IP_HEADERS = ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip'];

export interface TurnstileVerificationResult {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

type MaybePromise<T> = T | Promise<T>;
type Resolvable<T> = T | null | undefined | ((ctx: PluginContext) => MaybePromise<T | null | undefined>);

type SkipPredicate = (ctx: PluginContext) => MaybePromise<boolean>;

export interface TurnstileRouteConfig {
  /** Unique identifier for logging/locals (defaults to path) */
  id?: string;
  /** Path matcher. Accepts literal paths or RegExp */
  path: string | RegExp;
  /** HTTP methods to match (defaults to POST) */
  methods?: string[];
  /** Custom field name to read the token from (form or JSON body) */
  tokenField?: string;
  /** Custom header name to read the token from */
  tokenHeader?: string;
  /** Override default failure message */
  message?: string;
  /** Override remote IP header resolution */
  remoteIpHeaders?: string[];
  /** Expected Turnstile action value */
  expectedAction?: string;
  /** Expected action values */
  expectedActions?: string[];
  /** Expected hostnames */
  expectedHostnames?: string[];
  /** Skip predicate (return true to bypass verification) */
  skipWhen?: SkipPredicate;
}

export interface TurnstilePluginOptions {
  /** Provide Turnstile secret manually (falls back to env) */
  secret?: Resolvable<string>;
  /** Provide site key manually (falls back to env) */
  siteKey?: Resolvable<string>;
  /** Override default field names (form/JSON) */
  fieldName?: string | string[];
  /** Override default header names */
  headerName?: string | string[];
  /** Global remote IP headers to forward */
  remoteIpHeaders?: string[];
  /** Include default auth routes (/auth/signin, /auth/signup, /auth/credentials/login) */
  includeDefaultRoutes?: boolean;
  /** Additional/custom routes */
  routes?: TurnstileRouteConfig[];
  /** Override verification endpoint */
  verifyUrl?: string;
  /** Override Turnstile script URL exposed to clients */
  scriptUrl?: string;
  /** Plugin priority (defaults to 25) */
  priority?: number;
  /** Expected actions for all routes (can be overridden per route) */
  expectedActions?: string[];
  /** Expected hostnames for all routes (can be overridden per route) */
  expectedHostnames?: string[];
  /** Skip predicate applied before per-route predicate */
  skipWhen?: SkipPredicate;
  /** Skip Turnstile verification automatically during SvelteKit dev */
  disableInDev?: boolean;
}

interface NormalizedTurnstileRoute {
  id: string;
  regex: RegExp;
  methods?: string[];
  fieldNames: string[];
  headerNames: string[];
  message?: string;
  remoteIpHeaders: string[];
  expectedActions?: string[];
  expectedHostnames?: string[];
  skipWhen?: SkipPredicate;
}

const DEFAULT_ROUTES: TurnstileRouteConfig[] = [
  {
    id: 'auth.signin.turnstile',
    path: '/auth/signin',
    methods: ['POST'],
    message: 'Turnstile verification failed. Please refresh and try again.'
  },
  {
    id: 'auth.credentials.login.turnstile',
    path: '/auth/credentials/login',
    methods: ['POST'],
    message: 'Please complete the Turnstile challenge before logging in.'
  },
  {
    id: 'auth.signup.turnstile',
    path: '/auth/signup',
    methods: ['POST'],
    message: 'Turnstile verification failed while signing up. Please try again.'
  }
];

function normalizePathMatcher(path: string | RegExp): RegExp {
  if (path instanceof RegExp) return path;

  const trimmed = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
  const optionalTrailingSlash = trimmed !== '/' && !trimmed.includes('*') ? '/?' : '';
  return new RegExp(`^${escaped}${optionalTrailingSlash}$`, 'i');
}

async function resolve<T>(value: Resolvable<T>, ctx: PluginContext): Promise<T | null> {
  if (typeof value === 'function') {
    const resolved = await (value as (ctx: PluginContext) => MaybePromise<T | null | undefined>)(ctx);
    return resolved ?? null;
  }
  return value ?? null;
}

function ensureArray(value: string | string[] | undefined, fallback: string[]): string[] {
  if (!value) return [...fallback];
  return Array.from(new Set(Array.isArray(value) ? value : [value]));
}

async function resolveSecret(ctx: PluginContext, options: TurnstilePluginOptions): Promise<string | null> {
  const fromOptions = await resolve(options.secret ?? null, ctx);
  if (fromOptions) return fromOptions;

  const fromEnv = (
    ctx.env?.CLOUDFLARE_TURNSTILE_SECRET ||
    ctx.env?.TURNSTILE_SECRET ||
    null
  );

  try {
    console.log('[Kuratchi Auth][Turnstile] resolveSecret env snapshot:', {
      hasEnv: !!ctx.env,
      CLOUDFLARE_TURNSTILE_SECRET: ctx.env?.CLOUDFLARE_TURNSTILE_SECRET ? '***set***' : undefined,
      TURNSTILE_SECRET: ctx.env?.TURNSTILE_SECRET ? '***set***' : undefined
    });
  } catch {
    // ignore logging errors
  }

  return fromEnv;
}

async function resolveSiteKey(ctx: PluginContext, options: TurnstilePluginOptions): Promise<string | null> {
  const fromOptions = await resolve(options.siteKey ?? null, ctx);
  if (fromOptions) return fromOptions;

  return (
    ctx.env?.CLOUDFLARE_TURNSTILE_SITE_KEY ||
    ctx.env?.TURNSTILE_SITE_KEY ||
    null
  );
}

function toNormalizedRoutes(options: TurnstilePluginOptions): NormalizedTurnstileRoute[] {
  const globalFieldNames = ensureArray(options.fieldName, DEFAULT_FIELD_NAMES);
  const globalHeaderNames = ensureArray(options.headerName, DEFAULT_HEADER_NAMES);
  const globalRemoteIpHeaders = options.remoteIpHeaders && options.remoteIpHeaders.length > 0
    ? options.remoteIpHeaders
    : DEFAULT_REMOTE_IP_HEADERS;

  const routes = [
    ...(options.includeDefaultRoutes === false ? [] : DEFAULT_ROUTES),
    ...(options.routes ?? [])
  ];

  return routes.map(route => {
    const fieldNames = Array.from(
      new Set([
        ...(route.tokenField ? [route.tokenField] : []),
        ...globalFieldNames,
        ...DEFAULT_FIELD_NAMES
      ])
    );

    const headerNames = Array.from(
      new Set([
        ...(route.tokenHeader ? [route.tokenHeader] : []),
        ...globalHeaderNames,
        ...DEFAULT_HEADER_NAMES
      ])
    );

    return {
      id: route.id || (typeof route.path === 'string' ? route.path : route.path.toString()),
      regex: normalizePathMatcher(route.path),
      methods: route.methods?.map(method => method.toUpperCase()),
      fieldNames,
      headerNames,
      message: route.message,
      remoteIpHeaders: route.remoteIpHeaders && route.remoteIpHeaders.length > 0
        ? route.remoteIpHeaders
        : globalRemoteIpHeaders,
      expectedActions: route.expectedActions || (route.expectedAction ? [route.expectedAction] : options.expectedActions),
      expectedHostnames: route.expectedHostnames || options.expectedHostnames,
      skipWhen: route.skipWhen || options.skipWhen
    } satisfies NormalizedTurnstileRoute;
  });
}

async function shouldSkip(ctx: PluginContext, predicate?: SkipPredicate): Promise<boolean> {
  if (!predicate) return false;
  try {
    return await predicate(ctx);
  } catch (error) {
    console.warn('[Kuratchi Auth] Turnstile skip predicate threw an error, ignoring:', error);
    return false;
  }
}

async function extractToken(request: Request, route: NormalizedTurnstileRoute): Promise<string | null> {
  for (const headerName of route.headerNames) {
    const headerValue = request.headers.get(headerName);
    if (headerValue) return headerValue.trim();
  }

  const contentTypeHeader = request.headers.get('content-type') || '';
  const contentType = contentTypeHeader.split(';')[0]?.trim().toLowerCase();
  const cloned = request.clone();

  try {
    if (contentType === 'application/json') {
      const jsonBody = await cloned.json().catch(() => null);
      if (jsonBody && typeof jsonBody === 'object') {
        for (const field of route.fieldNames) {
          const value = (jsonBody as Record<string, any>)[field];
          if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
          }
        }
      }
    } else {
      const formData = await cloned.formData();
      for (const field of route.fieldNames) {
        const value = formData.get(field);
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
      }
    }
  } catch (error) {
    console.warn('[Kuratchi Auth] Failed to read request body for Turnstile verification:', error);
  }

  return null;
}

function resolveRemoteIp(ctx: PluginContext, headers: string[]): string | null {
  for (const header of headers) {
    const value = ctx.event.request.headers.get(header);
    if (value) {
      if (header.toLowerCase() === 'x-forwarded-for') {
        return value.split(',')[0]?.trim() || null;
      }
      return value;
    }
  }

  const anyEvent: any = ctx.event as any;
  if (typeof anyEvent.getClientAddress === 'function') {
    try {
      const addr = anyEvent.getClientAddress();
      if (addr) return addr;
    } catch {}
  }

  return null;
}

function ensureTurnstileLocals(ctx: PluginContext) {
  const locals = ctx.locals as any;
  locals.kuratchi = locals.kuratchi || {};
  locals.kuratchi.security = locals.kuratchi.security || {};
  locals.kuratchi.security.turnstile = locals.kuratchi.security.turnstile || {};
  return locals.kuratchi.security.turnstile as Record<string, any>;
}

export function turnstilePlugin(options: TurnstilePluginOptions = {}): AuthPlugin {
  const routes = toNormalizedRoutes(options);
  const verifyUrl = options.verifyUrl || TURNSTILE_VERIFY_URL;
  const scriptUrl = options.scriptUrl || TURNSTILE_SCRIPT_URL;

  return {
    name: 'turnstile',
    priority: options.priority ?? 25,

    async onRequest(ctx) {
      const localsTurnstile = ensureTurnstileLocals(ctx);

      const [siteKey, secret] = await Promise.all([
        resolveSiteKey(ctx, options),
        resolveSecret(ctx, options)
      ]);

      if (siteKey && !localsTurnstile.siteKey) {
        localsTurnstile.siteKey = siteKey;
      }
      localsTurnstile.scriptUrl = scriptUrl;

      const disableInDev = options.disableInDev !== false;
      const isDevEnvironment = dev === true;
      const devDisabled = disableInDev && isDevEnvironment;

      localsTurnstile.devDisabled = devDisabled;
      localsTurnstile.enabled = Boolean(secret) && !devDisabled;

      try {
        console.log('[Kuratchi Auth][Turnstile] onRequest env + resolved values:', {
          dev,
          disableInDev,
          devDisabled,
          resolvedSiteKey: siteKey ? '***set***' : undefined,
          hasSecret: !!secret,
          envHasSiteKey: ctx.env?.CLOUDFLARE_TURNSTILE_SITE_KEY || ctx.env?.TURNSTILE_SITE_KEY ? true : false,
          envHasSecret: ctx.env?.CLOUDFLARE_TURNSTILE_SECRET || ctx.env?.TURNSTILE_SECRET ? true : false
        });
      } catch {
        // ignore logging errors
      }

      if (!routes.length || devDisabled) {
        return;
      }

      const url = new URL(ctx.event.request.url);
      const method = ctx.event.request.method.toUpperCase();

      const matchedRoute = routes.find(route => {
        if (!route.regex.test(url.pathname)) return false;
        if (route.methods && route.methods.length > 0) {
          return route.methods.includes(method);
        }
        // Default to POST-only if methods not specified
        if (!route.methods) {
          return method === 'POST';
        }
        return true;
      });

      if (!matchedRoute) {
        return;
      }

      if (!secret) {
        console.warn('[Kuratchi Auth] Turnstile secret not configured. Skipping verification for route:', matchedRoute.id);
        return;
      }

      if (await shouldSkip(ctx, options.skipWhen)) {
        return;
      }

      if (await shouldSkip(ctx, matchedRoute.skipWhen)) {
        return;
      }

      const token = await extractToken(ctx.event.request, matchedRoute);
      if (!token) {
        return new Response(
          JSON.stringify({
            error: 'turnstile_token_missing',
            message: matchedRoute.message || 'Turnstile token missing. Please complete the challenge and try again.'
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const params: Record<string, string> = {
        secret,
        response: token
      };

      const remoteIp = resolveRemoteIp(ctx, matchedRoute.remoteIpHeaders);
      if (remoteIp) {
        params.remoteip = remoteIp;
      }

      let verifyResponse: Response;
      try {
        verifyResponse = await fetch(verifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams(params)
        });
      } catch (error) {
        console.error('[Kuratchi Auth] Failed to verify Turnstile token:', error);
        return new Response(
          JSON.stringify({
            error: 'turnstile_verification_failed',
            message: matchedRoute.message || 'Unable to verify Turnstile challenge. Please try again.'
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (!verifyResponse.ok) {
        console.error('[Kuratchi Auth] Turnstile verification returned non-OK status:', verifyResponse.status);
        return new Response(
          JSON.stringify({
            error: 'turnstile_verification_failed',
            message: matchedRoute.message || 'Turnstile verification failed. Please try again later.'
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      let verification: TurnstileVerificationResult;
      try {
        verification = await verifyResponse.json();
      } catch (error) {
        console.error('[Kuratchi Auth] Failed to parse Turnstile response JSON:', error);
        return new Response(
          JSON.stringify({
            error: 'turnstile_verification_failed',
            message: matchedRoute.message || 'Unexpected Turnstile response. Please retry the challenge.'
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (!verification.success) {
        return new Response(
          JSON.stringify({
            error: 'turnstile_verification_failed',
            message: matchedRoute.message || 'Turnstile verification failed. Please try again.',
            details: verification['error-codes'] || []
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (matchedRoute.expectedActions && matchedRoute.expectedActions.length > 0) {
        if (!verification.action || !matchedRoute.expectedActions.includes(verification.action)) {
          return new Response(
            JSON.stringify({
              error: 'turnstile_verification_failed',
              message: matchedRoute.message || 'Turnstile verification failed due to unexpected action.'
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }

      if (matchedRoute.expectedHostnames && matchedRoute.expectedHostnames.length > 0) {
        if (!verification.hostname || !matchedRoute.expectedHostnames.includes(verification.hostname)) {
          return new Response(
            JSON.stringify({
              error: 'turnstile_verification_failed',
              message: matchedRoute.message || 'Turnstile verification failed due to unexpected hostname.'
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }

      localsTurnstile.verified = true;
      localsTurnstile.token = token;
      localsTurnstile.routeId = matchedRoute.id;
      localsTurnstile.result = verification;
    }
  };
}
