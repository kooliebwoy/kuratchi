/**
 * Kuratchi dispatch module — served as the `kuratchi:dispatch` virtual
 * module inside the Worker bundle. Loaded as raw text from the plugin
 * (NOT transpiled by Vite, NOT a template literal) so comments can use
 * backticks and ${} freely without template-literal escaping hazards.
 *
 * Runs inside the Worker runtime: no Node APIs, no TypeScript, ESM-only,
 * globals limited to the Worker platform (Request, Response, URL, fetch,
 * crypto, etc.).
 */

import { routes } from 'kuratchi:routes';
import { lookup as lookupRpcModule } from 'kuratchi:rpc-map';
import { runtime as middlewareRuntime } from 'kuratchi:middleware';
// Per-database auto-migration runner. The plugin synthesizes this
// virtual module from `kuratchi.config.ts`: for every D1 binding
// declared under `orm.databases`, it emits a `runMigrations` call
// bootstrapped with the user's schema DSL. First request per worker
// isolate applies pending migrations; subsequent requests short-circuit
// via an in-isolate flag.
import { ensureMigrations } from 'kuratchi:migrations';
// Populate the per-request globals that `getEnv()` / `getRequest()` /
// `getLocals()` from `@kuratchi/js/runtime/context.js` read. Without
// this, any `$server/*` code using `getEnv()` (e.g. the ORM's lazy
// binding resolver) throws "called outside of a request context".
import { __setRequestContext, __getLocals } from '@kuratchi/js/runtime/context.js';

// Client-side polling bridge injected into pages that use workflowStatus({ poll }).
// Mirrors the initWorkflowPoll IIFE from root-layout-pipeline.ts (the CLI path).
const __POLL_BRIDGE_SCRIPT = '<script>(function(){function parseInterval(v){if(typeof v==="number")return v>0?v:30000;if(!v)return 30000;var m=String(v).match(/^(\\d+(?:\\.\\d+)?)(ms|s|m)?$/i);if(!m)return 30000;var n=parseFloat(m[1]);var u=(m[2]||"s").toLowerCase();if(u==="ms")return n;if(u==="m")return n*60000;return n*1000}function readConfig(){var el=document.getElementById("__kuratchi_poll");if(!el)return null;try{return JSON.parse(el.textContent||"{}")}catch(e){return null}}var timer=null;var stopped=false;function stop(){stopped=true;if(timer){clearTimeout(timer);timer=null}}function tick(interval){if(stopped)return;timer=setTimeout(function(){if(stopped)return;if(document.hidden){tick(interval);return}fetch(location.pathname+location.search,{headers:{"x-kuratchi-poll":"1"},credentials:"same-origin"}).then(function(r){var done=r.headers.get("x-kuratchi-poll-done")==="1";return r.text().then(function(html){return{html:html,done:done,ok:r.ok}})}).then(function(res){if(stopped)return;if(!res.ok){tick(interval);return}if(typeof DOMParser==="undefined"){location.reload();return}var doc=new DOMParser().parseFromString(res.html,"text/html");if(doc&&doc.body){document.body.innerHTML=doc.body.innerHTML}if(res.done){stop();return}var next=readConfig();tick(next?parseInterval(next.interval):interval)}).catch(function(){if(!stopped)tick(interval)})},interval)}var cfg=readConfig();if(cfg)tick(parseInterval(cfg.interval))})()\x3c/script>';
// Reuse the legacy security module wholesale. Same guarantees as the
// CLI-generated worker: same-origin gate on RPC/action, default security
// headers, optional CSP nonce stamping.
import {
	validateRpcRequest,
	validateActionRequest,
	applySecurityHeaders,
	initCspNonce,
	getCspNonce,
	sanitizeErrorMessage,
	sanitizeErrorDetail,
} from '@kuratchi/js/runtime/security.js';

