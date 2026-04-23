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
	buildVirtualModuleTypeDeclarations,
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
 *
 * `dispatch.js` imports `./invoke-action.js` so the action-dispatch
 * calling convention can be unit-tested in isolation (Bun can't resolve
 * the virtual `kuratchi:routes` / `kuratchi:middleware` modules that
 * the rest of `dispatch.js` transitively pulls in, but a pure helper
 * in its own file is testable directly). Rollup can't resolve that
 * relative import when the dispatcher is injected as a virtual module,
 * so we inline the helper's body here at plugin-load time.
 */
let cachedDispatchSource: string | null = null;
function loadDispatchSource(): string {
	if (cachedDispatchSource !== null) return cachedDispatchSource;
	const dispatchPath = new URL('./runtime/dispatch.js', import.meta.url);
	const invokeActionPath = new URL('./runtime/invoke-action.js', import.meta.url);
	const dispatchSrc = fs.readFileSync(dispatchPath, 'utf-8');
	const invokeActionSrc = fs.readFileSync(invokeActionPath, 'utf-8');
	// Drop the import line and inline the helper's source in its place.
	// Exact-match replacement — if anyone ever changes the spec or the
	// line shape in dispatch.js they'll notice immediately because this
	// throws instead of silently producing a broken bundle.
	const importLineRe = /^import\s+\{\s*invokeAction\s*\}\s+from\s+'\.\/invoke-action\.js';\s*$/m;
	if (!importLineRe.test(dispatchSrc)) {
		throw new Error(
			"[kuratchi/vite] dispatch.js no longer contains the expected `import { invokeAction } from './invoke-action.js'` line. " +
			"Update the inlining pattern in `loadDispatchSource()` to match.",
		);
	}
	// Strip `export` keywords from the helper source because they're
	// meaningless (and disallowed) inside a top-level module body that
	// already has its own exports. `invokeAction` just becomes a local
	// binding visible to the rest of dispatch.js.
	const invokeActionBody = invokeActionSrc.replace(/^export\s+/gm, '');
	cachedDispatchSource = dispatchSrc.replace(
		importLineRe,
		'// --- inlined from ./invoke-action.js (see `loadDispatchSource` in @kuratchi/vite/src/index.ts) ---\n' +
		invokeActionBody +
		'// --- end inlined invoke-action.js ---\n',
	);
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

const ROUTE_LAYOUT_FILENAME = 'layout' + ROUTE_EXT;
function isRouteLayoutFile(filePath: string): boolean {
	return path.basename(filePath) === ROUTE_LAYOUT_FILENAME;
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
 * Per-layout virtual module prefix for nested layouts.
 *
 * Every discovered `layout.kuratchi` under `routes/` gets its own
 * virtual module at `kuratchi:layout/<hash>` where `<hash>` is a
 * stable digest of the layout file's absolute path. Routes import
 * the full chain of layouts that wrap them and compose them at
 * render time.
 *
 * The legacy single-id `kuratchi:layout` still resolves — it maps
 * to whichever layout lives at `routes/layout.kuratchi` (the root).
 * Subdirectory layouts are only reachable via the nested id.
 */
const NESTED_LAYOUT_VIRTUAL_PREFIX = 'kuratchi:layout/';

/**
 * Stable 10-char hash derived from a layout file's absolute path.
 * Used to form the nested-layout virtual id and the local binding
 * name routes use to reference the layout module. Keyed on path
 * (not content) so cache-busting happens naturally when Vite rebuilds
 * the layout module and routes pick up the new output without the
 * route module's content hash changing.
 */
function layoutModuleHash(layoutAbsPath: string): string {
	return crypto.createHash('sha1').update(layoutAbsPath).digest('hex').slice(0, 10);
}

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
 * The user default-exports a `MiddlewareDefinition` (map of step names →
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
 * Stable fragment hash for the shared client-event bridge. The bridge
 * source is a single framework-owned string and doesn't vary per route,
 * so a fixed identifier is fine — Vite hashes the compiled asset
 * filename when the content changes, which is what actually drives
 * browser cache busting. The `bridge` prefix makes the fragment easy
 * to spot in bundle listings: `kuratchi-client-bridge.<vite-hash>.js`.
 */
const CLIENT_BRIDGE_HASH = 'bridge';

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
	/**
	 * `body`   — a template-body `<script>` block (the original, default kind).
	 *            Served verbatim to Vite.
	 *
	 * `leading` — the leading `<script>` block of a route. The plugin
	 *            extracts this as a client fragment too so the same code the
	 *            SSR runs also runs in the browser. `source` here is the
	 *            BROWSER-SHAPE transform — top-level `const X = await …` is
	 *            replaced with `const X = __kuratchiData?.X` so references
	 *            to SSR-resolved values keep working, and imports of virtual
	 *            modules like `kuratchi:request` / `kuratchi:environment`
	 *            are inlined as serialized consts.
	 *
	 * `bridge`  — the single shared client-event bridge module. Registered
	 *            once in `configResolved`, referenced by hash from every
	 *            route that has any `on<event>={…}` attribute. Emitting
	 *            this as its own asset (rather than appending it to every
	 *            leading fragment) lets the browser cache ~1 kB of
	 *            identical code once across the whole app.
	 */
	kind?: 'body' | 'leading' | 'bridge';
	/**
	 * For `leading` fragments: names of SSR-resolved top-level vars that
	 * must be serialized into `window.__kuratchiData` at render time so the
	 * client can read them. Empty for `body` fragments.
	 */
	hydrateVars?: string[];
	/**
	 * For `leading` fragments: the shared event-handler registry, created
	 * during `extractClientFragments` (pre-scan) and consulted during
	 * `compileTemplate` (transform) via `options.clientRouteRegistry`.
	 *
	 * The registry is pre-populated from a regex scan of the template so
	 * the handler ids (`h0`, `h1`, …) are stable between pre-scan and
	 * compile, and the handler-registration source is appended to the
	 * fragment's browser source at registration time — before the client
	 * Rollup build starts loading the fragment.
	 */
	handlerRegistry?: ViteClientRouteRegistry;
	/**
	 * For `leading` fragments: does this route need the shared client
	 * bridge loaded? True when the template contains any `on<event>={…}`
	 * attribute (either a client handler or a server-action callee) and
	 * the registered handlers need `window.__kuratchiClient` present,
	 * OR when any button relies on the bridge's `data-action-event`
	 * POST path. Read by the route emitter to decide whether to emit
	 * the shared-bridge `<script>` tag.
	 */
	needsBridge?: boolean;
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

/**
 * Virtual stylesheet that bundles framework-level global CSS — rules every
 * Kuratchi app should get regardless of whether it ships its own app.css.
 * Currently just the default cross-document view-transition rule; additions
 * here should be conservative and unopinionated (no colors, no resets).
 * The shim at `GLOBAL_CSS_VIRTUAL_ID` imports this *before* the user's
 * app.css so user rules always win via source order.
 */
const FRAMEWORK_CSS_VIRTUAL_ID = 'virtual:kuratchi-framework-css.css';
const FRAMEWORK_CSS_SOURCE = `@view-transition { navigation: auto; }\n`;
const GENERATED_TYPES_FILE = path.join('src', 'kuratchi.d.ts');

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
	 * Every `layout.kuratchi` found at any depth under `routes/`.
	 * Populated in `configResolved`. Each layout is served through a
	 * virtual module keyed by a stable hash of its absolute path;
	 * routes import the chain of layouts that wrap them in
	 * outermost-first order and compose them innermost-first at
	 * render time. See `layoutChainForRoute` + the route emission code.
	 */
	let allLayoutPaths: string[] = [];
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
			ensureKuratchiTypes(root, []);
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
			// Discover every `layout.kuratchi` under `routes/`. The root
			// layout remains accessible as `rootLayoutPath` for back-compat
			// with the legacy-shell detection; nested layouts are picked
			// up per route at emission time via `layoutChainForRoute`.
			allLayoutPaths = discoverAllLayouts(projectRoot, options.routesDir);
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
			ensureKuratchiTypes(projectRoot, workflowRegistry.map((workflow) => workflow.name));
			// Pre-scan routes to extract every template-body `<script>` block
			// BEFORE the client-env Rollup build starts. Each fragment is
			// registered with a stable content-hash id; the fragment id is
			// then added to the client environment's Rollup input so Rollup
			// emits a hashed asset per fragment (prod) and the manifest maps
			// virtual-id → output URL.
			for (const route of routes) {
				try {
					const source = await fs.promises.readFile(route.absPath, 'utf-8');
					extractClientFragments(source, route.absPath, clientFragments, isProduction);
				} catch {
					// Routes unreadable at config time (permissions/moves) will
					// surface later in `load` where the user gets a real error.
				}
			}

			// Register the shared client-event bridge as its own fragment.
			// One asset per app, referenced from every route that emits
			// `on<event>={…}` attributes. `importerAbsPath` is set to the
			// project root as a sentinel — `load()` only uses it for HMR
			// watch-file registration and the bridge never changes at
			// runtime so the sentinel is fine.
			clientFragments.set(CLIENT_BRIDGE_HASH, {
				source: CLIENT_HANDLER_BRIDGE_SOURCE,
				importerAbsPath: projectRoot,
				kind: 'bridge',
			});

			// Scan every extracted fragment for `$server/<path>` imports
			// up front. Populating `rpcReferencedModules` BEFORE the SSR
			// build starts ensures `kuratchi:rpc-map` has static imports
			// to every server module the client might RPC into.
			for (const fragment of clientFragments.values()) {
				// NB: use `[\s\S]+?` to tolerate multi-line named-import lists
				// — `.+` does not cross newlines and would miss any import with
				// the form `import { a,\n b } from '$server/...'`, which is
				// how most hand-authored routes break up long lists.
				const importRe = /import\s+[\s\S]+?from\s+['"]\$server\/([^'"]+)['"]/g;
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
			// Nested-layout virtual id: `kuratchi:layout/<hash>` resolves
			// to the same id with a null-byte marker so the browser
			// can't accidentally fetch it. The `load` hook below pulls
			// the hash back out and reads the matching file from disk.
			if (id.startsWith(NESTED_LAYOUT_VIRTUAL_PREFIX)) return '\0' + id;
			if (id === VIRTUAL_APP_ID) return RESOLVED_VIRTUAL_APP_ID;
			if (id === VIRTUAL_WORKER_ID) return RESOLVED_VIRTUAL_WORKER_ID;
			if (id === VIRTUAL_RPC_MAP_ID) return RESOLVED_VIRTUAL_RPC_MAP_ID;
			if (id === VIRTUAL_MIDDLEWARE_ID) return RESOLVED_VIRTUAL_MIDDLEWARE_ID;
			if (id === VIRTUAL_MIGRATIONS_ID) return RESOLVED_VIRTUAL_MIGRATIONS_ID;
			if (id.startsWith(CLIENT_VIRTUAL_PREFIX)) return id;
			if (id.startsWith(RPC_VIRTUAL_PREFIX)) return id;
			if (id === GLOBAL_CSS_VIRTUAL_ID) return id;
			if (id === FRAMEWORK_CSS_VIRTUAL_ID) return id;

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
			// Nested layout virtual module: `\0kuratchi:layout/<hash>`.
			// Look up the layout path by hash and compile it the same
			// way as the root layout. Each nested layout is a self-
			// contained fragment with its own leading `<script>` and a
			// `<slot></slot>` that becomes the wrapped child content.
			if (id.startsWith('\0' + NESTED_LAYOUT_VIRTUAL_PREFIX)) {
				const hash = id.slice(('\0' + NESTED_LAYOUT_VIRTUAL_PREFIX).length);
				const layoutPath = allLayoutPaths.find((p) => layoutModuleHash(p) === hash);
				if (!layoutPath) {
					return 'export const hasLayout = false;\nexport const render = async (_data, content) => content;\n';
				}
				this.addWatchFile(layoutPath);
				const source = await fs.promises.readFile(layoutPath, 'utf-8');
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
			// Global-CSS virtual shim: imports the framework baseline
			// (view-transitions etc.) *then* the user's `src/app.css` so
			// Rollup treats it as an entry and Vite's plugins run
			// (Tailwind, PostCSS, CSS Modules, etc.). The emitted hashed
			// `.css` output is linked from the shell automatically. Source
			// order matters — user rules come last so they always win over
			// the framework defaults.
			if (id === GLOBAL_CSS_VIRTUAL_ID) {
				const absPath = path.resolve(projectRoot, GLOBAL_CSS_FILE);
				this.addWatchFile(absPath);
				return `import ${JSON.stringify(FRAMEWORK_CSS_VIRTUAL_ID)};\nimport ${JSON.stringify(absPath)};\n`;
			}
			// Framework baseline CSS — served as an inline stylesheet. Kept
			// deliberately tiny and opinion-free; app.css still owns all
			// app-specific styling.
			if (id === FRAMEWORK_CSS_VIRTUAL_ID) {
				return FRAMEWORK_CSS_SOURCE;
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
				// Compute the layout chain for this route from the full
				// discovered list. The chain excludes the route file
				// itself (never wraps yourself) and a layout's own
				// ancestors (a layout renders its own ancestor chain in
				// the compiled route call, so a layout module doesn't
				// wrap itself again here).
				const routesAbsDir = path.resolve(projectRoot, options.routesDir);
				const chain = isRouteLayoutFile(fileId)
					? []
					: layoutChainForRoute(fileId, allLayoutPaths, routesAbsDir);
				return transformRouteFile(source, fileId, clientFragments, isProduction, chain);
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
	const ssrDir = path.join(projectRoot, 'dist', 'ssr');
	if (!fs.existsSync(clientManifestPath) || !fs.existsSync(ssrDir)) return;

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

	// Collect all JS files in the SSR output. The Cloudflare Vite plugin
	// moved the worker entrypoint from `dist/ssr/index.js` to
	// `dist/ssr/assets/worker-entry-<hash>.js` in v1+, so we can't
	// target a single well-known path any more — walk the tree and
	// rewrite every bundle that contains the stub consts. The consts
	// are unique enough that there's no ambiguity.
	const ssrFiles: string[] = [];
	const walkJs = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walkJs(full);
			else if (entry.isFile() && full.endsWith('.js')) ssrFiles.push(full);
		}
	};
	walkJs(ssrDir);

	const clientLiteral = JSON.stringify(clientMap);
	const hrefLiteral = JSON.stringify(globalCssHref);
	for (const file of ssrFiles) {
		const bundleSource = fs.readFileSync(file, 'utf-8');
		// Rollup may rename the const under minification if a collision
		// exists, so we match both the original name and the `$N` suffix
		// variants Rollup emits for collisions.
		let patched = bundleSource;
		if (Object.keys(clientMap).length > 0) {
			patched = patched.replace(
				/const (__kuratchiClientAssetMap(?:\$\d+)?)\s*=\s*\{\};/g,
				(_m, name) => `const ${name} = ${clientLiteral};`,
			);
			// Minifiers may drop `const` in favor of a top-level assignment
			// or a bare identifier-equals pair. Handle those shapes too.
			patched = patched.replace(
				/(__kuratchiClientAssetMap(?:\$\d+)?)\s*=\s*\{\}/g,
				(_m, name) => `${name} = ${clientLiteral}`,
			);
		}
		if (globalCssHref) {
			patched = patched.replace(
				/const (__kuratchiGlobalCssHref(?:\$\d+)?)\s*=\s*""\s*;/g,
				(_m, name) => `const ${name} = ${hrefLiteral};`,
			);
			patched = patched.replace(
				/(__kuratchiGlobalCssHref(?:\$\d+)?)\s*=\s*""/g,
				(_m, name) => `${name} = ${hrefLiteral}`,
			);
		}
		if (patched !== bundleSource) {
			fs.writeFileSync(file, patched);
		}
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
 * Walk the routes tree and collect every `layout.kuratchi` at any depth.
 * The root layout (`routes/layout.kuratchi`) is included.
 *
 * Returns absolute paths. The caller builds a per-route chain by
 * filtering this list down to ancestors of each route; see
 * `layoutChainForRoute`.
 */
function discoverAllLayouts(projectRoot: string, routesDir: string): string[] {
	const abs = path.resolve(projectRoot, routesDir);
	const out: string[] = [];
	const visit = (dir: string) => {
		if (!fs.existsSync(dir)) return;
		const candidate = path.join(dir, ROUTE_LAYOUT_BASENAME + ROUTE_EXT);
		if (fs.existsSync(candidate)) out.push(candidate);
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) visit(path.join(dir, entry.name));
		}
	};
	visit(abs);
	return out;
}

/**
 * Given a route file's absolute path, return the ordered chain of
 * layouts that wrap it, outermost first. A layout at
 * `routes/foo/layout.kuratchi` wraps every route under `routes/foo/**`.
 *
 * Output contract:
 *   chain[0]  — outermost layout (closest to the root)
 *   chain[n]  — innermost layout (deepest directory)
 *
 * Composition at render time is the reverse: the innermost layout
 * wraps the route's HTML first, then the next one out, then the
 * outermost. See the route-emission code for the wrapping order.
 */
function layoutChainForRoute(
	routeAbsPath: string,
	allLayouts: string[],
	routesAbsDir: string,
): string[] {
	// Pick every layout whose directory is an ancestor of the route
	// (including the layout's own directory, so a page at
	// `routes/foo/index.kuratchi` gets wrapped by
	// `routes/foo/layout.kuratchi`). Eligibility is: the layout's
	// directory must contain the route file's directory, AND the
	// route must live under `routesAbsDir` at all.
	const routeDir = path.dirname(routeAbsPath);
	if (!isPathWithin(routeDir, routesAbsDir)) return [];
	const eligible = allLayouts.filter((layoutPath) => {
		const layoutDir = path.dirname(layoutPath);
		return isPathWithin(routeDir, layoutDir);
	});
	// Sort outermost → innermost. Shorter directory path = outer.
	eligible.sort((a, b) => path.dirname(a).length - path.dirname(b).length);
	return eligible;
}

/**
 * True when `descendant` is `ancestor` itself or any subdirectory of it.
 * Used by `layoutChainForRoute` to pick ancestor layouts.
 */
function isPathWithin(descendant: string, ancestor: string): boolean {
	const rel = path.relative(ancestor, descendant);
	return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
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
 * Stable hash for the leading script of a given route file. Derived from
 * the route's absolute path only — not the script body — so the same
 * route always produces the same fragment id even across edits. The
 * content hash is not needed: the leading fragment has a 1:1 relationship
 * with its route, and Vite re-bundles on content change anyway.
 */
function leadingScriptHash(importerAbsPath: string): string {
	return crypto
		.createHash('sha1')
		.update('leading:' + importerAbsPath)
		.digest('hex')
		.slice(0, 12);
}

/**
 * Inspect the leading-script source and return the names of every
 * top-level declaration whose initializer reaches an `await` at module
 * evaluation time. Those are the SSR-resolved values the server computes
 * per request; we serialize them into the HTML payload so the client
 * copy of the script can read them without re-running the work.
 *
 * Supported initializer shapes:
 *   const X = await fn();                           // direct
 *   const X = cond ? await fn() : other;            // ternary (either branch)
 *   const X = cond ? other : await fn();
 *   const X = (await fn());                         // parenthesized
 *   const X = (a, await fn());                      // sequence (rare)
 *
 * Nested awaits inside arrow bodies / functions / blocks are NOT
 * collected — those don't fire at module-eval time.
 */
function initializerContainsTopLevelAwait(expr: ts.Expression): boolean {
	if (ts.isAwaitExpression(expr)) return true;
	if (ts.isParenthesizedExpression(expr)) {
		return initializerContainsTopLevelAwait(expr.expression);
	}
	if (ts.isConditionalExpression(expr)) {
		return (
			initializerContainsTopLevelAwait(expr.whenTrue) ||
			initializerContainsTopLevelAwait(expr.whenFalse)
		);
	}
	if (ts.isBinaryExpression(expr)) {
		// Logical / nullish short-circuit: `x ?? await fn()`, `x || await fn()`.
		const op = expr.operatorToken.kind;
		if (
			op === ts.SyntaxKind.QuestionQuestionToken ||
			op === ts.SyntaxKind.AmpersandAmpersandToken ||
			op === ts.SyntaxKind.BarBarToken ||
			op === ts.SyntaxKind.CommaToken
		) {
			return (
				initializerContainsTopLevelAwait(expr.left) ||
				initializerContainsTopLevelAwait(expr.right)
			);
		}
		return false;
	}
	return false;
}

/**
 * Walk the subtree under `node` (without crossing into nested functions,
 * arrow bodies, class/method bodies — those don't execute at module-eval
 * time) and report whether any `await` expression lives within. Used to
 * classify top-level statements: anything that contains an await is SSR-
 * only work and gets stripped from the browser bundle.
 */
function containsAwaitInControlFlow(node: ts.Node): boolean {
	if (ts.isAwaitExpression(node)) return true;
	// Stop at any construct that creates a new callable boundary. `await`
	// inside a function body will fire only if the function is invoked,
	// which we can't know statically — err on the side of preserving.
	if (
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node) ||
		ts.isConstructorDeclaration(node) ||
		ts.isClassDeclaration(node) ||
		ts.isClassExpression(node)
	) {
		return false;
	}
	let found = false;
	node.forEachChild((child) => {
		if (found) return;
		if (containsAwaitInControlFlow(child)) found = true;
	});
	return found;
}

/**
 * Walk the subtree under `node` (same "no-function-body" rule as above)
 * and collect every identifier that appears as the LHS of an assignment
 * (plain `=`, compound `+=`, `-=`, etc.) or as the operand of `++`/`--`.
 * Only bare identifiers are collected — property-access targets like
 * `obj.field = …` are ignored (they mutate the object the hydrated
 * binding points to, not the binding itself, so hydration still works).
 */
function collectReassignedIdentifiers(node: ts.Node, out: Set<string>): void {
	if (
		ts.isFunctionDeclaration(node) ||
		ts.isFunctionExpression(node) ||
		ts.isArrowFunction(node) ||
		ts.isMethodDeclaration(node) ||
		ts.isGetAccessorDeclaration(node) ||
		ts.isSetAccessorDeclaration(node) ||
		ts.isConstructorDeclaration(node) ||
		ts.isClassDeclaration(node) ||
		ts.isClassExpression(node)
	) {
		return;
	}
	if (ts.isBinaryExpression(node)) {
		const op = node.operatorToken.kind;
		const isAssignmentOp =
			op === ts.SyntaxKind.EqualsToken ||
			op === ts.SyntaxKind.PlusEqualsToken ||
			op === ts.SyntaxKind.MinusEqualsToken ||
			op === ts.SyntaxKind.AsteriskEqualsToken ||
			op === ts.SyntaxKind.SlashEqualsToken ||
			op === ts.SyntaxKind.PercentEqualsToken ||
			op === ts.SyntaxKind.AmpersandEqualsToken ||
			op === ts.SyntaxKind.BarEqualsToken ||
			op === ts.SyntaxKind.CaretEqualsToken ||
			op === ts.SyntaxKind.QuestionQuestionEqualsToken ||
			op === ts.SyntaxKind.AmpersandAmpersandEqualsToken ||
			op === ts.SyntaxKind.BarBarEqualsToken ||
			op === ts.SyntaxKind.LessThanLessThanEqualsToken ||
			op === ts.SyntaxKind.GreaterThanGreaterThanEqualsToken ||
			op === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken;
		if (isAssignmentOp && ts.isIdentifier(node.left)) {
			out.add(node.left.text);
		}
	}
	if (
		(ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
		(node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken) &&
		ts.isIdentifier(node.operand)
	) {
		out.add(node.operand.text);
	}
	node.forEachChild((child) => collectReassignedIdentifiers(child, out));
}

export interface LeadingHydrateTargets {
	/**
	 * Top-level `const|let|var X = await …` identifiers (plus ternary /
	 * short-circuit variants). The initializer itself reaches an `await`
	 * at module-eval time — the entire declaration is rewritten on the
	 * client to read from the hydrate payload.
	 */
	initAwaitVars: string[];
	/**
	 * Top-level `let X = <literal>` identifiers (or `let X;`) that are
	 * reassigned from within a statement whose body contains an `await`.
	 * These are the "imperative SSR lets" pattern — declared with a
	 * placeholder, mutated inside `if/try/…` blocks that do async work.
	 * The client rewrite is: keep the declaration, seed its initializer
	 * from the hydrate payload (falling back to the original init so
	 * unhydrated reruns don't crash), then strip the async blocks that
	 * mutate it since those values are already the SSR-final values.
	 */
	reassignedLets: string[];
}

function collectLeadingHydrateTargets(scriptBody: string): LeadingHydrateTargets {
	const empty: LeadingHydrateTargets = { initAwaitVars: [], reassignedLets: [] };
	if (!scriptBody.trim()) return empty;
	let sourceFile: ts.SourceFile;
	try {
		sourceFile = ts.createSourceFile(
			'kuratchi-leading-script.ts',
			scriptBody,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
	} catch {
		return empty;
	}

	const initAwaitVars: string[] = [];
	// Map every top-level `let` identifier to its declaration so we can
	// decide later whether to hydrate. `const` bindings can't be reassigned
	// so there's no point collecting them here — their initializer was
	// already handled by `initAwaitVars` above.
	const topLevelLets = new Set<string>();
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) continue;
		const isLet = (statement.declarationList.flags & ts.NodeFlags.Let) !== 0;
		const isVar =
			(statement.declarationList.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) === 0;
		for (const decl of statement.declarationList.declarations) {
			if (!ts.isIdentifier(decl.name)) continue;
			const name = decl.name.text;
			if (decl.initializer && initializerContainsTopLevelAwait(decl.initializer)) {
				initAwaitVars.push(name);
				continue;
			}
			if (isLet || isVar) topLevelLets.add(name);
		}
	}

	// Walk each top-level statement. If the statement body contains an
	// `await` (via `containsAwaitInControlFlow`), collect the identifiers
	// it reassigns. Any of those identifiers that is ALSO a top-level
	// `let`/`var` becomes a hydration target.
	const reassignedLets = new Set<string>();
	for (const statement of sourceFile.statements) {
		if (ts.isVariableStatement(statement)) continue; // declarations themselves handled above
		if (!containsAwaitInControlFlow(statement)) continue;
		const reassigned = new Set<string>();
		collectReassignedIdentifiers(statement, reassigned);
		for (const name of reassigned) {
			if (topLevelLets.has(name)) reassignedLets.add(name);
		}
	}

	return {
		initAwaitVars,
		reassignedLets: Array.from(reassignedLets),
	};
}

/**
 * AST-driven rewrite that transforms the leading script's source into its
 * browser-shaped equivalent. Two concerns, both at module-top-level:
 *
 *   1. "Init-await" declarations (`const X = await fn()`, incl. ternary/
 *      short-circuit variants): the whole declaration's initializer is
 *      swapped for `__kuratchiReadData("X")`. Type annotation dropped —
 *      the SSR-serialized value is the source of truth.
 *
 *   2. "Reassigned-let" declarations (`let X = <literal>` mutated from
 *      inside a top-level block that contains an `await`): the
 *      declaration is preserved but its initializer becomes
 *      `__kuratchiReadData("X") ?? <originalInitOrUndefined>`. Then every
 *      top-level statement whose body contains an `await` is stripped,
 *      because it exists only to populate those lets — and the hydration
 *      payload already carries the post-eval result.
 *
 * Everything else — helper functions, non-async branches, template
 * expressions — passes through untouched. We use the TypeScript compiler
 * API to guarantee we handle multi-line initializers, comments, template
 * literals, and nested ternaries correctly. Regex-based replacement would
 * misfire on any of those.
 */
function rewriteLeadingScriptForBrowser(
	scriptBody: string,
	initAwaitVars: Set<string>,
	reassignedLets: Set<string>,
): string {
	const sourceFile = ts.createSourceFile(
		'kuratchi-leading-script.ts',
		scriptBody,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });

	const makeHydrateRead = (factory: ts.NodeFactory, name: string): ts.CallExpression =>
		factory.createCallExpression(
			factory.createIdentifier('__kuratchiReadData'),
			undefined,
			[factory.createStringLiteral(name)],
		);

	const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
		const factory = context.factory;
		return (file) => {
			const newStatements: ts.Statement[] = [];
			for (const statement of file.statements) {
				// Variable declarations get rewritten to pull from hydrate.
				if (ts.isVariableStatement(statement)) {
					const decls = statement.declarationList.declarations.map((decl) => {
						if (!ts.isIdentifier(decl.name)) return decl;
						const name = decl.name.text;
						if (initAwaitVars.has(name)) {
							return factory.updateVariableDeclaration(
								decl,
								decl.name,
								decl.exclamationToken,
								undefined, // drop type — SSR value wins
								makeHydrateRead(factory, name),
							);
						}
						if (reassignedLets.has(name)) {
							// Preserve the original initializer (or `undefined`
							// if `let X;` with no init) as a fallback. `??`
							// is correct: JSON.parse can't produce `undefined`,
							// so `null`-valued hydrates fall through to the
							// author's original init, matching SSR behavior.
							const fallback = decl.initializer ?? factory.createIdentifier('undefined');
							const hydrateWithFallback = factory.createBinaryExpression(
								makeHydrateRead(factory, name),
								factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
								fallback,
							);
							return factory.updateVariableDeclaration(
								decl,
								decl.name,
								decl.exclamationToken,
								undefined,
								hydrateWithFallback,
							);
						}
						return decl;
					});
					newStatements.push(
						factory.updateVariableStatement(
							statement,
							statement.modifiers,
							factory.updateVariableDeclarationList(statement.declarationList, decls),
						),
					);
					continue;
				}

				// Top-level statements whose bodies contain `await` exist only
				// to populate the SSR lets we just hydrated. On the client
				// those lets already carry the post-eval values, so we skip
				// the whole statement. Nested functions are NOT flagged by
				// `containsAwaitInControlFlow` (they might be referenced by
				// event handlers that DO run client-side), so that path is
				// preserved.
				if (containsAwaitInControlFlow(statement)) continue;

				newStatements.push(statement);
			}

			return factory.updateSourceFile(file, newStatements);
		};
	};

	const result = ts.transform(sourceFile, [transformer]);
	const printed = printer.printFile(result.transformed[0] as ts.SourceFile);
	result.dispose();
	return printed;
}

/**
 * Produce the BROWSER-SHAPE version of the leading script. Three changes:
 *
 *   1. Top-level `const|let|var X = await …` declarations are rewritten to
 *      `const X = (typeof window !== 'undefined' && window.__kuratchiData)
 *        ? window.__kuratchiData.X : undefined;`
 *      so the client can read the value the server computed. `await`
 *      cannot run in a non-async module-eval context against a `$server/*`
 *      RPC stub without turning the top-level script into an async
 *      sequence; hydration keeps evaluation synchronous and predictable.
 *
 *   2. `import … from 'kuratchi:request'` is replaced with synthesized
 *      `const` declarations reading from `window.location`, so the same
 *      aliases (`params`, `searchParams`, `pathname`, etc.) resolve in
 *      the browser.
 *
 *   3. `import … from 'kuratchi:environment'` is replaced with a literal
 *      `const dev = <bool>;` matching the build-time env.
 *
 * Everything else — `$server/*` imports, `$lib/*` imports, helper
 * functions, non-await top-level consts, event listeners, etc. —
 * passes through unchanged. `$server/*` imports become RPC stubs
 * transparently via the existing client-env resolver.
 */
/**
 * Prepended to every leading-script browser bundle. Reads the JSON blob
 * the server inlined under `<script type="application/json"
 * id="__kuratchi_data">`. Using `application/json` keeps the browser's
 * script parser in data mode — the payload is never interpreted as JS
 * even if it contains `</script>`-like sequences or looks like code — so
 * authors can stare at View Source without worrying what's "live" there.
 *
 * If the element is missing (route shipped with no SSR data, or the
 * script runs in a stale page) the helper returns `undefined`; author
 * code is expected to have started with `x && x.foo` idioms anyway.
 */
const LEADING_FRAGMENT_HYDRATE_PRELUDE = `// kuratchi: SSR data hydrate helper
const __kuratchiReadData = (key) => {
	if (typeof document === 'undefined') return undefined;
	const el = document.getElementById('__kuratchi_data');
	if (!el || !el.textContent) return undefined;
	let data;
	try { data = JSON.parse(el.textContent); } catch { return undefined; }
	return data == null ? undefined : data[key];
};
`;

function transformLeadingScriptForClient(
	scriptBody: string,
	hydrateTargets: LeadingHydrateTargets,
	requestImports: Array<{ exportName: string; alias: string }>,
	isProduction: boolean,
): string {
	// 1. Rewrite the script body for the browser:
	//    - init-await declarations: initializer swapped for hydrate read
	//    - reassigned-let declarations: initializer wrapped in a hydrate
	//      read with `??` fallback to the original literal
	//    - every top-level statement whose body contains `await`:
	//      dropped, since those ran SSR and their effects were serialized
	let out = scriptBody;
	if (hydrateTargets.initAwaitVars.length > 0 || hydrateTargets.reassignedLets.length > 0) {
		out = rewriteLeadingScriptForBrowser(
			scriptBody,
			new Set(hydrateTargets.initAwaitVars),
			new Set(hydrateTargets.reassignedLets),
		);
	}

	// 2. Swap `kuratchi:request` imports for browser-readable aliases.
	// `params` reads from the SSR-hydrated data blob (route params aren't
	// visible to `window.location` alone — they come from the matched
	// route pattern). Everything else derives from `window.location`.
	if (requestImports.length > 0) {
		out = out.replace(
			/import\s*\{[^}]*\}\s*from\s*['"]kuratchi:request['"]\s*;?\s*/g,
			'',
		);
		const lines: string[] = [
			`const __kuratchiUrl = new URL(window.location.href);`,
			`const __kuratchiParams = __kuratchiReadData('__params') ?? {};`,
		];
		for (const imp of requestImports) {
			switch (imp.exportName) {
				case 'url':
					lines.push(`const ${imp.alias} = __kuratchiUrl;`);
					break;
				case 'pathname':
					lines.push(`const ${imp.alias} = __kuratchiUrl.pathname;`);
					break;
				case 'searchParams':
					lines.push(`const ${imp.alias} = __kuratchiUrl.searchParams;`);
					break;
				case 'params':
					lines.push(`const ${imp.alias} = __kuratchiParams;`);
					break;
				case 'slug':
					lines.push(
						`const ${imp.alias} = __kuratchiParams.slug ?? Object.values(__kuratchiParams)[0];`,
					);
					break;
				case 'method':
					lines.push(`const ${imp.alias} = 'GET';`);
					break;
			}
		}
		out = lines.join('\n') + '\n' + out;
	}

	// 3. `kuratchi:environment` → `const dev = …;`. The legacy CLI used
	// `globalThis.__kuratchi_DEV__`; we inline it because the client
	// fragment is bundled per environment and the value is static.
	out = out.replace(
		/import\s*\{\s*([^}]*)\s*\}\s*from\s*['"]kuratchi:environment['"]\s*;?\s*/g,
		(_m, bindings: string) => {
			const aliases = bindings
				.split(',')
				.map((b: string) => b.trim().split(/\s+as\s+/).pop() ?? '')
				.filter((name: string) => /^[A-Za-z_$][\w$]*$/.test(name));
			return aliases.map((alias: string) => `const ${alias} = ${!isProduction};`).join('\n') + '\n';
		},
	);

	// Prepend the hydrate helper whenever ANY bridge from SSR → browser
	// is in play (hydrated await vars OR a `kuratchi:request` `params`
	// import). The helper is a tiny arrow function + one DOM read; the
	// extra bytes are negligible and having it unconditionally present
	// means authors can call `__kuratchiReadData(...)` from their own
	// code if they want to read additional SSR-serialized values.
	const needsHydrateHelper =
		hydrateTargets.initAwaitVars.length > 0 ||
		hydrateTargets.reassignedLets.length > 0 ||
		requestImports.some((imp) => imp.exportName === 'params' || imp.exportName === 'slug');
	if (needsHydrateHelper) {
		out = LEADING_FRAGMENT_HYDRATE_PRELUDE + out;
	}

	return out;
}

/**
 * A `<script>` block is a "client fragment candidate" when it is not the
 * leading script AND contains at least one ES-module import. Without
 * imports, there is nothing to bundle — the block can stay inline (and
 * the existing Kuratchi template compiler preserves it as-is).
 *
 * NB: we match across multiple lines because named-import lists often
 * break across lines in hand-authored code (`import {\n a,\n b\n } from`).
 * The original regex used `.+` which doesn't cross newlines; that bug
 * caused multi-line imports to be treated as "no imports" and the entire
 * `<script>` block — raw TypeScript, `$server/*` and all — got echoed
 * into the rendered HTML response.
 */
function hasEsModuleImport(body: string): boolean {
	return /\bimport\b[\s\S]*?\bfrom\s+['"][^'"]+['"]/.test(body);
}

/**
 * Count the net brace delta in a compiled-template body, ignoring any
 * braces inside string literals (single, double, or backtick) and
 * template-literal interpolations. Used as a pre-Rollup sanity check
 * so a stray `}` in an author's template surfaces as a clear error
 * instead of a downstream "return not allowed here".
 *
 * Returns 0 for balanced bodies, positive for extra openers, negative
 * for extra closers.
 */
function controlFlowBraceImbalance(src: string): number {
	let depth = 0;
	let quote: '"' | "'" | '`' | null = null;
	let templateDepth = 0; // depth of `${…}` interpolations inside a backtick
	let escaped = false;
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		// Single-line and block comments — skip.
		if (!quote) {
			if (ch === '/' && src[i + 1] === '/') {
				while (i < src.length && src[i] !== '\n') i++;
				continue;
			}
			if (ch === '/' && src[i + 1] === '*') {
				i += 2;
				while (i < src.length - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
				i++;
				continue;
			}
		}
		if (quote) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (ch === '\\') {
				escaped = true;
				continue;
			}
			if (quote === '`') {
				// `${` opens a template interpolation; inside it we go
				// back to regular code until a matching `}`.
				if (ch === '$' && src[i + 1] === '{') {
					templateDepth++;
					i++;
					quote = null;
					continue;
				}
			}
			if (ch === quote) {
				quote = null;
			}
			continue;
		}
		if (ch === '"' || ch === "'" || ch === '`') {
			quote = ch as '"' | "'" | '`';
			continue;
		}
		if (ch === '{') {
			depth++;
		} else if (ch === '}') {
			if (templateDepth > 0) {
				// Closing a `${…}` interpolation, re-enter the template.
				templateDepth--;
				quote = '`';
			} else {
				depth--;
			}
		}
	}
	return depth;
}

