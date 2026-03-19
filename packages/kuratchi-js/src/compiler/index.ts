/**
 * Compiler �" scans a project's routes/ directory, parses .html files,
 * and generates a single Worker entry point.
 */

import { parseFile, stripTopLevelImports } from './parser.js';
import { compileAssets } from './asset-pipeline.js';
import { compileApiRoute } from './api-route-pipeline.js';
import { createComponentCompiler } from './component-pipeline.js';
import { compileErrorPages } from './error-page-pipeline.js';
import { compileLayoutPlan, finalizeLayoutPlan, type LayoutBuildPlan } from './layout-pipeline.js';
import { compilePageRoute } from './page-route-pipeline.js';
import { discoverRoutes as discoverRoutesPipeline } from './route-discovery.js';
import { prepareRootLayoutSource } from './root-layout-pipeline.js';
import { assembleRouteState } from './route-state-pipeline.js';
import { createServerModuleCompiler } from './server-module-pipeline.js';
import { compileTemplate } from './template.js';
import { transpileTypeScript } from './transpile.js';
import {
  buildWorkerEntrypointSource,
  resolveRuntimeImportPath as resolveRuntimeImportPathPipeline,
} from './worker-output-pipeline.js';
import { syncWranglerConfig as syncWranglerConfigPipeline } from './wrangler-sync.js';
import {
  buildDevAliasDeclarations,
  buildSegmentedScriptBody,
  rewriteImportedFunctionCalls,
  rewriteWorkerEnvAliases,
} from './script-transform.js';
import { filePathToPattern } from '../runtime/router.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export { parseFile } from './parser.js';
export { compileTemplate, generateRenderFunction } from './template.js';

const FRAMEWORK_PACKAGE_NAME = getFrameworkPackageName();
const RUNTIME_CONTEXT_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/context.js`;
const RUNTIME_DO_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/do.js`;

function getFrameworkPackageName(): string {
  try {
    const raw = fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8');
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed.name || '@kuratchi/js';
  } catch {
    return '@kuratchi/js';
  }
}

export interface CompileOptions {
  /** Absolute path to the project root */
  projectDir: string;
  /** Override path for routes.js (default: .kuratchi/routes.js). worker.js is always co-located. */
  outFile?: string;
  /** Whether this is a dev build (sets __kuratchi_DEV__ global) */
  isDev?: boolean;
}

export interface CompiledRoute {
  /** Route pattern (e.g., '/todos', '/blog/:slug') */
  pattern: string;
  /** Relative file path from routes/ (e.g., 'todos', 'blog/[slug]') */
  filePath: string;
  /** Whether it has a load function */
  hasLoad: boolean;
  /** Whether it has actions */
  hasActions: boolean;
  /** Whether it has RPC functions */
  hasRpc: boolean;
}

/**
 * Compile a project's src/routes/ into .kuratchi/routes.js
 *
 * The generated module exports { app } �" an object with a fetch() method
 * that handles routing, load functions, form actions, and rendering.
 * Returns the path to .kuratchi/worker.js � the stable wrangler entry point that
 * re-exports everything from routes.js (default fetch handler + named DO class exports).
 * No src/index.ts is needed in user projects.
 */
export function compile(options: CompileOptions): string {
  const { projectDir } = options;
  const srcDir = path.join(projectDir, 'src');
  const routesDir = path.join(srcDir, 'routes');

  if (!fs.existsSync(routesDir)) {
    throw new Error(`Routes directory not found: ${routesDir}`);
  }

  // Discover all .html route files
  const routeFiles = discoverRoutesPipeline(routesDir);
  const componentCompiler = createComponentCompiler({
    projectDir,
    srcDir,
    isDev: !!options.isDev,
  });

  // App layout: src/routes/layout.html (convention �" wraps all routes automatically)
  const layoutFile = path.join(routesDir, 'layout.html');
  let compiledLayout: string | null = null;
  let layoutPlan: LayoutBuildPlan | null = null;
  if (fs.existsSync(layoutFile)) {
    const layoutImportSource = fs.readFileSync(layoutFile, 'utf-8');
    const themeCSS = readUiTheme(projectDir);
    const uiConfigValues = readUiConfigValues(projectDir);
    const source = prepareRootLayoutSource({
      source: layoutImportSource,
      isDev: !!options.isDev,
      themeCss: themeCSS,
      uiConfigValues,
    });
    layoutPlan = compileLayoutPlan({
      renderSource: source,
      importSource: layoutImportSource,
      layoutFile,
      isDev: !!options.isDev,
      componentCompiler,
    });
    compiledLayout = layoutPlan.compiledLayout;
  }

  // Custom error pages: src/routes/NNN.html (e.g. 404.html, 500.html, 401.html, 403.html)
  // Only compiled if the user explicitly creates them �" otherwise the framework's built-in default is used
  const compiledErrorPages = compileErrorPages(routesDir);

  // Read assets prefix from kuratchi.config.ts (default: /assets/)
  const assetsPrefix = readAssetsPrefix(projectDir);

  // Read kuratchi.config.ts at build time to discover ORM database configs
  const ormDatabases = readOrmConfig(projectDir);

  // Read auth config from kuratchi.config.ts
  const authConfig = readAuthConfig(projectDir);

  // Auto-discover Durable Objects from .do.ts files (config optional, only needed for stubId)
  const configDoEntries = readDoConfig(projectDir);
  const { config: doConfig, handlers: doHandlers } = discoverDurableObjects(srcDir, configDoEntries, ormDatabases);
  // Auto-discover convention-based worker class files (no config needed)
  const containerConfig = discoverContainerFiles(projectDir);
  const workflowConfig = discoverWorkflowFiles(projectDir);
  const agentConfig = discoverConventionClassFiles(projectDir, path.join('src', 'server'), '.agent.ts', '.agent');

  // Generate handler proxy modules in .kuratchi/do/ (must happen BEFORE route processing
  // so that $durable-objects/X imports can be redirected to the generated proxies)
  const doProxyDir = path.join(projectDir, '.kuratchi', 'do');
  const doHandlerProxyPaths = new Map<string, string>();
  const registerDoProxyPath = (sourceAbsNoExt: string, proxyAbsNoExt: string) => {
    doHandlerProxyPaths.set(sourceAbsNoExt.replace(/\\/g, '/'), proxyAbsNoExt.replace(/\\/g, '/'));
  };
  if (doHandlers.length > 0) {
    if (!fs.existsSync(doProxyDir)) fs.mkdirSync(doProxyDir, { recursive: true });

    for (const handler of doHandlers) {
      const proxyCode = generateHandlerProxy(handler, projectDir);
      const proxyFile = path.join(doProxyDir, handler.fileName + '.js');
      const proxyFileDir = path.dirname(proxyFile);
      if (!fs.existsSync(proxyFileDir)) fs.mkdirSync(proxyFileDir, { recursive: true });
      writeIfChanged(proxyFile, proxyCode);
      const handlerAbsNoExt = handler.absPath.replace(/\\/g, '/').replace(/\.ts$/, '');
      const proxyAbsNoExt = proxyFile.replace(/\\/g, '/').replace(/\.js$/, '');
      registerDoProxyPath(handlerAbsNoExt, proxyAbsNoExt);
      // Backward-compatible alias for '.do' suffix.
      registerDoProxyPath(handlerAbsNoExt.replace(/\.do$/, ''), proxyAbsNoExt.replace(/\.do$/, ''));
      // Backward-compatible alias for `$durable-objects/<name>` imports.
      registerDoProxyPath(path.join(srcDir, 'durable-objects', handler.fileName).replace(/\\/g, '/'), proxyAbsNoExt);
      registerDoProxyPath(
        path.join(srcDir, 'durable-objects', handler.fileName.replace(/\.do$/, '')).replace(/\\/g, '/'),
        proxyAbsNoExt.replace(/\.do$/, ''),
      );
      if (handler.fileName.endsWith('.do')) {
        const aliasFileName = handler.fileName.slice(0, -3);
        const aliasProxyFile = path.join(doProxyDir, aliasFileName + '.js');
        const aliasCode = `// Auto-generated alias for .do handler\nexport * from './${handler.fileName}.js';\n`;
        const aliasProxyDir = path.dirname(aliasProxyFile);
        if (!fs.existsSync(aliasProxyDir)) fs.mkdirSync(aliasProxyDir, { recursive: true });
        writeIfChanged(aliasProxyFile, aliasCode);
        registerDoProxyPath(handlerAbsNoExt.replace(/\.do$/, ''), aliasProxyFile.replace(/\\/g, '/').replace(/\.js$/, ''));
      }
    }
  }
  const serverModuleCompiler = createServerModuleCompiler({
    projectDir,
    srcDir,
    doHandlerProxyPaths,
    writeFile: writeIfChanged,
  });

  // Parse and compile each route
  const compiledRoutes: string[] = [];
  const allImports: string[] = [];

  let moduleCounter = 0;

  // Layout server import resolution �" resolve non-component imports to module IDs
  let isLayoutAsync = false;
  let compiledLayoutActions: string | null = null;
  if (layoutPlan) {
    const finalizedLayout = finalizeLayoutPlan({
      plan: layoutPlan,
      layoutFile,
      projectDir,
      resolveCompiledImportPath: serverModuleCompiler.resolveCompiledImportPath,
      allocateModuleId: () => `__m${moduleCounter++}`,
      pushImport: (statement) => allImports.push(statement),
      componentCompiler,
    });
    compiledLayout = finalizedLayout.compiledLayout;
    compiledLayoutActions = finalizedLayout.compiledLayoutActions;
    isLayoutAsync = finalizedLayout.isLayoutAsync;
  }

  for (let i = 0; i < routeFiles.length; i++) {
    const rf = routeFiles[i];
    const fullPath = path.join(routesDir, rf.file);
    const pattern = filePathToPattern(rf.name);

    // -- API route (index.ts / index.js) --
    if (rf.type === 'api') {
      compiledRoutes.push(compileApiRoute({
        pattern,
        fullPath,
        projectDir,
        transformModule: serverModuleCompiler.transformModule,
        allocateModuleId: () => `__m${moduleCounter++}`,
        pushImport: (statement) => allImports.push(statement),
      }));
      continue;
    }

    // -- Page route (page.html) --
    const source = fs.readFileSync(fullPath, 'utf-8');
    const parsed = parseFile(source, { kind: 'route', filePath: fullPath });
    const routeState = assembleRouteState({
      parsed,
      fullPath,
      routesDir,
      layoutRelativePaths: rf.layouts,
    });

    compiledRoutes.push(compilePageRoute({
      pattern,
      routeIndex: i,
      projectDir,
      isDev: !!options.isDev,
      routeState,
      componentCompiler,
      resolveCompiledImportPath: serverModuleCompiler.resolveCompiledImportPath,
      allocateModuleId: () => `__m${moduleCounter++}`,
      pushImport: (statement) => allImports.push(statement),
    }));
  }

  // Scan src/assets/ for static files to embed (recursive)
  const compiledAssets = compileAssets(path.join(srcDir, 'assets'));

  // Collect only the components that were actually imported by routes
  const compiledComponents = componentCompiler.getCompiledComponents();

  // Generate the routes module
  const rawRuntimeImportPath = resolveRuntimeImportPathPipeline(projectDir);
  let runtimeImportPath: string | undefined;
  if (rawRuntimeImportPath) {
    // Resolve the runtime file's absolute path and pass it through the server module compiler
    // so that $durable-objects/* and other project imports get rewritten to their proxies.
    const runtimeAbs = path.resolve(path.join(projectDir, '.kuratchi'), rawRuntimeImportPath);
    const transformedRuntimePath = serverModuleCompiler.transformModule(runtimeAbs);
    const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.js');
    runtimeImportPath = serverModuleCompiler.toModuleSpecifier(outFile, transformedRuntimePath);
  }
  const hasRuntime = !!runtimeImportPath;
  const output = generateRoutesModule({
    projectDir,
    serverImports: allImports,
    compiledRoutes,
    compiledLayout,
    compiledComponents,
    compiledAssets,
    compiledErrorPages,
    ormDatabases,
    authConfig,
    doConfig,
    doHandlers,
    workflowConfig,
    isDev: options.isDev ?? false,
    isLayoutAsync,
    compiledLayoutActions,
    hasRuntime,
    runtimeImportPath,
    assetsPrefix,
  });

  // Write to .kuratchi/routes.js
  const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.js');
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  writeIfChanged(outFile, output);

  // Generate .kuratchi/worker.js � the stable wrangler entry point.
  // routes.js already exports the default fetch handler and all named DO classes;
  // worker.js explicitly re-exports them so wrangler.jsonc can reference a
  // stable filename while routes.js is freely regenerated.
  const workerFile = path.join(outDir, 'worker.js');
  writeIfChanged(workerFile, buildWorkerEntrypointSource({
    projectDir,
    outDir,
    doClassNames: doConfig.map((entry) => entry.className),
    workerClassEntries: [...agentConfig, ...containerConfig, ...workflowConfig],
  }));

  // Auto-sync wrangler.jsonc with workflow/container/DO config from kuratchi.config.ts
  syncWranglerConfigPipeline({
    projectDir,
    config: {
      workflows: workflowConfig,
      containers: containerConfig,
      durableObjects: doConfig,
    },
    writeFile: writeIfChanged,
  });

  return workerFile;
}

