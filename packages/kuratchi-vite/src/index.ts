/**
 * @kuratchi/vite — Vite plugin for KuratchiJS
 *
 * SPIKE BRANCH. Minimum surface to pass the gates in `VITE-SPIKE.md`.
 *
 * Route files use the `.kuratchi` extension. The files are HTML-shaped but
 * contain native JS control flow (`if () {}`, `for () {}`), `{expression}`
 * interpolation, attribute binding, and `$server/*` RPC imports — none of
 * which are valid HTML. The dedicated extension lets Vite / Rollup / Prettier
 * / editors / agents route through the right handler without fighting
 * HTML-tooling assumptions.
 *
 * The plugin delegates template parsing + codegen to `@kuratchi/js/compiler`
 * (the same primitives the legacy CLI uses), and adds Vite-specific
 * orchestration: route discovery, virtual `kuratchi:routes` module, client
 * fragment extraction (template-body `<script>` blocks) as virtual modules
 * that Vite bundles, and `$lib`/`$server` resolve aliases.
 */

import type { Plugin } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import {
	parseFile,
	compileTemplate,
	stripTopLevelImports,
	isKuratchiVirtualModule,
	resolveKuratchiVirtualModule,
	discoverContainerFiles,
	discoverSandboxFiles,
	discoverQueueConsumerFiles,
	discoverWorkflowFiles,
	discoverDurableObjects,
	syncWranglerConfig,
} from '@kuratchi/js/compiler';
import type {
	DiscoveredRoute,
	KuratchiViteOptions,
	ResolvedKuratchiOptions,
} from './types.js';

/**
 * Resolve `@kuratchi/js/runtime/<name>.js` to a concrete filesystem path.
 *
 * We can't use `require.resolve` because `@kuratchi/js` only publishes the
 * `import` condition — CJS resolution fails even though the files exist.
 * Instead we find the `@kuratchi/js` package directory (via CJS resolution
 * of its `package.json` which *is* exported) and join the runtime path.
 *
 * Resolving from the plugin's own require context means host apps don't
 * need to list `@kuratchi/js` as a direct dependency — the plugin owns
 * that link.
 */
const kuratchiRequire = createRequire(import.meta.url);
let cachedKuratchiDistDir: string | null = null;
function getKuratchiDistDir(): string {
	if (cachedKuratchiDistDir) return cachedKuratchiDistDir;
	const pkgJsonPath = kuratchiRequire.resolve('@kuratchi/js/package.json');
	cachedKuratchiDistDir = path.join(path.dirname(pkgJsonPath), 'dist');
	return cachedKuratchiDistDir;
}
/**
 * Read the dispatch runtime source from disk. Kept as a sibling file
 * (`runtime/dispatch.js`) rather than a template literal so comments,
 * regex literals, and `${…}` inside the source don't need exotic
 * escaping. Cached after the first read for speed.
 *
 * During dev + prod the file is co-located with the plugin's compiled
 * `dist/index.js`. We resolve against `import.meta.url` so the lookup
 * works regardless of how the plugin was installed (workspace link
 * vs. node_modules).
 */
let cachedDispatchSource: string | null = null;
function loadDispatchSource(): string {
	if (cachedDispatchSource !== null) return cachedDispatchSource;
	const dispatchPath = new URL('./runtime/dispatch.js', import.meta.url);
	cachedDispatchSource = fs.readFileSync(dispatchPath, 'utf-8');
	return cachedDispatchSource;
}

function resolveKuratchiRuntimeFile(runtimeSpec: string): string {
	// runtimeSpec looks like '@kuratchi/js/runtime/request.js' —
	// strip the package name and map to the dist dir.
	const pkgPrefix = '@kuratchi/js/';
	if (!runtimeSpec.startsWith(pkgPrefix)) return runtimeSpec;
	const subpath = runtimeSpec.slice(pkgPrefix.length);
	try {
		return path.join(getKuratchiDistDir(), subpath);
	} catch {
		return runtimeSpec;
	}
}

export type { KuratchiViteOptions } from './types.js';

const ROUTE_EXT = '.kuratchi';
function isRouteFile(filePath: string): boolean {
	return filePath.endsWith(ROUTE_EXT);
}

/**
 * Fallback expressions for each safe `kuratchi:request` export. The parser
 * only allows this subset through (see `KURATCHI_REQUEST_SAFE_EXPORTS` in
 * `@kuratchi/js/compiler/parser.ts`), so we keep the table in lock-step:
 * if a new safe export is added there, it needs a matching fallback here.
 * The dispatcher populates matching fields on `data` per-request; the
 * fallback only fires if something bypasses the dispatcher (e.g. a direct
 * `render({})` call in tests).
 */
/**
 * Default static-assets directory. Auto-wired into `wrangler.jsonc`'s
 * `assets.directory` field if the folder exists — no app-side config
 * required. Wrangler serves files from this directory at the URL
 * matching their path relative to the directory, so
 * `src/assets/styles.css` is reachable at `/styles.css` in both dev
 * (via the Cloudflare Vite plugin's asset handling) and prod.
 */
const DEFAULT_ASSETS_DIR = 'src/assets';

const REQUEST_IMPORT_FALLBACKS: Record<string, string> = {
	url: 'new URL("http://localhost/")',
	pathname: '"/"',
	searchParams: 'new URLSearchParams()',
	params: '{}',
	slug: 'undefined',
	method: '"GET"',
};

const ROUTE_LAYOUT_BASENAME = 'layout';
const ROUTE_APP_BASENAME = 'app';

const VIRTUAL_ROUTES_ID = 'kuratchi:routes';
const RESOLVED_VIRTUAL_ROUTES_ID = '\0' + VIRTUAL_ROUTES_ID;

/**
 * `kuratchi:layout` — a single synthesized module that exports the
 * root-layout `render(data, __content)` function. Emitted only when a
 * `routes/layout.kuratchi` (or `layout.html`) file exists at the root of
 * the routes dir. Each route's compiled render wraps its HTML output in
 * a layout-render call when this module is available.
 *
 * Keeping the layout in its own virtual module (not inlined per-route)
 * means the layout source + any `$server/*` it imports are evaluated
 * once per request at the layout level, not redundantly per route.
 */
const VIRTUAL_LAYOUT_ID = 'kuratchi:layout';
const RESOLVED_VIRTUAL_LAYOUT_ID = '\0' + VIRTUAL_LAYOUT_ID;

/**
 * `kuratchi:app` — the document shell (doctype + <html> + <head> + <body>).
 *
 * Synthesized from `src/routes/app.kuratchi` when present; otherwise
 * falls back to a minimal default shell. The app shell's single
 * `<slot></slot>` is where the layout+page stream is inserted.
 *
 * This separates two previously conflated concerns:
 *   - `app.kuratchi` owns the document frame (head, meta, framework
 *     head/body injections, CSP nonce, per-request html attrs).
 *   - `layout.kuratchi` is a fragment — just another route file with
 *     a top <script>, template, and a <slot></slot> for the page.
 *
 * Back-compat: if `app.kuratchi` is absent AND `layout.kuratchi`
 * contains `<html>` / `<body>`, the layout keeps its old conflated
 * role (the default shell is bypassed). A deprecation warning is
 * emitted when we detect that legacy shape.
 */
const VIRTUAL_APP_ID = 'kuratchi:app';
const RESOLVED_VIRTUAL_APP_ID = '\0' + VIRTUAL_APP_ID;

/**
 * `kuratchi:worker` — the full Worker module the user's `src/worker.ts`
 * re-exports. Combines:
 *
 *   - `default` export: `{ fetch, queue? }` (dispatcher + queue router)
 *   - Named exports: every discovered convention class
 *     (.workflow.ts / .do.ts / .sandbox.ts / .container.ts classes)
 *
 * Cloudflare requires convention classes to be NAMED EXPORTS OF THE
 * WORKER ENTRY SCRIPT for binding resolution. This virtual module gives
 * the user a single re-export target so `src/worker.ts` stays a two-line
 * stub regardless of how many conventions the project uses.
 */
const VIRTUAL_WORKER_ID = 'kuratchi:worker';
const RESOLVED_VIRTUAL_WORKER_ID = '\0' + VIRTUAL_WORKER_ID;

/**
 * `kuratchi:middleware` — resolves to `src/middleware.ts` if it exists,
 * or an empty stub otherwise. One canonical location — matches Next.js
 * and SvelteKit conventions, visible at a glance, implicitly server-only
 * (there's no client-side middleware concept).
 *
 * The user default-exports a `RuntimeDefinition` (map of step names →
 * `{ request, route, response, error }` phase handlers). The dispatcher
 * walks it per request phase.
 */
const VIRTUAL_MIDDLEWARE_ID = 'kuratchi:middleware';
const RESOLVED_VIRTUAL_MIDDLEWARE_ID = '\0' + VIRTUAL_MIDDLEWARE_ID;
const MIDDLEWARE_FILE = 'src/middleware.ts';

/**
 * A unified view of a discoverable Worker class (workflow / DO / sandbox
 * / container). Queue consumers are tracked separately because they're
 * function handlers, not classes.
 */
interface ConventionClass {
	className: string;
	file: string;
	exportKind: 'named' | 'default';
}
interface QueueConsumer {
	queueName: string;
	file: string;
	exportKind: 'named' | 'default';
}

