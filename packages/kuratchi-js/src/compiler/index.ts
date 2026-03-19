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
  readDoConfig,
  readOrmConfig,
  readUiConfigValues,
  readUiTheme,
} from './config-reading.js';
import {
  discoverContainerFiles,
  discoverConventionClassFiles,
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
  buildWorkerEntrypointSource,
  resolveRuntimeImportPath as resolveRuntimeImportPathPipeline,
} from './worker-output-pipeline.js';
import { syncWranglerConfig as syncWranglerConfigPipeline } from './wrangler-sync.js';
import { filePathToPattern } from '../runtime/router.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export { parseFile } from './parser.js';
export { compileTemplate, generateRenderFunction } from './template.js';

const FRAMEWORK_PACKAGE_NAME = getFrameworkPackageName();
const RUNTIME_CONTEXT_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/context.js`;
const RUNTIME_DO_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/do.js`;
const RUNTIME_WORKER_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/generated-worker.js`;

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
 * The generated module exports { app } ?" an object with a fetch() method
 * that handles routing, load functions, form actions, and rendering.
 * Returns the path to .kuratchi/worker.js ? the stable wrangler entry point that
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
  const clientModuleCompiler = createClientModuleCompiler({
    projectDir,
    srcDir,
  });
  const assetsPrefix = readAssetsPrefix(projectDir);

  // App layout: src/routes/layout.html (convention ?" wraps all routes automatically)
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
      const proxyCode = generateHandlerProxy(handler, {
        projectDir,
        runtimeDoImport: RUNTIME_DO_IMPORT,
      });
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
    const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.js');
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
    runtimeWorkerImport: RUNTIME_WORKER_IMPORT,
  });

  // Write to .kuratchi/routes.js
  const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.js');
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  writeIfChanged(outFile, output);

  // Generate .kuratchi/worker.js ? the stable wrangler entry point.
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