// �"��"� Helpers �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

/**
 * Write a file only if its content has changed.
 * Prevents unnecessary filesystem events that would retrigger wrangler's file watcher.
 */
function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

type ConfigBlockKind = 'call-object' | 'call-empty';

interface ConfigBlockMatch {
  kind: ConfigBlockKind;
  body: string;
}

function skipWhitespace(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

function extractBalancedBody(source: string, start: number, openChar: string, closeChar: string): string | null {
  if (source[start] !== openChar) return null;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    else if (source[i] === closeChar) {
      depth--;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

function readConfigBlock(source: string, key: string): ConfigBlockMatch | null {
  const keyRegex = new RegExp(`\\b${key}\\s*:`);
  const keyMatch = keyRegex.exec(source);
  if (!keyMatch) return null;

  const colonIdx = source.indexOf(':', keyMatch.index);
  if (colonIdx === -1) return null;

  const valueIdx = skipWhitespace(source, colonIdx + 1);
  if (valueIdx >= source.length) return null;

  if (source[valueIdx] === '{') {
    throw new Error(`[kuratchi] "${key}" config must use an adapter call (e.g. ${key}: kuratchi${key[0].toUpperCase()}${key.slice(1)}Config({...})).`);
  }

  const callOpen = source.indexOf('(', valueIdx);
  if (callOpen === -1) return null;
  const argIdx = skipWhitespace(source, callOpen + 1);
  if (argIdx >= source.length) return null;

  if (source[argIdx] === ')') return { kind: 'call-empty', body: '' };
  if (source[argIdx] === '{') {
    const body = extractBalancedBody(source, argIdx, '{', '}');
    if (body == null) return null;
    return { kind: 'call-object', body };
  }

  return { kind: 'call-empty', body: '' };
}

/**
 * Read ui.theme from kuratchi.config.ts and return the theme CSS content.
 * Returns null if no theme is configured.
 */
function readUiTheme(projectDir: string): string | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const uiBlock = readConfigBlock(source, 'ui');
  if (!uiBlock) return null;

  // Adapter form defaults to the bundled Kuratchi UI theme when ui config is present.
  const themeMatch = uiBlock.body.match(/theme\s*:\s*['"]([^'"]+)['"]/);
  const themeValue = themeMatch?.[1] ?? 'default';

  if (themeValue === 'default' || themeValue === 'dark' || themeValue === 'light' || themeValue === 'system') {
    // Resolve @kuratchi/ui/src/styles/theme.css from package
    const candidates = [
      path.join(projectDir, 'node_modules', '@kuratchi/ui', 'src', 'styles', 'theme.css'),
      path.join(path.resolve(projectDir, '../..'), 'packages', 'kuratchi-ui', 'src', 'styles', 'theme.css'),
      path.join(path.resolve(projectDir, '../..'), 'node_modules', '@kuratchi/ui', 'src', 'styles', 'theme.css'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf-8');
      }
    }
    console.warn(`[kuratchi] ui.theme: "${themeValue}" configured but @kuratchi/ui theme.css not found`);
    return null;
  }

  // Custom path �" resolve relative to project root
  const customPath = path.resolve(projectDir, themeValue);
  if (fs.existsSync(customPath)) {
    return fs.readFileSync(customPath, 'utf-8');
  }

  console.warn(`[kuratchi] ui.theme: "${themeValue}" not found at ${customPath}`);
  return null;
}

/**
 * Read ui.theme and ui.radius config values from kuratchi.config.ts.
 * Returns null if no ui block is present.
 */
function readUiConfigValues(projectDir: string): { theme: string; radius: string } | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;
  const source = fs.readFileSync(configPath, 'utf-8');
  const uiBlock = readConfigBlock(source, 'ui');
  if (!uiBlock) return null;
  const themeMatch = uiBlock.body.match(/theme\s*:\s*['"]([^'"]+)['"]/);
  const radiusMatch = uiBlock.body.match(/radius\s*:\s*['"]([^'"]+)['"]/);
  return {
    theme: themeMatch?.[1] ?? 'dark',
    radius: radiusMatch?.[1] ?? 'default',
  };
}

/**
 * Patch the opening <html> tag in a layout source string to reflect ui config.
 * theme='dark'   ? ensures class="dark" is present, removes data-theme.
 * theme='light'  ? ensures class="dark" is absent, removes data-theme.
 * theme='system' ? removes class="dark", sets data-theme="system".
 * radius='none'|'full' ? sets data-radius; radius='default' ? removes it.
 */
interface RouteFile {
  /** File path relative to routes/ (e.g., 'todos.html') */
  file: string;
  /** Route name without extension (e.g., 'todos', 'blog/[slug]') */
  name: string;
  /** Applicable layout files (outermost -> innermost), relative to routes/ */
  layouts: string[];
  /** Route type: 'page' for .html routes, 'api' for route.ts/route.js */
  type: 'page' | 'api';
}

function discoverRoutes(routesDir: string): RouteFile[] {
  const results: RouteFile[] = [];
  const registered = new Set<string>();

  function getLayoutsForPrefix(prefix: string): string[] {
    const layouts: string[] = [];
    if (fs.existsSync(path.join(routesDir, 'layout.html'))) layouts.push('layout.html');
    if (!prefix) return layouts;

    const parts = prefix.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const rel = `${current}/layout.html`;
      if (fs.existsSync(path.join(routesDir, rel))) layouts.push(rel);
    }
    return layouts;
  }

  function walk(dir: string, prefix: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Folder-based page route: routes/db/page.html ? /db
        const pageFile = path.join(dir, entry.name, 'page.html');
        if (fs.existsSync(pageFile)) {
          const routeFile = `${childPrefix}/page.html`;
          if (!registered.has(routeFile)) {
            registered.add(routeFile);
            results.push({ file: routeFile, name: childPrefix, layouts: getLayoutsForPrefix(childPrefix), type: 'page' });
          }
        }
        // Folder-based API route: routes/api/v1/health/index.ts -> /api/v1/health
        const apiFile = ['index.ts', 'index.js'].find(f =>
          fs.existsSync(path.join(dir, entry.name, f))
        );
        if (apiFile && !fs.existsSync(pageFile)) {
          const routeFile = `${childPrefix}/${apiFile}`;
          if (!registered.has(routeFile)) {
            registered.add(routeFile);
            results.push({ file: routeFile, name: childPrefix, layouts: [], type: 'api' });
          }
        }
        // Always recurse into subdirectory (for nested routes like /admin/roles)
        walk(path.join(dir, entry.name), childPrefix);
      } else if (entry.name === 'layout.html' || entry.name === '404.html' || entry.name === '500.html') {
        // Skip � layout.html is the app layout, 404/500 are error pages, not routes
        continue;
      } else if (entry.name === 'index.ts' || entry.name === 'index.js') {
        // API route file in current directory -> index API route for this prefix
        const routeFile = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!registered.has(routeFile)) {
          registered.add(routeFile);
          results.push({ file: routeFile, name: prefix || 'index', layouts: [], type: 'api' });
        }
      } else if (entry.name === 'page.html') {
        // page.html in current directory ? index route for this prefix
        const routeFile = prefix ? `${prefix}/page.html` : 'page.html';
        if (!registered.has(routeFile)) {
          registered.add(routeFile);
          results.push({ file: routeFile, name: prefix || 'index', layouts: getLayoutsForPrefix(prefix), type: 'page' });
        }
      } else if (entry.name.endsWith('.html') && entry.name !== 'page.html') {
        // File-based route: routes/about.html ? /about (fallback)
        const name = prefix
          ? `${prefix}/${entry.name.replace('.html', '')}`
          : entry.name.replace('.html', '');
        results.push({
          file: prefix ? `${prefix}/${entry.name}` : entry.name,
          name,
          layouts: getLayoutsForPrefix(prefix),
          type: 'page',
        });
      }
    }
  }

  walk(routesDir, '');

  // Sort: static routes first, then dynamic, then catch-all
  results.sort((a, b) => {
    const aScore = a.name.includes('[...') ? 2 : a.name.includes('[') ? 1 : 0;
    const bScore = b.name.includes('[...') ? 2 : b.name.includes('[') ? 1 : 0;
    return aScore - bScore || a.name.localeCompare(b.name);
  });

  return results;
}