/**
 * Prefix for per-route client-script virtual modules. Template-body
 * `<script>` blocks with imports get extracted, keyed by a content hash,
 * and served from these IDs. The `<script>` tag the browser loads is
 * `<script type="module" src="/@id/virtual:kuratchi-client/<hash>.ts">`.
 *
 * No null-byte prefix: the browser fetches these over HTTP, so the ID
 * must be URL-safe. Vite's dev server routes `/@id/<id>` through the
 * plugin pipeline regardless of prefix.
 */
const CLIENT_VIRTUAL_PREFIX = 'virtual:kuratchi-client/';

/**
 * Client-env stub prefix. When the browser-bound build sees an import of
 * `$server/<path>`, `resolveId` rewrites it to
 * `virtual:kuratchi-rpc/<path>.ts` (this prefix + relative `<path>`). The
 * corresponding `load` emits one `fetch('/__kuratchi/rpc/…')` stub per
 * exported identifier in the referenced server module — so the REAL
 * server module never enters the client bundle.
 */
const RPC_VIRTUAL_PREFIX = 'virtual:kuratchi-rpc/';
const RPC_DISPATCH_PATH = '/__kuratchi/rpc/';

/**
 * `kuratchi:rpc-map` — SSR-only virtual module that statically imports
 * every `$server/<subpath>` the client env has referenced, and exposes
 * them by subpath. The dispatcher uses this at request time so we never
 * need a dynamic `import()` with a runtime-computed specifier.
 */
const VIRTUAL_RPC_MAP_ID = 'kuratchi:rpc-map';
const RESOLVED_VIRTUAL_RPC_MAP_ID = '\0' + VIRTUAL_RPC_MAP_ID;

/**
 * `kuratchi:manifest` — imported by compiled route modules to resolve the
 * browser-visible URL for a client fragment. Separated from the fragments
 * themselves so the URL policy can differ per environment:
 *
 *   - dev: returns `/@id/<virtual-id>`; Vite's dev server transforms + serves
 *   - prod: reads `dist/client/.vite/manifest.json` (written by the client
 *     Rollup build that runs *before* the SSR build) and returns the hashed
 *     asset path
 */
const VIRTUAL_MANIFEST_ID = 'kuratchi:manifest';
const RESOLVED_VIRTUAL_MANIFEST_ID = '\0' + VIRTUAL_MANIFEST_ID;

/**
 * `kuratchi:dispatch` — high-level request handler the user's Worker
 * delegates to. Matches routes, renders on GET, dispatches server actions
 * (POST with `_action` form field) with a POST-Redirect-GET response.
 *
 * Exposing this as a virtual module — rather than a published helper in
 * `@kuratchi/vite` — means the generated code has direct access to the
 * `kuratchi:routes` module graph (pattern matching + `actions` export
 * per route). The user's `src/worker.ts` becomes three lines.
 */
const VIRTUAL_DISPATCH_ID = 'kuratchi:dispatch';
const RESOLVED_VIRTUAL_DISPATCH_ID = '\0' + VIRTUAL_DISPATCH_ID;

/**
 * `kuratchi:migrations` — exports `ensureMigrations(env)`, called once
 * per worker isolate on the first request. Synthesized from
 * `kuratchi.config.ts` — whatever DB bindings appear under
 * `orm.databases` get wired up with the user's schema DSL and the
 * ORM's `runMigrations` runner. Mirrors the legacy CLI's
 * `__runMigrations()` injection. No-op when the config file is absent
 * or has no `orm.databases` entries.
 */
const VIRTUAL_MIGRATIONS_ID = 'kuratchi:migrations';
const RESOLVED_VIRTUAL_MIGRATIONS_ID = '\0' + VIRTUAL_MIGRATIONS_ID;

/**
 * Shared across transformRouteFile invocations: every time we compile a
 * route we extract its template-body client scripts here so `resolveId` /
 * `load` can serve them back to Vite. Keyed by content hash so repeated
 * identical scripts dedupe automatically.
 */
interface ClientFragment {
	source: string;
	importerAbsPath: string;
}

/**
 * Convention filename for the project's global stylesheet. When a file
 * exists at this path, `@kuratchi/vite` registers it as a client Rollup
 * input so Vite's plugin pipeline processes it (Tailwind, PostCSS,
 * CSS Modules, etc.), emits a hashed `.css` asset in prod, and
 * auto-injects a `<link rel="stylesheet">` into the app shell's
 * `<head>` at compile time.
 *
 * Zero-config: drop `src/app.css` in the project, `@import "tailwindcss";`
 * (or whatever), and every page ships with it linked. Mirrors
 * SvelteKit's `src/app.css`, Next.js's `app/globals.css`, and Astro's
 * `src/styles/global.css` conventions.
 *
 * Files in `src/assets/` are a totally separate thing — served verbatim
 * by Wrangler's ASSETS binding (favicons, images, prebuilt CSS).
 */
const GLOBAL_CSS_FILE = 'src/app.css';
const GLOBAL_CSS_VIRTUAL_ID = 'virtual:kuratchi-global-css.js';
/** Rollup-input / manifest key for the global-CSS shim. */
const GLOBAL_CSS_ENTRY_NAME = 'kuratchi-global-css';

export function kuratchi(options: KuratchiViteOptions = {}): Plugin[] {
	const resolved: ResolvedKuratchiOptions = {
		routesDir: options.routesDir ?? 'src/routes',
		serverDir: options.serverDir ?? 'src/server',
		libDir: options.libDir ?? 'src/lib',
	};

	return [routesPlugin(resolved)];
}

