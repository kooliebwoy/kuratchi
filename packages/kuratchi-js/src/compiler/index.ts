/**
 * Compiler ?" scans a project's routes/ directory, parses .html files,
 * and generates a single Worker entry point.
 */

import { parseFile } from './parser.js';
import { compileAssets } from './asset-pipeline.js';
import { compileApiRoute } from './api-route-pipeline.js';
import { createClientModuleCompiler } from './client-module-pipeline.js';
import { createComponentCompiler } from './component-pipeline.js';
import {
  readAssetsPrefix,
  readAuthConfig,
  readCssConfig,
  readOrmConfig,
  readSecurityConfig,
  readUiConfigValues,
  readUiTheme,
} from './config-reading.js';
import { isCssFile, processCss, type CssConfigEntry } from './css-pipeline.js';
import {
  discoverContainerFiles,
  discoverConventionClassFiles,
  discoverSandboxFiles,
  discoverQueueConsumerFiles,
  discoverWorkflowFiles,
} from './convention-discovery.js';
import { discoverDurableObjects, generateHandlerProxy } from './durable-object-pipeline.js';
import { compileErrorPages } from './error-page-pipeline.js';
import { compileLayoutPlan, finalizeLayoutPlan, type LayoutBuildPlan } from './layout-pipeline.js';
import { compilePageRoute } from './page-route-pipeline.js';
import { discoverRoutes as discoverRoutesPipeline } from './route-discovery.js';
import { prepareRootLayoutSource } from './root-layout-pipeline.js';
import { generateRoutesModule as generateRoutesModulePipeline } from './routes-module-pipeline.js';
import { assembleRouteState } from './route-state-pipeline.js';
import { createServerModuleCompiler } from './server-module-pipeline.js';
import { compileTemplate } from './template.js';
import {
  buildCompatEntrypointSource,
  buildWorkerEntrypointSource,
  resolveRuntimeImportPath as resolveRuntimeImportPathPipeline,
} from './worker-output-pipeline.js';
import { syncWranglerConfig as syncWranglerConfigPipeline } from './wrangler-sync.js';
import { filePathToPattern } from '../runtime/router.js';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { RouteFile } from './route-discovery.js';

// Public compiler primitives — consumed by `@kuratchi/js`'s own CLI and by
// external orchestrators (e.g. `@kuratchi/vite`) so there is a single
// source of truth for template parsing and codegen.
export { parseFile, stripTopLevelImports } from './parser.js';
export type { ParsedFile } from './parser.js';
export {
  compileTemplate,
  generateRenderFunction,
  splitTemplateRenderSections,
} from './template.js';
export type {
  TemplateRenderSections,
  CompileTemplateOptions,
} from './template.js';
export {
  VIRTUAL_MODULE_MAP,
  VIRTUAL_MODULE_NAMES,
  isKuratchiVirtualModule,
  resolveKuratchiVirtualModule,
  getKuratchiModuleName,
  buildVirtualModuleTypeDeclarations,
} from './virtual-modules.js';
export {
  rewriteImportedFunctionCalls,
  rewriteWorkerEnvAliases,
  buildDevAliasDeclarations,
  buildSegmentedScriptBody,
} from './script-transform.js';
export type { RouteScriptSegment } from './script-transform.js';
export {
  discoverContainerFiles,
  discoverSandboxFiles,
  discoverQueueConsumerFiles,
  discoverWorkflowFiles,
} from './convention-discovery.js';
export { discoverDurableObjects } from './durable-object-pipeline.js';
export { syncWranglerConfig } from './wrangler-sync.js';
export { writeAppTypes, generateAppTypes } from './type-generator.js';
export type { GenerateTypesOptions } from './type-generator.js';
export type {
  WranglerSyncEntry,
  ContainerSyncEntry,
  QueueSyncEntry,
  WranglerSyncConfig,
} from './wrangler-sync.js';