function buildRouteObject(opts: {
  index: number;
  pattern: string;
  renderBody: string;
  isDev: boolean;
  parsed: ReturnType<typeof parseFile>;
  fnToModule: Record<string, string>;
  rpcNameMap?: Map<string, string>;
  componentStyles: string[];
}): string {
  const { pattern, renderBody, isDev, parsed, fnToModule, rpcNameMap, componentStyles } = opts;
  const hasFns = Object.keys(fnToModule).length > 0;

  const parts: string[] = [];
  parts.push(`    pattern: '${pattern}'`);

  const queryVars = ((parsed as any).dataGetQueries as Array<{ asName: string }> | undefined)?.map((q) => q.asName) ?? [];
  const scriptSegments = (((parsed as any).scriptSegments as Array<{ script: string; dataVars: string[] }> | undefined) ?? [])
    .filter((segment) => !!segment.script);
  const hasSegmentedScripts = scriptSegments.length > 1;
  const routeDevDecls = buildDevAliasDeclarations(parsed.devAliases, isDev);
  const routeImportDecls = (((parsed as any).scriptImportDecls as string[] | undefined) ?? []).join('\n');

  let scriptBody = '';
  let scriptUsesAwait = false;
  if (hasSegmentedScripts) {
    const combinedScript = scriptSegments.map((segment) => stripTopLevelImports(segment.script)).join('\n');
    scriptUsesAwait = /\bawait\b/.test(combinedScript);
    scriptBody = buildSegmentedScriptBody({
      segments: scriptSegments,
      fnToModule,
      importDecls: routeImportDecls,
      workerEnvAliases: parsed.workerEnvAliases,
      devAliases: parsed.devAliases,
      isDev,
      asyncMode: scriptUsesAwait,
    });
  } else {
    scriptBody = parsed.script
      ? stripTopLevelImports(parsed.script)
      : '';
    scriptBody = [routeDevDecls, routeImportDecls, scriptBody].filter(Boolean).join('\n');
    scriptBody = rewriteImportedFunctionCalls(scriptBody, fnToModule);
    scriptBody = rewriteWorkerEnvAliases(scriptBody, parsed.workerEnvAliases);
    scriptUsesAwait = /\bawait\b/.test(scriptBody);
  }

  let explicitLoadFunction = parsed.loadFunction
    ? parsed.loadFunction.replace(/^export\s+/, '').trim()
    : '';
  if (explicitLoadFunction) {
    explicitLoadFunction = [routeDevDecls, explicitLoadFunction].filter(Boolean).join('\n');
    explicitLoadFunction = rewriteImportedFunctionCalls(explicitLoadFunction, fnToModule);
    explicitLoadFunction = rewriteWorkerEnvAliases(explicitLoadFunction, parsed.workerEnvAliases);
    if (routeImportDecls) explicitLoadFunction = explicitLoadFunction.replace('{', `{\n${routeImportDecls}\n`);
  }

  if (explicitLoadFunction && scriptUsesAwait) {
    throw new Error(
      `[kuratchi compiler] ${pattern}\nTop-level await cannot be mixed with export async function load(). Move async server work into load().`,
    );
  }

  if (scriptBody) {
    scriptBody = transpileTypeScript(scriptBody, `route-script:${pattern}.ts`);
  }
  if (explicitLoadFunction) {
    explicitLoadFunction = transpileTypeScript(explicitLoadFunction, `route-load:${pattern}.ts`);
  }
  const scriptReturnVars = parsed.script
    ? parsed.dataVars.filter((v) =>
      !queryVars.includes(v) &&
      !parsed.actionFunctions.includes(v) &&
      !parsed.pollFunctions.includes(v),
    )
    : [];

  // Load function �" internal server prepass for async route script bodies
  // and data-get query state hydration.
  const hasDataGetQueries = Array.isArray((parsed as any).dataGetQueries) && (parsed as any).dataGetQueries.length > 0;
  if (explicitLoadFunction) {
    parts.push(`    load: ${explicitLoadFunction}`);
  } else if ((scriptBody && scriptUsesAwait) || hasDataGetQueries) {
    let loadBody = '';
    if (scriptBody && scriptUsesAwait) {
      loadBody = scriptBody;
    }

    // Inject data-get query state blocks into load scope.
    // Each query exposes:
    //   { state, loading, error, data, empty, success }
    const queries = (parsed as any).dataGetQueries as Array<{ fnName: string; argsExpr: string; asName: string; rpcId?: string }>;
    if (hasDataGetQueries) {
      const queryLines: string[] = [];
      for (const q of queries) {
        const fnName = q.fnName;
        const rpcId = q.rpcId || rpcNameMap?.get(fnName) || fnName;
        const argsExpr = (q.argsExpr || '').trim();
        const asName = q.asName;
        const defaultArgs = argsExpr ? `[${argsExpr}]` : '[]';
        const moduleId = fnToModule[fnName];
        const qualifiedFn = moduleId ? `${moduleId}.${fnName}` : fnName;
        queryLines.push(`let ${asName} = { state: 'loading', loading: true, error: null, data: null, empty: false, success: false };`);
        queryLines.push(`const __qOverride_${asName} = __getLocals().__queryOverride;`);
        queryLines.push(`const __qArgs_${asName} = ${defaultArgs};`);
        queryLines.push(`const __qShouldRun_${asName} = !!(__qOverride_${asName} && __qOverride_${asName}.fn === '${rpcId}' && Array.isArray(__qOverride_${asName}.args) && JSON.stringify(__qOverride_${asName}.args) === JSON.stringify(__qArgs_${asName}));`);
        queryLines.push(`if (__qShouldRun_${asName}) {`);
        queryLines.push(`  try {`);
        queryLines.push(`    const __qData_${asName} = await ${qualifiedFn}(...__qArgs_${asName});`);
        queryLines.push(`    const __qEmpty_${asName} = Array.isArray(__qData_${asName}) ? __qData_${asName}.length === 0 : (__qData_${asName} == null);`);
        queryLines.push(`    ${asName} = { state: __qEmpty_${asName} ? 'empty' : 'success', loading: false, error: null, data: __qData_${asName}, empty: __qEmpty_${asName}, success: !__qEmpty_${asName} };`);
        queryLines.push(`  } catch (err) {`);
        queryLines.push(`    const __qErr_${asName} = (err && err.message) ? String(err.message) : String(err);`);
        queryLines.push(`    ${asName} = { state: 'error', loading: false, error: __qErr_${asName}, data: null, empty: false, success: false };`);
        queryLines.push(`  }`);
        queryLines.push(`}`);
      }
      loadBody = [loadBody, queryLines.join('\n')].filter(Boolean).join('\n');
    }

    const loadReturnVars = [...scriptReturnVars, ...queryVars];
    let returnObj = '';
    if (loadReturnVars.length > 0) {
      if (hasSegmentedScripts && scriptUsesAwait) {
        const segmentReturnEntries = scriptReturnVars.map((name) => name + ': __segmentData.' + name);
        const queryReturnEntries = queryVars
          .filter((name) => !scriptReturnVars.includes(name))
          .map((name) => name);
        returnObj = `
      return { ${[...segmentReturnEntries, ...queryReturnEntries].join(', ')} };`;
      } else {
        returnObj = `
      return { ${loadReturnVars.join(', ')} };`;
      }
    }
    parts.push(`    async load(__routeParams = {}) {
      ${loadBody}${returnObj}
    }`);
  }

  // Actions �" functions referenced via action={fn} in the template
  if (hasFns && parsed.actionFunctions.length > 0) {
    const actionEntries = parsed.actionFunctions
      .map(fn => {
        const moduleId = fnToModule[fn];
        return moduleId ? `'${fn}': ${moduleId}.${fn}` : `'${fn}': ${fn}`;
      })
      .join(', ');
    parts.push(`    actions: { ${actionEntries} }`);
  }

  // RPC �" functions referenced via data-poll={fn(args)} in the template
  if (hasFns && parsed.pollFunctions.length > 0) {
    const rpcEntries = parsed.pollFunctions
      .map(fn => {
        const moduleId = fnToModule[fn];
        const rpcId = rpcNameMap?.get(fn) || fn;
        return moduleId ? `'${rpcId}': ${moduleId}.${fn}` : `'${rpcId}': ${fn}`;
      })
      .join(', ');
    parts.push(`    rpc: { ${rpcEntries} }`);
  }

  // Render function �" template compiled to JS with native flow control
  // Destructure data vars so templates reference them directly (e.g., {todos} not {data.todos})
  // Auto-inject action state objects so templates can reference signIn.error, signIn.loading, etc.
  const renderPrelude = (scriptBody && !scriptUsesAwait) ? scriptBody : '';

  const allVars = [...queryVars];
  if (scriptUsesAwait) {
    for (const v of scriptReturnVars) {
      if (!allVars.includes(v)) allVars.push(v);
    }
  }
  for (const fn of parsed.actionFunctions) {
    if (!allVars.includes(fn)) allVars.push(fn);
  }
  if (!allVars.includes('params')) allVars.push('params');
  if (!allVars.includes('breadcrumbs')) allVars.push('breadcrumbs');
  const destructure = `const { ${allVars.join(', ')} } = data;\n      `;
  // Inject component CSS at compile time (once per route, no runtime dedup)
  // Must come after 'let __html = "";' (first line of renderBody)
  let finalRenderBody = renderBody;
  if (componentStyles.length > 0) {
    const lines = renderBody.split('\n');
    const styleLines = componentStyles.map(css => `__html += \`${css}\\n\`;`);
    finalRenderBody = [lines[0], ...styleLines, ...lines.slice(1)].join('\n');
  }
  parts.push(`    render(data) {
      ${destructure}${renderPrelude ? renderPrelude + '\n      ' : ''}${finalRenderBody}
      return __html;
    }`);

  return `  {\n${parts.join(',\n')}\n  }`;
}

interface OrmDatabaseEntry {
  binding: string;
  schemaImportPath: string;
  schemaExportName: string;
  skipMigrations: boolean;
  type: 'd1' | 'do';
}

function readOrmConfig(projectDir: string): OrmDatabaseEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return [];

  const source = fs.readFileSync(configPath, 'utf-8');
  const ormBlock = readConfigBlock(source, 'orm');
  if (!ormBlock) return [];

  // Extract schema imports: import { todoSchema } from './src/schemas/todo';
  const importMap = new Map<string, string>(); // exportName �' importPath
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(source)) !== null) {
    const names = m[1].split(',').map(n => n.trim()).filter(Boolean);
    const importPath = m[2];
    for (const name of names) {
      importMap.set(name, importPath);
    }
  }

  const databasesIdx = ormBlock.body.search(/databases\s*:\s*\{/);
  if (databasesIdx === -1) return [];
  const dbBraceStart = ormBlock.body.indexOf('{', databasesIdx);
  if (dbBraceStart === -1) return [];
  const databasesBody = extractBalancedBody(ormBlock.body, dbBraceStart, '{', '}');
  if (databasesBody == null) return [];

  // Pattern: BINDING: { schema: schemaName, skipMigrations?: true/false }
  const entries: OrmDatabaseEntry[] = [];
  const entryRegex = /(\w+)\s*:\s*\{\s*schema\s*:\s*(\w+)([^}]*)\}/g;
  while ((m = entryRegex.exec(databasesBody)) !== null) {
    const binding = m[1];
    const schemaExportName = m[2];
    const rest = m[3] || '';

    const skipMatch = rest.match(/skipMigrations\s*:\s*(true|false)/);
    const skipMigrations = skipMatch?.[1] === 'true';

    const typeMatch = rest.match(/type\s*:\s*['"]?(d1|do)['"]?/);
    const type = (typeMatch?.[1] as 'd1' | 'do') ?? 'd1';

    // Only include if the schema name maps to a known import (not 'orm', 'databases', etc.)
    const schemaImportPath = importMap.get(schemaExportName);
    if (!schemaImportPath) continue;

    entries.push({ binding, schemaImportPath, schemaExportName, skipMigrations, type });
  }

  return entries;
}

interface AuthConfigEntry {
  cookieName: string;
  secretEnvKey: string;
  sessionEnabled: boolean;
  hasCredentials: boolean;
  hasActivity: boolean;
  hasRoles: boolean;
  hasOAuth: boolean;
  hasGuards: boolean;
  hasRateLimit: boolean;
  hasTurnstile: boolean;
  hasOrganization: boolean;
}

function readAuthConfig(projectDir: string): AuthConfigEntry | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const authBlockMatch = readConfigBlock(source, 'auth');
  if (!authBlockMatch) return null;
  const authBlock = authBlockMatch.body;

  const cookieMatch = authBlock.match(/cookieName\s*:\s*['"]([^'"]+)['"]/);
  const secretMatch = authBlock.match(/secretEnvKey\s*:\s*['"]([^'"]+)['"]/);
  const sessionMatch = authBlock.match(/sessionEnabled\s*:\s*(true|false)/);

  // Detect sub-configs by looking for the key followed by a colon
  const hasCredentials = /credentials\s*:/.test(authBlock);
  const hasActivity = /activity\s*:/.test(authBlock);
  const hasRoles = /roles\s*:/.test(authBlock);
  const hasOAuth = /oauth\s*:/.test(authBlock);
  const hasGuards = /guards\s*:/.test(authBlock);
  const hasRateLimit = /rateLimit\s*:/.test(authBlock);
  const hasTurnstile = /turnstile\s*:/.test(authBlock);
  const hasOrganization = /organizations\s*:/.test(authBlock);

  return {
    cookieName: cookieMatch?.[1] ?? 'kuratchi_session',
    secretEnvKey: secretMatch?.[1] ?? 'AUTH_SECRET',
    sessionEnabled: sessionMatch?.[1] !== 'false',
    hasCredentials,
    hasActivity,
    hasRoles,
    hasOAuth,
    hasGuards,
    hasRateLimit,
    hasTurnstile,
    hasOrganization,
  };
}

// �"��"� Durable Object config + handler discovery �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

interface DoConfigEntry {
  /** DO namespace binding name (e.g. 'ORG_DB') */
  binding: string;
  /** Exported class name (e.g. 'OrganizationDO') */
  className: string;
  /** The user field path that identifies the DO stub (e.g. 'user.orgId') */
  stubId?: string;
  /** Optional handler file names mapped to this binding (e.g. ['sites.do.ts']) */
  files?: string[];
}

interface WorkerClassConfigEntry {
  /** Binding name (e.g. 'WORDPRESS_CONTAINER', 'NEW_SITE_WORKFLOW') */
  binding: string;
  /** Exported class name (e.g. 'WordPressContainer', 'NewSiteWorkflow') */
  className: string;
  /** Source file path relative to project root */
  file: string;
  /** Whether worker.js should re-export a named or default class export. */
  exportKind: 'named' | 'default';
}

interface ConventionClassEntry {
  /** Exported class name (e.g. 'SessionAgent') */
  className: string;
  /** Source file path relative to project root */
  file: string;
  /** Whether worker.js should re-export a named or default class export. */
  exportKind: 'named' | 'default';
}

interface DoHandlerEntry {
  /** File name without extension (e.g. 'sites') */
  fileName: string;
  /** Absolute path to the handler .ts file */
  absPath: string;
  /** DO binding this handler belongs to */
  binding: string;
  /** Handler mode: class-based or function-based */
  mode: 'class' | 'function';
  /** The default-exported class name (class mode only) */
  className?: string;
  /** Methods extracted from the class body (class mode only) */
  classMethods: DoClassMethodEntry[];
  /** Exported functions (function mode public RPC surface, plus lifecycle hooks) */
  exportedFunctions: string[];
}

interface DoClassMethodEntry {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  hasWorkerContextCalls: boolean;
  callsThisMethods: string[];
}

function toSafeIdentifier(input: string): string {
  const normalized = input.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
}

/**
 * Parse durableObjects config from kuratchi.config.ts.
 *
 * Supports both string shorthand and object form:
 *   durableObjects: {
 *     ORG_DB: { className: 'OrganizationDO', stubId: 'user.orgId' },
 *     CACHE_DB: 'CacheDO'
 *   }
 */