function routesPlugin(options: ResolvedKuratchiOptions): Plugin {
	let projectRoot = process.cwd();
	let routes: DiscoveredRoute[] = [];
	let isProduction = false;
	/**
	 * Absolute path to the root layout file (`routes/layout.kuratchi` or
	 * `routes/layout.html`), or `null` if none exists. Routes only wrap
	 * their output in a layout render when this is set.
	 */
	let rootLayoutPath: string | null = null;
	/**
	 * Absolute path to the document shell (`routes/app.kuratchi`), or
	 * `null` when the app doesn't ship one — in which case the
	 * framework synthesizes a minimal default shell at render time.
	 */
	let rootAppPath: string | null = null;
	/**
	 * True when the layout file itself contains `<html>`/`<body>` — the
	 * legacy "layout is also the shell" shape. Triggers a deprecation
	 * warning and makes the default app shell a pass-through so we
	 * don't emit a nested `<html>`.
	 */
	let layoutIsLegacyShell = false;
	/**
	 * Populated by `syncWranglerFromConventions` during `configResolved`.
	 * Used later by the `kuratchi:worker` module to re-export classes
	 * and wire queue dispatch.
	 */
	let conventionClasses: ConventionClass[] = [];
	let queueConsumers: QueueConsumer[] = [];
	let workflowRegistry: Array<{ name: string; binding: string }> = [];
	/**
	 * Every `$server/<subpath>` specifier that the client env has ever
	 * resolved. We static-import each of these into the SSR bundle's
	 * `kuratchi:rpc-map` module so the dispatcher can look the module up
	 * at runtime without a dynamic `import()` (which Rollup can't
	 * statically resolve against an aliased specifier).
	 */
	const rpcReferencedModules = new Set<string>();
	const clientFragments = new Map<string, ClientFragment>();
	/**
	 * Whether `src/app.css` exists. Set in `configResolved`; drives
	 * both the client-Rollup-input registration and the `<link>`
	 * injection in `transformAppFile`.
	 */
	let hasGlobalCss = false;

	return {
		name: 'kuratchi:routes',
		enforce: 'pre',

		config(userConfig, configEnv) {
			// `$lib` and `$server` are Kuratchi's author-facing path aliases.
			// Registering them via Vite's resolver means any template-body
			// `<script>` (which Vite bundles for the client env) or any
			// Worker-side module (ssr env) can just `import x from '$lib/y'`
			// and have Vite resolve it. No custom rewrite pass needed.
			const root = (userConfig.root ? path.resolve(userConfig.root) : process.cwd());
			// Scaffold `src/worker.ts` if missing, BEFORE the Cloudflare
			// plugin's own `config` hook reads wrangler.jsonc's `main`
			// field. Otherwise that hook errors on a missing file and
			// dev/build fails to start.
			ensureWorkerEntry(root);
			// Default `publicDir` to `src/assets/` when it exists. Vite
			// serves this directory at URL root (files at `/<name>`) in
			// dev; Wrangler serves from the same directory in prod via
			// the assets binding we auto-wire into `wrangler.jsonc`.
			// Authors never configure a separate static dir.
			const assetsAbs = path.resolve(root, DEFAULT_ASSETS_DIR);
			const publicDir = userConfig.publicDir === undefined && fs.existsSync(assetsAbs)
				? assetsAbs
				: userConfig.publicDir;
			// `kuratchi:environment` exposes a `dev` flag that reads
			// `globalThis.__kuratchi_DEV__`. The legacy CLI substitutes
			// this at build time — we do the same via Vite's `define` so
			// `if (dev) { ... }` compiles to a literal. `command` is
			// 'serve' during `vite dev` and 'build` during `vite build`.
			const isDev = configEnv.command !== 'build';
			return {
				publicDir,
				define: {
					'globalThis.__kuratchi_DEV__': JSON.stringify(isDev),
				},
				resolve: {
					alias: [
						{
							find: /^\$lib\/(.*)/,
							replacement: path.resolve(root, options.libDir) + '/$1',
						},
						// `$server/*` is NOT registered as a resolve.alias
						// because alias rewriting runs BEFORE plugin
						// `resolveId` hooks. For RPC to work, we need
						// env-aware resolution (client = RPC stub, ssr =
						// real file) — handled in `resolveId` below.
					],
				},
				// Emit a Vite manifest for the client env. In prod we read
				// this to rewrite `/@id/virtual:...` dev URLs to the hashed
				// asset paths Rollup generated.
				environments: {
					client: {
						build: {
							manifest: true,
						},
					},
				},
			};
		},

		async configResolved(config) {
			projectRoot = config.root;
			isProduction = config.command === 'build';
			routes = discoverRoutes(projectRoot, options.routesDir);
			rootLayoutPath = discoverRootLayout(projectRoot, options.routesDir);
			rootAppPath = discoverRootApp(projectRoot, options.routesDir);
			layoutIsLegacyShell = false;
			if (rootLayoutPath) {
				try {
					const layoutSource = await fs.promises.readFile(rootLayoutPath, 'utf-8');
					if (/<html\b/i.test(layoutSource) || /<!DOCTYPE\s+html/i.test(layoutSource)) {
						layoutIsLegacyShell = true;
						if (!rootAppPath) {
							// eslint-disable-next-line no-console
							console.warn(
								'[kuratchi] src/routes/layout.kuratchi contains the document shell ' +
									'(<!DOCTYPE>/<html>). This shape is deprecated. Move the shell to ' +
									'src/routes/app.kuratchi and keep layout.kuratchi as a fragment ' +
									'(top <script> + markup wrapping <slot></slot>).',
							);
						}
					}
				} catch {
					// Best-effort detection; fall back to the new model.
				}
			}
			const discovered = syncWranglerFromConventions(projectRoot, options.serverDir);
			conventionClasses = discovered.classes;
			queueConsumers = discovered.queues;
			workflowRegistry = discovered.workflows;
			// Pre-scan routes to extract every template-body `<script>` block
			// BEFORE the client-env Rollup build starts. Each fragment is
			// registered with a stable content-hash id; the fragment id is
			// then added to the client environment's Rollup input so Rollup
			// emits a hashed asset per fragment (prod) and the manifest maps
			// virtual-id → output URL.
			for (const route of routes) {
				try {
					const source = await fs.promises.readFile(route.absPath, 'utf-8');
					extractClientFragments(source, route.absPath, clientFragments);
				} catch {
					// Routes unreadable at config time (permissions/moves) will
					// surface later in `load` where the user gets a real error.
				}
			}

			// Scan every extracted fragment for `$server/<path>` imports
			// up front. Populating `rpcReferencedModules` BEFORE the SSR
			// build starts ensures `kuratchi:rpc-map` has static imports
			// to every server module the client might RPC into.
			for (const fragment of clientFragments.values()) {
				const importRe = /^\s*import\s+.+\s+from\s+['"]\$server\/([^'"]+)['"]/gm;
				let m: RegExpExecArray | null;
				while ((m = importRe.exec(fragment.source)) !== null) {
					rpcReferencedModules.add(m[1]);
				}
			}

			// Global CSS convention: when `src/app.css` exists, register it
			// as a client Rollup input so Vite's plugin pipeline processes
			// it (Tailwind, PostCSS, CSS Modules, etc.), and the shell's
			// compiled template auto-injects a `<link rel="stylesheet">`
			// pointing at the hashed output. Mirrors SvelteKit/Next.js.
			hasGlobalCss = fs.existsSync(path.resolve(projectRoot, GLOBAL_CSS_FILE));

			if (clientFragments.size > 0 || hasGlobalCss) {
				const clientEnv = config.environments?.client;
				if (clientEnv) {
					const existingInput = clientEnv.build.rollupOptions?.input;
					const fragmentInputs: Record<string, string> = {};
					for (const hash of clientFragments.keys()) {
						fragmentInputs['kuratchi-client-' + hash] =
							CLIENT_VIRTUAL_PREFIX + hash + '.ts';
					}
					if (hasGlobalCss) {
						fragmentInputs[GLOBAL_CSS_ENTRY_NAME] = GLOBAL_CSS_VIRTUAL_ID;
					}
					clientEnv.build.rollupOptions = {
						...clientEnv.build.rollupOptions,
						input: mergeRollupInputs(existingInput, fragmentInputs),
					};
				}
			}
		},

		async resolveId(id, importer) {
			if (id === VIRTUAL_ROUTES_ID) return RESOLVED_VIRTUAL_ROUTES_ID;
			if (id === VIRTUAL_MANIFEST_ID) return RESOLVED_VIRTUAL_MANIFEST_ID;
			if (id === VIRTUAL_DISPATCH_ID) return RESOLVED_VIRTUAL_DISPATCH_ID;
			if (id === VIRTUAL_LAYOUT_ID) return RESOLVED_VIRTUAL_LAYOUT_ID;
			if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
			if (id === VIRTUAL_WORKER_ID) return RESOLVED_VIRTUAL_WORKER_ID;
			if (id === VIRTUAL_RPC_MAP_ID) return RESOLVED_VIRTUAL_RPC_MAP_ID;
			if (id === VIRTUAL_MIDDLEWARE_ID) return RESOLVED_VIRTUAL_MIDDLEWARE_ID;
			if (id === VIRTUAL_MIGRATIONS_ID) return RESOLVED_VIRTUAL_MIGRATIONS_ID;
			if (id.startsWith(CLIENT_VIRTUAL_PREFIX)) return id;
			if (id.startsWith(RPC_VIRTUAL_PREFIX)) return id;
			if (id === GLOBAL_CSS_VIRTUAL_ID) return id;

			// `$server/*` resolution is env-aware:
			//   - client env → per-module RPC stub (no server code in the
			//     browser bundle)
			//   - ssr (Worker) env → real file on disk, so server-side
			//     code + the RPC dispatcher can call it directly
			if (id.startsWith('$server/')) {
				const subpath = id.slice('$server/'.length);
				const envName = (this as { environment?: { name?: string } }).environment?.name;
				if (envName === 'client') {
					rpcReferencedModules.add(subpath);
					return RPC_VIRTUAL_PREFIX + subpath + '.ts';
				}
				// SSR / dev-server default: resolve to the real file.
				const real = resolveServerFile(projectRoot, options.serverDir, subpath);
				return real ?? null;
			}
			// `kuratchi:*` virtual modules (request, navigation, environment,
			// workflow) map to real files under `@kuratchi/js/runtime/`.
			// Resolve against the PLUGIN's own require context so the host
			// app doesn't have to list `@kuratchi/js` as a direct dep.
			if (
				isKuratchiVirtualModule(id) &&
				!id.startsWith('kuratchi:routes') &&
				!id.startsWith('kuratchi:manifest') &&
				!id.startsWith('kuratchi:dispatch') &&
				!id.startsWith('kuratchi:layout') &&
				!id.startsWith('kuratchi:app') &&
				!id.startsWith('kuratchi:worker') &&
				!id.startsWith('kuratchi:client')
			) {
				const target = resolveKuratchiVirtualModule(id);
				if (target !== id) {
					return resolveKuratchiRuntimeFile(target);
				}
			}
			return null;
		},

		async load(id) {
			if (id === RESOLVED_VIRTUAL_ROUTES_ID) {
				return generateRoutesModule(routes);
			}
			if (id === RESOLVED_VIRTUAL_MANIFEST_ID) {
				return generateManifestModule(projectRoot, isProduction);
			}
			if (id === RESOLVED_VIRTUAL_DISPATCH_ID) {
				return loadDispatchSource();
			}
			if (id === RESOLVED_VIRTUAL_WORKER_ID) {
				return generateWorkerModule(conventionClasses, queueConsumers, workflowRegistry);
			}
			if (id === RESOLVED_VIRTUAL_RPC_MAP_ID) {
				return generateRpcMapModule(
					projectRoot,
					options.serverDir,
					rpcReferencedModules,
				);
			}
			if (id === RESOLVED_VIRTUAL_MIDDLEWARE_ID) {
				const middlewareFile = resolveMiddlewareFile(projectRoot, options.serverDir);
				if (middlewareFile) {
					this.addWatchFile(middlewareFile);
					return `export { default as runtime } from ${JSON.stringify(middlewareFile)};
`;
				}
				// Stub — empty runtime definition. The dispatcher handles this
				// as a no-op (no steps to run), matching the behavior when
				// no middleware file exists.
				return 'export const runtime = {};\n';
			}
			if (id === RESOLVED_VIRTUAL_MIGRATIONS_ID) {
				const configPath = resolveKuratchiConfigFile(projectRoot);
				if (configPath) this.addWatchFile(configPath);
				return generateMigrationsModule(configPath);
			}
			if (id === RESOLVED_VIRTUAL_LAYOUT_ID) {
				if (!rootLayoutPath) return 'export const hasLayout = false;\nexport const render = async (_data, content) => content;\n';
				this.addWatchFile(rootLayoutPath);
				const source = await fs.promises.readFile(rootLayoutPath, 'utf-8');
				return transformLayoutFile(source);
			}
			if (id === RESOLVED_VIRTUAL_APP_ID) {
				if (rootAppPath) {
					this.addWatchFile(rootAppPath);
					const source = await fs.promises.readFile(rootAppPath, 'utf-8');
					return transformAppFile(source, hasGlobalCss);
				}
				// Legacy shape: layout.kuratchi owns the shell — app becomes a pass-through.
				if (layoutIsLegacyShell) {
					return 'export const hasApp = false;\nexport const render = async (_data, content) => content;\n';
				}
				// Default shell — no app.kuratchi in the project.
				return transformAppFile(DEFAULT_APP_SHELL, hasGlobalCss);
			}
			// Global-CSS virtual shim: one-line `import` of `src/app.css`
			// so Rollup treats it as an entry and Vite's plugins run
			// (Tailwind, PostCSS, CSS Modules, etc.). The emitted hashed
			// `.css` output is linked from the shell automatically.
			if (id === GLOBAL_CSS_VIRTUAL_ID) {
				const absPath = path.resolve(projectRoot, GLOBAL_CSS_FILE);
				this.addWatchFile(absPath);
				return `import ${JSON.stringify(absPath)};\n`;
			}
			// Client-env RPC stub for `$server/<path>`: synthesize one
			// `fetch('/__kuratchi/rpc/<path>/<fn>')` wrapper per exported
			// identifier in the real server file. The real source is never
			// shipped to the browser.
			if (id.startsWith(RPC_VIRTUAL_PREFIX)) {
				const subpath = id
					.slice(RPC_VIRTUAL_PREFIX.length)
					.replace(/\.ts$/, '');
				const serverFile = resolveServerFile(projectRoot, options.serverDir, subpath);
				if (serverFile) this.addWatchFile(serverFile);
				return generateRpcStubModule(subpath, serverFile);
			}
			// Client fragment requested by the browser: serve the extracted
			// `<script>` body. The `.ts` extension on the id tells Vite to
			// run its TypeScript transform on the module.
			if (id.startsWith(CLIENT_VIRTUAL_PREFIX)) {
				const hash = id.slice(CLIENT_VIRTUAL_PREFIX.length).replace(/\.ts$/, '');
				const fragment = clientFragments.get(hash);
				if (!fragment) return null;
				this.addWatchFile(fragment.importerAbsPath);
				return fragment.source;
			}
			// `.kuratchi` route files: read, compile, emit the render module.
			const fileId = id.split('?')[0];
			if (
				isRouteFile(fileId) &&
				isUnderRoutesDir(fileId, projectRoot, options.routesDir)
			) {
				const source = await fs.promises.readFile(fileId, 'utf-8');
				return transformRouteFile(source, fileId, clientFragments);
			}
			return null;
		},

		async handleHotUpdate({ file, server }) {
			if (!isRouteFile(file)) return;
			if (!isUnderRoutesDir(file, projectRoot, options.routesDir)) return;
			routes = discoverRoutes(projectRoot, options.routesDir);
			const virtualMod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ROUTES_ID);
			if (virtualMod) server.moduleGraph.invalidateModule(virtualMod);
			return undefined;
		},

		/**
		 * Post-build patch: Vite builds the SSR environment before the
		 * client environment (the Cloudflare plugin pins SSR as the
		 * primary builder). That ordering means the `kuratchi:manifest`
		 * virtual module — loaded during the SSR Rollup run — sees an
		 * empty `dist/client/.vite/manifest.json` and bakes `MAP = {}`
		 * into the Worker bundle.
		 *
		 * To avoid swapping bundler order (risky — it's set by the
		 * Cloudflare plugin), we patch the emitted Worker bundle once the
		 * client build completes. The `writeBundle` hook fires per
		 * environment; we only act when the *client* env finishes, at
		 * which point the client manifest is on disk.
		 */
		writeBundle: {
			sequential: true,
			handler(outputOptions) {
				if (!isProduction) return;
				// Only the Worker bundle has the `MAP = {}` placeholder. SSR
				// output lands in `dist/ssr/index.js` (or the env-specific
				// default (Cloudflare plugin respects Vite defaults).
				const dir = outputOptions.dir ?? '';
				if (!dir.endsWith(path.sep + 'client') && !dir.endsWith('/client')) return;
				patchSsrManifestPlaceholder(projectRoot, hasGlobalCss);
			},
		},
	};
}