// Streaming async-boundary primitives. After a template render that used
// `const x = fn()` patterns, the per-request boundary collector is populated.
// We read it here to decide whether to stream the response or return a flat
// string (no boundaries = no streaming, zero overhead).
import {
	__takeCollectedBoundaries,
	BOOTSTRAP_SCRIPT as __BOUNDARY_BOOTSTRAP,
	resolveBoundaryToChunk,
} from '@kuratchi/js/runtime/stream.js';

// Action-handler calling convention (`fn(...args, ctx)`). Lives in its
// own module because it's the only piece of the dispatcher that can be
// exercised in isolation — the rest of this file transitively imports
// Worker-only virtual modules that Bun can't resolve at test time.
import { invokeAction } from './invoke-action.js';

/**
 * The middleware definition is a map of step names
 * to `{ request, route, response, error }` handlers. We precompute the
 * sorted entry list once per worker boot; per-request, each phase walks
 * the list in order with a `next()` chain so steps can wrap downstream
 * work (auth → logging → feature flags, etc.).
 */
const middlewareEntries = Object.entries(middlewareRuntime || {}).filter(
	([, step]) => step && typeof step === 'object',
);

async function runRequestPhase(ctx, next) {
	let idx = -1;
	async function dispatch(i) {
		if (i <= idx) throw new Error('[kuratchi] next() called twice in request phase');
		idx = i;
		const entry = middlewareEntries[i];
		if (!entry) return next();
		const [, step] = entry;
		if (typeof step.request !== 'function') return dispatch(i + 1);
		return step.request(ctx, () => dispatch(i + 1));
	}
	return dispatch(0);
}

async function runRoutePhase(ctx, next) {
	let idx = -1;
	async function dispatch(i) {
		if (i <= idx) throw new Error('[kuratchi] next() called twice in route phase');
		idx = i;
		const entry = middlewareEntries[i];
		if (!entry) return next();
		const [, step] = entry;
		if (typeof step.route !== 'function') return dispatch(i + 1);
		return step.route(ctx, () => dispatch(i + 1));
	}
	return dispatch(0);
}

async function runResponsePhase(ctx, response) {
	// `Response.redirect()` and some other constructors produce responses
	// with immutable headers. Middleware typically needs to mutate headers
	// (set cookies, custom observability headers), so we rebuild into a
	// mutable Response before handing to steps. Cheap for our scale.
	let current = toMutableResponse(response);
	for (const [, step] of middlewareEntries) {
		if (typeof step.response === 'function') {
			current = (await step.response(ctx, current)) || current;
		}
	}
	return current;
}

function toMutableResponse(response) {
	if (!response) return response;
	// Redirect responses (303/302/etc) have a frozen headers list. Copying
	// status + headers into a new Response gives a mutable clone.
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: new Headers(response.headers),
	});
}

async function runErrorPhase(ctx, error) {
	for (const [, step] of middlewareEntries) {
		if (typeof step.error !== 'function') continue;
		const result = await step.error(ctx, error);
		if (result && result.response instanceof Response) return result.response;
	}
	return null;
}

/**
 * Compile each route's URL pattern (e.g. '/users/:id', '/posts/*') into
 * a matcher that returns a params object if the pathname fits.
 */
function compileMatcher(pattern) {
	const segments = pattern.split('/').filter(Boolean);
	const keys = [];
	let regexSrc = '^';
	for (const segment of segments) {
		regexSrc += '/';
		if (segment.startsWith(':')) {
			keys.push(segment.slice(1));
			regexSrc += '([^/]+)';
		} else if (segment === '*') {
			keys.push('rest');
			regexSrc += '(.*)';
		} else {
			regexSrc += segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		}
	}
	if (segments.length === 0) regexSrc += '/?';
	regexSrc += '$';
	const re = new RegExp(regexSrc);
	return (pathname) => {
		const m = re.exec(pathname);
		if (!m) return null;
		const params = {};
		for (let i = 0; i < keys.length; i++) params[keys[i]] = m[i + 1];
		return params;
	};
}

const compiledRoutes = routes.map((r) => ({
	pattern: r.pattern,
	match: compileMatcher(r.pattern),
	module: r.module,
}));