// ─────────────────────────────────────────────────────────────────────
//  Stream boundaries — automatic detection.
//
//  Authors write normal KuratchiJS templates:
//
//    <script>
//      const todos = getTodos();         // no await → async binding
//    </script>
//    if (todos.pending) { <Skeleton /> }
//    else if (todos.error) { <p>{todos.error}</p> }
//    else { for (const t of todos) { <TodoItem todo={t} /> } }
//
//  The framework spots the if/else-if/else chain that gates on
//  `todos.pending|error|success`, compiles that chain into a render
//  closure, and streams its resolved markup in when the promise settles.
//  Authors never see a `<Boundary>` tag or any other wrapper — the
//  compiler infers the region from the `.pending/.error/.success`
//  accesses the author already wrote.
//
//  Region rule: smallest contiguous `if (…) { } else if (…) { } else { }`
//  chain whose gating expressions reference any async binding. A chain
//  may reference multiple bindings (`if (a.pending || b.pending)`); in
//  that case the boundary awaits `Promise.all([a, b])` and re-renders
//  the chain once both settle.
//
//  See `@kuratchi/js/runtime/stream.ts` for the runtime primitives
//  (`__registerBoundary`, `boundaryPlaceholder`, `BOOTSTRAP_SCRIPT`,
//  `resolveBoundaryToChunk`) this pre-pass composes with.
// ─────────────────────────────────────────────────────────────────────