/**
 * Replace the empty `MAP = {}` literal the SSR build baked in with the
 * real client-manifest mapping. Matches against the well-known shape
 * emitted by `generateManifestModule` so we can't accidentally rewrite
 * unrelated code.
 */
function patchSsrManifestPlaceholder(
	projectRoot: string,
	hasGlobalCss: boolean,
): void {
	const clientManifestPath = path.join(projectRoot, 'dist', 'client', '.vite', 'manifest.json');
	const ssrBundlePath = path.join(projectRoot, 'dist', 'ssr', 'index.js');
	if (!fs.existsSync(clientManifestPath) || !fs.existsSync(ssrBundlePath)) return;

	const manifest = JSON.parse(fs.readFileSync(clientManifestPath, 'utf-8')) as Record<
		string,
		{ file: string; css?: string[]; src?: string }
	>;

	// Client-fragment map: virtual hash → hashed output path.
	const clientMap: Record<string, string> = {};
	for (const [inputPath, entry] of Object.entries(manifest)) {
		const clientMatch = inputPath.match(
			new RegExp(`^${CLIENT_VIRTUAL_PREFIX.replace(/[/:]/g, (c) => '\\' + c)}([^.]+)\\.ts$`),
		);
		if (clientMatch) clientMap[clientMatch[1]] = '/' + entry.file;
	}

	// Global-CSS: resolve the single hashed `.css` Vite emitted via the
	// shim's `css[]` field. Empty string when absent so the shell's
	// `<link>` resolves to the harmless `href=""`, which browsers drop.
	let globalCssHref = '';
	if (hasGlobalCss) {
		const shimEntry = manifest[GLOBAL_CSS_VIRTUAL_ID];
		const css = shimEntry?.css?.[0];
		if (css) globalCssHref = '/' + css;
	}

	if (Object.keys(clientMap).length === 0 && !globalCssHref) return;

	const bundleSource = fs.readFileSync(ssrBundlePath, 'utf-8');
	// Rollup may rename the const under minification if a collision
	// exists, so we match both the original name and the `$N` suffix
	// variants Rollup emits for collisions.
	const clientLiteral = JSON.stringify(clientMap);
	let patched = bundleSource;
	if (Object.keys(clientMap).length > 0) {
		patched = patched.replace(
			/const (__kuratchiClientAssetMap(?:\$\d+)?)\s*=\s*\{\};/g,
			(_m, name) => `const ${name} = ${clientLiteral};`,
		);
	}
	if (globalCssHref) {
		const hrefLiteral = JSON.stringify(globalCssHref);
		patched = patched.replace(
			/const (__kuratchiGlobalCssHref(?:\$\d+)?)\s*=\s*""\s*;/g,
			(_m, name) => `const ${name} = ${hrefLiteral};`,
		);
	}
	if (patched !== bundleSource) {
		fs.writeFileSync(ssrBundlePath, patched);
	}
}

function discoverRoutes(projectRoot: string, routesDir: string): DiscoveredRoute[] {
	const abs = path.resolve(projectRoot, routesDir);
	if (!fs.existsSync(abs)) return [];
	const out: DiscoveredRoute[] = [];
	walk(abs, (file) => {
		if (!file.endsWith(ROUTE_EXT)) return;
		// Skip layout + error page files — they're not addressable routes.
		const basename = path.basename(file).replace(new RegExp(`\\${ROUTE_EXT}$`), '');
		if (basename === ROUTE_LAYOUT_BASENAME || basename === 'error') return;
		const rel = path.relative(abs, file);
		const urlPattern = pathToUrlPattern(rel);
		const id = rel.replace(/[\\/]/g, '__').replace(new RegExp(`\\${ROUTE_EXT}$`), '');
		out.push({ absPath: file, urlPattern, id });
	});
	out.sort((a, b) => {
		const aParam = (a.urlPattern.match(/:/g) ?? []).length;
		const bParam = (b.urlPattern.match(/:/g) ?? []).length;
		if (aParam !== bParam) return aParam - bParam;
		return b.urlPattern.length - a.urlPattern.length;
	});
	return out;
}

function walk(dir: string, visit: (file: string) => void) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, visit);
		else if (entry.isFile()) visit(full);
	}
}

/**
 * Look for a root layout at `routes/layout.kuratchi`.
 * Returns the first match, or null.
 */
function discoverRootLayout(projectRoot: string, routesDir: string): string | null {
	const abs = path.resolve(projectRoot, routesDir);
	const candidate = path.join(abs, ROUTE_LAYOUT_BASENAME + ROUTE_EXT);
	return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Look for the document shell at `src/app.kuratchi` — a framework-level
 * file, not a route. Mirrors SvelteKit's `src/app.html`, Next.js's
 * `app/layout.tsx`, and Remix's `app/root.tsx` conventions: the root
 * shell sits alongside `src/worker.ts` and `src/middleware.ts`, leaving
 * `src/routes/` for layouts and pages only.
 *
 * Returns the absolute path, or `null` when the project doesn't ship
 * one (in which case the framework synthesizes a minimal default).
 */
function discoverRootApp(projectRoot: string, _routesDir: string): string | null {
	// The `src/` location is derived from the canonical kuratchi layout
	// so we don't tie it to the routes dir. Changing the routes dir
	// doesn't move the shell.
	const candidate = path.resolve(projectRoot, 'src', ROUTE_APP_BASENAME + ROUTE_EXT);
	return fs.existsSync(candidate) ? candidate : null;
}

/**
 *   routes/index.kuratchi           -> '/'
 *   routes/about.kuratchi           -> '/about'
 *   routes/users/index.kuratchi     -> '/users'
 *   routes/users/[id].kuratchi      -> '/users/:id'
 *   routes/posts/[...slug].kuratchi -> '/posts/*'
 */
function pathToUrlPattern(rel: string): string {
	const withoutExt = rel.replace(new RegExp(`\\${ROUTE_EXT}$`), '');
	const segments = withoutExt.split(/[\\/]/).filter((s) => s !== 'index');
	const mapped = segments.map((s) => {
		const rest = s.match(/^\[\.\.\.([^\]]+)\]$/);
		if (rest) return '*';
		const param = s.match(/^\[([^\]]+)\]$/);
		if (param) return ':' + param[1];
		return s;
	});
	return '/' + mapped.join('/');
}