/**
 * High-level Kuratchi request handler. The user's Worker delegates via
 * `kuratchi:worker`, which wires this `handle` into the `fetch` export.
 */
export async function handle(request, env, ctx) {
	const url = new URL(request.url);

	// Apply ORM migrations on first request per worker isolate. Idempotent
	// — the generated runner flips a module-scoped flag after success.
	await ensureMigrations(env);

	// Seed the module-scoped context so helpers like `getEnv()`,
	// `getRequest()`, `getLocals()` from `@kuratchi/js` work in any
	// `$server/*` module for the duration of this request. Workers are
	// single-threaded per isolate, so this is safe despite the module
	// scope — the handler completes before the next request starts.
	__setRequestContext(ctx, request, env);

	// Runtime context passed to every middleware step. `locals` MUST be
	// the same object `@kuratchi/js`'s `getLocals()` returns — otherwise
	// middleware mutations (e.g. `ctx.locals.userId = 1`) land on a
	// detached object and downstream handlers, actions, and
	// `$server/*` modules read `undefined`. `__setRequestContext` reset
	// `__locals = {}` above; we grab that same reference and hand it
	// through the runtime context.
	const runtimeCtx = {
		request,
		env,
		ctx,
		url,
		locals: __getLocals(),
		params: {},
	};

	try {
		const requestResponse = await runRequestPhase(runtimeCtx, async () => {
			return runRoutePhase(runtimeCtx, async () => {
				// Always hand middleware a mutable response: `Response.redirect()`
				// and friends return frozen headers, which breaks middleware that
				// sets cookies / observability headers after `await next()`.
				return toMutableResponse(await coreHandle(runtimeCtx));
			});
		});
		const afterResponseChain = await runResponsePhase(runtimeCtx, requestResponse);
		return finalizeResponse(afterResponseChain);
	} catch (err) {
		const handled = await runErrorPhase(runtimeCtx, err);
		if (handled) return finalizeResponse(handled);
		// Last-chance framework error path. We do NOT rethrow in prod
		// because Cloudflare's default 1101 page leaks stack traces into
		// logs + headers on some proxies. Render a minimal sanitized
		// 500 instead; `sanitizeErrorDetail` suppresses the raw message
		// in prod (`isDevMode() === false`) and keeps `PageError`
		// messages visible because they're intentional.
		console.error('[kuratchi] Unhandled request error:', err);
		const detail = sanitizeErrorDetail(err);
		const status = (err && err.isPageError && Number(err.status)) || 500;
		const body = detail
			? `<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head><body><h1>${status}</h1><pre>${escapeHtml(detail)}</pre></body></html>`
			: `<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head><body><h1>${status}</h1></body></html>`;
		return finalizeResponse(new Response(body, {
			status,
			headers: { 'content-type': 'text/html; charset=utf-8' },
		}));
	}
}

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Final response pipeline: attach `Set-Cookie` headers accumulated in
 * `locals.__setCookieHeaders` (the shared convention used by
 * `@kuratchi/auth` and `createAuthSession()`), THEN apply framework
 * security headers (X-Content-Type-Options, X-Frame-Options,
 * Referrer-Policy, optional CSP) and stamp CSP nonces onto
 * framework-injected `<script>` tags in HTML output. No-op when CSP is
 * unconfigured (most apps).
 *
 * Mirrors `__attachCookies` → `__secHeaders` in the legacy CLI
 * `generated-worker.ts`. Must stay in that order — CSP / security
 * headers should be final.
 */
function finalizeResponse(response) {
	const locals = __getLocals();
	const cookies = locals?.__setCookieHeaders;
	if (cookies && cookies.length > 0) {
		// Clone to avoid body-stream reuse issues behind WARP / proxy layers.
		const cloned = response.clone();
		const headers = new Headers(cloned.headers);
		for (const header of cookies) headers.append('Set-Cookie', header);
		return applySecurityHeaders(new Response(cloned.body, {
			status: cloned.status,
			statusText: cloned.statusText,
			headers,
		}));
	}
	return applySecurityHeaders(response);
}