interface ExtractedBoundary {
	/** Marker substituted into the outer template in place of the if-chain. */
	marker: string;
	/** The full source of the if-chain. Compiled on its own into a closure. */
	chainSource: string;
	/** Identifiers the chain depends on (bindings accessed as X.pending/.error/.success). */
	bindings: string[];
	/** 0-based sequence number, makes closure names unique per route. */
	index: number;
}

/**
 * Which top-level script bindings are "async" — meaning they're
 * referenced in the template as `X.pending`?
 *
 * `.pending` is the unique AsyncValue tell. Server action state
 * bindings use `.loading` (not `.pending`), `.error`, and `.success`,
 * so filtering on `.pending` rules them out cleanly — no need to
 * subtract action-function names separately.
 *
 * Once `.pending` is seen the caller promotes the identifier to an
 * async binding; the extractor then matches if-chains gated on any of
 * `.pending | .error | .success` for that same identifier.
 */
function detectAsyncBindings(template: string): Set<string> {
	const out = new Set<string>();
	const re = /\b([A-Za-z_$][\w$]*)\.pending\b/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(template)) !== null) {
		out.add(match[1]);
	}
	return out;
}

/**
 * Walk the template line-by-line (the same shape `compileTemplate`
 * expects) and identify every `if (...) { ... } else if (...) { ... }
 * else { ... }` chain whose head condition mentions an async binding.
 * Replace each chain with a `<!--kuratchi:auto-boundary:N-->` marker.
 *
 * Control-flow opener detection: `compileTemplate` already recognizes
 * `if (…) {`, `else if (…) {`, `else {`, and the closing `}` as plain
 * JS lines. We follow the same bracket-counting rules to find the end
 * of a chain.
 */