function isUnderRoutesDir(file: string, projectRoot: string, routesDir: string): boolean {
	const abs = path.resolve(projectRoot, routesDir);
	const rel = path.relative(abs, file);
	return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Matches every `<script>` block in the source. We iterate matches to
 * distinguish the LEADING script (index 0, which the existing Kuratchi
 * parser treats as SSR+client dual) from TEMPLATE-BODY scripts (subsequent
 * ones, which are client-only). Only template-body scripts get extracted
 * into client fragments here.
 */
const SCRIPT_BLOCK_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/**
 * A `<script>` block is a "client fragment candidate" when it is not the
 * leading script AND contains at least one ES-module import. Without
 * imports, there is nothing to bundle — the block can stay inline (and
 * the existing Kuratchi template compiler preserves it as-is).
 */
function hasEsModuleImport(body: string): boolean {
	return /^\s*import\s+.+\s+from\s+['"][^'"]+['"]/m.test(body);
}

/**
 * Extract every template-body `<script>` block with imports into the
 * shared `clientFragments` map and return a modified source where each
 * extracted block has been replaced with an HTML-comment marker. The
 * marker survives `compileTemplate` verbatim, so we can rewrite it into
 * a real `<script type="module" src=...>` tag on the way out.
 */
function extractClientFragments(
	source: string,
	importerAbsPath: string,
	clientFragments: Map<string, ClientFragment>,
): { source: string; fragmentHashes: string[] } {
	const fragmentHashes: string[] = [];
	let index = 0;
	let leadingSkipped = false;

	const transformed = source.replace(SCRIPT_BLOCK_RE, (match, _attrs: string, body: string) => {
		const currentIndex = index++;

		// Treat the first script block in the file as the leading (dual)
		// script — not a client-only fragment. Parser handles that block.
		if (!leadingSkipped) {
			leadingSkipped = true;
			return match;
		}

		if (!hasEsModuleImport(body)) return match;

		const hash = crypto
			.createHash('sha1')
			.update(importerAbsPath + ':' + currentIndex + ':' + body)
			.digest('hex')
			.slice(0, 12);

		clientFragments.set(hash, {
			source: body,
			importerAbsPath,
		});

		fragmentHashes.push(hash);
		return `<!--kuratchi:client-entry:${hash}-->`;
	});

	return { source: transformed, fragmentHashes };
}

/**
 * Compile a `.kuratchi` route file into a TS module exporting `render(data)`.
 *
 *   1. Extract template-body `<script>` blocks with imports → Vite-managed
 *      virtual client modules. Replace in source with HTML-comment markers.
 *   2. Parse the (now script-sanitized) source with `@kuratchi/js/compiler`.
 *   3. Compile the template to the `const __parts = [...]` body.
 *   4. Rewrite the markers in the compiled body to proper `<script type=
 *      "module" src="/@id/virtual:kuratchi-client/<hash>.ts">` tags so the
 *      browser fetches them through Vite's dev server (dev) or through the
 *      hashed asset path emitted by Rollup (prod; manifest-driven in a
 *      later gate).
 *   5. Inline the leading `<script>` body as the render-function prelude
 *      so top-level `const` declarations become locals in scope.
 *
 * Dual SSR/client split for the leading script + `$server/*` RPC stubs
 * arrive in Phase C.2/C.3.
 */
/**
 * Compile a `routes/layout.*` file into a TS module exporting
 * `render(data, __content)`. `<slot></slot>` and `<slot/>` in the layout
 * template get rewritten to `{@raw __content}` so the child route's
 * HTML is inserted unescaped at that location — matching the existing
 * CLI's layout semantics.
 *
 * Layouts currently don't extract template-body client fragments (those
 * are route-scoped). A layout-wide client bundle is a later enhancement
 * once a concrete need arises.
 */
const DEFAULT_APP_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<slot></slot>
</body>
</html>`;

/**
 * Compile a `routes/app.kuratchi` file into a TS module exporting
 * `render(data, __content)`. Structurally identical to the layout
 * transform — app files are fragments too, just scoped to the
 * document shell instead of in-page chrome. Keeping the transforms
 * symmetrical means authors get the same mental model in both
 * files: top <script> + template + `<slot></slot>`.
 */
function transformAppFile(source: string, hasGlobalCss: boolean): string {
	const parsed = parseFile(source);
	const rawTemplate = parsed.template ?? '';
	// When `src/app.css` exists, inject `<link rel="stylesheet" href={...}>`
	// immediately before `</head>`. The href resolves at render time via
	// `resolveGlobalCssHref()` from kuratchi:manifest — pointing at the
	// dev-server URL in dev, and the hashed manifest output in prod.
	//
	// If the shell has no `</head>`, we synthesize one: authors who ship
	// a shell without a head get a one-line injection as the first child
	// of `<html>`. The default shell always has `</head>`.
	const withGlobalCss = hasGlobalCss ? injectGlobalCssLink(rawTemplate) : rawTemplate;
	const template = withGlobalCss
		.replace(/<slot\s*><\/slot>/g, '{@raw __content}')
		.replace(/<slot\s*\/>/g, '{@raw __content}');
	const script = parsed.script ?? '';
	const authoredImports = (parsed.serverImports ?? []).join('\n');
	const manifestImport = hasGlobalCss
		? "import { resolveGlobalCssHref as __kuratchiResolveGlobalCssHref } from 'kuratchi:manifest';"
		: '';
	const moduleImports = [authoredImports, manifestImport].filter(Boolean).join('\n');
	const prelude = stripTopLevelImports(script).trim();
	const requestImportDecls = buildRequestImportDecls(parsed.requestImports ?? []);
	const body = compileTemplate(template);

	return `${moduleImports}
export const hasApp = true;
export async function render(data, __content) {
${requestImportDecls}
	const __rawHtml = (v) => (v == null ? '' : String(v));
	const __sanitizeHtml = (v) => {
		let html = __rawHtml(v);
		html = html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, '');
		html = html.replace(/<iframe\\b[^>]*>[\\s\\S]*?<\\/iframe>/gi, '');
		html = html.replace(/<object\\b[^>]*>[\\s\\S]*?<\\/object>/gi, '');
		html = html.replace(/<embed\\b[^>]*>/gi, '');
		html = html.replace(/\\son[a-z]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
		html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*([\"'])\\s*javascript:[\\s\\S]*?\\2/gi, ' $1=\"#\"');
		html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*javascript:[^\\s>]+/gi, ' $1=\"#\"');
		html = html.replace(/\\ssrcdoc\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
		return html;
	};
	const __esc = (v) => {
		if (v == null) return '';
		return String(v)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\"/g, '&quot;')
			.replace(/'/g, '&#39;');
	};

	${prelude}

	${body}
	return __html;
}
`;
}

/**
 * Inject `<link rel="stylesheet" href={__kuratchiResolveGlobalCssHref()}>`
 * immediately before the first `</head>` in the template. When the
 * template has no `</head>` (authors who ship a shell without a head),
 * the link goes right after `<html ...>` so the browser still sees it
 * before any body content.
 *
 * Idempotent: if the template already contains a rendered call to
 * `__kuratchiResolveGlobalCssHref`, we leave it alone (prevents double
 * injection on HMR).
 */
function injectGlobalCssLink(template: string): string {
	if (template.includes('__kuratchiResolveGlobalCssHref')) return template;
	const tag = `<link rel="stylesheet" href={__kuratchiResolveGlobalCssHref()} />`;
	if (/<\/head\s*>/i.test(template)) {
		return template.replace(/<\/head\s*>/i, `\t${tag}\n</head>`);
	}
	if (/<html\b[^>]*>/i.test(template)) {
		return template.replace(/(<html\b[^>]*>)/i, `$1\n${tag}`);
	}
	// No `<html>` — prepend. Produces a malformed document but at least
	// the link is in the HTML response.
	return `${tag}\n${template}`;
}

/**
 * Synthesize `const <alias> = data.<exportName> ?? <fallback>;`
 * declarations for every `kuratchi:request` import the leading script
 * referenced. Routes, layouts, and the app shell all run inside a
 * `render(data, ...)` function the dispatcher invokes per request —
 * so any file whose top <script> pulls from `kuratchi:request` needs
 * these locals to be in scope.
 */
function buildRequestImportDecls(
	requestImports: Array<{ exportName: string; alias: string }>,
): string {
	return requestImports
		.map((imp) => {
			const fallback = REQUEST_IMPORT_FALLBACKS[imp.exportName] ?? 'undefined';
			return `\tconst ${imp.alias} = data.${imp.exportName} ?? ${fallback};`;
		})
		.join('\n');
}

function transformLayoutFile(source: string): string {
	const parsed = parseFile(source);
	const rawTemplate = parsed.template ?? '';
	// Replace both styles of `<slot>` marker with the raw-content directive.
	// Kuratchi's template compiler lowers `{@raw expr}` to `__rawHtml(expr)`.
	const template = rawTemplate
		.replace(/<slot\s*><\/slot>/g, '{@raw __content}')
		.replace(/<slot\s*\/>/g, '{@raw __content}');
	const script = parsed.script ?? '';
	const moduleImports = (parsed.serverImports ?? []).join('\n');
	const prelude = stripTopLevelImports(script).trim();
	const requestImportDecls = buildRequestImportDecls(parsed.requestImports ?? []);
	const body = compileTemplate(template);

	return `${moduleImports}
export const hasLayout = true;
export async function render(data, __content) {
${requestImportDecls}
	const __rawHtml = (v) => (v == null ? '' : String(v));
	const __sanitizeHtml = (v) => {
		let html = __rawHtml(v);
		html = html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, '');
		html = html.replace(/<iframe\\b[^>]*>[\\s\\S]*?<\\/iframe>/gi, '');
		html = html.replace(/<object\\b[^>]*>[\\s\\S]*?<\\/object>/gi, '');
		html = html.replace(/<embed\\b[^>]*>/gi, '');
		html = html.replace(/\\son[a-z]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
		html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*([\"'])\\s*javascript:[\\s\\S]*?\\2/gi, ' $1=\"#\"');
		html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*javascript:[^\\s>]+/gi, ' $1=\"#\"');
		html = html.replace(/\\ssrcdoc\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
		return html;
	};
	const __esc = (v) => {
		if (v == null) return '';
		return String(v)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	};

	${prelude}

	${body}
	return __html;
}
`;
}

function transformRouteFile(
	source: string,
	importerAbsPath: string,
	clientFragments: Map<string, ClientFragment>,
): string {
	const { source: preprocessedSource, fragmentHashes } = extractClientFragments(
		source,
		importerAbsPath,
		clientFragments,
	);

	const parsed = parseFile(preprocessedSource);
	const template = parsed.template ?? '';
	const script = parsed.script ?? '';

	// Imports hoist to module scope so Vite's resolver handles them once
	// per module (via `$lib`/`$server` aliases). The prelude — the script
	// body with imports stripped — runs inside `render()` every request
	// so top-level `await` of `$server/*` calls produces per-request data.
	// (`serverRpcImports` is a subset of `serverImports`; `serverImports`
	// alone covers everything from the leading script.)
	const moduleImports = (parsed.serverImports ?? []).join('\n');
	const prelude = stripTopLevelImports(script).trim();

	// `kuratchi:request` imports are stripped by the parser (they're not
	// real import lines at runtime; they map to per-request state). We
	// synthesize the matching `const alias = data.alias || <fallback>;`
	// declarations so the leading-script body, which runs inside `render`,
	// can reference `params` / `searchParams` / `url` / etc. The Vite
	// dispatcher populates `data` with these values before calling render.
	const requestImportDecls = buildRequestImportDecls(parsed.requestImports ?? []);

	// Pass action function names so the template compiler emits
	// `<input name="_action" value="<fn>">` literals instead of
	// stringifying the function reference.
	const actionNames = new Set(parsed.actionFunctions ?? []);

	// Compile the template, then swap every extracted-fragment marker in
	// the compiled JS string-literal output with a `<script src=...>` tag
	// whose URL is resolved at RENDER TIME via `resolveClientAsset`. The
	// compiled body emits `__parts.push(\`...\`)` with backtick templates,
	// so `${resolveClientAsset('<hash>')}` becomes a real interpolation.
	let body = compileTemplate(template, new Map(), actionNames);
	for (const hash of fragmentHashes) {
		const marker = `<!--kuratchi:client-entry:${hash}-->`;
		// String-build the tag so the `${` stays literal (it's meant to
		// be a JS template-literal interpolation in the compiled output).
		const scriptTag =
			'<script type="module" src="${resolveClientAsset(' +
			JSON.stringify(hash) +
			')}"></script>';
		body = body.split(marker).join(scriptTag);
	}

	const manifestImport =
		fragmentHashes.length > 0
			? `import { resolveClientAsset } from 'kuratchi:manifest';\n`
			: '';

	// Export the action map so the request dispatcher can call server
	// functions referenced via `<form action={fn}>`. Names are preserved
	// — server module imports are hoisted at module scope, so the
	// identifiers are in lexical range at module eval time.
	const actionExportEntries = Array.from(actionNames)
		.map((name) => `\t${JSON.stringify(name)}: ${name},`)
		.join('\n');
	const actionsExport = actionExportEntries
		? `\nexport const actions = {\n${actionExportEntries}\n};\n`
		: `\nexport const actions = {};\n`;

	// Inside `render(data)`, shadow every action function identifier with
	// its per-request state object (`{ error, loading, success }`). The
	// state object is seeded on `data` by the dispatcher for every GET and
	// populated with `error` on an action failure. This makes
	// `<actionFn>.error` in the template resolve to the state, not the
	// hoisted function reference (which would always be `undefined`).
	//
	// We keep the fallback to the function itself (`?? <name>`) so bare
	// identifier usage in JSX-ish contexts like `<form action={fn}>`
	// still sees a truthy value at render time — though in practice the
	// template compiler rewrites those into string literals anyway.
	const actionStateDecls = Array.from(actionNames)
		.map(
			(name) =>
				`\tconst ${name} = (data && data[${JSON.stringify(name)}]) ?? { error: undefined, loading: false, success: false };`
		)
		.join('\n');

	// Every route imports the root-layout module. When no layout file
	// exists, `kuratchi:layout` is a no-op that returns `content` unchanged
	// (see `load` for the fallback stub), so the wrap is free. When a
	// layout exists, the route's HTML is passed in as `__content`.
	const layoutImport = `import * as __kuratchiLayout from 'kuratchi:layout';\nimport * as __kuratchiApp from 'kuratchi:app';\n`;

	// `async` so top-level `await` in the leading script (e.g. `const x =
	// await $serverFn()`) is valid inside the function body. Worker
	// callers must `await render()`.
	return `${manifestImport}${layoutImport}${moduleImports}
${actionsExport}
export async function render(data) {
	const __rawHtml = (v) => (v == null ? '' : String(v));
	const __sanitizeHtml = (v) => {
		let html = __rawHtml(v);
		html = html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, '');
		html = html.replace(/<iframe\\b[^>]*>[\\s\\S]*?<\\/iframe>/gi, '');
		html = html.replace(/<object\\b[^>]*>[\\s\\S]*?<\\/object>/gi, '');
		html = html.replace(/<embed\\b[^>]*>/gi, '');
		html = html.replace(/\\son[a-z]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
		html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*([\"'])\\s*javascript:[\\s\\S]*?\\2/gi, ' $1=\"#\"');
		html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*javascript:[^\\s>]+/gi, ' $1=\"#\"');
		html = html.replace(/\\ssrcdoc\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
		return html;
	};
	const __esc = (v) => {
		if (v == null) return '';
		return String(v)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	};

${requestImportDecls}
${actionStateDecls}

	${prelude}

	${body}
	const __routeHtml = __html;
	const __layoutHtml = await __kuratchiLayout.render(data, __routeHtml);
	return __kuratchiApp.render(data, __layoutHtml);
}

export const __kuratchiRoute = { kind: 'page' };
`;
}

/**
 * Emit the body of the `kuratchi:manifest` virtual module.
 *
 * In dev (no build manifest exists yet) the helper returns a live
 * `/@id/virtual:kuratchi-client/<hash>.ts` URL that Vite's dev server
 * transforms on demand.
 *
 * In prod, the client Rollup build runs first and writes
 * `dist/client/.vite/manifest.json`. We read it synchronously here —
 * safe because the SSR environment build runs *after* the client build
 * in Vite's default env order, so the file exists by the time this is
 * loaded. The manifest is then baked into the module as a literal
 * object; no file IO at request time.
 */
function generateManifestModule(projectRoot: string, isProduction: boolean): string {
	// Dev-server URL that Vite's module graph will serve through all
	// registered plugins (Tailwind, PostCSS, CSS Modules, …). The
	// leading `/` is a project-root-relative path; Vite resolves it
	// against the source tree and applies its transform pipeline.
	const devGlobalCssHref = '/' + GLOBAL_CSS_FILE;
	if (!isProduction) {
		return `export function resolveClientAsset(hash) {
	return '/@id/${CLIENT_VIRTUAL_PREFIX}' + hash + '.ts';
}
export function resolveGlobalCssHref() {
	return ${JSON.stringify(devGlobalCssHref)};
}
`;
	}

	const manifestPath = path.join(projectRoot, 'dist', 'client', '.vite', 'manifest.json');
	let clientMap: Record<string, string> = {};
	try {
		const raw = fs.readFileSync(manifestPath, 'utf-8');
		const manifest = JSON.parse(raw) as Record<
			string,
			{ file: string; css?: string[] }
		>;
		for (const [inputPath, entry] of Object.entries(manifest)) {
			const clientMatch = inputPath.match(
				new RegExp(`^${CLIENT_VIRTUAL_PREFIX.replace(/[/:]/g, (c) => '\\' + c)}([^.]+)\\.ts$`),
			);
			if (clientMatch) clientMap[clientMatch[1]] = '/' + entry.file;
		}
		// Global CSS href is baked in at write time by
		// `patchSsrManifestPlaceholder` — the placeholder stays an
		// empty string here so we can rewrite it to the hashed path.
	} catch {
		// Manifest absent (e.g. SSR-only build). Fall back to hash-as-path.
	}

	// Unique variable names avoid Rollup renaming under minification
	// (e.g. a collision with `kuratchi:rpc-map`'s own `MAP`), which would
	// break the post-build `writeBundle` patch that swaps the stub for
	// the real value.
	return `const __kuratchiClientAssetMap = ${JSON.stringify(clientMap)};
const __kuratchiGlobalCssHref = "";
export function resolveClientAsset(hash) {
	return __kuratchiClientAssetMap[hash] || ('/@id/${CLIENT_VIRTUAL_PREFIX}' + hash + '.ts');
}
export function resolveGlobalCssHref() {
	return __kuratchiGlobalCssHref;
}
`;
}

/**
 * Rollup's `input` accepts a string, string[], or Record<string,string>.
 * We want a stable named-input form so asset filenames stay predictable,
 * so we normalize existing input into an object and merge our fragment
 * entries into it.
 */
/**
 * Phase F: discover Kuratchi conventions (`.sandbox.ts`, `.container.ts`,
 * `.do.ts`, `.workflow.ts`, `.queue.ts`) under `serverDir` and sync the
 * results into the user's `wrangler.jsonc`. This runs at `configResolved`
 * so the Cloudflare Vite plugin sees a fully up-to-date wrangler config
 * when it reads bindings / DO classes / containers for dev + build.
 *
 * Delegates the actual wrangler mutation to `syncWranglerConfig` from
 * `@kuratchi/js/compiler` — the same code path the legacy CLI uses, so
 * the output wrangler.jsonc is byte-identical.
 */
function syncWranglerFromConventions(
	projectRoot: string,
	serverDir: string,
): { classes: ConventionClass[]; queues: QueueConsumer[]; workflows: Array<{ name: string; binding: string }> } {
	const srcDir = path.dirname(path.resolve(projectRoot, serverDir));

	const workflowConfig = discoverWorkflowFiles(projectRoot);
	const containerConfig = discoverContainerFiles(projectRoot);
	const sandboxConfig = discoverSandboxFiles(projectRoot);
	const queueConsumerConfig = discoverQueueConsumerFiles(projectRoot);
	const { config: doConfig, handlers: doHandlers } = discoverDurableObjects(srcDir);

	// Sandbox containers always run with sqlite storage (per kuratchi convention).
	// Regular containers opt in via their static `sqlite` field.
	const containerizedClassEntries = [
		...containerConfig.map((entry) => ({ ...entry, sqlite: Boolean(entry.sqlite) })),
		...sandboxConfig.map((entry) => ({ ...entry, sqlite: true })),
	];
	const containerDoConfig = containerizedClassEntries.map((entry) => ({
		binding: entry.binding,
		className: entry.className,
	}));

	// Auto-wire `assets.directory` if `src/assets/` exists. No app-level
	// config needed — authors drop files into that folder and they're
	// served at `/<filename>` in both dev and prod. Binding is always
	// `ASSETS`.
	const assetsDir = fs.existsSync(path.join(projectRoot, DEFAULT_ASSETS_DIR))
		? DEFAULT_ASSETS_DIR
		: undefined;

	syncWranglerConfig({
		projectDir: projectRoot,
		config: {
			workflows: workflowConfig,
			containers: containerizedClassEntries.map((entry) => ({
				binding: entry.binding,
				className: entry.className,
				image: entry.image,
				instanceType: entry.instanceType,
				maxInstances: entry.maxInstances,
				sqlite: entry.sqlite,
			})),
			durableObjects: [...doConfig, ...containerDoConfig],
			queues: queueConsumerConfig.map((q) => ({
				binding: q.binding,
				queueName: q.queueName,
			})),
			assetsDirectory: assetsDir,
		},
		writeFile: (filePath, content) => {
			// Mirror the CLI's "write-if-changed" behavior so we don't
			// retrigger Vite's wrangler.jsonc watcher on every dev boot.
			if (fs.existsSync(filePath)) {
				const existing = fs.readFileSync(filePath, 'utf-8');
				if (existing === content) return;
			}
			fs.writeFileSync(filePath, content, 'utf-8');
		},
	});

	// Consolidated list of convention classes the Worker must re-export.
	// DOs are imported by absolute path from their source files. Workflows
	// and containerized classes use the same shape.
	const classes: ConventionClass[] = [
		...workflowConfig.map((e) => ({
			className: e.className,
			file: path.resolve(projectRoot, e.file),
			exportKind: e.exportKind,
		})),
		...containerizedClassEntries.map((e) => ({
			className: e.className,
			file: path.resolve(projectRoot, e.file),
			exportKind: e.exportKind,
		})),
		...doHandlers
			.filter((h) => h.mode === 'class' && h.className)
			.map((h) => ({
				className: h.className!,
				file: h.absPath,
				exportKind: (h.exportKind ?? 'named') as 'named' | 'default',
			})),
	];
	const queues: QueueConsumer[] = queueConsumerConfig.map((q) => ({
		queueName: q.queueName,
		file: path.resolve(projectRoot, q.file),
		exportKind: q.exportKind,
	}));
	// Workflow registry: basename (matches `workflowStatus('<name>', ...)`)
	// → env binding name. Consumed by `generateWorkerModule` to emit a
	// `__setWorkflowRegistry(...)` call so the runtime can resolve workflow
	// instances by convention name.
	const workflows: Array<{ name: string; binding: string }> = workflowConfig.map((e) => ({
		name: path.basename(e.file).replace(/\.workflow\.ts$/, ''),
		binding: e.binding,
	}));
	return { classes, queues, workflows };
}

/**
 * Locate the user's middleware file at the single canonical location:
 * `src/middleware.ts`. Returns null if it doesn't exist — the plugin
 * emits an empty-runtime stub in that case.
 */
function resolveMiddlewareFile(projectRoot: string, _serverDir: string): string | null {
	const candidate = path.resolve(projectRoot, MIDDLEWARE_FILE);
	return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Locate `kuratchi.config.ts` (or `.js`) at the project root. Returns
 * `null` when absent — the generated migrations module then degrades
 * to a no-op, so apps without an ORM config still boot cleanly.
 */
function resolveKuratchiConfigFile(projectRoot: string): string | null {
	for (const ext of ['ts', 'js', 'mjs']) {
		const candidate = path.join(projectRoot, `kuratchi.config.${ext}`);
		if (fs.existsSync(candidate)) return candidate;
	}
	return null;
}

/**
 * Emit the `kuratchi:migrations` virtual module source.
 *
 * Strategy: import the user's `kuratchi.config` default export and walk
 * `orm.databases` at runtime. For each entry we invoke
 * `runMigrations({ execute, schema })` exactly once per isolate, gated
 * by a module-scoped `__migrated` flag. Matches the legacy CLI's
 * `__runMigrations()` semantics but keeps the code in ONE place (the
 * generated module) rather than injected piecewise into the worker
 * entry — easier to reason about and watch for config changes.
 */
function generateMigrationsModule(configPath: string | null): string {
	if (!configPath) {
		return [
			'// No kuratchi.config.{ts,js,mjs} found at project root.',
			'// Auto-migration disabled; `ensureMigrations` is a no-op.',
			'export async function ensureMigrations() {}',
			'',
		].join('\n');
	}

	const importSpecifier = JSON.stringify(configPath);
	return `import __kuratchiConfig from ${importSpecifier};
import { runMigrations } from '@kuratchi/orm/migrations';

let __migrated = false;

export async function ensureMigrations(env) {
	if (__migrated) return;
	__migrated = true;

	const databases = __kuratchiConfig?.orm?.databases ?? {};
	for (const [binding, entry] of Object.entries(databases)) {
		const d1 = env[binding];
		if (!d1) continue;
		const schema = entry?.schema;
		if (!schema) continue;
		try {
			const execute = (sql, params) => {
				let stmt = d1.prepare(sql);
				if (params?.length) stmt = stmt.bind(...params);
				return stmt.all().then((r) => ({
					success: r.success ?? true,
					data: r.results,
					results: r.results,
				}));
			};
			const result = await runMigrations({ execute, schema });
			if (result.applied) {
				console.log('[kuratchi] ' + binding + ': migrated (' + result.statementsRun + ' statements)');
			}
			if (result.warnings?.length) {
				result.warnings.forEach((w) => console.warn('[kuratchi] ' + binding + ': ' + w));
			}
		} catch (err) {
			// Don't poison the isolate — log and let the flag stay set so
			// we don't storm the DB with retries on every request. A
			// malformed schema typically surfaces on the next edit via
			// Vite HMR restarting the worker.
			console.error('[kuratchi] ' + binding + ' migration failed:', err?.message ?? err);
		}
	}
}
`;
}

/**
 * Create `src/worker.ts` with a canonical re-export of the synthesized
 * `kuratchi:worker` module if it doesn't already exist. Matches the
 * legacy CLI's convention so projects scaffolded by either path have
 * the same entrypoint shape.
 *
 * We never overwrite — once the file exists, the developer owns it,
 * and appending would risk losing their customizations. If they need
 * the stub back, they can delete the file and rerun dev/build.
 */
function ensureWorkerEntry(projectRoot: string): void {
	const workerPath = path.join(projectRoot, 'src', 'worker.ts');
	if (fs.existsSync(workerPath)) return;
	const srcDir = path.dirname(workerPath);
	if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
	const source = `// Auto-generated by @kuratchi/vite on first dev/build.
// Re-exports the synthesized \`kuratchi:worker\` module so Cloudflare
// sees every discovered convention class (workflows, durable objects,
// sandboxes, containers) as a named export off this entry, and the
// default export wires \`fetch\` through the Kuratchi dispatcher.
//
// You can add custom code to this file (e.g. \`scheduled\` handlers);
// the plugin will never overwrite it once it exists. Delete it to
// regenerate.

// @ts-expect-error — virtual module provided by \`@kuratchi/vite\` at build time.
export { default } from 'kuratchi:worker';
// @ts-expect-error — virtual module provided by \`@kuratchi/vite\` at build time.
export * from 'kuratchi:worker';
`;
	fs.writeFileSync(workerPath, source, 'utf-8');
}

function mergeRollupInputs(
	existing: string | string[] | Record<string, string> | undefined,
	additions: Record<string, string>,
): Record<string, string> {
	if (!existing) return { ...additions };
	if (typeof existing === 'string') {
		return { main: existing, ...additions };
	}
	if (Array.isArray(existing)) {
		const asObject: Record<string, string> = {};
		for (const entry of existing) {
			const key = path.basename(entry).replace(/\.[^.]+$/, '');
			asObject[key] = entry;
		}
		return { ...asObject, ...additions };
	}
	return { ...existing, ...additions };
}


/**
 * Locate the real file backing `$server/<subpath>` using `serverDir`
 * (default `src/server`). Checks `.ts`, `.js`, and index files. Returns
 * `null` if nothing matches — callers treat that as "stub with zero
 * functions" so the module is still valid JS.
 */
function resolveServerFile(
	projectRoot: string,
	serverDir: string,
	subpath: string,
): string | null {
	const base = path.resolve(projectRoot, serverDir, subpath);
	const candidates = [
		base,
		base + '.ts',
		base + '.js',
		base + '.mjs',
		path.join(base, 'index.ts'),
		path.join(base, 'index.js'),
	];
	for (const candidate of candidates) {
		if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
	}
	return null;
}

/**
 * Walk a TypeScript source file's AST to collect every exported
 * identifier name. We need this to generate the right number of RPC
 * stub exports — a Proxy-catch-all would work at runtime but break
 * Rollup's static import-analysis in the client bundle.
 *
 * Supports: `export function x`, `export const y`, `export class Z`,
 * `export { a, b }`, `export default <expr>`. For `export default`,
 * the stub exports a `default` binding (callable the same way).
 */
function collectExportedNames(sourceFile: string): string[] {
	if (!fs.existsSync(sourceFile)) return [];
	const source = fs.readFileSync(sourceFile, 'utf-8');
	const sf = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true);
	const names = new Set<string>();
	for (const stmt of sf.statements) {
		if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
			for (const spec of stmt.exportClause.elements) {
				names.add((spec.name as ts.Identifier).text);
			}
			continue;
		}
		const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
		if (!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
		const hasDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
		if (hasDefault) {
			names.add('default');
			continue;
		}
		if (ts.isFunctionDeclaration(stmt) && stmt.name) names.add(stmt.name.text);
		else if (ts.isClassDeclaration(stmt) && stmt.name) names.add(stmt.name.text);
		else if (ts.isVariableStatement(stmt)) {
			for (const decl of stmt.declarationList.declarations) {
				if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
			}
		}
	}
	return Array.from(names);
}

/**
 * Emit the SSR-only `kuratchi:rpc-map` module. Every `$server/<subpath>`
 * specifier the client env has referenced is statically imported here
 * (as a wildcard namespace) and exposed via a `lookup(subpath)` helper
 * the dispatcher uses at request time.
 *
 * Static imports are critical for Rollup / Worker bundling: a dynamic
 * `import('$server/' + subpath)` can't be resolved at build time, which
 * is why the dispatcher delegates to this map instead of importing
 * server modules itself.
 */
function generateRpcMapModule(
	projectRoot: string,
	serverDir: string,
	referenced: Set<string>,
): string {
	const entries = Array.from(referenced).filter((subpath) => {
		const file = resolveServerFile(projectRoot, serverDir, subpath);
		return file !== null;
	});
	const imports = entries
		.map((subpath, i) => `import * as __rpc_${i} from '$server/${subpath}';`)
		.join('\n');
	const mapEntries = entries
		.map((subpath, i) => `\t${JSON.stringify(subpath)}: __rpc_${i}`)
		.join(',\n');
	return `${imports}

const MAP = {
${mapEntries}
};

export function lookup(subpath) {
	return MAP[subpath] || null;
}
`;
}

/**
 * Emit a client-safe stub module for `$server/<subpath>`. Each exported
 * identifier becomes an async function that POSTs JSON-serialized args
 * to `/__kuratchi/rpc/<subpath>/<name>`; the dispatcher (see
 * `DISPATCH_MODULE_SOURCE`) imports the real module server-side and
 * invokes the function with the deserialized args.
 *
 * Non-function exports become the same shape — the server dispatcher
 * returns their current value if they're not callable, which matches
 * the typical usage pattern (`await getCurrentUser()` over a `locals`
 * constant, etc.).
 */
function generateRpcStubModule(subpath: string, serverFile: string | null): string {
	const names = serverFile ? collectExportedNames(serverFile) : [];
	const rpcBase = RPC_DISPATCH_PATH + subpath + '/';
	const stubs = names.map((name) => {
		const url = rpcBase + name;
		if (name === 'default') {
			return `async function __default(...args) {
	const res = await fetch(${JSON.stringify(url)}, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(args),
	});
	if (!res.ok) throw new Error('RPC failed: ' + res.status);
	return res.json();
}
export default __default;`;
		}
		return `export async function ${name}(...args) {
	const res = await fetch(${JSON.stringify(url)}, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(args),
	});
	if (!res.ok) throw new Error('RPC failed: ' + res.status);
	return res.json();
}`;
	});
	return `// RPC stub for $server/${subpath} — generated by @kuratchi/vite
${stubs.join('\n\n')}
`;
}

/**
 * Emit the body of the `kuratchi:worker` virtual module — the full
 * worker entry the user's `src/worker.ts` re-exports.
 *
 * Generates:
 *   - Named imports of every convention class from their source files.
 *   - Named queue-handler imports (one per .queue.ts consumer), shimmed
 *     so the default export's `queue(batch, env, ctx)` can dispatch by
 *     queue name.
 *   - `export default { fetch, queue? }` wired to the dispatcher.
 *   - `export { ClassA, ClassB, ... }` for Cloudflare to resolve bindings.
 *
 * Paths are absolute so Vite/Rollup resolve them against the host app's
 * node_modules + source tree (they DON'T go through the plugin's require
 * context — these are the user's own files).
 */
function generateWorkerModule(
	classes: ConventionClass[],
	queues: QueueConsumer[],
	workflows: Array<{ name: string; binding: string }> = [],
): string {
	const classImports: string[] = [];
	const classExports: string[] = [];
	for (const c of classes) {
		if (c.exportKind === 'default') {
			classImports.push(
				`import ${c.className} from ${JSON.stringify(c.file)};`,
			);
		} else {
			classImports.push(
				`import { ${c.className} } from ${JSON.stringify(c.file)};`,
			);
		}
		classExports.push(c.className);
	}

	const queueImports: string[] = [];
	const queueCases: string[] = [];
	queues.forEach((q, i) => {
		const local = `__queueHandler${i}`;
		if (q.exportKind === 'default') {
			queueImports.push(`import ${local} from ${JSON.stringify(q.file)};`);
		} else {
			queueImports.push(
				`import { queue as ${local} } from ${JSON.stringify(q.file)};`,
			);
		}
		queueCases.push(
			`    case ${JSON.stringify(q.queueName)}: return ${local}(batch, env, ctx);`,
		);
	});

	const queueBlock = queues.length
		? `,
	async queue(batch, env, ctx) {
		switch (batch.queue) {
${queueCases.join('\n')}
			default:
				console.warn('[kuratchi] No queue handler registered for:', batch.queue);
		}
	}`
		: '';

	const exportsLine = classExports.length
		? `\nexport { ${classExports.join(', ')} };\n`
		: '';

	// Workflow registry init. The runtime's `workflowStatus(name, id)` looks
	// up the convention name (e.g. 'container' for `container.workflow.ts`)
	// in this map to find the env binding, then calls `env[binding].get(id)`.
	// Without this, `workflowStatus()` short-circuits with a "no workflows
	// registered" error, marking polling as terminal immediately and
	// breaking the workflowStatus({ poll }) live-refresh contract.
	const workflowRegistryBlock = workflows.length
		? `\nimport { __setWorkflowRegistry as __kuratchiSetWorkflowRegistry } from '@kuratchi/js/runtime/workflow.js';\n__kuratchiSetWorkflowRegistry({\n${workflows
				.map((w) => `\t${JSON.stringify(w.name)}: { binding: ${JSON.stringify(w.binding)} },`)
				.join('\n')}\n});\n`
		: '';

	return `import { handle as __kuratchiHandle } from 'kuratchi:dispatch';
${classImports.join('\n')}
${queueImports.join('\n')}
${workflowRegistryBlock}
export default {
	fetch: (request, env, ctx) => __kuratchiHandle(request, env, ctx)${queueBlock},
};
${exportsLine}`;
}

function generateRoutesModule(routes: DiscoveredRoute[]): string {
	const imports = routes
		.map((r, i) => `import * as r${i} from ${JSON.stringify(r.absPath)};`)
		.join('\n');
	const entries = routes
		.map(
			(r, i) =>
				`  { pattern: ${JSON.stringify(r.urlPattern)}, module: r${i} }`,
		)
		.join(',\n');
	return `${imports}\n\nexport const routes = [\n${entries}\n];\n`;
}
