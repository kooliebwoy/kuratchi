import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

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
}

export interface ClientRouteRegistry {
  hasBindings(): boolean;
  hasBindingReference(expression: string): boolean;
  registerEventHandler(eventName: string, expression: string): ClientEventRegistration | null;
  getServerProxyBindings(): ClientServerProxyBinding[];
  buildEntryAsset(): { assetName: string; asset: CompiledAsset } | null;
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
    if (folder !== 'client' && folder !== 'shared' && folder !== 'server') {
      throw new Error(`[kuratchi compiler] Unsupported browser import realm "${spec}". Only $client/*, $shared/*, and $server/* may be referenced from browser code.`);
    }
    const abs = path.join(srcDir, folder, rest);
    const resolved = resolveExistingModuleFile(abs);
    if (!resolved) {
      throw new Error(`[kuratchi compiler] Browser import not found: ${spec}`);
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

  throw new Error(
    `[kuratchi compiler] Browser modules currently only support project-local imports ($client, $shared, $server, or relative). Unsupported import: ${spec}`,
  );
}

function buildServerProxyRpcId(sourceKey: string, importedName: string): string {
  const hash = crypto.createHash('sha1').update(`${sourceKey}:${importedName}`).digest('hex').slice(0, 12);
  return `rpc_remote_${hash}`;
}

class CompilerBackedClientRouteRegistry implements ClientRouteRegistry {
  private readonly bindingMap = new Map<string, BrowserBindingEntry>();
  private readonly clientOnlyBindings = new Set<string>();
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
      const isClient = parsed.moduleSpecifier.startsWith('$client/');
      const isShared = parsed.moduleSpecifier.startsWith('$shared/');
      if (!isClient && !isShared) continue;

      for (const binding of parsed.bindings) {
        this.bindingMap.set(binding.local, {
          importLine: entry.line,
          importerDir: entry.importerDir,
          localName: binding.local,
          moduleSpecifier: parsed.moduleSpecifier,
        });
        if (isClient) this.clientOnlyBindings.add(binding.local);
      }
      if (parsed.namespaceImport) {
        this.bindingMap.set(parsed.namespaceImport, {
          importLine: entry.line,
          importerDir: entry.importerDir,
          localName: parsed.namespaceImport,
          moduleSpecifier: parsed.moduleSpecifier,
        });
        if (isClient) this.clientOnlyBindings.add(parsed.namespaceImport);
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

    if (parsed.argsExpr) {
      const argRefs = collectReferencedIdentifiers(parsed.argsExpr);
      const leakedClientRefs = Array.from(argRefs).filter((ref) => this.clientOnlyBindings.has(ref));
      if (leakedClientRefs.length > 0) {
        throw new Error(
          `[kuratchi compiler] Client event arguments cannot depend on $client bindings: ${leakedClientRefs.join(', ')}.\n` +
          `Only server/shared values can be serialized into event handler arguments.`,
        );
      }
    }

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
      `function __kuratchiGetCsrf(){`,
      `  return (document.cookie.match(/(?:^|;\\s*)__kuratchi_csrf=([^;]*)/) || [])[1] || '';`,
      `}`,
      `async function __kuratchiCallRemote(rpcId, args){`,
      `  const url = new URL(window.location.pathname, window.location.origin);`,
      `  url.searchParams.set('_rpc', rpcId);`,
      `  if (args.length > 0) url.searchParams.set('_args', JSON.stringify(args));`,
      `  const headers = { 'x-kuratchi-rpc': '1' };`,
      `  const csrfToken = __kuratchiGetCsrf();`,
      `  if (csrfToken) headers['x-kuratchi-csrf'] = csrfToken;`,
      `  const response = await fetch(url.toString(), { method: 'GET', headers });`,
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
    const rewritten = rewriteImportSpecifiers(source, (spec) => {
      const target = resolveClientImportTarget(this.compiler.srcDir, resolved, spec);
      if (target.kind === 'browser') {
        const targetAssetName = this.transformRouteClientModule(target.resolved);
        return toRelativeSpecifier(assetName, targetAssetName);
      }
      const proxyAssetName = this.ensureServerProxyAsset(normalizePath(target.resolved));
      return toRelativeSpecifier(assetName, proxyAssetName);
    });

    this.compiler.registerAsset(buildAsset(assetName, rewritten));
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
}

class CompilerBackedClientModuleCompiler implements ClientModuleCompiler {
  private readonly compiledAssets = new Map<string, CompiledAsset>();

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
    return Array.from(this.compiledAssets.values());
  }

  registerAsset(asset: CompiledAsset): void {
    this.compiledAssets.set(asset.name, asset);
  }
}

export function createClientModuleCompiler(opts: {
  projectDir: string;
  srcDir: string;
}): ClientModuleCompiler {
  return new CompilerBackedClientModuleCompiler(opts.projectDir, opts.srcDir);
}