function extractAsyncBoundaries(
	template: string,
	asyncBindings: Set<string>,
): { template: string; boundaries: ExtractedBoundary[] } {
	if (asyncBindings.size === 0) {
		return { template, boundaries: [] };
	}
	const lines = template.split('\n');
	const boundaries: ExtractedBoundary[] = [];
	const output: string[] = [];

	// Regexes tolerant of leading whitespace. Head `if` must reference
	// an async binding directly in its condition; `else if` continues
	// an ongoing chain regardless of whether its own condition mentions
	// an async binding (the chain as a whole is already a boundary).
	const headIfRe = /^\s*if\s*\(([^)]+)\)\s*\{\s*$/;
	const elseIfRe = /^\s*\}\s*else\s+if\s*\(([^)]+)\)\s*\{\s*$/;
	const elseRe = /^\s*\}\s*else\s*\{\s*$/;
	const closeRe = /^\s*\}\s*$/;

	const conditionReferencesAsyncBinding = (condition: string): string[] => {
		const hits: string[] = [];
		const idRe = /\b([A-Za-z_$][\w$]*)\.(?:pending|error|success)\b/g;
		let m: RegExpExecArray | null;
		while ((m = idRe.exec(condition)) !== null) {
			if (asyncBindings.has(m[1]) && !hits.includes(m[1])) hits.push(m[1]);
		}
		return hits;
	};

	let i = 0;
	let boundaryIndex = 0;
	while (i < lines.length) {
		const line = lines[i];
		const headMatch = line.match(headIfRe);
		const headHits = headMatch ? conditionReferencesAsyncBinding(headMatch[1]) : [];
		if (!headMatch || headHits.length === 0) {
			output.push(line);
			i++;
			continue;
		}

		// We're at the head of an async-binding-gated if. Walk forward
		// through the chain tracking `{`/`}` depth. The chain ends at
		// the line that closes the last `else` branch.
		const chainStart = i;
		const bindingsInChain = new Set<string>(headHits);
		let depth = 1;
		let j = i + 1;
		let chainClosedAt = -1;
		while (j < lines.length) {
			const l = lines[j];
			// Continuation clauses at depth 1 keep the chain alive AND
			// may introduce new binding references.
			if (depth === 1) {
				const ei = l.match(elseIfRe);
				if (ei) {
					for (const b of conditionReferencesAsyncBinding(ei[1])) bindingsInChain.add(b);
					// `} else if (…) {` pops one block and opens another; depth stays at 1.
					j++;
					continue;
				}
				const e = l.match(elseRe);
				if (e) {
					j++;
					continue;
				}
				if (closeRe.test(l)) {
					chainClosedAt = j;
					break;
				}
			}
			// Count braces INSIDE lines that aren't clause boundaries.
			// We approximate: each naked `{` at end of line opens, each
			// naked `}` at start closes. Good enough because the author
			// writes control flow on its own line (the template-compiler
			// line-scanner already assumes this).
			const opens = (l.match(/\{\s*$/) || []).length;
			const closes = (l.match(/^\s*\}/) || []).length;
			depth += opens;
			depth -= closes;
			j++;
		}
		if (chainClosedAt === -1) {
			// Unclosed chain — bail out to avoid breaking the template;
			// emit the original lines unchanged so `compileTemplate`
			// surfaces any syntax error rather than us masking it.
			output.push(line);
			i++;
			continue;
		}
		const chainSource = lines.slice(chainStart, chainClosedAt + 1).join('\n');
		const marker = `<!--kuratchi:auto-boundary:${boundaryIndex}-->`;
		boundaries.push({
			marker,
			chainSource,
			bindings: Array.from(bindingsInChain),
			index: boundaryIndex,
		});
		output.push(marker);
		boundaryIndex++;
		i = chainClosedAt + 1;
	}

	return { template: output.join('\n'), boundaries };
}