/**
 * Route + RPC + action dispatch.
 *
 * Routes deliberately DO NOT receive `env`, `ctx`, or `locals` in their
 * `render()` payload — templates must stay env-agnostic, and any binding
 * access has to go through a `$server/*` module (which uses `getEnv()`
 * from the module-scope request context we seeded in `handle`).
 *
 * This mirrors the legacy CLI's `generated-worker.ts` contract exactly.
 */
async function coreHandle(runtimeCtx) {
	const { request, url } = runtimeCtx;

	// Client-side $server/* RPC calls route here. Same-origin gate first
	// (blocks non-browser + cross-origin), then look the module up in
	// the statically-built rpc-map and invoke the named export.
	if (url.pathname.startsWith('/__kuratchi/rpc/')) {
		const rpcCheck = validateRpcRequest(request, url, {
			allowedMethods: ['POST'],
			requireSameOrigin: true,
		});
		if (!rpcCheck.valid) {
			return new Response(JSON.stringify({ ok: false, error: rpcCheck.reason }), {
				status: rpcCheck.status,
				headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
			});
		}
		return handleRpc(request, url);
	}

	let match = null;
	let params = null;
	for (const r of compiledRoutes) {
		params = r.match(url.pathname);
		if (params) {
			match = r;
			break;
		}
	}
	if (!match) return new Response('Not Found', { status: 404 });
	runtimeCtx.params = params;

	if (request.method === 'POST') {
		// Actions, like RPC, are same-origin-only. Cross-origin form
		// POSTs (e.g. an attacker's site submitting to ours) are rejected.
		const actionCheck = validateActionRequest(request, url, { requireSameOrigin: true });
		if (!actionCheck.valid) {
			return new Response(actionCheck.reason ?? 'Forbidden', { status: actionCheck.status });
		}
		return handleAction(request, match, params, url);
	}

	return renderRoute(request, url, match, params);
}

/**
 * Render a matched route to an HTML Response. Shared by:
 *   - the GET path (normal page load)
 *   - the action-error path (POST → action threw → re-render same page
 *     with `actionName.error` populated so the template can surface it)
 *
 * `overrides` lets the action-error path inject its error/success state
 * into the render data without duplicating the data-construction logic.
 * `status` defaults to 200 for normal renders; action errors pass 422
 * (Unprocessable Entity) or whatever status the thrown error provides.
 */