function readDoConfig(projectDir: string): DoConfigEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return [];

  const source = fs.readFileSync(configPath, 'utf-8');

  // Find durableObjects block
  const doIdx = source.search(/durableObjects\s*:\s*\{/);
  if (doIdx === -1) return [];

  const braceStart = source.indexOf('{', doIdx);
  if (braceStart === -1) return [];

  // Balance braces
  let depth = 0, braceEnd = braceStart;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
  }
  const doBlock = source.slice(braceStart + 1, braceEnd);

  const entries: DoConfigEntry[] = [];

  // Match object form: BINDING: { className: '...', stubId: '...' }
  const objRegex = /(\w+)\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let m;
  while ((m = objRegex.exec(doBlock)) !== null) {
    const binding = m[1];
    const body = m[2];

    const cnMatch = body.match(/className\s*:\s*['"](\w+)['"]/);
    if (!cnMatch) continue;

    const entry: DoConfigEntry = { binding, className: cnMatch[1] };

    const stubIdMatch = body.match(/stubId\s*:\s*['"]([^'"]+)['"]/);
    if (stubIdMatch) entry.stubId = stubIdMatch[1];

    const filesMatch = body.match(/files\s*:\s*\[([\s\S]*?)\]/);
    if (filesMatch) {
      const list: string[] = [];
      const itemRegex = /['"]([^'"]+)['"]/g;
      let fm;
      while ((fm = itemRegex.exec(filesMatch[1])) !== null) {
        list.push(fm[1]);
      }
      if (list.length > 0) entry.files = list;
    }

    // (inject config removed �" DO methods are org-scoped, no auto-injection needed)

    entries.push(entry);
  }

  // Match string shorthand: BINDING: 'ClassName' (skip bindings already found)
  const foundBindings = new Set(entries.map(e => e.binding));
  const pairRegex = /(\w+)\s*:\s*['"](\w+)['"]\s*[,}\n]/g;
  while ((m = pairRegex.exec(doBlock)) !== null) {
    if (foundBindings.has(m[1])) continue;
    // Make sure this isn't a nested key like 'className'
    if (['className', 'stubId'].includes(m[1])) continue;
    entries.push({ binding: m[1], className: m[2] });
  }

  return entries;
}

function readWorkerClassConfig(projectDir: string, key: 'containers' | 'workflows'): WorkerClassConfigEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return [];
  const source = fs.readFileSync(configPath, 'utf-8');

  const keyIdx = source.search(new RegExp(`\\b${key}\\s*:\\s*\\{`));
  if (keyIdx === -1) return [];

  const braceStart = source.indexOf('{', keyIdx);
  if (braceStart === -1) return [];
  const body = extractBalancedBody(source, braceStart, '{', '}');
  if (body == null) return [];

  const entries: WorkerClassConfigEntry[] = [];
  const expectedSuffix = key === 'containers' ? '.container' : '.workflow';
  const allowedExt = /\.(ts|js|mjs|cjs)$/i;
  const requiredFilePattern = new RegExp(`\\${expectedSuffix}\\.(ts|js|mjs|cjs)$`, 'i');

  const resolveClassFromFile = (binding: string, filePath: string): { className: string; exportKind: 'named' | 'default' } => {
    if (!requiredFilePattern.test(filePath)) {
      throw new Error(`[kuratchi] ${key}.${binding} must reference a file ending in "${expectedSuffix}.ts|js|mjs|cjs". Received: ${filePath}`);
    }
    if (!allowedExt.test(filePath)) {
      throw new Error(`[kuratchi] ${key}.${binding} file must be a TypeScript or JavaScript module. Received: ${filePath}`);
    }
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`[kuratchi] ${key}.${binding} file not found: ${filePath}`);
    }
    const fileSource = fs.readFileSync(absPath, 'utf-8');
    const defaultClass = fileSource.match(/export\s+default\s+class\s+(\w+)/);
    if (defaultClass) {
      return { className: defaultClass[1], exportKind: 'default' };
    }
    const namedClass = fileSource.match(/export\s+class\s+(\w+)/);
    if (namedClass) {
      return { className: namedClass[1], exportKind: 'named' };
    }
    throw new Error(`[kuratchi] ${key}.${binding} must export a class via "export class X" or "export default class X". File: ${filePath}`);
  };

  // Object form:
  // containers: { WORDPRESS_CONTAINER: { file: 'src/server/containers/wordpress.container.ts', className?: 'WordPressContainer' } }
  // workflows:  { NEW_SITE_WORKFLOW: { file: 'src/server/workflows/new-site.workflow.ts', className?: 'NewSiteWorkflow' } }
  const objRegex = /(\w+)\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(body)) !== null) {
    const binding = m[1];
    const entryBody = m[2];
    const fileMatch = entryBody.match(/file\s*:\s*['"]([^'"]+)['"]/);
    if (!fileMatch) continue;
    const inferred = resolveClassFromFile(binding, fileMatch[1]);
    const classMatch = entryBody.match(/className\s*:\s*['"](\w+)['"]/);
    const className = classMatch?.[1] ?? inferred.className;
    entries.push({
      binding,
      className,
      file: fileMatch[1],
      exportKind: inferred.exportKind,
    });
  }

  // String shorthand:
  // containers: { WORDPRESS_CONTAINER: 'src/server/containers/wordpress.container.ts' }
  // workflows:  { NEW_SITE_WORKFLOW: 'src/server/workflows/new-site.workflow.ts' }
  const foundBindings = new Set(entries.map((e) => e.binding));
  const pairRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]\s*[,}\n]/g;
  while ((m = pairRegex.exec(body)) !== null) {
    const binding = m[1];
    const file = m[2];
    if (foundBindings.has(binding)) continue;
    if (binding === 'file' || binding === 'className') continue;
    const inferred = resolveClassFromFile(binding, file);
    entries.push({
      binding,
      className: inferred.className,
      file,
      exportKind: inferred.exportKind,
    });
  }
  return entries;
}

function resolveClassExportFromFile(absPath: string, errorLabel: string): { className: string; exportKind: 'named' | 'default' } {
  if (!fs.existsSync(absPath)) {
    throw new Error(`[kuratchi] ${errorLabel} file not found: ${absPath}`);
  }
  const fileSource = fs.readFileSync(absPath, 'utf-8');
  const defaultClass = fileSource.match(/export\s+default\s+class\s+(\w+)/);
  if (defaultClass) {
    return { className: defaultClass[1], exportKind: 'default' };
  }
  const namedClass = fileSource.match(/export\s+class\s+(\w+)/);
  if (namedClass) {
    return { className: namedClass[1], exportKind: 'named' };
  }
  throw new Error(`[kuratchi] ${errorLabel} must export a class via "export class X" or "export default class X". File: ${absPath}`);
}

function readAssetsPrefix(projectDir: string): string {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return '/assets/';
  const source = fs.readFileSync(configPath, 'utf-8');
  const match = source.match(/assetsPrefix\s*:\s*['"]([^'"]+)['"]/);
  if (!match) return '/assets/';
  let prefix = match[1];
  if (!prefix.startsWith('/')) prefix = '/' + prefix;
  if (!prefix.endsWith('/')) prefix += '/';
  return prefix;
}

function discoverConventionClassFiles(
  projectDir: string,
  dir: string,
  suffix: string,
  errorLabel: string,
): ConventionClassEntry[] {
  const absDir = path.join(projectDir, dir);
  const files = discoverFilesWithSuffix(absDir, suffix);
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const resolved = resolveClassExportFromFile(absPath, errorLabel);
    return {
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
    };
  });
}

function discoverFilesWithSuffix(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (absDir: string) => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && abs.endsWith(suffix)) {
        out.push(abs);
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * Auto-discover .workflow.ts files in src/server/.
 * Derives binding name from filename: migration.workflow.ts → MIGRATION_WORKFLOW
 * Returns entries compatible with WorkerClassConfigEntry for worker.js export generation.
 */
function discoverWorkflowFiles(projectDir: string): WorkerClassConfigEntry[] {
  const serverDir = path.join(projectDir, 'src', 'server');
  const files = discoverFilesWithSuffix(serverDir, '.workflow.ts');
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const fileName = path.basename(absPath, '.workflow.ts');
    // Derive binding: migration.workflow.ts → MIGRATION_WORKFLOW
    const binding = fileName.toUpperCase().replace(/-/g, '_') + '_WORKFLOW';
    const resolved = resolveClassExportFromFile(absPath, `.workflow`);
    return {
      binding,
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
    };
  });
}

/**
 * Auto-discover .container.ts files in src/server/.
 * Derives binding name from filename: wordpress.container.ts → WORDPRESS_CONTAINER
 * Returns entries compatible with WorkerClassConfigEntry for worker.js export generation.
 */
function discoverContainerFiles(projectDir: string): WorkerClassConfigEntry[] {
  const serverDir = path.join(projectDir, 'src', 'server');
  const files = discoverFilesWithSuffix(serverDir, '.container.ts');
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const fileName = path.basename(absPath, '.container.ts');
    // Derive binding: wordpress.container.ts → WORDPRESS_CONTAINER
    const binding = fileName.toUpperCase().replace(/-/g, '_') + '_CONTAINER';
    const resolved = resolveClassExportFromFile(absPath, `.container`);
    return {
      binding,
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
    };
  });
}

/**
 * Auto-discover Durable Objects from .do.ts files.
 * Returns both DoConfigEntry (for wrangler sync) and DoHandlerEntry (for code gen).
 * 
 * Convention:
 * - File: user.do.ts → Binding: USER_DO
 * - Class: export default class UserDO extends DurableObject
 * - Optional: static binding = 'CUSTOM_BINDING' to override
 */
