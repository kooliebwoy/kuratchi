import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import * as esbuild from 'esbuild';

import type { CompiledAsset } from './asset-pipeline.js';
import { collectReferencedIdentifiers, parseImportStatement, type RouteImportEntry } from './import-linking.js';

export interface ClientEventRegistration {
  routeId: string;
  handlerId: string;
  argsExpr: string | null;
}

export interface ClientServerProxyBinding {
  sourceKey: string;
  moduleSpecifier: string;
  importerDir: string;
  importedName: string;
  rpcId: string;
}

interface BrowserBindingEntry {
  importLine: string;
  importerDir: string;
  localName: string;
  moduleSpecifier: string;
}

interface ClientHandlerRecord {
  id: string;
  calleeExpr: string;
  rootBinding: string;
}

export interface ClientModuleCompiler {
  createRegistry(scopeId: string, importEntries: RouteImportEntry[]): ClientRouteRegistry;
  createRouteRegistry(routeIndex: number, importEntries: RouteImportEntry[]): ClientRouteRegistry;
  getCompiledAssets(): CompiledAsset[];
  
  // RFC 0002: Bundle client script with RPC stubs for $server/ imports
  bundleClientScript(opts: {
    routeIndex: number;
    clientScriptRaw: string;
    serverRpcImports: string[];
    serverRpcFunctions: string[];
    ssrAwaitVars: string[];
    routeFilePath: string;
    devAliases: string[];
    requestImports: Array<{ exportName: string; alias: string }>;
    isDev: boolean;
  }): { assetName: string; asset: CompiledAsset } | null;
}

export interface ClientRouteRegistry {
  hasBindings(): boolean;
  hasBindingReference(expression: string): boolean;
  registerEventHandler(eventName: string, expression: string): ClientEventRegistration | null;
  getServerProxyBindings(): ClientServerProxyBinding[];
  buildEntryAsset(): { assetName: string; asset: CompiledAsset } | null;
  /** Rewrite a $lib/ import specifier to the bundled asset path */
  rewriteClientImport(importLine: string, importerDir: string): string | null;
}

interface ResolvedClientImportTarget {
  kind: 'browser' | 'server';
  resolved: string;
  moduleSpecifier: string;
}