// ─────────────────────────────────────────────────────────────────────
//  Inline event-handler directive: `onclick={fn(args)}`
//
//  KuratchiJS-native handler binding. Authors write:
//      <button onclick={deleteTodo(todo.id)}>Delete</button>
//  The template compiler in `@kuratchi/js` recognizes `on<event>={…}`
//  attributes and consults the `ClientRouteRegistry` we pass in via
//  `compileTemplate`'s options. The registry assigns a stable handler
//  id (`h0`, `h1`, …), remembers the callee expression, and returns
//  the triple `(routeId, handlerId, argsExpr)`. The compiler then
//  emits the element with:
//
//      data-client-route="<routeId>"
//      data-client-handler="h0"
//      data-client-event="click"
//      data-client-args="${__esc(JSON.stringify([<argsExpr>]))}"
//
//  At the end of the leading-script browser bundle we register the
//  handler table with the client bridge:
//
//      window.__kuratchiClient.register("<routeId>", {
//          h0: (args) => deleteTodo(args[0]),
//          h1: (args, event) => save(),
//      });
//
//  The bridge (a tiny ~1 kB IIFE) installs one document-level listener
//  per event type, finds the `data-client-*` attributes on the closest
//  ancestor, parses `data-client-args`, and invokes the registered
//  handler. Re-including the bridge across multiple pages is
//  idempotent — it guards on `window.__kuratchiClient`.
//
//  This is deliberately MORE permissive than `@kuratchi/js`'s reference
//  implementation. That one required every referenced binding to come
//  from a `$lib/*` import. We allow any identifier: `$lib/*` imports,
//  `$server/*` RPC stubs (which in the browser bundle become real
//  functions), or functions the author declared in the top `<script>`
//  block. The registry never resolves the expression — it just stores
//  the string — so as long as the expression evaluates cleanly in the
//  leading-fragment's module scope at register time, it works.
// ─────────────────────────────────────────────────────────────────────

interface ClientEventRegistration {
	routeId: string;
	handlerId: string;
	argsExpr: string | null;
}

interface ClientRouteRegistryLike {
	hasBindings(): boolean;
	hasBindingReference(expression: string): boolean;
	registerEventHandler(eventName: string, expression: string): ClientEventRegistration | null;
	getServerProxyBindings(): unknown[];
	buildEntryAsset(): { assetName: string; asset: unknown } | null;
	rewriteClientImport(importLine: string, importerDir: string): string | null;
}

/**
 * Does the template have any `on<event>={fn(…)}` where `fn` is a
 * `$server/*` import? Used to decide whether the leading-fragment
 * bundle must ship the bridge's server-action dispatch branch even
 * when there are zero client handlers to register.
 */
function templateHasServerActionHandlers(
	template: string,
	serverActionCallees: Set<string>,
): boolean {
	if (serverActionCallees.size === 0) return false;
	const re = /\son[A-Za-z]+\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\(/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(template)) !== null) {
		if (serverActionCallees.has(match[1])) return true;
	}
	return false;
}

/**
 * Pre-populate the per-route handler registry from a raw template
 * scan. Matches every `on<event>={expr}` attribute and feeds `expr` to
 * `registerEventHandler`. Run during `extractClientFragments` so the
 * handler-registration source can be appended to the leading-fragment
 * browser source at fragment registration time — BEFORE the client
 * Rollup build calls `load()` on the virtual fragment module.
 *
 * Skips expressions whose root callee is a `$server/*` import — those
 * are dispatched as server actions by the template compiler
 * (`data-action=…`), not through the client-handler bridge. Keeping
 * them out of the registry keeps the browser bundle tight.
 *
 * Must match `{…}` carefully: we want the FULL expression including
 * nested parens, template literals, comments. A naive `{[^}]*}` would
 * cut off at the first `}` inside the expression. We use a tiny
 * bracket-balanced scanner instead.
 */
