import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { CompiledAsset } from './asset-pipeline.js';
import { collectReferencedIdentifiers, parseImportStatement, type RouteImportEntry } from './import-linking.js';
import { transpileTypeScript } from './transpile.js';

export interface ClientEventRegistration {
  routeId: string;
  handlerId: string;
  argsExpr: string | null;
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
  buildEntryAsset(): { assetName: string; asset: CompiledAsset } | null;
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

function resolveClientImportTarget(srcDir: string, importerAbs: string, spec: string): string {
  if (spec.startsWith('$')) {
    const slashIdx = spec.indexOf('/');
    const folder = slashIdx === -1 ? spec.slice(1) : spec.slice(1, slashIdx);
    const rest = slashIdx === -1 ? '' : spec.slice(slashIdx + 1);
    if (folder !== 'client' && folder !== 'shared') {
      throw new Error(`[kuratchi compiler] Unsupported browser import realm "${spec}". Only $client/* and $shared/* may be loaded in the browser.`);
    }
    const abs = path.join(srcDir, folder, rest);
    const resolved = resolveExistingModuleFile(abs);
    if (!resolved) {
      throw new Error(`[kuratchi compiler] Browser import not found: ${spec}`);
    }
    return resolved;
  }

  if (spec.startsWith('.')) {
    const abs = path.resolve(path.dirname(importerAbs), spec);
    const resolved = resolveExistingModuleFile(abs);
    if (!resolved) {
      throw new Error(`[kuratchi compiler] Browser import not found: ${spec}`);
    }
    return resolved;
  }

  throw new Error(
    `[kuratchi compiler] Browser modules currently only support project-local imports ($client, $shared, or relative). Unsupported import: ${spec}`,
  );
}

class CompilerBackedClientRouteRegistry implements ClientRouteRegistry {
  private readonly bindingMap = new Map<string, BrowserBindingEntry>();
  private readonly clientOnlyBindings = new Set<string>();
  private readonly handlerByKey = new Map<string, ClientHandlerRecord>();
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

  buildEntryAsset(): { assetName: string; asset: CompiledAsset } | null {
    if (this.handlerByKey.size === 0) return null;

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
      const targetAbs = resolveClientImportTarget(this.compiler.srcDir, path.join(entry.importerDir, '__route__.ts'), parsed.moduleSpecifier);
      const targetAssetName = this.compiler.transformClientModule(targetAbs);
      const relSpecifier = toRelativeSpecifier(assetName, targetAssetName);
      importLines.push(entry.line.replace(parsed.moduleSpecifier, relSpecifier));
    }

    const registrationEntries = Array.from(this.handlerByKey.values()).map((record) => {
      return `${JSON.stringify(record.id)}: (args, event, element) => ${record.calleeExpr}(...args, event, element)`;
    });

    const source = transpileTypeScript(
      [
        ...importLines,
        `window.__kuratchiClient?.register(${JSON.stringify(this.routeId)}, {`,
        registrationEntries.map((entry) => `  ${entry},`).join('\n'),
        `});`,
      ].join('\n'),
      `client-route:${this.routeId}.ts`,
    );
    const asset = buildAsset(assetName, source);
    this.compiler.registerAsset(asset);
    return { assetName, asset };
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
  private readonly transformedModules = new Map<string, string>();

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

  transformClientModule(entryAbsPath: string): string {
    const resolved = resolveExistingModuleFile(entryAbsPath) ?? entryAbsPath;
    const normalized = resolved.replace(/\\/g, '/');
    const cached = this.transformedModules.get(normalized);
    if (cached) return cached;

    const relFromSrc = path.relative(this.srcDir, resolved).replace(/\\/g, '/');
    const assetName = `__kuratchi/client/modules/${relFromSrc.replace(/\.(ts|js|mjs|cjs)$/i, '.js')}`;
    this.transformedModules.set(normalized, assetName);

    if (!fs.existsSync(resolved)) {
      throw new Error(`[kuratchi compiler] Browser module not found: ${resolved}`);
    }

    const source = fs.readFileSync(resolved, 'utf-8');
    let rewritten = transpileTypeScript(source, `client-module:${relFromSrc}`);
    rewritten = rewriteImportSpecifiers(rewritten, (spec) => {
      const targetAbs = resolveClientImportTarget(this.srcDir, resolved, spec);
      const targetAssetName = this.transformClientModule(targetAbs);
      return toRelativeSpecifier(assetName, targetAssetName);
    });

    this.registerAsset(buildAsset(assetName, rewritten));
    return assetName;
  }
}

export function createClientModuleCompiler(opts: {
  projectDir: string;
  srcDir: string;
}): ClientModuleCompiler {
  return new CompilerBackedClientModuleCompiler(opts.projectDir, opts.srcDir);
}
