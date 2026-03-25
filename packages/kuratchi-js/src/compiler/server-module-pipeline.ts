import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ServerModuleCompiler {
  toModuleSpecifier(fromFileAbs: string, toFileAbs: string): string;
  transformModule(entryAbsPath: string): string;
  resolveCompiledImportPath(origPath: string, importerDir: string, outFileDir: string): string;
}

interface CreateServerModuleCompilerOptions {
  projectDir: string;
  srcDir: string;
  doHandlerProxyPaths: Map<string, string>;
  writeFile: (filePath: string, content: string) => void;
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

export function createServerModuleCompiler(
  options: CreateServerModuleCompilerOptions,
): ServerModuleCompiler {
  const { projectDir, srcDir, doHandlerProxyPaths, writeFile } = options;
  const transformedServerModules = new Map<string, string>();
  const modulesOutDir = path.join(projectDir, '.kuratchi', 'modules');
  const normalizedProjectDir = projectDir.replace(/\\/g, '/');

  function toModuleSpecifier(fromFileAbs: string, toFileAbs: string): string {
    let rel = path.relative(path.dirname(fromFileAbs), toFileAbs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
  }

  function resolveDoProxyTarget(absPath: string): string | null {
    const normalizedNoExt = absPath.replace(/\\/g, '/').replace(/\.[^.\/]+$/, '');
    const proxyNoExt = doHandlerProxyPaths.get(normalizedNoExt);
    if (!proxyNoExt) return null;
    return resolveExistingModuleFile(proxyNoExt) ?? (fs.existsSync(proxyNoExt + '.ts') ? proxyNoExt + '.ts' : null);
  }

  function resolveImportTarget(importerAbs: string, spec: string): string | null {
    // Handle kuratchi:* virtual modules
    if (spec.startsWith('kuratchi:')) {
      // These are resolved at bundle time to @kuratchi/js runtime modules
      // Return null to keep the specifier as-is for later rewriting
      return null;
    }

    if (spec.startsWith('$')) {
      const slashIdx = spec.indexOf('/');
      const folder = slashIdx === -1 ? spec.slice(1) : spec.slice(1, slashIdx);
      const rest = slashIdx === -1 ? '' : spec.slice(slashIdx + 1);
      if (!folder) return null;
      const abs = path.join(srcDir, folder, rest);
      return resolveExistingModuleFile(abs) ?? abs;
    }

    if (spec.startsWith('.')) {
      const abs = path.resolve(path.dirname(importerAbs), spec);
      return resolveExistingModuleFile(abs) ?? abs;
    }

    return null;
  }

  function transformModule(entryAbsPath: string): string {
    const resolved = resolveExistingModuleFile(entryAbsPath) ?? entryAbsPath;
    const normalized = resolved.replace(/\\/g, '/');
    const cached = transformedServerModules.get(normalized);
    if (cached) return cached;

    const relFromProject = path.relative(projectDir, resolved);
    const outPath = path.join(modulesOutDir, relFromProject);
    transformedServerModules.set(normalized, outPath);

    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    if (!/\.(ts|js|mjs|cjs)$/i.test(resolved) || !fs.existsSync(resolved)) {
      transformedServerModules.set(normalized, resolved);
      return resolved;
    }

    const source = fs.readFileSync(resolved, 'utf-8');
    const rewriteSpecifier = (spec: string): string => {
      // Rewrite kuratchi:* virtual modules to @kuratchi/js runtime paths
      if (spec.startsWith('kuratchi:')) {
        const moduleName = spec.slice('kuratchi:'.length);
        const moduleMap: Record<string, string> = {
          'request': '@kuratchi/js/request',
          'navigation': '@kuratchi/js/navigation',
        };
        return moduleMap[moduleName] ?? spec;
      }

      const target = resolveImportTarget(resolved, spec);
      if (!target) return spec;

      const doProxyTarget = resolveDoProxyTarget(target);
      if (doProxyTarget) return toModuleSpecifier(outPath, doProxyTarget);

      const normalizedTarget = target.replace(/\\/g, '/');
      const inProject = normalizedTarget.startsWith(normalizedProjectDir + '/');
      if (!inProject) return spec;

      const targetResolved = resolveExistingModuleFile(target) ?? target;
      if (!/\.(ts|js|mjs|cjs)$/i.test(targetResolved)) return spec;
      const rewrittenTarget = transformModule(targetResolved);
      return toModuleSpecifier(outPath, rewrittenTarget);
    };

    let rewritten = source.replace(/(from\s+)(['"])([^'"]+)\2/g, (_match, prefix: string, quote: string, spec: string) => {
      return `${prefix}${quote}${rewriteSpecifier(spec)}${quote}`;
    });
    rewritten = rewritten.replace(
      /(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
      (_match, prefix: string, quote: string, spec: string, suffix: string) => {
        return `${prefix}${quote}${rewriteSpecifier(spec)}${quote}${suffix}`;
      },
    );

    writeFile(outPath, rewritten);
    return outPath;
  }

  function resolveCompiledImportPath(origPath: string, importerDir: string, outFileDir: string): string {
    // Rewrite kuratchi:* virtual modules to @kuratchi/js runtime paths
    if (origPath.startsWith('kuratchi:')) {
      const moduleName = origPath.slice('kuratchi:'.length);
      const moduleMap: Record<string, string> = {
        'request': '@kuratchi/js/request',
        'navigation': '@kuratchi/js/navigation',
      };
      return moduleMap[moduleName] ?? origPath;
    }

    const isBareModule = !origPath.startsWith('.') && !origPath.startsWith('/') && !origPath.startsWith('$');
    if (isBareModule) return origPath;

    let absImport: string;
    if (origPath.startsWith('$')) {
      const slashIdx = origPath.indexOf('/');
      const folder = slashIdx === -1 ? origPath.slice(1) : origPath.slice(1, slashIdx);
      const rest = slashIdx === -1 ? '' : origPath.slice(slashIdx + 1);
      absImport = path.join(srcDir, folder, rest);
    } else {
      absImport = path.resolve(importerDir, origPath);
    }

    const doProxyTarget = resolveDoProxyTarget(absImport);
    const target = doProxyTarget ?? transformModule(absImport);

    let relPath = path.relative(outFileDir, target).replace(/\\/g, '/');
    if (!relPath.startsWith('.')) relPath = './' + relPath;
    return relPath;
  }

  return {
    toModuleSpecifier,
    transformModule,
    resolveCompiledImportPath,
  };
}