function preRegisterHandlers(
	template: string,
	registry: ViteClientRouteRegistry,
	serverActionCallees: Set<string>,
): void {
	const attrRe = /\son([A-Za-z]+)\s*=\s*\{/g;
	let match: RegExpExecArray | null;
	while ((match = attrRe.exec(template)) !== null) {
		const eventName = match[1].toLowerCase();
		const exprStart = match.index + match[0].length;
		let depth = 1;
		let end = exprStart;
		let inString: '"' | "'" | '`' | null = null;
		while (end < template.length && depth > 0) {
			const ch = template[end];
			const prev = end > 0 ? template[end - 1] : '';
			if (inString) {
				if (ch === inString && prev !== '\\') inString = null;
			} else if (ch === '"' || ch === "'" || ch === '`') {
				inString = ch;
			} else if (ch === '{') {
				depth++;
			} else if (ch === '}') {
				depth--;
				if (depth === 0) break;
			}
			end++;
		}
		const expr = template.slice(exprStart, end).trim();
		if (!expr) continue;
		// Skip server-action callees. `parseHandlerExpression` reports
		// the root identifier of `foo.bar(…)` as `foo`, so we need the
		// parser's result to filter correctly for property-access
		// callees — but server actions are always bare identifiers
		// (`$server/*` imports produce top-level bindings), so a cheap
		// identifier-first check is sufficient.
		const rootMatch = expr.match(/^([A-Za-z_$][\w$]*)/);
		if (rootMatch && serverActionCallees.has(rootMatch[1])) continue;
		registry.registerEventHandler(eventName, expr);
	}
}

/**
 * Parse `fnExpr(argsExpr)` into its parts. The argsExpr is the raw
 * argument list source (possibly multi-arg, possibly empty). We use the
 * TypeScript parser to tolerate nested parens, template literals, and
 * commas inside array/object literals — things a regex can't handle.
 *
 * Returns `null` if the expression isn't a call expression, or if the
 * callee isn't a simple identifier / property-access chain (we refuse
 * to register anything more exotic because it's not clear what the
 * client-side invocation shape should be).
 */
function parseHandlerExpression(expression: string): {
	calleeExpr: string;
	argsExpr: string;
	rootBinding: string;
} | null {
	let sourceFile: ts.SourceFile;
	try {
		sourceFile = ts.createSourceFile(
			'kuratchi-handler.ts',
			`(${expression})`,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
	} catch {
		return null;
	}
	const stmt = sourceFile.statements[0];
	if (!stmt || !ts.isExpressionStatement(stmt)) return null;
	const paren = stmt.expression;
	if (!ts.isParenthesizedExpression(paren)) return null;
	const expr = paren.expression;
	if (!ts.isCallExpression(expr)) return null;

	// Callee must be a plain identifier or dotted property-access chain.
	// This is the ONLY place we're opinionated: `foo.bar()` is fine,
	// `(a || b)()` is not. Authors who need dynamic dispatch can wrap
	// their logic in a named function.
	const rootBinding = (() => {
		let node: ts.Expression = expr.expression;
		while (ts.isPropertyAccessExpression(node)) node = node.expression;
		if (!ts.isIdentifier(node)) return null;
		return node.text;
	})();
	if (!rootBinding) return null;

	const calleeText = expr.expression.getText(sourceFile);
	const argsText = expr.arguments.map((a) => a.getText(sourceFile)).join(', ');
	return { calleeExpr: calleeText, argsExpr: argsText, rootBinding };
}

interface ClientHandlerRecord {
	id: string;
	calleeExpr: string;
	argsExpr: string;
}

class ViteClientRouteRegistry implements ClientRouteRegistryLike {
	private readonly handlerByKey = new Map<string, ClientHandlerRecord>();

	constructor(private readonly routeId: string) {}

	hasBindings(): boolean {
		// We don't gate registrations on `$lib` bindings, so claim
		// `true` whenever a registration has happened. The field is
		// only consulted by the template compiler to decide whether to
		// emit the legacy native `on<event>=` fallback; we always want
		// the data-client-* path for our routes.
		return true;
	}

	hasBindingReference(_expression: string): boolean {
		// The reference implementation uses this to refuse unsupported
		// handler shapes whose identifiers come from `$lib`. We accept
		// any identifier, so returning `false` lets `compileTemplate`
		// fall through to the native inline-handler branch if
		// `registerEventHandler` couldn't parse the expression.
		return false;
	}

	registerEventHandler(_eventName: string, expression: string): ClientEventRegistration | null {
		const parsed = parseHandlerExpression(expression);
		if (!parsed) return null;

		// De-dupe: two identical `<button onclick={save()}>` elements
		// share the same handler id, so we don't bloat the registry.
		const key = `${parsed.calleeExpr}::${parsed.argsExpr}`;
		let record = this.handlerByKey.get(key);
		if (!record) {
			record = {
				id: `h${this.handlerByKey.size}`,
				calleeExpr: parsed.calleeExpr,
				argsExpr: parsed.argsExpr,
			};
			this.handlerByKey.set(key, record);
		}

		return {
			routeId: this.routeId,
			handlerId: record.id,
			argsExpr: parsed.argsExpr.trim() === '' ? null : parsed.argsExpr,
		};
	}

	getServerProxyBindings(): unknown[] {
		return [];
	}

	buildEntryAsset(): null {
		// We emit the handler table inline in the leading fragment, not
		// as a separate client entry asset. Return null so the template
		// compiler doesn't try to inject a `<script src=...>` tag of
		// its own for the handler bundle.
		return null;
	}

	rewriteClientImport(_importLine: string, _importerDir: string): string | null {
		return null;
	}

	/**
	 * JS source appended to the end of the leading fragment's browser
	 * source, AFTER all user code. Registers every collected handler
	 * with `window.__kuratchiClient.register(routeId, {…})`. Returns
	 * empty string when no handlers were registered — that short-circuits
	 * both the `register(...)` call AND the bridge inclusion.
	 */
	emitRegistrationSource(): string {
		if (this.handlerByKey.size === 0) return '';
		// Invocation shape: `fn(...args, event, element)`. Matches the
		// reference `@kuratchi/js` runtime. `args` comes from
		// `data-client-args` (JSON-serialized at SSR); `event` is the
		// browser event; `element` is the ancestor element the bridge
		// matched on (the one carrying `data-client-handler`). Authors
		// who only care about their own args can write a normal
		// fixed-arity function: `function deleteTodo(id) { … }` works
		// whether invoked with zero or three trailing arguments.
		const entries = Array.from(this.handlerByKey.values())
			.map((record) => `\t${record.id}: (args, event, element) => ${record.calleeExpr}(...args, event, element)`)
			.join(',\n');
		return `\nwindow.__kuratchiClient && window.__kuratchiClient.register(${JSON.stringify(this.routeId)}, {\n${entries}\n});\n`;
	}

	get handlerCount(): number {
		return this.handlerByKey.size;
	}
}

/**
 * Minimal client bridge. Runs once per page — idempotent because it
 * guards on `window.__kuratchiClient`. Listens at the document root
 * for a fixed set of events and performs TWO dispatches:
 *
 *   1. `data-client-event`  → client handler registered via
 *      `window.__kuratchiClient.register(routeId, {…})`. Registered
 *      by the leading-fragment browser bundle. See `registerEventHandler`
 *      in the compiler for the emission shape.
 *
 *   2. `data-action-event`  → server action. The bridge POSTs to the
 *      current URL with `_action`, `_args`, optional `_method` fields.
 *      The response JSON can include `{ redirectTo }` to trigger a
 *      client-side navigation after the action resolves. This mirrors
 *      the `@kuratchi/js` reference bridge — `onclick={serverFn(id)}`
 *      where `serverFn` is a `$server/*` import compiles to these
 *      attributes, so the button "just works" with no extra code.
 *
 * Security: every routeId / handlerId is validated against a strict
 * identifier regex, prototype-pollution names are blocked, and the
 * handler table is an `Object.create(null)` with `hasOwnProperty`
 * checks on lookup.
 */
const CLIENT_HANDLER_BRIDGE_SOURCE = `(function(){
	if (window.__kuratchiClient) return;
	var __clientHandlers = Object.create(null);
	window.__kuratchiClient = {
		register: function(routeId, handlers){
			if (!routeId || !handlers) return;
			if (!/^[a-zA-Z0-9_-]+$/.test(String(routeId))) return;
			var key = String(routeId);
			__clientHandlers[key] = Object.assign(__clientHandlers[key] || {}, handlers);
		},
		invoke: function(routeId, handlerId, args, event, element){
			if (!routeId || !handlerId) return;
			var safeRoute = String(routeId);
			var safeId = String(handlerId);
			if (safeRoute === '__proto__' || safeRoute === 'constructor' || safeRoute === 'prototype') return;
			if (safeId === '__proto__' || safeId === 'constructor' || safeId === 'prototype') return;
			if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(safeId)) return;
			var table = __clientHandlers[safeRoute] || null;
			if (!table || !Object.prototype.hasOwnProperty.call(table, safeId)) return;
			var fn = table[safeId];
			if (typeof fn !== 'function') return;
			return fn(Array.isArray(args) ? args : [], event, element);
		}
	};
	function act(e){
		// 1. Client-handler dispatch.
		var clientSel = '[data-client-event="' + e.type + '"]';
		var clientEl = e.target && e.target.closest ? e.target.closest(clientSel) : null;
		if (clientEl){
			var routeId = clientEl.getAttribute('data-client-route') || '';
			var handlerId = clientEl.getAttribute('data-client-handler') || '';
			var argsRaw = clientEl.getAttribute('data-client-args') || '[]';
			var args = [];
			try {
				var parsedArgs = JSON.parse(argsRaw);
				args = Array.isArray(parsedArgs) ? parsedArgs : [];
			} catch (_err) {}
			try {
				var result = window.__kuratchiClient.invoke(routeId, handlerId, args, e, clientEl);
				if (result === false){ e.preventDefault(); e.stopPropagation(); return; }
			} catch (err) {
				console.error('[kuratchi] client handler error:', err);
			}
		}
		// 2. Server-action dispatch.
		var actionSel = '[data-action][data-action-event="' + e.type + '"]';
		var actionEl = e.target && e.target.closest ? e.target.closest(actionSel) : null;
		if (!actionEl) return;
		e.preventDefault();
		var fd = new FormData();
		fd.append('_action', actionEl.getAttribute('data-action') || '');
		fd.append('_args', actionEl.getAttribute('data-args') || '[]');
		var method = actionEl.getAttribute('data-action-method');
		if (method) fd.append('_method', String(method).toUpperCase());
		fetch(location.pathname + location.search, { method: 'POST', body: fd, credentials: 'same-origin' })
			.then(function(r){
				if (!r.ok){
					return r.json().then(function(j){ throw new Error((j && j.error) || ('HTTP ' + r.status)); })
						.catch(function(){ throw new Error('HTTP ' + r.status); });
				}
				return r.json();
			})
			.then(function(j){
				if (j && j.redirectTo){ location.assign(j.redirectTo); return; }
				// Default behavior matches <form>-action semantics:
				// reload the page so the SSR reflects the write.
				location.reload();
			})
			.catch(function(err){ console.error('[kuratchi] client action error:', err); });
	}
	['click','change','input','submit','keydown','keyup','focus','blur'].forEach(function(ev){
		document.addEventListener(ev, act, true);
	});
})();
`;

/**
 * Extract every template-body `<script>` block with imports into the
 * shared `clientFragments` map and return a modified source where each
 * extracted block has been replaced with an HTML-comment marker. The
 * marker survives `compileTemplate` verbatim, so we can rewrite it into
 * a real `<script type="module" src=...>` tag on the way out.
 *
 * As of the leading-script dual-bundle change, the LEADING `<script>`
 * block (index 0) is ALSO registered as a client fragment — with its
 * body rewritten so module-level `await` of `$server/*` reads from the
 * SSR-hydrated `window.__kuratchiData` instead. The SSR copy of the
 * leading script remains inlined as the render-function prelude; the
 * browser copy runs the same code with live data, the same way Svelte
 * + Astro ship dual SSR/client modules.
 */
function extractClientFragments(
	source: string,
	importerAbsPath: string,
	clientFragments: Map<string, ClientFragment>,
	isProduction: boolean = false,
): { source: string; fragmentHashes: string[]; leadingHash: string | null } {
	const fragmentHashes: string[] = [];
	let index = 0;
	let leadingSkipped = false;
	let leadingHash: string | null = null;

	const transformed = source.replace(SCRIPT_BLOCK_RE, (match, _attrs: string, body: string) => {
		const currentIndex = index++;

		if (!leadingSkipped) {
			leadingSkipped = true;
			// Register the leading script as a client fragment too. Its
			// stable hash is derived from the route path alone so the
			// fragment id survives content edits and HMR. Only bother
			// when the body is non-empty — routes with no leading script
			// have nothing to ship to the browser.
			const trimmedLeading = body.trim();
			if (trimmedLeading.length === 0) {
				return match;
			}
			const hash = leadingScriptHash(importerAbsPath);
			leadingHash = hash;
			// Parse once to discover what `kuratchi:request` exports the
			// leading script referenced (so the browser copy gets the
			// same aliases) and every top-level binding that needs to
			// survive the SSR→client trip: init-await consts AND let
			// bindings mutated inside top-level async blocks.
			const hydrateTargets = collectLeadingHydrateTargets(trimmedLeading);
			let requestImports: Array<{ exportName: string; alias: string }> = [];
			// `$server/*` callees are dispatched as server actions, not
			// client handlers. Parsing the leading script gives us
			// `serverRpcFunctions`, the set of identifiers imported
			// from `$server/*`; we hand that to `preRegisterHandlers`
			// so it skips registering them with the client bridge.
			let serverActionCallees = new Set<string>();
			try {
				const parsed = parseFile(`<script>${trimmedLeading}</script>`);
				requestImports = parsed.requestImports ?? [];
				serverActionCallees = new Set(parsed.serverRpcFunctions ?? []);
			} catch {
				requestImports = [];
			}
			const browserSource = transformLeadingScriptForClient(
				trimmedLeading,
				hydrateTargets,
				requestImports,
				isProduction,
			);

			// Pre-scan the template (everything after this leading
			// `<script>`) for `on<event>={fn(args)}` attributes and
			// pre-populate the per-route handler registry. This has to
			// happen before the client-Rollup build serves the
			// fragment — otherwise the appended bridge + registration
			// source wouldn't be visible to the browser bundle. The
			// compile pass later re-registers the same expressions
			// through `compileTemplate`'s `clientRouteRegistry` option;
			// the registry de-dupes by `(calleeExpr, argsExpr)` so we
			// end up with identical handler ids on both passes.
			const handlerRegistry = new ViteClientRouteRegistry(hash);
			const templateTail = source.slice(source.indexOf(match) + match.length);
			preRegisterHandlers(templateTail, handlerRegistry, serverActionCallees);

			// The leading fragment carries ONLY the author's code + the
			// handler-registration table. The bridge itself lives in a
			// separate shared fragment (`CLIENT_BRIDGE_HASH`) registered
			// once per app and emitted as its own `<script src>` tag
			// before the leading fragment in `transformRouteFile`. Two
			// benefits: the bridge is cached across routes, and the
			// leading bundle stays focused on per-route code.
			//
			// The route still NEEDS the bridge to be emitted when EITHER:
			//   - client handlers (registered via `__kuratchiClient.register`), OR
			//   - server-action handlers (dispatched via `data-action-event`).
			// We record that on the fragment so the caller knows whether
			// to inject the bridge `<script>` tag for this route.
			const hasServerActionHandlers = templateHasServerActionHandlers(templateTail, serverActionCallees);
			const needsBridge = handlerRegistry.handlerCount > 0 || hasServerActionHandlers;
			let finalSource = browserSource;
			if (handlerRegistry.handlerCount > 0) {
				finalSource += handlerRegistry.emitRegistrationSource();
			}
			clientFragments.set(hash, {
				source: finalSource,
				importerAbsPath,
				kind: 'leading',
				hydrateVars: [...hydrateTargets.initAwaitVars, ...hydrateTargets.reassignedLets],
				handlerRegistry,
				needsBridge,
			});
			// The SSR-side leading script stays inline in the route
			// module (it's not replaced with a marker — `parseFile`
			// grabs the original, untouched body and the compiler
			// renders it as `prelude` inside `render(data)`). So we
			// return the raw match verbatim, leaving the source
			// structurally unchanged for the rest of the pipeline.
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
			kind: 'body',
		});

		fragmentHashes.push(hash);
		return `<!--kuratchi:client-entry:${hash}-->`;
	});

	return { source: transformed, fragmentHashes, leadingHash };
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

	// Server-action identifiers used in `action={fn}` or `on<event>={fn(…)}`.
	// Same filtering rule as pages: only names that are ALSO imported
	// from `$server/*` qualify (the rest are client-handler callees).
	// Without this, the template compiler falls through to its native
	// attribute emitter which calls `toString()` on the function — the
	// "Unknown action: async function setCaseCategoryAction(…)" bug that
	// used to bite every form in a layout.
	const rawLayoutActionFunctions = parsed.actionFunctions ?? [];
	const layoutServerRpcFunctions = new Set(parsed.serverRpcFunctions ?? []);
	const layoutActionNames = new Set(
		rawLayoutActionFunctions.filter((name) => layoutServerRpcFunctions.has(name)),
	);

	// Layouts support the same async-boundary rewrite as pages: a top-
	// level `let x = fn()` (non-awaited) that the template gates on via
	// `x.pending | x.error | x.success` becomes a stream boundary. The
	// runtime's dispatcher handles boundaries uniformly regardless of
	// whether they were registered from a layout or a page — boundaries
	// collect on the per-request `locals` collector, and the final
	// `renderRoute` check picks them all up.
	const topLevelDataVars = new Set(parsed.dataVars ?? []);
	const layoutAsyncBindings = new Set(
		[...detectAsyncBindings(template)].filter((name) => topLevelDataVars.has(name)),
	);
	const layoutBoundaryExtraction = extractAsyncBoundaries(template, layoutAsyncBindings);
	const layoutBoundariesUsed = layoutBoundaryExtraction.boundaries.length > 0;

	let body = compileTemplate(layoutBoundaryExtraction.template, undefined, layoutActionNames);

	// Post-compile: swap each `<!--kuratchi:auto-boundary:N-->` marker
	// for a block that registers the combined promise with the stream
	// runtime and emits a placeholder wrapping the chain's pending
	// render. Same shape as the route-side rewrite in `transformRouteFile`.
	for (const boundary of layoutBoundaryExtraction.boundaries) {
		const marker = boundary.marker;
		const innerBody = compileTemplate(boundary.chainSource, undefined, layoutActionNames);
		const params = boundary.bindings.join(', ');
		const closureName = `__boundary_${boundary.bindings[0]}_${boundary.index}_render`;
		const closureDef = `const ${closureName} = (${params}) => { ${innerBody}; return __html; };`;
		const rawCaptures = boundary.bindings
			.map((b) => `const __boundary_raw_${b} = ${b};`)
			.join('\n\t\t');
		const combinedPromise = `Promise.all([${boundary.bindings
			.map((b) => `Promise.resolve(__boundary_raw_${b})`)
			.join(', ')}])`;
		const successArgs = boundary.bindings
			.map((_, idx) => `__kuratchiWrapSuccess(__values[${idx}])`)
			.join(', ');
		const successHandler = `(__values) => ${closureName}(${successArgs})`;
		const errorArgs = boundary.bindings.map(() => `__kuratchiWrapError(__message)`).join(', ');
		const errorHandler = `(__message) => ${closureName}(${errorArgs})`;
		const reassignPending = boundary.bindings
			.map((b) => `${b} = __boundary_pending;`)
			.join('\n\t\t');
		const pendingArgs = boundary.bindings.map(() => '__boundary_pending').join(', ');
		const replacement = `\`);
	{
		${closureDef}
		${rawCaptures}
		const __boundary_id = __kuratchiNextBoundaryId(${JSON.stringify(boundary.bindings.join('-'))});
		const __boundary_pending = __kuratchiRegisterBoundary(
			__boundary_id,
			${combinedPromise},
			${successHandler},
			${errorHandler},
		);
		${reassignPending}
		__parts.push(__kuratchiBoundaryPlaceholder(__boundary_id, ${closureName}(${pendingArgs})));
	}
	__parts.push(\``;
		body = body.split(marker).join(replacement);
	}

	const streamRuntimeImport = layoutBoundariesUsed
		? `import {\n\t__registerBoundary as __kuratchiRegisterBoundary,\n\t__nextBoundaryId as __kuratchiNextBoundaryId,\n\tboundaryPlaceholder as __kuratchiBoundaryPlaceholder,\n\t__wrapSuccess as __kuratchiWrapSuccess,\n\t__wrapError as __kuratchiWrapError,\n} from '@kuratchi/js/runtime/stream.js';\n`
		: '';

	// Export every detected server-action function so the route module
	// can re-export them as its own `actions` (layout actions bubble up
	// the chain to the page's exported `actions` table; the dispatcher
	// looks up `match.module.actions[name]` without needing any
	// layout-awareness at the runtime level).
	const layoutActionExportEntries = Array.from(layoutActionNames)
		.map((name) => `\t${JSON.stringify(name)}: ${name},`)
		.join('\n');
	const layoutActionsExport = layoutActionExportEntries
		? `\nexport const actions = {\n${layoutActionExportEntries}\n};\n`
		: '';

	// Inside `render(data, __content)`, shadow every action identifier
	// with its per-request state object (`{ error, loading, success }`).
	// Seeded by the dispatcher before render; same mechanism as pages.
	const layoutActionStateDecls = Array.from(layoutActionNames)
		.map(
			(name) =>
				`\tconst ${name} = (data && data[${JSON.stringify(name)}]) ?? { error: undefined, loading: false, success: false };`,
		)
		.join('\n');

	return `${streamRuntimeImport}${moduleImports}
${layoutActionsExport}
export const hasLayout = true;
export async function render(data, __content) {
${requestImportDecls}
${layoutActionStateDecls}
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

/**
 * Emit the JS that composes the route's HTML through every layout in
 * its chain, innermost-first. The chain is received outermost-first
 * (so `chain[0]` is the root-most layout wrapping everything); we
 * reverse at compose time so the first wrap is the innermost layout
 * — that layout receives the raw route HTML, and its output becomes
 * the child content for the next-outer layout.
 *
 * Returns a sequence of `const` assignments feeding a final
 * `__layoutHtml` that the route emission hands to `__kuratchiApp.render`.
 *
 * When the chain is empty, falls back to the legacy single-module
 * `__kuratchiLayout` import (which resolves to a no-op stub when the
 * project has no root layout file). This preserves behavior for
 * existing apps with no layouts at all.
 */
function composeLayoutChain(chain: string[]): string {
	if (chain.length === 0) {
		return `const __layoutHtml = await __kuratchiLayout.render(data, __routeHtml);`;
	}
	const lines: string[] = [`let __layoutHtml = __routeHtml;`];
	// Reverse to innermost-first. Each wrap's output feeds the next.
	for (const layoutPath of [...chain].reverse()) {
		const hash = layoutModuleHash(layoutPath);
		lines.push(`__layoutHtml = await __kuratchiLayout_${hash}.render(data, __layoutHtml);`);
	}
	return lines.join('\n\t');
}

function transformRouteFile(
	source: string,
	importerAbsPath: string,
	clientFragments: Map<string, ClientFragment>,
	isProduction: boolean = false,
	layoutChain: string[] = [],
): string {
	const { source: preprocessedSource, fragmentHashes, leadingHash } = extractClientFragments(
		source,
		importerAbsPath,
		clientFragments,
		isProduction,
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

	// Dispatch rule for `on<event>={fn(args)}` matches the Kuratchi CLI:
	//
	//   1. If `fn` is imported from `$server/*`              → server action
	//      (POSTs to the route URL via the action dispatcher).
	//   2. Else, if `fn` is a known client binding           → client handler
	//      (either a `$lib/*` import or a function declared
	//       in the top `<script>` block).
	//   3. Else                                              → native inline
	//      `<button onclick="fn(args)">` — legacy escape hatch.
	//
	// The `compileTemplate` branch at `template.ts:1030` dispatches rule
	// 1 vs rules 2/3 based on whether the callee name is present in
	// `actionNames`. So `actionNames` must contain EXACTLY the server-
	// action callees — no more, no less.
	//
	// `parsed.actionFunctions` from the parser conflates both categories
	// (it collects every `action={…}` + every `on<event>={…}` callee).
	// We filter it down to just the ones that are also `$server/*`
	// imports. That matches the CLI's effective behavior: only functions
	// authored as server work become server-action dispatches.
	const rawActionFunctions = parsed.actionFunctions ?? [];
	const serverRpcFunctions = new Set(parsed.serverRpcFunctions ?? []);
	const actionNames = new Set(
		rawActionFunctions.filter((name) => serverRpcFunctions.has(name)),
	);

	// Per-route event-handler registry. Consumed by `compileTemplate`
	// whenever it sees an `on<event>={…}` attribute. The registry was
	// created during `extractClientFragments` and pre-populated from a
	// template scan, so handler IDs here match what the leading
	// fragment's browser bundle registers with `__kuratchiClient`.
	const handlerRegistry = leadingHash
		? clientFragments.get(leadingHash)?.handlerRegistry ?? null
		: null;

	// Async boundaries — auto-detected from the template. For every
	// top-level `if/else-if/else` chain whose conditions reference
	// `X.pending | X.error | X.success`, the framework pulls that
	// chain out, compiles it into a render closure, and (at render
	// time) registers it with the stream collector. Authors write
	// plain template control flow — no `<Boundary>` wrapper required.
	//
	// An identifier qualifies as an async binding when it is
	// (a) declared at the top level of the leading `<script>` AND
	// (b) accessed in the template via `.pending`.
	//
	// `.pending` is the AsyncValue tell — server action state
	// (`.error | .loading | .success`) never uses it, regular objects
	// don't have it either, so seeing `X.pending` is an unambiguous
	// signal that X is an AsyncValue binding.
	const topLevelDataVars = new Set(parsed.dataVars ?? []);
	const asyncBindings = new Set(
		[...detectAsyncBindings(template)].filter((name) => topLevelDataVars.has(name)),
	);
	const boundaryExtraction = extractAsyncBoundaries(template, asyncBindings);
	const boundariesUsed = boundaryExtraction.boundaries.length > 0;

	// `clientRouteRegistry` is typed in `@kuratchi/js` against a private
	// internal interface we can't import by name. Structural typing
	// handles the shape — the method surface we expose matches exactly.
	let body = compileTemplate(boundaryExtraction.template, undefined, actionNames, undefined, {
		clientRouteRegistry: handlerRegistry as any,
	});

	// NOTE: a brace-balance pre-check was attempted here but produced
	// false positives because `compileTemplate` legitimately emits JS
	// where string-literal or template-interpolation braces don't net
	// to zero at the token-level when analyzed without a full JS parser.
	// A proper implementation would need to acorn-parse the emitted body
	// and surface the first unbalanced brace at its source-line. Left
	// for follow-up; for now, Rollup's downstream "return not allowed
	// here" error points at the route module and is enough to find a
	// stray `}` in the template by visual inspection.
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

	// Stream-boundary rewrite. For each detected if-chain:
	//
	//  1. Compile the chain's source into a render closure parameterized
	//     on every async binding it references. The same closure is
	//     invoked at SSR time with pending AsyncValues (rendering the
	//     skeleton branch) and at stream-resolve time with success or
	//     error AsyncValues (rendering the final branch).
	//
	//  2. Capture each binding's underlying promise before the register
	//     call reassigns the binding to a pending AsyncValue.
	//
	//  3. Combine the promises with `Promise.all` — the chain streams
	//     atomically when ALL referenced bindings settle, matching how
	//     an author reasons about "this block needs a, b, and c ready
	//     before it can render."
	//
	//  4. Emit `boundaryPlaceholder(id, initialHTML)` wrapping the
	//     closure's pending-state output. The stream dispatcher later
	//     picks up the registered promise, runs `renderSuccess` /
	//     `renderError`, and streams the resolved chunk.
	for (const boundary of boundaryExtraction.boundaries) {
		const marker = boundary.marker;
		const innerBody = compileTemplate(boundary.chainSource, undefined, actionNames, undefined, {
			clientRouteRegistry: handlerRegistry as any,
		});
		const params = boundary.bindings.join(', ');
		const closureName = `__boundary_${boundary.bindings[0]}_${boundary.index}_render`;
		const closureDef = `const ${closureName} = (${params}) => { ${innerBody}; return __html; };`;

		// Capture each binding's raw value BEFORE reassigning — those
		// raw values are the promises (or already-resolved values) we
		// hand to the stream runtime.
		const rawCaptures = boundary.bindings
			.map((b) => `const __boundary_raw_${b} = ${b};`)
			.join('\n\t\t');

		// Combine all raw values through `Promise.resolve` so
		// non-thenable bindings (already resolved literals, rare but
		// possible) flow through cleanly. `Promise.all` waits for every
		// binding to settle; any rejection short-circuits the chain.
		const combinedPromise = `Promise.all([${boundary.bindings
			.map((b) => `Promise.resolve(__boundary_raw_${b})`)
			.join(', ')}])`;

		// renderSuccess: wrap each resolved value back into an
		// AsyncValue<T>(success=true) and pass them positionally into
		// the closure — one per binding.
		const successArgs = boundary.bindings
			.map((_, idx) => `__kuratchiWrapSuccess(__values[${idx}])`)
			.join(', ');
		const successHandler = `(__values) => ${closureName}(${successArgs})`;

		// renderError: the whole chain takes the error branch. Every
		// binding is handed the same error AsyncValue so `if (x.error)`
		// / `if (y.error)` both evaluate true and the closure renders
		// its error branch regardless of which binding actually failed.
		const errorArgs = boundary.bindings.map(() => `__kuratchiWrapError(__message)`).join(', ');
		const errorHandler = `(__message) => ${closureName}(${errorArgs})`;

		// Reassign each binding to a SHARED pending AsyncValue for the
		// initial render. `createPendingValue` returns an empty object
		// with `pending=true, error=null, success=false` — that's what
		// every binding evaluates to during SSR up to the boundary
		// site. Must happen AFTER `rawCaptures` stashes the promises.
		const reassignPending = boundary.bindings
			.map((b) => `${b} = __boundary_pending;`)
			.join('\n\t\t');

		const pendingArgs = boundary.bindings.map(() => '__boundary_pending').join(', ');

		const replacement = `\`);
	{
		${closureDef}
		${rawCaptures}
		const __boundary_id = __kuratchiNextBoundaryId(${JSON.stringify(boundary.bindings.join('-'))});
		const __boundary_pending = __kuratchiRegisterBoundary(
			__boundary_id,
			${combinedPromise},
			${successHandler},
			${errorHandler},
		);
		${reassignPending}
		__parts.push(__kuratchiBoundaryPlaceholder(__boundary_id, ${closureName}(${pendingArgs})));
	}
	__parts.push(\``;
		body = body.split(marker).join(replacement);
	}

	// (Handler registration + bridge are emitted to the leading
	// fragment's browser source during `extractClientFragments`, not
	// here. See `preRegisterHandlers`.)

	// Leading-script dual bundle: emit a JSON data blob + module
	// `<script>` at the very end of the route body. The client bundle
	// reads the blob via `getElementById('__kuratchi_data').textContent`
	// + `JSON.parse(...)` so the payload is never parsed as JavaScript
	// — no risk of XSS via a broken serializer, no visible "live-looking
	// code" in view-source. Matches the pattern Next.js (__NEXT_DATA__),
	// SvelteKit, and Remix (loader data) all use.
	let leadingModuleAppend = '';
	if (leadingHash) {
		const leadingFragment = clientFragments.get(leadingHash);
		const hydrateVars = leadingFragment?.hydrateVars ?? [];
		const hydrateEntries = hydrateVars
			.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))
			.map((name) => `${JSON.stringify(name)}: ${name}`)
			.join(', ');
		// `__params` is always included so `kuratchi:request`'s `params`
		// / `slug` virtual imports have a source on the client. Cost is
		// typically a couple of bytes for `{}` when a route has no params.
		const hydratePayload = `{ ${hydrateEntries}${
			hydrateEntries ? ', ' : ''
		}__params: data.params ?? {} }`;
		const leadingScriptTag =
			'<script type="module" src="${resolveClientAsset(' +
			JSON.stringify(leadingHash) +
			')}"></script>';
		// Module `<script type="module">` is implicitly deferred until
		// the document is parsed, so the JSON blob is always present in
		// the DOM by the time the client bundle evaluates.
		// NB: compileTemplate ends its output with `let __html =
		// __parts.join('')`. We push more onto `__parts` after that
		// join, then re-assign `__html` so the appended markup makes it
		// into the final response.
		//
		// If the route uses any `on<event>={…}`, emit the shared client
		// bridge BEFORE the leading fragment. `<script type="module">`
		// preserves document order, so `window.__kuratchiClient` is
		// defined by the time the leading bundle calls `register(…)`.
		const bridgeTag = leadingFragment?.needsBridge
			? '<script type="module" src="${resolveClientAsset(' +
				JSON.stringify(CLIENT_BRIDGE_HASH) +
				')}"></script>'
			: null;
		const bridgePush = bridgeTag
			? `\n	__parts.push(\`${bridgeTag}\\n\`);`
			: '';
		leadingModuleAppend = `
	__parts.push('<script type="application/json" id="__kuratchi_data">' + __kuratchiSerializeData(${hydratePayload}) + '</' + 'script>\\n');${bridgePush}
	__parts.push(\`${leadingScriptTag}\\n\`);
	__html = __parts.join('');`;
	}

	const manifestImport =
		fragmentHashes.length > 0 || leadingHash
			? `import { resolveClientAsset } from 'kuratchi:manifest';\n`
			: '';

	// Stream-boundary runtime imports. Only emitted for routes that
	// declare a `<Boundary>` element — routes without boundaries pay
	// zero cost. The dispatcher side of the streaming protocol lives
	// in `@kuratchi/vite/runtime/dispatch.js`; these imports give the
	// route's `render()` access to the compile-time primitives.
	const streamRuntimeImport = boundariesUsed
		? `import {\n\t__registerBoundary as __kuratchiRegisterBoundary,\n\t__nextBoundaryId as __kuratchiNextBoundaryId,\n\tboundaryPlaceholder as __kuratchiBoundaryPlaceholder,\n\t__wrapSuccess as __kuratchiWrapSuccess,\n\t__wrapError as __kuratchiWrapError,\n} from '@kuratchi/js/runtime/stream.js';\n`
		: '';

	// Export the action map so the request dispatcher can call server
	// functions referenced via `<form action={fn}>`. Names are preserved
	// — server module imports are hoisted at module scope, so the
	// identifiers are in lexical range at module eval time.
	//
	// Layout actions bubble up: a form `<form action={fn}>` inside any
	// `layout.kuratchi` on the chain should dispatch when the user POSTs
	// to a page under that layout. We spread each layout's `actions`
	// export into our own (outermost→innermost so a page can override a
	// layout action by re-exporting the same name). The dispatcher
	// stays layout-ignorant — it just sees a single `actions` table on
	// the matched page module.
	const actionExportEntries = Array.from(actionNames)
		.map((name) => `\t${JSON.stringify(name)}: ${name},`)
		.join('\n');
	const layoutActionSpreads = layoutChain
		.map((p) => `\t...(__kuratchiLayout_${layoutModuleHash(p)}.actions ?? {}),`)
		.join('\n');
	const mergedActionBody = [layoutActionSpreads, actionExportEntries]
		.filter((chunk) => chunk.length > 0)
		.join('\n');
	const actionsExport = mergedActionBody
		? `\nexport const actions = {\n${mergedActionBody}\n};\n`
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

	// Every route imports the chain of layouts that wrap it, outermost
	// first. The chain is computed in the `load` hook via
	// `layoutChainForRoute`. Each entry gets its own local binding
	// `__kuratchiLayout_<hash>`. If the chain is empty (no layout file
	// anywhere on the ancestor chain), the legacy `kuratchi:layout`
	// module (a no-op when the root layout is absent) is imported so
	// existing setups without nested layouts still behave as before.
	const layoutChainImports = layoutChain.length > 0
		? layoutChain
			.map((p) => {
				const hash = layoutModuleHash(p);
				return `import * as __kuratchiLayout_${hash} from ${JSON.stringify(NESTED_LAYOUT_VIRTUAL_PREFIX + hash)};`;
			})
			.join('\n') + '\n'
		: `import * as __kuratchiLayout from 'kuratchi:layout';\n`;
	const layoutImport = `${layoutChainImports}import * as __kuratchiApp from 'kuratchi:app';\n`;

	// `async` so top-level `await` in the leading script (e.g. `const x =
	// await $serverFn()`) is valid inside the function body. Worker
	// callers must `await render()`.
	//
	// `__kuratchiSerializeData` is defined inside `render()` so routes
	// without a leading-script hydration payload still pay zero cost
	// (no closure over a module-level helper, minifiers can DCE it).
	return `${manifestImport}${streamRuntimeImport}${layoutImport}${moduleImports}
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
	const __kuratchiSerializeData = (value) => {
		let s;
		try { s = JSON.stringify(value); } catch { s = undefined; }
		if (s === undefined) return 'null';
		// The payload lives inside <script type="application/json">, so the
		// browser never parses it as JavaScript — no XSS-via-unquoted-JSON.
		// The only remaining hazard is the HTML tokenizer bailing out of
		// the script tag if it encounters a literal '</' sequence; escape
		// '<' (covering '</', '<!--', '<script', etc.) to '\u003c'.
		// U+2028 / U+2029 are preserved valid JSON but some older parsers
		// choke, so we escape them too — cheap insurance.
		return s
			.replace(/</g, '\\\\u003c')
			.replace(/\\u2028/g, '\\\\u2028')
			.replace(/\\u2029/g, '\\\\u2029');
	};

${requestImportDecls}
${actionStateDecls}

	${prelude}

	${body}${leadingModuleAppend}
	const __routeHtml = __html;
	${composeLayoutChain(layoutChain)}
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

function ensureKuratchiTypes(projectRoot: string, workflowNames: string[]): void {
	const typesPath = path.join(projectRoot, GENERATED_TYPES_FILE);
	const source = `declare namespace App {
	interface Locals {
		[key: string]: unknown;
	}
}

${buildVirtualModuleTypeDeclarations(workflowNames)}
`;
	if (fs.existsSync(typesPath)) {
		const existing = fs.readFileSync(typesPath, 'utf-8');
		if (existing === source) return;
	}
	const srcDir = path.dirname(typesPath);
	if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });
	fs.writeFileSync(typesPath, source, 'utf-8');
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