async function renderRoute(request, url, match, params, overrides, status) {
	// `render(data)` receives the safe subset of request state. The
	// compiled route module destructures `url`, `pathname`, `searchParams`,
	// `params`, `slug`, `method` from `data` (via synthesized
	// `requestImportDecls` — see `transformRouteFile` in the plugin) so
	// the leading-script body running inside render can read
	// `kuratchi:request` values. Locals and env are NOT here — templates
	// reach those through `$server/*` modules.
	const data = {
		url,
		pathname: url.pathname,
		searchParams: url.searchParams,
		params,
		slug: params?.slug ?? Object.values(params ?? {})[0],
		method: request.method,
		breadcrumbs: __getLocals().__breadcrumbs ?? [],
	};
	// Seed default action state for every declared action on this route so
	// templates can reference `myAction.error` / `.loading` / `.success`
	// unconditionally — no existence checks required. Action errors
	// overwrite this below via `overrides`.
	if (match.module.actions) {
		for (const actionKey of Object.keys(match.module.actions)) {
			if (!(actionKey in data)) {
				data[actionKey] = { error: undefined, loading: false, success: false };
			}
		}
	}
	if (overrides) Object.assign(data, overrides);

	let rendered;
	try {
		rendered = await match.module.render(data);
	} catch (err) {
		// Same `redirect()` control-flow as actions: a route's leading
		// `<script>` can call `redirect('/somewhere')` (e.g. to bounce
		// unauthenticated users). The framework's `RedirectError` must
		// be converted to a 3xx here — otherwise it bubbles to the
		// error phase and renders a 500 page.
		if (err && err.isRedirectError) {
			const location = err.location || url.pathname;
			const redirectStatus = Number(err.status) || 303;
			return new Response(null, { status: redirectStatus, headers: { location } });
		}
		throw err;
	}
	// Legacy contract: `render()` may return either a string (raw HTML)
	// or an object with `html` / `head` fields (when the compiler
	// produced a layout-compatible render). Normalize to string.
	let html = typeof rendered === 'string'
		? rendered
		: (rendered?.html ?? '');

	// Inject workflow poll metadata if workflowStatus(..., { poll }) was
	// called during render. The client bridge reads the JSON config tag and
	// re-fetches the page on the given interval, swapping <body> contents
	// so every { status.* } in the template re-renders against fresh data.
	// The server sets x-kuratchi-poll-done when the 'until' predicate
	// reports terminal, so the client stops polling.
	const poll = __getLocals().__kuratchiPoll;
	const responseHeaders = { 'content-type': 'text/html; charset=utf-8' };
	if (poll && !poll.done) {
		const payload = JSON.stringify({ interval: poll.interval });
		html = html + '\n<script type="application/json" id="__kuratchi_poll">' + payload.replace(/</g, '\\u003c') + '</script>';
		// Inject the client-side polling bridge inline. The IIFE reads the
		// config tag above, then re-fetches the current URL on the interval
		// and swaps <body> contents. Runs once — the setTimeout chain
		// survives body innerHTML replacements because the closure is in
		// memory, not in the DOM.
		html = html + '\n' + __POLL_BRIDGE_SCRIPT;
	}
	if (poll && poll.done) {
		responseHeaders['x-kuratchi-poll-done'] = '1';
	}

	// Streaming: if the template registered any async boundaries via
	// `const x = fn()` patterns, the sync render emitted pending-state
	// placeholder divs and queued the promises on the request-scoped
	// collector. We now:
	//   1. Inject the bootstrap `$_swap` helper once.
	//   2. Keep the initial HTML's `</body>` / `</html>` tail for after the chunks.
	//   3. Stream each resolved chunk (`<template>` + `<script>$_swap(id)</script>`)
	//      into the body before those closing tags.
	// If there are no boundaries, skip the streaming machinery entirely
	// and return a plain string response — zero overhead for simple pages.
	const boundaries = __takeCollectedBoundaries();
	if (boundaries.length === 0) {
		return new Response(html, {
			status: status ?? 200,
			headers: responseHeaders,
		});
	}
	return streamResponseWithBoundaries(html, boundaries, status, responseHeaders);
}

/**
 * Stream an HTML response with out-of-order flushed async boundaries.
 *
 * The initial HTML contains placeholder divs (`<div id="__ssr_boundary_X">`)
 * at each boundary site. We emit that HTML as the first chunk, followed by
 * one inline bootstrap script defining `$_swap`. Then — as each boundary's
 * promise resolves — we emit a `<template id="__ssr_chunk_X">{html}</template>`
 * plus a `<script>$_swap('X')</script>` chunk. The client's inline
 * bootstrap moves the template's contents into the placeholder, replacing
 * the pending-state markup with the resolved content.
 *
 * Chunks are emitted in resolution order, not declaration order (out-of-order
 * flush). Browsers handle this correctly because every chunk targets its
 * placeholder by id.
 */