function resolveExistingModuleFile(absBase: string): string | null {
  const candidates = [
    absBase,
    absBase + '.ts',
    absBase + '.js',
    absBase + '.mjs',
    absBase + '.cjs',
    path.join(absBase, 'index.ts'),
    path.join(absBase, 'index.js'),
    path.join(absBase, 'index.mjs'),
    path.join(absBase, 'index.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }

  return null;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function isWithinDir(target: string, dir: string): boolean {
  const relative = path.relative(dir, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isExternalNpmPackage(spec: string): boolean {
  // External npm packages are bare specifiers that don't start with . or / and aren't absolute paths
  if (spec.startsWith('.') || spec.startsWith('/') || path.isAbsolute(spec)) {
    return false;
  }
  // Check if it looks like a package name (e.g., 'agents/client', '@scope/pkg', 'lodash')
  return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(\/.*)?$/i.test(spec);
}

function getTopLevelImportLines(source: string): string[] {
  const sourceFile = ts.createSourceFile('kuratchi-client-module.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => statement.getText(sourceFile).trim());
}

function buildAsset(name: string, content: string): CompiledAsset {
  return {
    name,
    content,
    mime: 'text/javascript; charset=utf-8',
    etag: '"' + crypto.createHash('md5').update(content).digest('hex').slice(0, 12) + '"',
  };
}

function toRelativeSpecifier(fromAssetName: string, toAssetName: string): string {
  let rel = path.posix.relative(path.posix.dirname(fromAssetName), toAssetName);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function rewriteImportSpecifiers(
  source: string,
  rewriteSpecifier: (spec: string) => string,
): string {
  let rewritten = source.replace(/(from\s+)(['"])([^'"]+)\2/g, (_match, prefix: string, quote: string, spec: string) => {
    return `${prefix}${quote}${rewriteSpecifier(spec)}${quote}`;
  });
  rewritten = rewritten.replace(
    /(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
    (_match, prefix: string, quote: string, spec: string, suffix: string) => {
      return `${prefix}${quote}${rewriteSpecifier(spec)}${quote}${suffix}`;
    },
  );
  return rewritten;
}

function resolveClientImportTarget(srcDir: string, importerAbs: string, spec: string): ResolvedClientImportTarget {
  const serverDir = path.join(srcDir, 'server');
  if (spec.startsWith('$')) {
    const slashIdx = spec.indexOf('/');
    const folder = slashIdx === -1 ? spec.slice(1) : spec.slice(1, slashIdx);
    const rest = slashIdx === -1 ? '' : spec.slice(slashIdx + 1);
    // Only $server/ and $lib/ are supported
    if (folder !== 'server' && folder !== 'lib') {
      throw new Error(`[kuratchi compiler] Unsupported import prefix "${spec}". Only $server/* and $lib/* are supported.`);
    }
    const abs = path.join(srcDir, folder, rest);
    const resolved = resolveExistingModuleFile(abs);
    if (!resolved) {
      throw new Error(`[kuratchi compiler] Import not found: ${spec}`);
    }
    return {
      kind: folder === 'server' ? 'server' : 'browser',
      resolved,
      moduleSpecifier: spec,
    };
  }

  if (spec.startsWith('.')) {
    const abs = path.resolve(path.dirname(importerAbs), spec);
    const resolved = resolveExistingModuleFile(abs);
    if (!resolved) {
      throw new Error(`[kuratchi compiler] Browser import not found: ${spec}`);
    }
    return {
      kind: isWithinDir(resolved, serverDir) ? 'server' : 'browser',
      resolved,
      moduleSpecifier: spec,
    };
  }

  // External npm package - mark as external for bundling
  return {
    kind: 'browser',
    resolved: spec, // Keep the bare specifier for esbuild to resolve
    moduleSpecifier: spec,
  };
}

function buildServerProxyRpcId(sourceKey: string, importedName: string): string {
  const hash = crypto.createHash('sha1').update(`${sourceKey}:${importedName}`).digest('hex').slice(0, 12);
  return `rpc_remote_${hash}`;
}

class CompilerBackedClientRouteRegistry implements ClientRouteRegistry {
  private readonly bindingMap = new Map<string, BrowserBindingEntry>();
  private readonly handlerByKey = new Map<string, ClientHandlerRecord>();
  private readonly routeModuleAssets = new Map<string, string>();
  private readonly serverProxyBindings = new Map<string, ClientServerProxyBinding>();
  private readonly serverProxyAssets = new Map<string, string>();
  private readonly scannedBrowserModules = new Set<string>();
  private prepared = false;
  private readonly routeId: string;

  constructor(
    private readonly compiler: CompilerBackedClientModuleCompiler,
    scopeId: string,
    importEntries: RouteImportEntry[],
  ) {
    this.routeId = scopeId;

    for (const entry of importEntries) {
      const parsed = parseImportStatement(entry.line);
      if (!parsed.moduleSpecifier) continue;
      const isLib = parsed.moduleSpecifier.startsWith('$lib/');
      if (!isLib) continue;

      for (const binding of parsed.bindings) {
        this.bindingMap.set(binding.local, {
          importLine: entry.line,
          importerDir: entry.importerDir,
          localName: binding.local,
          moduleSpecifier: parsed.moduleSpecifier,
        });
      }
      if (parsed.namespaceImport) {
        this.bindingMap.set(parsed.namespaceImport, {
          importLine: entry.line,
          importerDir: entry.importerDir,
          localName: parsed.namespaceImport,
          moduleSpecifier: parsed.moduleSpecifier,
        });
      }
    }
  }

  hasBindings(): boolean {
    return this.bindingMap.size > 0;
  }

  hasBindingReference(expression: string): boolean {
    const refs = collectReferencedIdentifiers(expression);
    for (const ref of refs) {
      if (this.bindingMap.has(ref)) return true;
    }
    return false;
  }

  registerEventHandler(_eventName: string, expression: string): ClientEventRegistration | null {
    const parsed = this.parseClientExpression(expression);
    if (!parsed) return null;

    const binding = this.bindingMap.get(parsed.rootBinding);
    if (!binding) return null;

    // Args validation - no longer needed since we removed $client/ vs $shared/ distinction

    const key = `${parsed.calleeExpr}::${parsed.argsExpr || ''}`;
    let existing = this.handlerByKey.get(key);
    if (!existing) {
      existing = {
        id: `h${this.handlerByKey.size}`,
        calleeExpr: parsed.calleeExpr,
        rootBinding: parsed.rootBinding,
      };
      this.handlerByKey.set(key, existing);
    }

    return {
      routeId: this.routeId,
      handlerId: existing.id,
      argsExpr: parsed.argsExpr,
    };
  }

  getServerProxyBindings(): ClientServerProxyBinding[] {
    this.prepareClientGraph();
    return Array.from(this.serverProxyBindings.values());
  }

  buildEntryAsset(): { assetName: string; asset: CompiledAsset } | null {
    if (this.handlerByKey.size === 0) return null;

    this.prepareClientGraph();

    const usedImportLines = new Map<string, RouteImportEntry>();
    for (const record of this.handlerByKey.values()) {
      const binding = this.bindingMap.get(record.rootBinding);
      if (!binding) continue;
      if (!usedImportLines.has(binding.importLine)) {
        usedImportLines.set(binding.importLine, {
          line: binding.importLine,
          importerDir: binding.importerDir,
        });
      }
    }

    const assetName = `__kuratchi/client/routes/${this.routeId}.js`;
    const importLines: string[] = [];
    for (const entry of usedImportLines.values()) {
      const parsed = parseImportStatement(entry.line);
      if (!parsed.moduleSpecifier) continue;
      const target = resolveClientImportTarget(this.compiler.srcDir, path.join(entry.importerDir, '__route__.ts'), parsed.moduleSpecifier);
      if (target.kind !== 'browser') {
        throw new Error(`[kuratchi compiler] Top-level route browser imports cannot reference server modules directly: ${parsed.moduleSpecifier}`);
      }
      const targetAssetName = this.transformRouteClientModule(target.resolved);
      const relSpecifier = toRelativeSpecifier(assetName, targetAssetName);
      importLines.push(entry.line.replace(parsed.moduleSpecifier, relSpecifier));
    }

    const registrationEntries = Array.from(this.handlerByKey.values()).map((record) => {
      return `${JSON.stringify(record.id)}: (args, event, element) => ${record.calleeExpr}(...args, event, element)`;
    });

    // TypeScript is preserved — wrangler's esbuild handles transpilation
    const source = [
      ...importLines,
      `window.__kuratchiClient?.register(${JSON.stringify(this.routeId)}, {`,
      registrationEntries.map((entry) => `  ${entry},`).join('\n'),
      `});`,
    ].join('\n');
    const asset = buildAsset(assetName, source);
    this.compiler.registerAsset(asset);
    return { assetName, asset };
  }

  private prepareClientGraph(): void {
    if (this.prepared) return;
    this.prepared = true;

    const usedImportLines = new Map<string, RouteImportEntry>();
    for (const record of this.handlerByKey.values()) {
      const binding = this.bindingMap.get(record.rootBinding);
      if (!binding) continue;
      if (!usedImportLines.has(binding.importLine)) {
        usedImportLines.set(binding.importLine, {
          line: binding.importLine,
          importerDir: binding.importerDir,
        });
      }
    }

    for (const entry of usedImportLines.values()) {
      const parsed = parseImportStatement(entry.line);
      if (!parsed.moduleSpecifier) continue;
      const target = resolveClientImportTarget(this.compiler.srcDir, path.join(entry.importerDir, '__route__.ts'), parsed.moduleSpecifier);
      if (target.kind === 'browser') {
        this.scanBrowserModule(target.resolved);
      }
    }

    for (const binding of this.serverProxyBindings.values()) {
      this.ensureServerProxyAsset(binding.sourceKey);
    }
  }

  private scanBrowserModule(entryAbsPath: string): void {
    // Skip external npm packages (bare specifiers without path separators)
    if (isExternalNpmPackage(entryAbsPath)) {
      return;
    }

    const resolved = resolveExistingModuleFile(entryAbsPath) ?? entryAbsPath;
    const normalized = normalizePath(resolved);
    if (this.scannedBrowserModules.has(normalized)) return;
    this.scannedBrowserModules.add(normalized);

    if (!fs.existsSync(resolved)) {
      throw new Error(`[kuratchi compiler] Browser module not found: ${resolved}`);
    }

    const source = fs.readFileSync(resolved, 'utf-8');
    for (const importLine of getTopLevelImportLines(source)) {
      const parsed = parseImportStatement(importLine);
      if (!parsed.moduleSpecifier) continue;
      const target = resolveClientImportTarget(this.compiler.srcDir, resolved, parsed.moduleSpecifier);
      if (target.kind === 'browser') {
        this.scanBrowserModule(target.resolved);
        continue;
      }

      if (parsed.namespaceImport) {
        throw new Error(
          `[kuratchi compiler] Browser code cannot use namespace imports from server modules: ${parsed.moduleSpecifier}. Use named imports instead.`,
        );
      }

      for (const binding of parsed.bindings) {
        const importedName = binding.imported;
        const sourceKey = normalizePath(target.resolved);
        const key = `${sourceKey}::${importedName}`;
        if (!this.serverProxyBindings.has(key)) {
          this.serverProxyBindings.set(key, {
            sourceKey,
            moduleSpecifier: target.moduleSpecifier,
            importerDir: path.dirname(resolved),
            importedName,
            rpcId: buildServerProxyRpcId(sourceKey, importedName),
          });
        }
      }
    }
  }

  private ensureServerProxyAsset(sourceKey: string): string {
    const cached = this.serverProxyAssets.get(sourceKey);
    if (cached) return cached;

    const relFromSrc = path.relative(this.compiler.srcDir, sourceKey).replace(/\\/g, '/');
    const assetName = `__kuratchi/client/routes/${this.routeId}/server/${relFromSrc.replace(/\.(ts|js|mjs|cjs)$/i, '.js')}`;
    const bindings = Array.from(this.serverProxyBindings.values())
      .filter((binding) => binding.sourceKey === sourceKey)
      .sort((a, b) => a.importedName.localeCompare(b.importedName));

    const lines: string[] = [
      `async function __kuratchiCallRemote(rpcId, args){`,
      `  const url = new URL(window.location.pathname, window.location.origin);`,
      `  url.searchParams.set('_rpc', rpcId);`,
      `  if (args.length > 0) url.searchParams.set('_args', JSON.stringify(args));`,
      `  const response = await fetch(url.toString(), { method: 'GET', credentials: 'same-origin' });`,
      `  const payload = await response.json().catch(() => ({ ok: false, error: 'Invalid RPC response' }));`,
      `  if (!response.ok || !payload || payload.ok !== true) {`,
      `    throw new Error((payload && payload.error) || ('HTTP ' + response.status));`,
      `  }`,
      `  window.dispatchEvent(new CustomEvent('kuratchi:invalidate-reads', { detail: { rpcId: rpcId } }));`,
      `  return payload.data;`,
      `}`,
    ];

    for (const binding of bindings) {
      if (binding.importedName === 'default') {
        lines.push(`export default async function(...args){ return __kuratchiCallRemote(${JSON.stringify(binding.rpcId)}, args); }`);
      } else {
        lines.push(`export async function ${binding.importedName}(...args){ return __kuratchiCallRemote(${JSON.stringify(binding.rpcId)}, args); }`);
      }
    }

    const asset = buildAsset(assetName, lines.join('\n'));
    this.compiler.registerAsset(asset);
    this.serverProxyAssets.set(sourceKey, assetName);
    return assetName;
  }

  private transformRouteClientModule(entryAbsPath: string): string {
    // External npm packages are kept as-is - they'll be bundled by esbuild
    if (isExternalNpmPackage(entryAbsPath)) {
      return entryAbsPath;
    }

    const resolved = resolveExistingModuleFile(entryAbsPath) ?? entryAbsPath;
    const normalized = normalizePath(resolved);
    const cached = this.routeModuleAssets.get(normalized);
    if (cached) return cached;

    const relFromSrc = path.relative(this.compiler.srcDir, resolved).replace(/\\/g, '/');
    const assetName = `__kuratchi/client/routes/${this.routeId}/modules/${relFromSrc.replace(/\.(ts|js|mjs|cjs)$/i, '.js')}`;
    this.routeModuleAssets.set(normalized, assetName);

    if (!fs.existsSync(resolved)) {
      throw new Error(`[kuratchi compiler] Browser module not found: ${resolved}`);
    }

    const source = fs.readFileSync(resolved, 'utf-8');
    let hasExternalNpmImport = false;
    const rewritten = rewriteImportSpecifiers(source, (spec) => {
      const target = resolveClientImportTarget(this.compiler.srcDir, resolved, spec);
      if (target.kind === 'browser') {
        // External npm packages stay as bare specifiers for esbuild to bundle
        if (isExternalNpmPackage(target.resolved)) {
          hasExternalNpmImport = true;
          return target.resolved;
        }
        const targetAssetName = this.transformRouteClientModule(target.resolved);
        return toRelativeSpecifier(assetName, targetAssetName);
      }
      const proxyAssetName = this.ensureServerProxyAsset(normalizePath(target.resolved));
      return toRelativeSpecifier(assetName, proxyAssetName);
    });

    this.compiler.registerAsset(buildAsset(assetName, rewritten));
    
    // Mark this asset for bundling/transpilation
    // TypeScript files always need transpilation, and files with npm imports need bundling
    const isTypeScript = resolved.endsWith('.ts') || resolved.endsWith('.mts');
    if (hasExternalNpmImport || isTypeScript) {
      this.compiler.markAssetNeedsBundle(assetName);
    }
    
    return assetName;
  }

  private parseClientExpression(expression: string): { calleeExpr: string; rootBinding: string; argsExpr: string | null } | null {
    const trimmed = expression.trim();
    if (!trimmed) return null;

    const callMatch = trimmed.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\(([\s\S]*)\)$/);
    if (callMatch) {
      const calleeExpr = callMatch[1];
      const rootBinding = calleeExpr.split('.')[0];
      const argsExpr = (callMatch[2] || '').trim();
      return { calleeExpr, rootBinding, argsExpr: argsExpr || null };
    }

    const refMatch = trimmed.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/);
    if (!refMatch) return null;

    const calleeExpr = refMatch[1];
    const rootBinding = calleeExpr.split('.')[0];
    return { calleeExpr, rootBinding, argsExpr: null };
  }

  rewriteClientImport(importLine: string, importerDir: string): string | null {
    const parsed = parseImportStatement(importLine);
    if (!parsed.moduleSpecifier) return null;
    if (!parsed.moduleSpecifier.startsWith('$lib/')) return null;

    try {
      const target = resolveClientImportTarget(this.compiler.srcDir, path.join(importerDir, '__route__.ts'), parsed.moduleSpecifier);
      if (target.kind !== 'browser') return null;

      // Ensure the module is scanned and transformed
      this.scanBrowserModule(target.resolved);
      const targetAssetName = this.transformRouteClientModule(target.resolved);
      
      // Return the rewritten import with the asset path
      // targetAssetName already includes __kuratchi/ prefix
      return importLine.replace(parsed.moduleSpecifier, `/${targetAssetName}`);
    } catch (err) {
      // Log error but don't throw - allows graceful fallback
      console.error(`[kuratchi compiler] Failed to rewrite $lib/ import: ${importLine}`, err);
      return null;
    }
  }
}

class CompilerBackedClientModuleCompiler implements ClientModuleCompiler {
  private readonly compiledAssets = new Map<string, CompiledAsset>();
  private readonly assetsNeedingBundle = new Set<string>();

  constructor(
    public readonly projectDir: string,
    public readonly srcDir: string,
  ) {}

  createRegistry(scopeId: string, importEntries: RouteImportEntry[]): ClientRouteRegistry {
    return new CompilerBackedClientRouteRegistry(this, scopeId, importEntries);
  }

  createRouteRegistry(routeIndex: number, importEntries: RouteImportEntry[]): ClientRouteRegistry {
    return this.createRegistry(`route_${routeIndex}`, importEntries);
  }

  getCompiledAssets(): CompiledAsset[] {
    // Bundle assets that have external npm imports
    const assets = Array.from(this.compiledAssets.values());
    const bundledAssets: CompiledAsset[] = [];

    for (const asset of assets) {
      if (this.assetsNeedingBundle.has(asset.name)) {
        const bundled = this.bundleAssetSync(asset);
        bundledAssets.push(bundled);
      } else {
        bundledAssets.push(asset);
      }
    }

    return bundledAssets;
  }

  registerAsset(asset: CompiledAsset): void {
    this.compiledAssets.set(asset.name, asset);
  }

  markAssetNeedsBundle(assetName: string): void {
    this.assetsNeedingBundle.add(assetName);
  }

  private bundleAssetSync(asset: CompiledAsset): CompiledAsset {
    // Find the original source file path from the asset name
    // Asset name format: __kuratchi/client/routes/route_X/modules/client/filename.js
    // Original path: src/client/filename.ts
    const assetPathMatch = asset.name.match(/modules\/(.+)\.js$/);
    if (!assetPathMatch) {
      // Can't determine original path, just transpile in place
      return this.transpileAssetInPlace(asset);
    }
    
    const relPath = assetPathMatch[1]; // e.g., "client/chat-ui"
    const originalFile = path.join(this.srcDir, relPath + '.ts');
    
    if (!fs.existsSync(originalFile)) {
      // Try .js extension
      const jsFile = path.join(this.srcDir, relPath + '.js');
      if (!fs.existsSync(jsFile)) {
        return this.transpileAssetInPlace(asset);
      }
    }

    try {
      const result = esbuild.buildSync({
        entryPoints: [originalFile],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        target: ['es2020'],
        minify: false,
        sourcemap: false,
        nodePaths: [path.join(this.projectDir, 'node_modules')],
        loader: { '.ts': 'ts' },
        resolveExtensions: ['.ts', '.js', '.mjs'],
      });

      const bundledContent = result.outputFiles?.[0]?.text || asset.content;
      const etag = '"' + crypto.createHash('md5').update(bundledContent).digest('hex').slice(0, 12) + '"';

      return {
        name: asset.name,
        content: bundledContent,
        mime: asset.mime,
        etag,
      };
    } catch (err) {
      console.error(`[kuratchi compiler] Failed to bundle client module ${asset.name}:`, err);
      // Fall back to transpiling in place
      return this.transpileAssetInPlace(asset);
    }
  }

  private transpileAssetInPlace(asset: CompiledAsset): CompiledAsset {
    // Simple TypeScript transpilation without bundling dependencies
    const tempDir = path.join(this.projectDir, '.kuratchi', '.tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `${asset.name.replace(/\//g, '_').replace(/\.js$/, '.ts')}`);
    fs.writeFileSync(tempFile, asset.content, 'utf-8');

    try {
      const result = esbuild.buildSync({
        entryPoints: [tempFile],
        bundle: false, // Don't bundle, just transpile
        write: false,
        format: 'esm',
        platform: 'browser',
        target: ['es2020'],
        loader: { '.ts': 'ts' },
      });

      const transpiledContent = result.outputFiles?.[0]?.text || asset.content;
      const etag = '"' + crypto.createHash('md5').update(transpiledContent).digest('hex').slice(0, 12) + '"';

      return {
        name: asset.name,
        content: transpiledContent,
        mime: asset.mime,
        etag,
      };
    } catch (err) {
      console.error(`[kuratchi compiler] Failed to transpile client module ${asset.name}:`, err);
      return asset;
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * RFC 0002: Bundle client script with RPC stubs for $server/ imports.
   * 
   * This transforms the client <script> block by:
   * 1. Replacing $server/ imports with RPC stub functions
   * 2. Removing top-level await calls (they run at SSR, results come from data)
   * 3. Bundling npm dependencies with esbuild
   */
  bundleClientScript(opts: {
    routeIndex: number;
    clientScriptRaw: string;
    serverRpcImports: string[];
    serverRpcFunctions: string[];
    ssrAwaitVars: string[];
    routeFilePath: string;
    devAliases: string[];
    requestImports: Array<{ exportName: string; alias: string }>;
    isDev: boolean;
  }): { assetName: string; asset: CompiledAsset } | null {
    if (!opts.clientScriptRaw || opts.clientScriptRaw.trim().length === 0) {
      return null;
    }

    const assetName = `__kuratchi/client/routes/route_${opts.routeIndex}/script.js`;
    const importerDir = path.dirname(opts.routeFilePath);
    
    // Build serialized kuratchi:environment values
    const envLines: string[] = [];
    if (opts.devAliases && opts.devAliases.length > 0) {
      envLines.push(`// kuratchi:environment - serialized for client`);
      for (const alias of opts.devAliases) {
        envLines.push(`const ${alias} = ${opts.isDev ? 'true' : 'false'};`);
      }
    }
    
    // Build serialized kuratchi:request values
    // These are read from the current URL at runtime on the client
    if (opts.requestImports && opts.requestImports.length > 0) {
      envLines.push(`// kuratchi:request - serialized for client`);
      envLines.push(`const __kuratchiUrl = new URL(window.location.href);`);
      envLines.push(`const __kuratchiParams = Object.fromEntries(new URLSearchParams(window.location.search));`);
      for (const imp of opts.requestImports) {
        switch (imp.exportName) {
          case 'url':
            envLines.push(`const ${imp.alias} = __kuratchiUrl;`);
            break;
          case 'pathname':
            envLines.push(`const ${imp.alias} = __kuratchiUrl.pathname;`);
            break;
          case 'searchParams':
            envLines.push(`const ${imp.alias} = __kuratchiUrl.searchParams;`);
            break;
          case 'params':
            // Route params are injected by the server into a data attribute
            envLines.push(`const ${imp.alias} = JSON.parse(document.body.dataset.kuratchiParams || '{}');`);
            break;
          case 'slug':
            envLines.push(`const ${imp.alias} = JSON.parse(document.body.dataset.kuratchiParams || '{}').slug || Object.values(JSON.parse(document.body.dataset.kuratchiParams || '{}'))[0];`);
            break;
          case 'method':
            envLines.push(`const ${imp.alias} = 'GET';`); // Client-side is always GET (initial page load)
            break;
        }
      }
    }
    
    // Build RPC stub code for $server/ functions
    const rpcStubLines: string[] = [];
    rpcStubLines.push(`// RFC 0002: RPC stubs for $server/ imports`);
    rpcStubLines.push(`async function __kuratchiCallRpc(rpcId, args) {`);
    rpcStubLines.push(`  const url = new URL(window.location.pathname, window.location.origin);`);
    rpcStubLines.push(`  url.searchParams.set('_rpc', rpcId);`);
    rpcStubLines.push(`  if (args.length > 0) url.searchParams.set('_args', JSON.stringify(args));`);
    rpcStubLines.push(`  const response = await fetch(url.toString(), { method: 'GET', credentials: 'same-origin' });`);
    rpcStubLines.push(`  const payload = await response.json().catch(() => ({ ok: false, error: 'Invalid RPC response' }));`);
    rpcStubLines.push(`  if (!response.ok || !payload || payload.ok !== true) {`);
    rpcStubLines.push(`    throw new Error((payload && payload.error) || ('HTTP ' + response.status));`);
    rpcStubLines.push(`  }`);
    rpcStubLines.push(`  return payload.data;`);
    rpcStubLines.push(`}`);
    
    // Generate stub functions for each $server/ function
    for (const fnName of opts.serverRpcFunctions) {
      const rpcId = `rpc_${opts.routeIndex}_server_${fnName}`;
      rpcStubLines.push(`async function ${fnName}(...args) { return __kuratchiCallRpc('${rpcId}', args); }`);
    }
    
    // Transform the client script:
    // 1. Remove $server/ imports (replaced by stubs above)
    // 2. Remove kuratchi:environment imports (replaced by serialized values)
    // 3. Remove top-level await variable declarations (data comes from SSR)
    let transformedScript = opts.clientScriptRaw;
    
    // Remove $server/ import lines
    for (const importLine of opts.serverRpcImports) {
      transformedScript = transformedScript.replace(importLine, '// [RFC 0002] $server/ import removed - using RPC stub');
    }
    
    // Remove kuratchi:environment and @kuratchi/js/environment import lines
    // (replaced by serialized const declarations above)
    transformedScript = transformedScript.replace(
      /import\s*\{[^}]*\}\s*from\s*['"]kuratchi:environment['"];?\s*/g,
      '// kuratchi:environment import removed - using serialized value\n'
    );
    transformedScript = transformedScript.replace(
      /import\s*\{[^}]*\}\s*from\s*['"]@kuratchi\/js\/environment['"];?\s*/g,
      '// @kuratchi/js/environment import removed - using serialized value\n'
    );
    
    // Remove kuratchi:request import lines (replaced by serialized const declarations above)
    transformedScript = transformedScript.replace(
      /import\s*\{[^}]*\}\s*from\s*['"]kuratchi:request['"];?\s*/g,
      '// kuratchi:request import removed - using serialized value\n'
    );
    
    // Rewrite top-level await declarations for SSR vars. We used to delete the line
    // entirely, but that left dangling references to the (now-missing) binding in any
    // subsequent top-level statement — `ReferenceError: X is not defined` — which
    // aborted the whole module before event listeners could register.
    //
    // Instead we preserve the declaration and zero out the RHS to `undefined`. Any
    // downstream expression that reads the var sees `undefined` (falsy) and — because
    // authors write server-first code with `ssrVar && ssrVar.foo` patterns — silently
    // skips the branch that would have required the server value. The server-rendered
    // HTML is still correct; the client bundle just no-ops around the stripped data.
    //
    // TODO: eventually serialize these values into the HTML (body data attribute or
    // inline script) so the client can actually read them, matching the original
    // intent of this transform ("data comes from window.__kuratchiData").
    for (const varName of opts.ssrAwaitVars) {
      // Match any of: `const X = await …;`, `let X = await …;`, `var X = await …;`,
      // with or without a `: Type` annotation. The await must be at the start of the
      // RHS — if it's buried in a ternary or sub-expression we leave the line alone
      // and rely on the replaced-to-undefined dependent vars to neuter it at runtime.
      const awaitPattern = new RegExp(
        `\\b(const|let|var)\\s+${varName}(\\s*:[^=]+)?\\s*=\\s*await\\s+[^;]+;`,
        'g',
      );
      transformedScript = transformedScript.replace(
        awaitPattern,
        `$1 ${varName}$2 = undefined; // [RFC 0002] SSR data: ${varName} resolved on server`,
      );
    }
    
    // Combine env declarations, RPC stubs, and transformed script
    const finalScript = [
      ...envLines,
      ...rpcStubLines,
      '',
      '// Client script',
      transformedScript,
    ].join('\n');
    
    // Write to temp file and bundle with esbuild
    const tempDir = path.join(this.projectDir, '.kuratchi', '.tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFile = path.join(tempDir, `route_${opts.routeIndex}_client.ts`);
    fs.writeFileSync(tempFile, finalScript, 'utf-8');
    
    try {
      // Resolve $lib/ imports before bundling by rewriting them in the script
      const srcDir = this.srcDir;
      let scriptWithResolvedImports = finalScript;
      
      // Find and resolve $lib/ imports
      const libImportRegex = /from\s+['"](\$lib\/[^'"]+)['"]/g;
      let match;
      while ((match = libImportRegex.exec(finalScript)) !== null) {
        const importPath = match[1];
        const relativePath = importPath.replace(/^\$lib\//, '');
        const candidates = [
          path.join(srcDir, 'lib', relativePath + '.ts'),
          path.join(srcDir, 'lib', relativePath + '.js'),
          path.join(srcDir, 'lib', relativePath, 'index.ts'),
          path.join(srcDir, 'lib', relativePath, 'index.js'),
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            scriptWithResolvedImports = scriptWithResolvedImports.replace(
              new RegExp(`['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
              `'${candidate}'`
            );
            break;
          }
        }
      }
      
      // Update temp file with resolved imports
      fs.writeFileSync(tempFile, scriptWithResolvedImports, 'utf-8');

      const result = esbuild.buildSync({
        entryPoints: [tempFile],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        target: ['es2022'], // Support top-level await
        minify: false,
        sourcemap: false,
        nodePaths: [path.join(this.projectDir, 'node_modules')],
        loader: { '.ts': 'ts' },
        resolveExtensions: ['.ts', '.js', '.mjs'],
        // Mark framework virtual modules and $server/ as external
        external: ['$server/*', 'kuratchi:*', 'cloudflare:*', '@kuratchi/js/*'],
      });
      
      const bundledContent = result.outputFiles?.[0]?.text || finalScript;
      const etag = '"' + crypto.createHash('md5').update(bundledContent).digest('hex').slice(0, 12) + '"';
      
      const asset: CompiledAsset = {
        name: assetName,
        content: bundledContent,
        mime: 'text/javascript; charset=utf-8',
        etag,
      };
      
      this.compiledAssets.set(assetName, asset);
      return { assetName, asset };
    } catch (err) {
      console.error(`[kuratchi compiler] Failed to bundle client script for route ${opts.routeIndex}:`, err);
      
      // Fall back to non-bundled version
      const etag = '"' + crypto.createHash('md5').update(finalScript).digest('hex').slice(0, 12) + '"';
      const asset: CompiledAsset = {
        name: assetName,
        content: finalScript,
        mime: 'text/javascript; charset=utf-8',
        etag,
      };
      
      this.compiledAssets.set(assetName, asset);
      return { assetName, asset };
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export function createClientModuleCompiler(opts: {
  projectDir: string;
  srcDir: string;
}): ClientModuleCompiler {
  return new CompilerBackedClientModuleCompiler(opts.projectDir, opts.srcDir);
}