function discoverDurableObjects(
  srcDir: string,
  configDoEntries: DoConfigEntry[],
  ormDatabases: OrmDatabaseEntry[],
): { config: DoConfigEntry[]; handlers: DoHandlerEntry[] } {
  const serverDir = path.join(srcDir, 'server');
  const legacyDir = path.join(srcDir, 'durable-objects');
  const serverDoFiles = discoverFilesWithSuffix(serverDir, '.do.ts');
  const legacyDoFiles = discoverFilesWithSuffix(legacyDir, '.ts');
  const discoveredFiles = Array.from(new Set([...serverDoFiles, ...legacyDoFiles]));
  
  if (discoveredFiles.length === 0) {
    return { config: configDoEntries, handlers: [] };
  }

  // Build lookup from config for stubId (still needed for auth integration)
  const configByBinding = new Map<string, DoConfigEntry>();
  for (const entry of configDoEntries) {
    configByBinding.set(entry.binding, entry);
  }

  const handlers: DoHandlerEntry[] = [];
  const discoveredConfig: DoConfigEntry[] = [];
  const fileNameToAbsPath = new Map<string, string>();
  const seenBindings = new Set<string>();

  for (const absPath of discoveredFiles) {
    const file = path.basename(absPath);
    const source = fs.readFileSync(absPath, 'utf-8');

    // Must extend DurableObject
    const hasClass = /extends\s+DurableObject\b/.test(source);
    if (!hasClass) continue;

    // Extract class name
    const classMatch = source.match(/export\s+default\s+class\s+(\w+)\s+extends\s+DurableObject/);
    const className = classMatch?.[1] ?? null;
    if (!className) continue;

    // Derive binding from filename or static binding property
    // user.do.ts → USER_DO
    const bindingMatch = source.match(/static\s+binding\s*=\s*['"](\w+)['"]/);
    const baseName = file.replace(/\.do\.ts$/, '').replace(/\.ts$/, '');
    const derivedBinding = baseName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase() + '_DO';
    const binding = bindingMatch?.[1] ?? derivedBinding;

    if (seenBindings.has(binding)) {
      throw new Error(
        `[KuratchiJS] Duplicate DO binding '${binding}' detected. Use 'static binding = "UNIQUE_NAME"' in one of the classes.`,
      );
    }
    seenBindings.add(binding);

    // Extract public class methods for RPC
    const classMethods = extractClassMethods(source, className);

    const fileName = file.replace(/\.ts$/, '');
    const existing = fileNameToAbsPath.get(fileName);
    if (existing && existing !== absPath) {
      throw new Error(
        `[KuratchiJS] Duplicate DO handler file name '${fileName}.ts' detected:\n- ${existing}\n- ${absPath}\nRename one file or move it to avoid proxy name collision.`,
      );
    }
    fileNameToAbsPath.set(fileName, absPath);

    // Merge with config entry if exists (for stubId)
    const configEntry = configByBinding.get(binding);
    
    discoveredConfig.push({
      binding,
      className,
      stubId: configEntry?.stubId,
      files: [file],
    });

    handlers.push({
      fileName,
      absPath,
      binding,
      mode: 'class',
      className,
      classMethods,
      exportedFunctions: [],
    });
  }

  return { config: discoveredConfig, handlers };
}

/**
 * Extract method names from a class body using brace-balanced parsing.
 * Only public methods (no private/protected/underscore prefix) are RPC-accessible.
 */
function extractClassMethods(source: string, className: string): DoClassMethodEntry[] {
  // Find: class ClassName extends DurableObject {
  const classIdx = source.search(new RegExp(`class\\s+${className}\\s+extends\\s+DurableObject`));
  if (classIdx === -1) return [];

  const braceStart = source.indexOf('{', classIdx);
  if (braceStart === -1) return [];

  // Balance braces to find end of class
  let depth = 0, braceEnd = braceStart;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
  }

  const classBody = source.slice(braceStart + 1, braceEnd);

  // Match method declarations with optional visibility/static/async modifiers.
  const methods: DoClassMethodEntry[] = [];
  const methodRegex = /^\s+(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(async)\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{/gm;
  const reserved = new Set([
    'constructor', 'static', 'get', 'set',
    'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
    'void', 'instanceof', 'in', 'of', 'await', 'yield', 'const',
    'let', 'var', 'function', 'class', 'import', 'export', 'default',
    'break', 'continue', 'with', 'super', 'this',
  ]);
  let m;
  while ((m = methodRegex.exec(classBody)) !== null) {
    const visibility = m[1] ?? 'public';
    const isStatic = !!m[2];
    const isAsync = !!m[3];
    const name = m[4]!;
    if (isStatic) continue;
    if (reserved.has(name)) continue;
    const matchText = m[0] ?? '';
    const openRel = matchText.lastIndexOf('{');
    const openAbs = openRel >= 0 ? m.index + openRel : -1;
    let hasWorkerContextCalls = false;
    const callsThisMethods: string[] = [];
    if (openAbs >= 0) {
      let depth = 0;
      let endAbs = openAbs;
      for (let i = openAbs; i < classBody.length; i++) {
        const ch = classBody[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            endAbs = i;
            break;
          }
        }
      }
      const bodySource = classBody.slice(openAbs + 1, endAbs);
      hasWorkerContextCalls = /\b(getCurrentUser|redirect|goto|getRequest|getLocals)\s*\(/.test(bodySource);
      const called = new Set<string>();
      const callRegex = /\bthis\.([A-Za-z_$][\w$]*)\s*\(/g;
      let cm;
      while ((cm = callRegex.exec(bodySource)) !== null) {
        called.add(cm[1]);
      }
      callsThisMethods.push(...called);
    }
    methods.push({
      name,
      visibility: visibility as 'public' | 'private' | 'protected',
      isStatic,
      isAsync,
      hasWorkerContextCalls,
      callsThisMethods,
    });
  }
  return methods;
}

function extractExportedFunctions(source: string): string[] {
  const out: string[] = [];
  const fnRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = fnRegex.exec(source)) !== null) out.push(m[1]);
  return out;
}

/**
 * Generate a proxy module for a DO handler file.
 *
 * The proxy provides auto-RPC function exports.
 * Class mode only: public class methods become RPC exports.
 * Methods starting with underscore or marked private/protected are excluded.
 */
function generateHandlerProxy(handler: DoHandlerEntry, projectDir: string): string {
  const doDir = path.join(projectDir, '.kuratchi', 'do');
  const origRelPath = path.relative(doDir, handler.absPath).replace(/\\/g, '/').replace(/\.ts$/, '.js');
  const handlerLocal = `__handler_${toSafeIdentifier(handler.fileName)}`;
  // Lifecycle methods excluded from RPC
  const lifecycle = new Set(['constructor', 'fetch', 'alarm', 'webSocketMessage', 'webSocketClose', 'webSocketError']);
  
  // Only public methods (not starting with _) are RPC-accessible
  const rpcFunctions = handler.classMethods
    .filter((m) => m.visibility === 'public' && !m.name.startsWith('_') && !lifecycle.has(m.name))
    .map((m) => m.name);

  const methods = handler.classMethods.map((m) => ({ ...m }));
  const methodMap = new Map(methods.map((m) => [m.name, m]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of methods) {
      if (m.hasWorkerContextCalls) continue;
      for (const called of m.callsThisMethods) {
        const target = methodMap.get(called);
        if (target?.hasWorkerContextCalls) {
          m.hasWorkerContextCalls = true;
          changed = true;
          break;
        }
      }
    }
  }

  const workerContextMethods = methods
    .filter((m) => m.visibility === 'public' && m.hasWorkerContextCalls)
    .map((m) => m.name);
  const asyncMethods = methods.filter((m) => m.isAsync).map((m) => m.name);

  const lines: string[] = [
    `// Auto-generated by KuratchiJS compiler �" do not edit.`,
    `import { __getDoStub } from '${RUNTIME_DO_IMPORT}';`,
    `import ${handlerLocal} from '${origRelPath}';`,
    ``,
    `const __FD_TAG = '__kuratchi_form_data__';`,
    `function __isPlainObject(__v) {`,
    `  if (!__v || typeof __v !== 'object') return false;`,
    `  const __proto = Object.getPrototypeOf(__v);`,
    `  return __proto === Object.prototype || __proto === null;`,
    `}`,
    `function __encodeArg(__v, __seen = new WeakSet()) {`,
    `  if (typeof FormData !== 'undefined' && __v instanceof FormData) {`,
    `    return { [__FD_TAG]: Array.from(__v.entries()) };`,
    `  }`,
    `  if (Array.isArray(__v)) return __v.map((__x) => __encodeArg(__x, __seen));`,
    `  if (__isPlainObject(__v)) {`,
    `    if (__seen.has(__v)) throw new Error('[KuratchiJS] Circular object passed to DO RPC');`,
    `    __seen.add(__v);`,
    `    const __out = {};`,
    `    for (const [__k, __val] of Object.entries(__v)) __out[__k] = __encodeArg(__val, __seen);`,
    `    __seen.delete(__v);`,
    `    return __out;`,
    `  }`,
    `  return __v;`,
    `}`,
    `function __decodeArg(__v) {`,
    `  if (Array.isArray(__v)) return __v.map(__decodeArg);`,
    `  if (__isPlainObject(__v)) {`,
    `    const __obj = __v;`,
    `    if (__FD_TAG in __obj) {`,
    `      const __fd = new FormData();`,
    `      const __entries = Array.isArray(__obj[__FD_TAG]) ? __obj[__FD_TAG] : [];`,
    `      for (const __pair of __entries) {`,
    `        if (Array.isArray(__pair) && __pair.length >= 2) __fd.append(String(__pair[0]), __pair[1]);`,
    `      }`,
    `      return __fd;`,
    `    }`,
    `    const __out = {};`,
    `    for (const [__k, __val] of Object.entries(__obj)) __out[__k] = __decodeArg(__val);`,
    `    return __out;`,
    `  }`,
    `  return __v;`,
    `}`,
    ``,
  ];

  if (workerContextMethods.length > 0) {
    lines.push(`const __workerMethods = new Set(${JSON.stringify(workerContextMethods)});`);
    lines.push(`const __asyncMethods = new Set(${JSON.stringify(asyncMethods)});`);
    lines.push(`function __callWorkerMethod(__name, __args) {`);
    lines.push(`  const __self = new Proxy({}, {`);
    lines.push(`    get(_, __k) {`);
    lines.push(`      if (typeof __k !== 'string') return undefined;`);
    lines.push(`      if (__k === 'db') {`);
    lines.push(`        throw new Error("[KuratchiJS] Worker-executed DO method cannot use this.db directly. Move DB access into a non-public method and call it via this.<method>().");`);
    lines.push(`      }`);
      lines.push(`      if (__workerMethods.has(__k)) {`);
      lines.push(`        return (...__a) => ${handlerLocal}.prototype[__k].apply(__self, __a);`);
      lines.push(`      }`);
      lines.push(`      const __local = ${handlerLocal}.prototype[__k];`);
      lines.push(`      if (typeof __local === 'function' && !__asyncMethods.has(__k)) {`);
      lines.push(`        return (...__a) => __local.apply(__self, __a);`);
      lines.push(`      }`);
      lines.push(`      return async (...__a) => { const __s = await __getDoStub('${handler.binding}'); if (!__s) throw new Error('Not authenticated'); return __s[__k](...__a.map((__x) => __encodeArg(__x))); };`);
      lines.push(`    },`);
    lines.push(`  });`);
    lines.push(`  return ${handlerLocal}.prototype[__name].apply(__self, __args.map(__decodeArg));`);
    lines.push(`}`);
    lines.push(``);
  }

  // Export RPC methods
  for (const method of rpcFunctions) {
    if (workerContextMethods.includes(method)) {
      lines.push(`export async function ${method}(...a) { return __callWorkerMethod('${method}', a); }`);
    } else {
      lines.push(
        `export async function ${method}(...a) { const s = await __getDoStub('${handler.binding}'); if (!s) throw new Error('Not authenticated'); return s.${method}(...a.map((__x) => __encodeArg(__x))); }`
      );
    }
  }

  return lines.join('\n') + '\n';
}

function generateRoutesModule(opts: {
  projectDir: string;
  serverImports: string[];
  compiledRoutes: string[];
  compiledLayout: string | null;
  compiledComponents: string[];
  isDev: boolean;
  compiledAssets: { name: string; content: string; mime: string; etag: string }[];
  compiledErrorPages: Map<number, string>;
  ormDatabases: OrmDatabaseEntry[];
  authConfig: AuthConfigEntry | null;
  doConfig: DoConfigEntry[];
  doHandlers: DoHandlerEntry[];
  workflowConfig: WorkerClassConfigEntry[];
  isLayoutAsync: boolean;
  compiledLayoutActions: string | null;
  hasRuntime: boolean;
  runtimeImportPath?: string;
  assetsPrefix: string;
}): string {
  const layoutBlock = opts.compiledLayout ?? 'function __layout(content) { return content; }';
  const layoutActionsBlock = opts.compiledLayoutActions
    ? `const __layoutActions = ${opts.compiledLayoutActions};`
    : 'const __layoutActions = {};';

  // Custom error page overrides (user-created NNN.html files)
  const customErrorFunctions = Array.from(opts.compiledErrorPages.entries())
    .map(([status, fn]) => fn)
    .join('\n\n');

  // Resolve path to the framework's context module from the output directory
  const contextImport = `import { __setRequestContext, __esc, __rawHtml, __sanitizeHtml, __setLocal, __getLocals, buildDefaultBreadcrumbs as __buildDefaultBreadcrumbs } from '${RUNTIME_CONTEXT_IMPORT}';`;
  const runtimeImport = opts.hasRuntime && opts.runtimeImportPath
    ? `import __kuratchiRuntime from '${opts.runtimeImportPath}';`
    : '';

  // Auth session init �" thin cookie parsing injected into Worker entry
  let authInit = '';
  if (opts.authConfig && opts.authConfig.sessionEnabled) {
    const cookieName = opts.authConfig.cookieName;
    authInit = `
// �"��"� Auth Session Init �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function __parseCookies(header) {
  const map = {};
  if (!header) return map;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    map[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return map;
}

function __initAuth(request) {
  const cookies = __parseCookies(request.headers.get('cookie'));
  __setLocal('session', null);
  __setLocal('user', null);
  __setLocal('auth', {
    cookies,
    sessionCookie: cookies['${cookieName}'] || null,
    cookieName: '${cookieName}',
  });
}
`;
  }
  const workerImport = `import { WorkerEntrypoint, env as __env } from 'cloudflare:workers';`;

  // ORM migration imports + init code
  let migrationImports = '';
  let migrationInit = '';
  if (opts.ormDatabases.length > 0) {
    const schemaImports: string[] = [];
    const migrateEntries: string[] = [];

    // Resolve schema import paths relative to .kuratchi output dir
    // Config imports are relative to project root (e.g., './src/schemas/todo')
    // Generated code lives in .kuratchi/routes.js, so we prefix ../ to reach project root
    for (const db of opts.ormDatabases) {
      const resolvedPath = db.schemaImportPath.replace(/^\.\//, '../');
      // Only D1 databases get runtime migration in the Worker fetch handler
      // DO databases are migrated via initDO() in the DO constructor
      if (!db.skipMigrations && db.type === 'd1') {
        schemaImports.push(`import { ${db.schemaExportName} } from '${resolvedPath}';`);
        migrateEntries.push(
          `    { binding: '${db.binding}', schema: ${db.schemaExportName} }`
        );
      }
    }

    if (migrateEntries.length > 0) {
      migrationImports = [
        `import { runMigrations } from '@kuratchi/orm/migrations';`,
        `import { kuratchiORM } from '@kuratchi/orm';`,
        ...schemaImports,
      ].join('\n');

      migrationInit = `
// �"��"� ORM Auto-Migration �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

let __migrated = false;
const __ormDatabases = [
${migrateEntries.join(',\n')}
];

async function __runMigrations() {
  if (__migrated) return;
  __migrated = true;
  for (const db of __ormDatabases) {
    const binding = __env[db.binding];
    if (!binding) continue;
    try {
      const executor = (sql, params) => {
        let stmt = binding.prepare(sql);
        if (params?.length) stmt = stmt.bind(...params);
        return stmt.all().then(r => ({ success: r.success ?? true, data: r.results, results: r.results }));
      };
      const result = await runMigrations({ execute: executor, schema: db.schema });
      if (result.applied) {
        console.log('[kuratchi] ' + db.binding + ': migrated (' + result.statementsRun + ' statements)');
      }
      if (result.warnings.length) {
        result.warnings.forEach(w => console.warn('[kuratchi] ' + db.binding + ': ' + w));
      }
    } catch (err) {
      console.error('[kuratchi] ' + db.binding + ' migration failed:', err.message);
    }
  }
}
`;
    }
  }

  // Auth plugin init �" import config + call @kuratchi/auth setup functions
  let authPluginImports = '';
  let authPluginInit = '';
  const ac = opts.authConfig;
  if (ac && (ac.hasCredentials || ac.hasActivity || ac.hasRoles || ac.hasOAuth || ac.hasGuards || ac.hasRateLimit || ac.hasTurnstile || ac.hasOrganization)) {
    const imports: string[] = [];
    const initLines: string[] = [];

    // Import the config file to read auth sub-configs at runtime
    imports.push(`import __kuratchiConfig from '../kuratchi.config';`);

    if (ac.hasCredentials) {
      imports.push(`import { configureCredentials as __configCreds } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.credentials) __configCreds(__kuratchiConfig.auth.credentials);`);
    }
    if (ac.hasActivity) {
      imports.push(`import { defineActivities as __defActivities } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.activity) __defActivities(__kuratchiConfig.auth.activity);`);
    }
    if (ac.hasRoles) {
      imports.push(`import { defineRoles as __defRoles } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.roles) __defRoles(__kuratchiConfig.auth.roles);`);
    }
    if (ac.hasOAuth) {
      imports.push(`import { configureOAuth as __configOAuth } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.oauth) {`);
      initLines.push(`    const oc = __kuratchiConfig.auth.oauth;`);
      initLines.push(`    const providers = {};`);
      initLines.push(`    if (oc.providers) {`);
      initLines.push(`      for (const [name, cfg] of Object.entries(oc.providers)) {`);
      initLines.push(`        providers[name] = { clientId: __env[cfg.clientIdEnv] || '', clientSecret: __env[cfg.clientSecretEnv] || '', scopes: cfg.scopes };`);
      initLines.push(`      }`);
      initLines.push(`    }`);
      initLines.push(`    __configOAuth({ providers, loginRedirect: oc.loginRedirect });`);
      initLines.push(`  }`);
    }
    if (ac.hasGuards) {
      imports.push(`import { configureGuards as __configGuards, checkGuard as __checkGuard } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.guards) __configGuards(__kuratchiConfig.auth.guards);`);
    }
    if (ac.hasRateLimit) {
      imports.push(`import { configureRateLimit as __configRL, checkRateLimit as __checkRL } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.rateLimit) __configRL(__kuratchiConfig.auth.rateLimit);`);
    }
    if (ac.hasTurnstile) {
      imports.push(`import { configureTurnstile as __configTS, checkTurnstile as __checkTS } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.turnstile) __configTS(__kuratchiConfig.auth.turnstile);`);
    }
    if (ac.hasOrganization) {
      imports.push(`import { configureOrganization as __configOrg } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.organizations) __configOrg(__kuratchiConfig.auth.organizations);`);
    }

    authPluginImports = imports.join('\n');
    authPluginInit = `
// �"��"� Auth Plugin Init �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function __initAuthPlugins() {
${initLines.join('\n')}
}
`;
  }

  // �"��"� Durable Object class generation �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
  let doImports = '';
  let doClassCode = '';
  let doResolverInit = '';

  if (opts.doConfig.length > 0 && opts.doHandlers.length > 0) {
    const doImportLines: string[] = [];
    const doClassLines: string[] = [];
    const doResolverLines: string[] = [];

    doImportLines.push(`import { DurableObject as __DO } from 'cloudflare:workers';`);
    doImportLines.push(`import { initDO as __initDO } from '@kuratchi/orm';`);
    doImportLines.push(`import { __registerDoResolver, __registerDoClassBinding, __setDoContext } from '${RUNTIME_DO_IMPORT}';`);
    doImportLines.push(`const __DO_FD_TAG = '__kuratchi_form_data__';`);
    doImportLines.push(`function __isDoPlainObject(__v) {`);
    doImportLines.push(`  if (!__v || typeof __v !== 'object') return false;`);
    doImportLines.push(`  const __proto = Object.getPrototypeOf(__v);`);
    doImportLines.push(`  return __proto === Object.prototype || __proto === null;`);
    doImportLines.push(`}`);
    doImportLines.push(`function __decodeDoArg(__v) {`);
    doImportLines.push(`  if (Array.isArray(__v)) return __v.map(__decodeDoArg);`);
    doImportLines.push(`  if (__isDoPlainObject(__v)) {`);
    doImportLines.push(`    if (__DO_FD_TAG in __v) {`);
    doImportLines.push(`      const __fd = new FormData();`);
    doImportLines.push(`      const __entries = Array.isArray(__v[__DO_FD_TAG]) ? __v[__DO_FD_TAG] : [];`);
    doImportLines.push(`      for (const __pair of __entries) { if (Array.isArray(__pair) && __pair.length >= 2) __fd.append(String(__pair[0]), __pair[1]); }`);
    doImportLines.push(`      return __fd;`);
    doImportLines.push(`    }`);
    doImportLines.push(`    const __out = {};`);
    doImportLines.push(`    for (const [__k, __val] of Object.entries(__v)) __out[__k] = __decodeDoArg(__val);`);
    doImportLines.push(`    return __out;`);
    doImportLines.push(`  }`);
    doImportLines.push(`  return __v;`);
    doImportLines.push(`}`);

    // We need getCurrentUser and getOrgStubByName for stub resolvers
    doImportLines.push(`import { getCurrentUser as __getCU, getOrgStubByName as __getOSBN } from '@kuratchi/auth';`);

    // Group handlers by binding
    const handlersByBinding = new Map<string, DoHandlerEntry[]>();
    for (const h of opts.doHandlers) {
      const list = handlersByBinding.get(h.binding) ?? [];
      list.push(h);
      handlersByBinding.set(h.binding, list);
    }

    // Import handler files + schema for each DO (class mode only)
    for (const doEntry of opts.doConfig) {
      const handlers = handlersByBinding.get(doEntry.binding) ?? [];
      const ormDb = opts.ormDatabases.find(d => d.binding === doEntry.binding);

      // Import schema (paths are relative to project root; prefix ../ since we're in .kuratchi/)
      if (ormDb) {
        const schemaPath = ormDb.schemaImportPath.replace(/^\.\//, '../');
        doImportLines.push(`import { ${ormDb.schemaExportName} as __doSchema_${doEntry.binding} } from '${schemaPath}';`);
      }

      // Import handler classes (class mode only - extends DurableObject)
      for (const h of handlers) {
        let handlerImportPath = path
          .relative(path.join(opts.projectDir, '.kuratchi'), h.absPath)
          .replace(/\\/g, '/')
          .replace(/\.ts$/, '.js');
        if (!handlerImportPath.startsWith('.')) handlerImportPath = './' + handlerImportPath;
        const handlerVar = `__handler_${toSafeIdentifier(h.fileName)}`;
        doImportLines.push(`import ${handlerVar} from '${handlerImportPath}';`);
      }

      // Generate DO class that extends the user's class (for ORM integration)
      // If no ORM, we just re-export the user's class directly
      if (ormDb) {
        const handler = handlers[0];
        const handlerVar = handler ? `__handler_${toSafeIdentifier(handler.fileName)}` : '__DO';
        const baseClass = handler ? handlerVar : '__DO';
        doClassLines.push(`export class ${doEntry.className} extends ${baseClass} {`);
        doClassLines.push(`  constructor(ctx, env) {`);
        doClassLines.push(`    super(ctx, env);`);
        doClassLines.push(`    this.db = __initDO(ctx.storage.sql, __doSchema_${doEntry.binding});`);
        doClassLines.push(`  }`);
        doClassLines.push(`  async __kuratchiLogActivity(payload) {`);
        doClassLines.push(`    const now = new Date().toISOString();`);
        doClassLines.push(`    try {`);
        doClassLines.push(`      await this.db.activityLog.insert({`);
        doClassLines.push(`        userId: payload?.userId ?? null,`);
        doClassLines.push(`        action: payload?.action,`);
        doClassLines.push(`        detail: payload?.detail ?? null,`);
        doClassLines.push(`        ip: payload?.ip ?? null,`);
        doClassLines.push(`        userAgent: payload?.userAgent ?? null,`);
        doClassLines.push(`        createdAt: now,`);
        doClassLines.push(`        updatedAt: now,`);
        doClassLines.push(`      });`);
        doClassLines.push(`    } catch (err) {`);
        doClassLines.push(`      const msg = String((err && err.message) || err || '');`);
        doClassLines.push(`      if (!msg.includes('userId')) throw err;`);
        doClassLines.push(`      // Backward-compat fallback for org DBs not yet migrated with userId column.`);
        doClassLines.push(`      await this.db.activityLog.insert({`);
        doClassLines.push(`        action: payload?.action,`);
        doClassLines.push(`        detail: payload?.detail ?? null,`);
        doClassLines.push(`        ip: payload?.ip ?? null,`);
        doClassLines.push(`        userAgent: payload?.userAgent ?? null,`);
        doClassLines.push(`        createdAt: now,`);
        doClassLines.push(`        updatedAt: now,`);
        doClassLines.push(`      });`);
        doClassLines.push(`    }`);
        doClassLines.push(`  }`);
        doClassLines.push(`  async __kuratchiGetActivity(options = {}) {`);
        doClassLines.push(`    let query = this.db.activityLog;`);
        doClassLines.push(`    if (options?.action) query = query.where({ action: options.action });`);
        doClassLines.push(`    const result = await query.orderBy({ createdAt: 'desc' }).many();`);
        doClassLines.push(`    const rows = Array.isArray(result?.data) ? result.data : [];`);
        doClassLines.push(`    const limit = Number(options?.limit);`);
        doClassLines.push(`    if (Number.isFinite(limit) && limit > 0) return rows.slice(0, Math.floor(limit));`);
        doClassLines.push(`    return rows;`);
        doClassLines.push(`  }`);
        doClassLines.push(`}`);
      } else if (handlers.length > 0) {
        // No ORM - just re-export the user's class directly
        const handler = handlers[0];
        const handlerVar = `__handler_${toSafeIdentifier(handler.fileName)}`;
        doClassLines.push(`export { ${handlerVar} as ${doEntry.className} };`);
      }

      // Register class binding for RPC
      for (const h of handlers) {
        const handlerVar = `__handler_${toSafeIdentifier(h.fileName)}`;
        doResolverLines.push(`  __registerDoClassBinding(${handlerVar}, '${doEntry.binding}');`);
      }

      // Register stub resolver
      if (doEntry.stubId) {
        // Config-driven: e.g. stubId: 'user.orgId' �' __u.orgId
        const fieldPath = doEntry.stubId.startsWith('user.') ? `__u.${doEntry.stubId.slice(5)}` : doEntry.stubId;
        const checkField = doEntry.stubId.startsWith('user.') ? doEntry.stubId.slice(5) : doEntry.stubId;
        doResolverLines.push(`  __registerDoResolver('${doEntry.binding}', async () => {`);
        doResolverLines.push(`    const __u = await __getCU();`);
        doResolverLines.push(`    if (!__u?.${checkField}) return null;`);
        doResolverLines.push(`    return __getOSBN(${fieldPath});`);
        doResolverLines.push(`  });`);
      } else {
        // No stubId config �" stub must be obtained manually
        doResolverLines.push(`  // No 'stubId' config for ${doEntry.binding} �" stub must be obtained manually`);
      }
    }

    doImports = doImportLines.join('\n');
    doClassCode = `\n// ── Durable Object Classes (generated) ─────────────────────────\n\n` + doClassLines.join('\n') + '\n';
    doResolverInit = `\nfunction __initDoResolvers() {\n${doResolverLines.join('\n')}\n}\n`;
  }

  // Generate workflow status RPC handlers for auto-discovered workflows
  // Naming: migration.workflow.ts -> migrationWorkflowStatus(instanceId)
  let workflowStatusRpc = '';
  if (opts.workflowConfig.length > 0) {
    const rpcLines: string[] = [];
    rpcLines.push(`\n// ── Workflow Status RPCs (auto-generated) ─────────────────────`);
    rpcLines.push(`const __workflowStatusRpc = {`);
    for (const wf of opts.workflowConfig) {
      // file: src/server/migration.workflow.ts -> camelCase RPC name: migrationWorkflowStatus
      const baseName = wf.file.split('/').pop()?.replace(/\.workflow\.ts$/, '') || '';
      const camelName = baseName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const rpcName = `${camelName}WorkflowStatus`;
      rpcLines.push(`  '${rpcName}': async (instanceId) => {`);
      rpcLines.push(`    if (!instanceId) return { status: 'unknown', error: { name: 'Error', message: 'Missing instanceId' } };`);
      rpcLines.push(`    try {`);
      rpcLines.push(`      const instance = await __env.${wf.binding}.get(instanceId);`);
      rpcLines.push(`      return await instance.status();`);
      rpcLines.push(`    } catch (err) {`);
      rpcLines.push(`      return { status: 'errored', error: { name: err?.name || 'Error', message: err?.message || 'Unknown error' } };`);
      rpcLines.push(`    }`);
      rpcLines.push(`  },`);
    }
    rpcLines.push(`};`);
    workflowStatusRpc = rpcLines.join('\n');
  }

  return `// Generated by KuratchiJS compiler �" do not edit.
${opts.isDev ? '\nglobalThis.__kuratchi_DEV__ = true;\n' : ''}
${workerImport}
${contextImport}
${runtimeImport ? runtimeImport + '\n' : ''}${migrationImports ? migrationImports + '\n' : ''}${authPluginImports ? authPluginImports + '\n' : ''}${doImports ? doImports + '\n' : ''}${opts.serverImports.join('\n')}
${workflowStatusRpc}

// ── Assets ─────────────────────────────────────────────────────

const __assets = {
${opts.compiledAssets.map(a => `  ${JSON.stringify(a.name)}: { content: ${JSON.stringify(a.content)}, mime: ${JSON.stringify(a.mime)}, etag: ${JSON.stringify(a.etag)} }`).join(',\n')}
};

// �"��"� Router �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const __staticRoutes = new Map();  // exact path �' index (O(1) lookup)
const __dynamicRoutes = [];        // regex-based routes (params/wildcards)

function __addRoute(pattern, index) {
  if (!pattern.includes(':') && !pattern.includes('*')) {
    // Static route �" direct Map lookup, no regex needed
    __staticRoutes.set(pattern, index);
  } else {
    // Dynamic route �" build regex for param extraction
    const paramNames = [];
    let regexStr = pattern
      .replace(/\\*(\\w+)/g, (_, name) => { paramNames.push(name); return '(?<' + name + '>.+)'; })
      .replace(/:(\\w+)/g, (_, name) => { paramNames.push(name); return '(?<' + name + '>[^/]+)'; });
    __dynamicRoutes.push({ regex: new RegExp('^' + regexStr + '$'), paramNames, index });
  }
}

function __match(pathname) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\\/$/, '');
  // Fast path: static routes (most common)
  const staticIdx = __staticRoutes.get(normalized);
  if (staticIdx !== undefined) return { params: {}, index: staticIdx };
  // Slow path: dynamic routes with params
  for (const route of __dynamicRoutes) {
    const m = normalized.match(route.regex);
    if (m) {
      const params = {};
      for (const name of route.paramNames) params[name] = m.groups?.[name] ?? '';
      return { params, index: route.index };
    }
  }
  return null;
}

// �"��"� Layout �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

${layoutBlock}

${layoutActionsBlock}

// �"��"� Error pages �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const __errorMessages = {
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

// Built-in default error page �" clean, dark, minimal, centered
function __errorPage(status, detail) {
  const title = __errorMessages[status] || 'Error';
  const detailHtml = detail ? '<p style="font-family:ui-monospace,monospace;font-size:0.8rem;color:#555;background:#111;padding:0.5rem 1rem;border-radius:6px;max-width:480px;margin:1rem auto 0;word-break:break-word">' + __esc(detail) + '</p>' : '';
  return '<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem">'
    + '<div>'
    + '<p style="font-size:5rem;font-weight:700;margin:0;color:#333;line-height:1">' + status + '</p>'
    + '<p style="font-size:1rem;color:#555;margin:0.5rem 0 0;letter-spacing:0.05em">' + __esc(title) + '</p>'
    + detailHtml
    + '</div>'
    + '</div>';
}

${customErrorFunctions ? '// Custom error page overrides (user-created NNN.html)\n' + customErrorFunctions + '\n' : ''}
// Dispatch: use custom override if it exists, otherwise built-in default
const __customErrors = {${Array.from(opts.compiledErrorPages.keys()).map(s => ` ${s}: __error_${s}`).join(',')} };

function __error(status, detail) {
  if (__customErrors[status]) return __customErrors[status](detail);
  return __errorPage(status, detail);
}

${opts.compiledComponents.length > 0 ? '// �"��"� Components �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�\n\n' + opts.compiledComponents.join('\n\n') + '\n' : ''}${migrationInit}${authInit}${authPluginInit}${doResolverInit}${doClassCode}
// �"��"� Route definitions �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const routes = [
${opts.compiledRoutes.join(',\n')}
];

for (let i = 0; i < routes.length; i++) __addRoute(routes[i].pattern, i);

// �"��"� Response helpers �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const __defaultSecHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function __secHeaders(response) {
  for (const [k, v] of Object.entries(__defaultSecHeaders)) {
    if (!response.headers.has(k)) response.headers.set(k, v);
  }
  return response;
}

function __attachCookies(response) {
  const cookies = __getLocals().__setCookieHeaders;
  if (cookies && cookies.length > 0) {
    const newResponse = new Response(response.body, response);
    for (const h of cookies) newResponse.headers.append('Set-Cookie', h);
    return __secHeaders(newResponse);
  }
  return __secHeaders(response);
}

function __isSameOrigin(request, url) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === url.origin; } catch { return false; }
}

// Extract fragment content by ID from rendered HTML
function __extractFragment(html, fragmentId) {
  // Find the element with data-poll-id="fragmentId" and extract its innerHTML
  const escaped = fragmentId.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  const openTagRegex = new RegExp('<([a-z][a-z0-9]*)\\\\s[^>]*data-poll-id="' + escaped + '"[^>]*>', 'i');
  const match = html.match(openTagRegex);
  if (!match) return null;
  const tagName = match[1];
  const startIdx = match.index + match[0].length;
  // Find matching closing tag (handle nesting)
  let depth = 1;
  let i = startIdx;
  const closeTag = '</' + tagName + '>';
  const openTag = '<' + tagName;
  while (i < html.length && depth > 0) {
    const nextClose = html.indexOf(closeTag, i);
    const nextOpen = html.indexOf(openTag, i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) return html.slice(startIdx, nextClose);
      i = nextClose + closeTag.length;
    }
  }
  return null;
}

${opts.isLayoutAsync ? 'async ' : ''}function __render(route, data, fragmentId) {
  let html = route.render(data);
  
  // Fragment request: return only the fragment's innerHTML
  if (fragmentId) {
    const fragment = __extractFragment(html, fragmentId);
    if (fragment !== null) {
      return new Response(fragment, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    return new Response('Fragment not found', { status: 404 });
  }
  
  // Full page render
  const headMatch = html.match(/<head>([\\s\\S]*?)<\\/head>/);
  if (headMatch) {
    html = html.replace(headMatch[0], '');
    const layoutHtml = ${opts.isLayoutAsync ? 'await ' : ''}__layout(html);
    return __attachCookies(new Response(layoutHtml.replace('</head>', headMatch[1] + '</head>'), {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    }));
  }
  return __attachCookies(new Response(${opts.isLayoutAsync ? 'await ' : ''}__layout(html), { headers: { 'content-type': 'text/html; charset=utf-8' } }));
}

const __runtimeDef = (typeof __kuratchiRuntime !== 'undefined' && __kuratchiRuntime && typeof __kuratchiRuntime === 'object') ? __kuratchiRuntime : {};
const __runtimeEntries = Object.entries(__runtimeDef).filter(([, step]) => step && typeof step === 'object');

async function __runRuntimeRequest(ctx, next) {
  let idx = -1;
  async function __dispatch(i) {
    if (i <= idx) throw new Error('[kuratchi runtime] next() called multiple times in request phase');
    idx = i;
    const entry = __runtimeEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.request !== 'function') return __dispatch(i + 1);
    return await step.request(ctx, () => __dispatch(i + 1));
  }
  return __dispatch(0);
}

async function __runRuntimeRoute(ctx, next) {
  let idx = -1;
  async function __dispatch(i) {
    if (i <= idx) throw new Error('[kuratchi runtime] next() called multiple times in route phase');
    idx = i;
    const entry = __runtimeEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.route !== 'function') return __dispatch(i + 1);
    return await step.route(ctx, () => __dispatch(i + 1));
  }
  return __dispatch(0);
}

async function __runRuntimeResponse(ctx, response) {
  let out = response;
  for (const [, step] of __runtimeEntries) {
    if (typeof step.response !== 'function') continue;
    out = await step.response(ctx, out);
    if (!(out instanceof Response)) {
      throw new Error('[kuratchi runtime] response handlers must return a Response');
    }
  }
  return out;
}

async function __runRuntimeError(ctx, error) {
  for (const [name, step] of __runtimeEntries) {
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

// �"��"� Exported Worker entrypoint �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export default class extends WorkerEntrypoint {
  async fetch(request) {
    __setRequestContext(this.ctx, request, __env);
${migrationInit ? '    await __runMigrations();\n' : ''}${authInit ? '    __initAuth(request);\n' : ''}${authPluginInit ? '    __initAuthPlugins();\n' : ''}${doResolverInit ? '    __initDoResolvers();\n' : ''}
    const __runtimeCtx = {
      request,
      env: __env,
      ctx: this.ctx,
      url: new URL(request.url),
      params: {},
      locals: __getLocals(),
    };

    const __coreFetch = async () => {
      const request = __runtimeCtx.request;
      const url = __runtimeCtx.url;
      const __fragmentId = request.headers.get('x-kuratchi-fragment');
${ac?.hasRateLimit ? '\n      // Rate limiting - check before route handlers\n      { const __rlRes = await __checkRL(); if (__rlRes) return __secHeaders(__rlRes); }\n' : ''}${ac?.hasTurnstile ? '      // Turnstile bot protection\n      { const __tsRes = await __checkTS(); if (__tsRes) return __secHeaders(__tsRes); }\n' : ''}${ac?.hasGuards ? '      // Route guards - redirect if not authenticated\n      { const __gRes = __checkGuard(); if (__gRes) return __secHeaders(__gRes); }\n' : ''}

      // Serve static assets from src/assets/
      if (url.pathname.startsWith('${opts.assetsPrefix}')) {
        const name = url.pathname.slice('${opts.assetsPrefix}'.length);
        const asset = __assets[name];
        if (asset) {
          if (request.headers.get('if-none-match') === asset.etag) {
            return new Response(null, { status: 304 });
          }
          return new Response(asset.content, {
            headers: { 'content-type': asset.mime, 'cache-control': 'public, max-age=31536000, immutable', 'etag': asset.etag }
          });
        }
        return __secHeaders(new Response('Not Found', { status: 404 }));
      }

      const match = __match(url.pathname);

      if (!match) {
        return __secHeaders(new Response(${opts.isLayoutAsync ? 'await ' : ''}__layout(__error(404)), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }));
      }

      __runtimeCtx.params = match.params;
      const route = routes[match.index];
      __setLocal('params', match.params);

      // API route: dispatch to method handler
      if (route.__api) {
        const method = request.method;
        if (method === 'OPTIONS') {
          const handler = route['OPTIONS'];
          if (typeof handler === 'function') return __secHeaders(await handler(__runtimeCtx));
          const allowed = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].filter(m => typeof route[m] === 'function').join(', ');
          return __secHeaders(new Response(null, { status: 204, headers: { 'Allow': allowed, 'Access-Control-Allow-Methods': allowed } }));
        }
        const handler = route[method];
        if (typeof handler !== 'function') {
          const allowed = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].filter(m => typeof route[m] === 'function').join(', ');
          return __secHeaders(new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'content-type': 'application/json', 'Allow': allowed } }));
        }
        return __secHeaders(await handler(__runtimeCtx));
      }

      const __qFn = request.headers.get('x-kuratchi-query-fn') || '';
      const __qArgsRaw = request.headers.get('x-kuratchi-query-args') || '[]';
      let __qArgs = [];
      try {
        const __parsed = JSON.parse(__qArgsRaw);
        __qArgs = Array.isArray(__parsed) ? __parsed : [];
      } catch {}
      __setLocal('__queryOverride', __qFn ? { fn: __qFn, args: __qArgs } : null);
      if (!__getLocals().__breadcrumbs) {
        __setLocal('breadcrumbs', __buildDefaultBreadcrumbs(url.pathname, match.params));
      }

      // RPC call: GET ?_rpc=fnName&_args=[...] -> JSON response
      const __rpcName = url.searchParams.get('_rpc');
      const __hasRouteRpc = __rpcName && route.rpc && Object.hasOwn(route.rpc, __rpcName);
      const __hasWorkflowRpc = __rpcName && typeof __workflowStatusRpc !== 'undefined' && Object.hasOwn(__workflowStatusRpc, __rpcName);
      if (request.method === 'GET' && __rpcName && (__hasRouteRpc || __hasWorkflowRpc)) {
        if (request.headers.get('x-kuratchi-rpc') !== '1') {
          return __secHeaders(new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
            status: 403, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
          }));
        }
        try {
          const __rpcArgsStr = url.searchParams.get('_args');
          let __rpcArgs = [];
          if (__rpcArgsStr) {
            const __parsed = JSON.parse(__rpcArgsStr);
            __rpcArgs = Array.isArray(__parsed) ? __parsed : [];
          }
          const __rpcFn = __hasRouteRpc ? route.rpc[__rpcName] : __workflowStatusRpc[__rpcName];
          const __rpcResult = await __rpcFn(...__rpcArgs);
          return __secHeaders(new Response(JSON.stringify({ ok: true, data: __rpcResult }), {
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
          }));
        } catch (err) {
          console.error('[kuratchi] RPC error:', err);
          const __errMsg = typeof __kuratchi_DEV__ !== 'undefined' ? err.message : 'Internal Server Error';
          return __secHeaders(new Response(JSON.stringify({ ok: false, error: __errMsg }), {
            status: 500, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
          }));
        }
      }

      // Form action: POST with hidden _action field in form body
      if (request.method === 'POST') {
        if (!__isSameOrigin(request, url)) {
          return __secHeaders(new Response('Forbidden', { status: 403 }));
        }
        const formData = await request.formData();
        const actionName = formData.get('_action');
        const __actionFn = (actionName && route.actions && Object.hasOwn(route.actions, actionName) ? route.actions[actionName] : null)
          || (actionName && __layoutActions && Object.hasOwn(__layoutActions, actionName) ? __layoutActions[actionName] : null);
        if (actionName && __actionFn) {
          // Check if this is a fetch-based action call (onclick) with JSON args
          const argsStr = formData.get('_args');
          const isFetchAction = argsStr !== null;
          try {
            if (isFetchAction) {
              const __parsed = JSON.parse(argsStr);
              const args = Array.isArray(__parsed) ? __parsed : [];
              await __actionFn(...args);
            } else {
              await __actionFn(formData);
            }
          } catch (err) {
            if (err && err.isRedirectError) {
              const __redirectTo = err.location || url.pathname;
              const __redirectStatus = Number(err.status) || 303;
              if (isFetchAction) {
                return __attachCookies(__secHeaders(new Response(JSON.stringify({ ok: true, redirectTo: __redirectTo, redirectStatus: __redirectStatus }), {
                  headers: { 'content-type': 'application/json' }
                })));
              }
              return __attachCookies(new Response(null, { status: __redirectStatus, headers: { 'location': __redirectTo } }));
            }
            console.error('[kuratchi] Action error:', err);
            if (isFetchAction) {
              const __errMsg = typeof __kuratchi_DEV__ !== 'undefined' && err && err.message ? err.message : 'Internal Server Error';
              return __secHeaders(new Response(JSON.stringify({ ok: false, error: __errMsg }), {
                status: 500, headers: { 'content-type': 'application/json' }
              }));
            }
            const __loaded = route.load ? await route.load(match.params) : {};
            const data = (__loaded && typeof __loaded === 'object') ? __loaded : { value: __loaded };
            data.params = match.params;
            data.breadcrumbs = __getLocals().__breadcrumbs ?? [];
            const __allActions = Object.assign({}, route.actions, __layoutActions || {});
            Object.keys(__allActions).forEach(function(k) { if (!(k in data)) data[k] = { error: undefined, loading: false, success: false }; });
            const __errMsg = (err && err.isActionError) ? err.message : (typeof __kuratchi_DEV__ !== 'undefined' && err && err.message) ? err.message : 'Action failed';
            data[actionName] = { error: __errMsg, loading: false, success: false };
            return ${opts.isLayoutAsync ? 'await ' : ''}__render(route, data, __fragmentId);
          }
          // Fetch-based actions return lightweight JSON (no page re-render)
          if (isFetchAction) {
            return __attachCookies(new Response(JSON.stringify({ ok: true }), {
              headers: { 'content-type': 'application/json' }
            }));
          }
          // POST-Redirect-GET: redirect to custom target or back to same URL
          const __locals = __getLocals();
          const redirectTo = __locals.__redirectTo || url.pathname;
          const redirectStatus = Number(__locals.__redirectStatus) || 303;
          return __attachCookies(new Response(null, { status: redirectStatus, headers: { 'location': redirectTo } }));
        }
      }

      // GET (or unmatched POST): load + render
      try {
        const __loaded = route.load ? await route.load(match.params) : {};
        const data = (__loaded && typeof __loaded === 'object') ? __loaded : { value: __loaded };
        data.params = match.params;
        data.breadcrumbs = __getLocals().__breadcrumbs ?? [];
        const __allActionsGet = Object.assign({}, route.actions, __layoutActions || {});
        Object.keys(__allActionsGet).forEach(function(k) { if (!(k in data)) data[k] = { error: undefined, loading: false, success: false }; });
        return ${opts.isLayoutAsync ? 'await ' : ''}__render(route, data, __fragmentId);
      } catch (err) {
        if (err && err.isRedirectError) {
          const __redirectTo = err.location || url.pathname;
          const __redirectStatus = Number(err.status) || 303;
          return __attachCookies(new Response(null, { status: __redirectStatus, headers: { 'location': __redirectTo } }));
        }
        console.error('[kuratchi] Route load/render error:', err);
        const __pageErrStatus = (err && err.isPageError && err.status) ? err.status : 500;
        const __errDetail = (err && err.isPageError) ? err.message : (typeof __kuratchi_DEV__ !== 'undefined' && err && err.message) ? err.message : undefined;
        return __secHeaders(new Response(${opts.isLayoutAsync ? 'await ' : ''}__layout(__error(__pageErrStatus, __errDetail)), { status: __pageErrStatus, headers: { 'content-type': 'text/html; charset=utf-8' } }));
      }
    };

    try {
      const __requestResponse = await __runRuntimeRequest(__runtimeCtx, async () => {
        return __runRuntimeRoute(__runtimeCtx, __coreFetch);
      });
      return await __runRuntimeResponse(__runtimeCtx, __requestResponse);
    } catch (err) {
      const __handled = await __runRuntimeError(__runtimeCtx, err);
      if (__handled) return __secHeaders(__handled);
      throw err;
    }
  }
}
`;
}





interface WranglerSyncConfig {
  workflows: WorkerClassConfigEntry[];
  containers: WorkerClassConfigEntry[];
  durableObjects: DoConfigEntry[];
}

/**
 * Auto-sync wrangler.jsonc with workflow/container/DO config from kuratchi.config.ts.
 * This eliminates the need to manually duplicate config between kuratchi.config.ts and wrangler.jsonc.
 *
 * The function:
 * 1. Reads existing wrangler.jsonc (or wrangler.json)
 * 2. Updates/adds workflow entries based on kuratchi.config.ts
 * 3. Preserves all other wrangler config (bindings, vars, etc.)
 * 4. Writes back only if changed
 */
function syncWranglerConfig(projectDir: string, config: WranglerSyncConfig): void {
  // Find wrangler config file (prefer .jsonc, fall back to .json)
  const jsoncPath = path.join(projectDir, 'wrangler.jsonc');
  const jsonPath = path.join(projectDir, 'wrangler.json');
  const tomlPath = path.join(projectDir, 'wrangler.toml');

  let configPath: string;
  let isJsonc = false;

  if (fs.existsSync(jsoncPath)) {
    configPath = jsoncPath;
    isJsonc = true;
  } else if (fs.existsSync(jsonPath)) {
    configPath = jsonPath;
  } else if (fs.existsSync(tomlPath)) {
    // TOML is not supported for auto-sync — user must migrate to JSON/JSONC
    console.log('[kuratchi] wrangler.toml detected. Auto-sync requires wrangler.jsonc. Skipping wrangler sync.');
    return;
  } else {
    // No wrangler config exists — create a minimal wrangler.jsonc
    console.log('[kuratchi] Creating wrangler.jsonc with workflow config...');
    configPath = jsoncPath;
    isJsonc = true;
  }

  // Read existing config (or start fresh)
  let rawContent = '';
  let wranglerConfig: Record<string, any> = {};

  if (fs.existsSync(configPath)) {
    rawContent = fs.readFileSync(configPath, 'utf-8');
    try {
      // Strip JSONC comments for parsing
      const jsonContent = stripJsonComments(rawContent);
      wranglerConfig = JSON.parse(jsonContent);
    } catch (err: any) {
      console.error(`[kuratchi] Failed to parse ${path.basename(configPath)}: ${err.message}`);
      console.error('[kuratchi] Skipping wrangler sync. Please fix the JSON syntax.');
      return;
    }
  }

  let changed = false;

  // Sync workflows
  if (config.workflows.length > 0) {
    const existingWorkflows: any[] = wranglerConfig.workflows || [];
    const existingByBinding = new Map(existingWorkflows.map(w => [w.binding, w]));

    for (const wf of config.workflows) {
      // Convert SCREAMING_SNAKE binding to kebab-case name
      const name = wf.binding.toLowerCase().replace(/_/g, '-');
      const entry = {
        name,
        binding: wf.binding,
        class_name: wf.className,
      };

      const existing = existingByBinding.get(wf.binding);
      if (!existing) {
        existingWorkflows.push(entry);
        changed = true;
        console.log(`[kuratchi] Added workflow "${wf.binding}" to wrangler config`);
      } else if (existing.class_name !== wf.className) {
        existing.class_name = wf.className;
        changed = true;
        console.log(`[kuratchi] Updated workflow "${wf.binding}" class_name to "${wf.className}"`);
      }
    }

    // Remove workflows that are no longer in kuratchi.config.ts
    const configBindings = new Set(config.workflows.map(w => w.binding));
    const filtered = existingWorkflows.filter(w => {
      if (!configBindings.has(w.binding)) {
        // Check if this was a kuratchi-managed workflow (has matching naming convention)
        const expectedName = w.binding.toLowerCase().replace(/_/g, '-');
        if (w.name === expectedName) {
          console.log(`[kuratchi] Removed workflow "${w.binding}" from wrangler config`);
          changed = true;
          return false;
        }
      }
      return true;
    });

    if (filtered.length !== existingWorkflows.length) {
      wranglerConfig.workflows = filtered;
    } else {
      wranglerConfig.workflows = existingWorkflows;
    }

    if (wranglerConfig.workflows.length === 0) {
      delete wranglerConfig.workflows;
    }
  }

  // Sync containers (similar pattern)
  if (config.containers.length > 0) {
    const existingContainers: any[] = wranglerConfig.containers || [];
    const existingByBinding = new Map(existingContainers.map(c => [c.binding, c]));

    for (const ct of config.containers) {
      const name = ct.binding.toLowerCase().replace(/_/g, '-');
      const entry = {
        name,
        binding: ct.binding,
        class_name: ct.className,
      };

      const existing = existingByBinding.get(ct.binding);
      if (!existing) {
        existingContainers.push(entry);
        changed = true;
        console.log(`[kuratchi] Added container "${ct.binding}" to wrangler config`);
      } else if (existing.class_name !== ct.className) {
        existing.class_name = ct.className;
        changed = true;
        console.log(`[kuratchi] Updated container "${ct.binding}" class_name to "${ct.className}"`);
      }
    }

    wranglerConfig.containers = existingContainers;
    if (wranglerConfig.containers.length === 0) {
      delete wranglerConfig.containers;
    }
  }

  // Sync durable_objects
  if (config.durableObjects.length > 0) {
    if (!wranglerConfig.durable_objects) {
      wranglerConfig.durable_objects = { bindings: [] };
    }
    const existingBindings: any[] = wranglerConfig.durable_objects.bindings || [];
    const existingByName = new Map(existingBindings.map(b => [b.name, b]));

    for (const doEntry of config.durableObjects) {
      const entry = {
        name: doEntry.binding,
        class_name: doEntry.className,
      };

      const existing = existingByName.get(doEntry.binding);
      if (!existing) {
        existingBindings.push(entry);
        changed = true;
        console.log(`[kuratchi] Added durable_object "${doEntry.binding}" to wrangler config`);
      } else if (existing.class_name !== doEntry.className) {
        existing.class_name = doEntry.className;
        changed = true;
        console.log(`[kuratchi] Updated durable_object "${doEntry.binding}" class_name to "${doEntry.className}"`);
      }
    }

    wranglerConfig.durable_objects.bindings = existingBindings;
  }

  if (!changed) return;

  // Write back with pretty formatting
  const newContent = JSON.stringify(wranglerConfig, null, '\t');
  writeIfChanged(configPath, newContent + '\n');
}

/**
 * Strip JSON comments (// and /* *\/) for parsing JSONC files.
 */
function stripJsonComments(content: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    // Handle string literals
    if (inString) {
      result += ch;
      if (ch === '\\' && i + 1 < content.length) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    // Start of string
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      result += ch;
      i++;
      continue;
    }

    // Line comment
    if (ch === '/' && next === '/') {
      // Skip until end of line
      while (i < content.length && content[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2; // Skip */
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}