function streamResponseWithBoundaries(initialHtml, boundaries, status, headers) {
	// Find the safest injection point for the bootstrap + chunks. We prefer
	// just before `</body>`; if missing (rare — fragment responses, etc),
	// we append at the very end of the HTML string.
	const closingIdx = findClosingBodyIndex(initialHtml);
	const head = closingIdx >= 0 ? initialHtml.slice(0, closingIdx) : initialHtml;
	const tail = closingIdx >= 0 ? initialHtml.slice(closingIdx) : '';

	const encoder = new TextEncoder();
	const body = new ReadableStream({
		async start(controller) {
			try {
				// 1) Emit initial HTML up to but NOT including </body>
				controller.enqueue(encoder.encode(head));
				// 2) Emit the one-time bootstrap <script>. Safe to always emit
				//    at this position — the helper must be defined before any
				//    chunk script runs.
				controller.enqueue(encoder.encode('\n' + __BOUNDARY_BOOTSTRAP));
				// 3) Fire all boundary resolutions in parallel. As each
				//    settles, enqueue its chunk. Using Promise.all on the
				//    mapped list preserves each boundary's completion in
				//    whatever order it finishes.
				await Promise.all(
					boundaries.map(async (b) => {
						const chunk = await resolveBoundaryToChunk(b);
						controller.enqueue(encoder.encode('\n' + chunk));
					}),
				);
				// 4) Emit the preserved </body></html> tail after all chunks.
				if (tail) controller.enqueue(encoder.encode(tail));
				controller.close();
			} catch (err) {
				// A catastrophic error in the streaming pipeline (not in an
				// individual boundary — those are caught by resolveBoundaryToChunk).
				// Close the stream gracefully; the client sees whatever we've
				// emitted so far, which is better than a hung connection.
				console.error('[kuratchi] Streaming render error:', err);
				try {
					controller.close();
				} catch {
					// Already closed.
				}
			}
		},
	});

	return new Response(body, {
		status: status ?? 200,
		headers,
	});
}

/**
 * Locate the index of the last `</body>` tag in the HTML. Returns -1 if
 * not present (e.g. a fragment response or a misauthored template). The
 * streaming path gracefully falls back to appending chunks at end-of-string
 * in that case.
 */
function findClosingBodyIndex(html) {
	// Case-insensitive match of `</body>` with optional whitespace inside the tag.
	const m = html.match(/<\/body\s*>/i);
	if (!m) return -1;
	return html.lastIndexOf(m[0]);
}

/**
 * Dispatch client-initiated RPC. Path shape: `/__kuratchi/rpc/<subpath>/<fn>`.
 * `<subpath>` matches the original `$server/<subpath>` import specifier
 * and is fed through a dynamic `import('$server/<subpath>')` that Vite's
 * alias resolves to the real server file at build time.
 *
 * The client stub passes a JSON array of args as the request body.
 * Whatever the server function returns is JSON-serialized back. If the
 * return value is a Response, we pass it through directly — lets
 * server functions stream, redirect, or set custom status/headers.
 */
async function handleRpc(request, url) {
	if (request.method !== 'POST') {
		return new Response('RPC requires POST', { status: 405 });
	}
	const rest = url.pathname.slice('/__kuratchi/rpc/'.length);
	const slashIdx = rest.lastIndexOf('/');
	if (slashIdx < 0) return new Response('Malformed RPC path', { status: 400 });
	const subpath = rest.slice(0, slashIdx);
	const fnName = rest.slice(slashIdx + 1);

	let args = [];
	try {
		const text = await request.text();
		if (text) args = JSON.parse(text);
	} catch {
		return new Response('Invalid RPC body', { status: 400 });
	}

	// The server module has been statically imported into `kuratchi:rpc-map`
	// at build time (see `generateRpcMapModule`). We look it up by subpath
	// rather than using dynamic `import()` so Rollup / the Worker bundler
	// can follow the import graph statically.
	const mod = lookupRpcModule(subpath);
	if (!mod) {
		return new Response('Unknown RPC module: ' + subpath, { status: 404 });
	}
	const fn = fnName === 'default' ? mod.default : mod[fnName];
	if (typeof fn !== 'function') {
		if (fnName in mod) {
			// Allow read-only access to non-function exports too.
			return Response.json(mod[fnName] ?? null);
		}
		return new Response('Unknown RPC function: ' + fnName, { status: 404 });
	}
	try {
		const result = await fn.apply(null, args);
		if (result instanceof Response) return result;
		return Response.json(result ?? null);
	} catch (err) {
		// RPC errors travel back to the client as JSON; `sanitizeErrorMessage`
		// hides internal error strings in prod while still surfacing
		// explicit `ActionError` / `PageError` messages authored by the
		// developer. Matches `__handleRpc` in the legacy generated worker.
		console.error('[kuratchi] RPC error:', err);
		const message = sanitizeErrorMessage(err, 'RPC call failed');
		return new Response(JSON.stringify({ ok: false, error: message }), {
			status: 500,
			headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
		});
	}
}