const FRAMEWORK_PACKAGE_NAME = getFrameworkPackageName();
const RUNTIME_CONTEXT_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/context.js`;
const RUNTIME_DO_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/do.js`;
const RUNTIME_SCHEMA_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/schema.js`;
// The legacy CLI worker entry template lives in `@kuratchi/wrangler`
// (the build tool that actually emits `.kuratchi/worker.ts`). The
// runtime package (`@kuratchi/js`) is import-safe inside a Worker —
// it deliberately does not ship the generated-worker template.
const RUNTIME_WORKER_IMPORT = `@kuratchi/wrangler/runtime/generated-worker.js`;

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
  /** Override path for routes.ts (default: .kuratchi/routes.ts). worker.ts is always co-located. */
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
 * Pre-read all route files and their layouts in parallel for better I/O performance.
 * Returns a Map from file path to content.
 */
async function preReadFiles(
  routesDir: string,
  routeFiles: RouteFile[],
): Promise<Map<string, string>> {
  const filesToRead = new Set<string>();

  // Collect all unique files to read
  for (const rf of routeFiles) {
    filesToRead.add(path.join(routesDir, rf.file));
    for (const layout of rf.layouts) {
      filesToRead.add(path.join(routesDir, layout));
    }
  }

  // Also include root layout if it exists
  const rootLayout = path.join(routesDir, 'layout.html');
  if (fs.existsSync(rootLayout)) {
    filesToRead.add(rootLayout);
  }

  // Read all files in parallel
  const entries = await Promise.all(
    Array.from(filesToRead).map(async (filePath) => {
      const content = await fsp.readFile(filePath, 'utf-8');
      return [filePath, content] as const;
    }),
  );

  return new Map(entries);
}

/**
 * Compile a project's src/routes/ into .kuratchi/routes.ts
 *
 * The generated module exports { app } — an object with a fetch() method
 * that handles routing, load functions, form actions, and rendering.
 * Returns the path to .kuratchi/worker.ts — the stable wrangler entry point that
 * re-exports everything from routes.ts (default fetch handler + named DO class exports).
 * No src/index.ts is needed in user projects.
 */
export async function compile(options: CompileOptions): Promise<string> {
  const { projectDir } = options;
  const srcDir = path.join(projectDir, 'src');
  const routesDir = path.join(srcDir, 'routes');

  if (!fs.existsSync(routesDir)) {
    throw new Error(`Routes directory not found: ${routesDir}`);
  }

  // Discover all .html route files
  const routeFiles = discoverRoutesPipeline(routesDir);

  // Pre-read all files in parallel for better I/O performance
  const fileContents = await preReadFiles(routesDir, routeFiles);
  const componentCompiler = createComponentCompiler({
    projectDir,
    srcDir,
    isDev: !!options.isDev,
  });
  const clientModuleCompiler = createClientModuleCompiler({
    projectDir,
    srcDir,
  });
  const assetsPrefix = readAssetsPrefix(projectDir);

  // App layout: src/routes/layout.html (convention ?" wraps all routes automatically)
  const layoutFile = path.join(routesDir, 'layout.html');
  let compiledLayout: string | null = null;
  let layoutPlan: LayoutBuildPlan | null = null;
  if (fileContents.has(layoutFile)) {
    const layoutImportSource = fileContents.get(layoutFile)!;
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
      clientModuleCompiler,
      assetsPrefix,
      clientScopeId: 'layout_root',
    });
    compiledLayout = layoutPlan.compiledLayout;
  }

  // Custom error pages: src/routes/NNN.html (e.g. 404.html, 500.html, 401.html, 403.html)
  // Only compiled if the user explicitly creates them ?" otherwise the framework's built-in default is used
  const compiledErrorPages = compileErrorPages(routesDir);

  // Read kuratchi.config.ts at build time to discover ORM database configs
  const ormDatabases = readOrmConfig(projectDir);
  // Read auth config from kuratchi.config.ts
  const authConfig = readAuthConfig(projectDir);

  // Read security config from kuratchi.config.ts
  const securityConfig = readSecurityConfig(projectDir);

  // Auto-discover Durable Objects from .do.ts files (config optional, only needed for stubId)
  const { config: doConfig, handlers: doHandlers } = discoverDurableObjects(srcDir);
  // Auto-discover convention-based worker class files (no config needed)
  const containerConfig = discoverContainerFiles(projectDir);
  const sandboxConfig = discoverSandboxFiles(projectDir);
  const workflowConfig = discoverWorkflowFiles(projectDir);
  const queueConsumerConfig = discoverQueueConsumerFiles(projectDir);
  const agentConfig = discoverConventionClassFiles(projectDir, path.join('src', 'server'), '.agents.ts', '.agents');
  // Containers and sandboxes are Durable Objects under the hood — they need a
  // `durable_objects.bindings` entry and (for SQLite-backed classes) a
  // `migrations[].new_sqlite_classes` entry. Collapse them into one list that
  // feeds both the worker class re-exports and the wrangler-sync DO pipeline.
  const containerizedClassEntries = [...containerConfig, ...sandboxConfig];

  // Generate handler proxy modules in .kuratchi/do/ for auto-discovered .do.ts files
  const doProxyDir = path.join(projectDir, '.kuratchi', 'do');
  const doHandlerProxyPaths = new Map<string, string>();
  const registerDoProxyPath = (sourceAbsNoExt: string, proxyAbsNoExt: string) => {
    doHandlerProxyPaths.set(sourceAbsNoExt.replace(/\\/g, '/'), proxyAbsNoExt.replace(/\\/g, '/'));
  };
  if (doHandlers.length > 0) {
    if (!fs.existsSync(doProxyDir)) fs.mkdirSync(doProxyDir, { recursive: true });

    for (const handler of doHandlers) {
      const proxyCode = generateHandlerProxy(handler, {
        projectDir,
        runtimeDoImport: RUNTIME_DO_IMPORT,
        runtimeSchemaImport: RUNTIME_SCHEMA_IMPORT,
      });
      const proxyFile = path.join(doProxyDir, handler.fileName + '.ts');
      const proxyFileDir = path.dirname(proxyFile);
      if (!fs.existsSync(proxyFileDir)) fs.mkdirSync(proxyFileDir, { recursive: true });
      writeIfChanged(proxyFile, proxyCode);
      const handlerAbsNoExt = handler.absPath.replace(/\\/g, '/').replace(/\.ts$/, '');
      const proxyAbsNoExt = proxyFile.replace(/\\/g, '/').replace(/\.ts$/, '');
      registerDoProxyPath(handlerAbsNoExt, proxyAbsNoExt);
    }
  }
  const serverModuleCompiler = createServerModuleCompiler({
    projectDir,
    srcDir,
    doHandlerProxyPaths,
    isDev: options.isDev ?? false,
    writeFile: writeIfChanged,
  });

  // Parse and compile each route
  const compiledRoutes: string[] = [];
  const allImports: string[] = [];

  let moduleCounter = 0;

  // Layout server import resolution ?" resolve non-component imports to module IDs
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

    // -- Page route (index.html) --
    const source = fileContents.get(fullPath) ?? fs.readFileSync(fullPath, 'utf-8');
    const parsed = parseFile(source, { kind: 'route', filePath: fullPath });
    const routeState = assembleRouteState({
      parsed,
      fullPath,
      routesDir,
      layoutRelativePaths: rf.layouts,
      fileContents,
    });

    compiledRoutes.push(compilePageRoute({
      pattern,
      routeIndex: i,
      projectDir,
      isDev: !!options.isDev,
      routeState,
      routeFilePath: fullPath,
      componentCompiler,
      clientModuleCompiler,
      assetsPrefix,
      resolveCompiledImportPath: serverModuleCompiler.resolveCompiledImportPath,
      allocateModuleId: () => `__m${moduleCounter++}`,
      pushImport: (statement) => allImports.push(statement),
    }));
  }

  // Scan src/assets/ for static files to embed (recursive)
  const compiledAssets = [
    ...compileAssets(path.join(srcDir, 'assets')),
    ...clientModuleCompiler.getCompiledAssets(),
  ];

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
    const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.ts');
    runtimeImportPath = serverModuleCompiler.toModuleSpecifier(outFile, transformedRuntimePath);
  }
  const hasRuntime = !!runtimeImportPath;
  const output = generateRoutesModulePipeline({
    projectDir,
    serverImports: allImports,
    compiledRoutes,
    compiledLayout,
    compiledComponents,
    compiledAssets,
    compiledErrorPages,
    ormDatabases,
    authConfig,
    securityConfig,
    doConfig,
    doHandlers,
    workflowConfig,
    isDev: options.isDev ?? false,
    isLayoutAsync,
    compiledLayoutActions,
    hasRuntime,
    runtimeImportPath,
    assetsPrefix,
    runtimeContextImport: RUNTIME_CONTEXT_IMPORT,
    runtimeDoImport: RUNTIME_DO_IMPORT,
    runtimeSchemaImport: RUNTIME_SCHEMA_IMPORT,
    runtimeWorkerImport: RUNTIME_WORKER_IMPORT,
  });

  // Write to .kuratchi/routes.ts
  const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.ts');
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  writeIfChanged(outFile, output);
  writeIfChanged(path.join(outDir, 'routes.js'), buildCompatEntrypointSource('./routes.ts'));

  // Generate .kuratchi/worker.ts — the stable wrangler entry point.
  // routes.ts already exports the default fetch handler and all named DO classes;
  // worker.ts explicitly re-exports them so wrangler.jsonc can reference a
  // stable filename while routes.ts is freely regenerated.
  // If user has src/index.ts with a default export, merge it with the generated worker
  // to support scheduled, queue, and other Cloudflare Worker handlers.
  const userIndexFile = path.join(srcDir, 'index.ts');
  const hasUserIndex = fs.existsSync(userIndexFile) && 
    fs.readFileSync(userIndexFile, 'utf-8').includes('export default');
  const transformedUserIndexFile = hasUserIndex ? serverModuleCompiler.transformModule(userIndexFile) : undefined;
  // Re-export every convention-discovered class from the generated worker so wrangler can
  // reach each one by `class_name`. Sandboxes flow through the same path as containers —
  // no `hasSandbox` flag, no `export { Sandbox } from '@cloudflare/sandbox'` special case.
  const transformedWorkerClassEntries = [...agentConfig, ...containerizedClassEntries, ...workflowConfig].map((entry) => ({
    ...entry,
    file: serverModuleCompiler.transformModule(path.join(projectDir, entry.file)),
  }));
  const transformedQueueConsumers = queueConsumerConfig.map((entry) => ({
    ...entry,
    file: serverModuleCompiler.transformModule(path.join(projectDir, entry.file)),
  }));
  const workerFile = path.join(outDir, 'worker.ts');
  writeIfChanged(workerFile, buildWorkerEntrypointSource({
    projectDir,
    outDir,
    doClassNames: doConfig.map((entry) => entry.className),
    workerClassEntries: transformedWorkerClassEntries,
    queueConsumers: transformedQueueConsumers,
    userIndexFile: transformedUserIndexFile,
  }));
  writeIfChanged(path.join(outDir, 'worker.js'), buildCompatEntrypointSource('./worker.ts'));

  // Read CSS config for asset processing
  const cssConfig = readCssConfig(projectDir);

  // Auto-sync wrangler.jsonc with workflow/container/DO config from kuratchi.config.ts
  // Also sync the static assets directory when src/assets/ exists, so Cloudflare Workers
  // serves them natively without any manual wrangler.jsonc edits from the user.
  const srcAssetsDir = path.join(srcDir, 'assets');
  let syncedAssetsDirectory: string | undefined;
  if (fs.existsSync(srcAssetsDir)) {
    // Mirror src/assets/ into .kuratchi/public/<prefix>/ so Cloudflare serves them at the
    // correct URL (e.g. /assets/app.css) — the directory passed to wrangler is the parent.
    // CSS files are processed through the CSS pipeline (Tailwind, minification).
    const prefixSegment = assetsPrefix.replace(/^\/|\/$/g, ''); // '/assets/' -> 'assets'
    const publicDir = path.join(projectDir, '.kuratchi', 'public');
    const publicAssetsDir = prefixSegment ? path.join(publicDir, prefixSegment) : publicDir;
    await copyDirIfChanged(srcAssetsDir, publicAssetsDir, {
      projectDir,
      cssConfig,
      isDev: options.isDev ?? false,
    });
    syncedAssetsDirectory = path.relative(projectDir, publicDir).replace(/\\/g, '/');
  }

  // Convert agent config to DO config format (agents are Durable Objects)
  const agentDoConfig = agentConfig.map((entry) => {
    const binding = entry.className.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    return { binding, className: entry.className };
  });
  // Containers and sandboxes are also Durable Objects — feed them into the DO sync
  // so `durable_objects.bindings` and `migrations[].new_sqlite_classes` are kept current
  // without any manual wrangler.jsonc edits.
  const containerDoConfig = containerizedClassEntries.map((entry) => ({
    binding: entry.binding,
    className: entry.className,
  }));

  syncWranglerConfigPipeline({
    projectDir,
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
      durableObjects: [...doConfig, ...agentDoConfig, ...containerDoConfig],
      queues: queueConsumerConfig.map((q) => ({ binding: q.binding, queueName: q.queueName })),
      assetsDirectory: syncedAssetsDirectory,
    },
    writeFile: writeIfChanged,
  });

  return workerFile;
}

// ?"??"? Helpers ?"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"??"?

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

interface CopyDirOptions {
  projectDir: string;
  cssConfig: CssConfigEntry | null;
  isDev: boolean;
}

/**
 * Recursively copy files from src to dest, processing CSS files through the CSS pipeline.
 * Used to mirror src/assets/ into .kuratchi/public/ for Cloudflare Workers Static Assets.
 */
async function copyDirIfChanged(src: string, dest: string, options: CopyDirOptions): Promise<void> {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirIfChanged(srcPath, destPath, options);
      continue;
    }

    // Process CSS files through the CSS pipeline
    if (isCssFile(srcPath)) {
      const srcContent = fs.readFileSync(srcPath, 'utf-8');
      const result = await processCss({
        filePath: srcPath,
        content: srcContent,
        projectDir: options.projectDir,
        cssConfig: options.cssConfig,
        isDev: options.isDev,
      });

      const destContent = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf-8') : null;
      if (destContent !== result.css) {
        fs.writeFileSync(destPath, result.css, 'utf-8');
      }
      continue;
    }

    // Copy non-CSS files as-is
    const srcBuf = fs.readFileSync(srcPath);
    const destBuf = fs.existsSync(destPath) ? fs.readFileSync(destPath) : null;
    if (!destBuf || !srcBuf.equals(destBuf)) {
      fs.writeFileSync(destPath, srcBuf);
    }
  }
}