async function handleAction(request, match, params, url) {
	if (!url) url = new URL(request.url);
	const contentType = request.headers.get('content-type') || '';
	let actionName = '';
	let formData = null;
	let spreadArgs = [];
	if (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	) {
		formData = await request.formData();
		actionName = String(formData.get('_action') || '');
		// Button-triggered actions post `_args` as a JSON-encoded
		// array alongside `_action`. Parse it here so handlers receive
		// positional arguments and never have to deserialize by hand.
		// Authored `<form action={fn}>` submissions have no `_args`
		// field, so the array stays empty.
		const argsRaw = formData.get('_args');
		if (argsRaw !== null) {
			try {
				const parsed = JSON.parse(String(argsRaw));
				if (Array.isArray(parsed)) spreadArgs = parsed;
			} catch {
				// Malformed `_args` is a client bug — reject loudly.
				return new Response('Invalid _args JSON', { status: 400 });
			}
		}
	} else {
		actionName = url.searchParams.get('_action') || '';
	}
	const fn = match.module.actions && match.module.actions[actionName];
	if (!fn) {
		return new Response('Unknown action: ' + actionName, { status: 400 });
	}
	try {
		const result = await invokeAction(fn, { spreadArgs, formData, request, url, params });
		// If the action returned a Response, honor it directly. Otherwise
		// do a 303 See Other back to the requested path for POST-Redirect-GET.
		if (result instanceof Response) return result;
		return Response.redirect(url.toString(), 303);
	} catch (err) {
		// `redirect()` from `@kuratchi/js/runtime/context` throws a
		// `RedirectError` — the framework's declared control-flow
		// mechanism for action handlers. Convert to a real 3xx response.
		// Mirrors `__handleAction` in `@kuratchi/js/runtime/generated-worker.ts`.
		if (err && err.isRedirectError) {
			const location = err.location || url.pathname;
			const status = Number(err.status) || 303;
			return new Response(null, { status, headers: { location } });
		}

		// Action errors — the route re-renders with `actionName.error`
		// populated so templates can surface the message inline (like the
		// legacy wrangler worker's `__handleAction` did). This is the
		// declared contract in `@kuratchi/js` docs: `actionName.error`
		// is set on `ActionError` throw and cleared on the next render.
		//
		// `ActionError` messages always surface (explicit user-facing
		// errors by definition). Plain Error messages leak only in dev;
		// in prod they collapse to a generic fallback so internal detail
		// never reaches the browser.
		console.error('[kuratchi] Action error:', err);
		const message = sanitizeErrorMessage(err, 'Action failed');
		// If the thrown error carries an explicit `status` (e.g. an
		// HttpError-style with 409 / 422 / 404), honor it. Otherwise
		// default to 422 Unprocessable Entity — the standard status for
		// form-validation failures. 500 is reserved for genuine bugs,
		// which still bubble to the top-level handler (via re-throw below).
		const errStatus = err && typeof err.status === 'number' ? err.status : 0;
		if (!err?.isActionError && errStatus < 400) {
			// Not a user-facing error and no explicit status — treat as
			// an unexpected bug and bubble to the top-level 500 path so
			// behavior matches the GET render-error path.
			throw err;
		}
		const status = errStatus >= 400 && errStatus < 600 ? errStatus : 422;
		const overrides = {
			[actionName]: { error: message, loading: false, success: false },
		};
		return renderRoute(request, url, match, params, overrides, status);
	}
}
