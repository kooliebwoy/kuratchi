import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFile, stripTopLevelImports } from './parser.js';
import { compileTemplate } from './template.js';
import { transpileTypeScript } from './transpile.js';
import { buildDevAliasDeclarations } from './script-transform.js';

export interface ComponentCompiler {
  ensureCompiled(fileName: string): string | null;
  collectComponentMap(componentImports: Record<string, string>): Map<string, string>;
  getActionPropNames(fileName: string): Set<string>;
  collectStyles(componentNames: Map<string, string>): string[];
  resolveActionProps(
    template: string,
    componentNames: Map<string, string>,
    shouldInclude?: (fnName: string) => boolean,
  ): Set<string>;
  getCompiledComponents(): string[];
}

interface CreateComponentCompilerOptions {
  projectDir: string;
  srcDir: string;
  isDev: boolean;
}

function resolvePackageComponent(projectDir: string, pkgName: string, componentFile: string): string {
  const nmPath = path.join(projectDir, 'node_modules', pkgName, 'src', 'lib', componentFile + '.html');
  if (fs.existsSync(nmPath)) return nmPath;

  const pkgDirName = pkgName.replace(/^@/, '').replace(/\//g, '-');
  const workspaceRoot = path.resolve(projectDir, '../..');
  const wsPath = path.join(workspaceRoot, 'packages', pkgDirName, 'src', 'lib', componentFile + '.html');
  if (fs.existsSync(wsPath)) return wsPath;

  const rootNmPath = path.join(workspaceRoot, 'node_modules', pkgName, 'src', 'lib', componentFile + '.html');
  if (fs.existsSync(rootNmPath)) return rootNmPath;

  return '';
}

function escapeTemplateLiteral(source: string): string {
  return source.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function scopeComponentCss(source: string, scopeHash: string): string {
  return source.replace(
    /([^{}]+)\{/g,
    (_match, selectors: string) => {
      const scoped = selectors
        .split(',')
        .map((selector: string) => `.${scopeHash} ${selector.trim()}`)
        .join(', ');
      return scoped + ' {';
    },
  );
}

export function createComponentCompiler(options: CreateComponentCompilerOptions): ComponentCompiler {
  const { projectDir, srcDir, isDev } = options;
  const libDir = path.join(srcDir, 'lib');
  const compiledComponentCache = new Map<string, string>();
  const componentStyleCache = new Map<string, string>();
  const componentActionCache = new Map<string, Set<string>>();

  function ensureCompiled(fileName: string): string | null {
    if (compiledComponentCache.has(fileName)) return compiledComponentCache.get(fileName)!;

    let filePath: string;
    let funcName: string;

    const pkgMatch = fileName.match(/^(@[^:]+):(.+)$/);
    if (pkgMatch) {
      const pkgName = pkgMatch[1];
      const componentFile = pkgMatch[2];
      funcName = '__c_' + componentFile.replace(/[\/\-]/g, '_');
      filePath = resolvePackageComponent(projectDir, pkgName, componentFile);
      if (!filePath || !fs.existsSync(filePath)) return null;
    } else {
      funcName = '__c_' + fileName.replace(/[\/\-]/g, '_');
      filePath = path.join(libDir, fileName + '.html');
      if (!fs.existsSync(filePath)) return null;
    }

    const scopeHash = 'dz-' + crypto.createHash('md5').update(fileName).digest('hex').slice(0, 6);
    const rawSource = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFile(rawSource, { kind: 'component', filePath });

    const propsCode = parsed.script ? stripTopLevelImports(parsed.script) : '';
    const devDecls = buildDevAliasDeclarations(parsed.devAliases, isDev);
    const effectivePropsCode = [devDecls, propsCode].filter(Boolean).join('\n');
    const transpiledPropsCode = propsCode
      ? transpileTypeScript(effectivePropsCode, `component-script:${fileName}.ts`)
      : devDecls
        ? transpileTypeScript(devDecls, `component-script:${fileName}.ts`)
        : '';

    let source = parsed.template;
    let styleBlock = '';
    const styleMatch = source.match(/<style[\s>][\s\S]*?<\/style>/i);
    if (styleMatch) {
      styleBlock = styleMatch[0];
      source = source.replace(styleMatch[0], '').trim();
    }

    let scopedStyle = '';
    if (styleBlock) {
      const cssContent = styleBlock.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, '').trim();
      scopedStyle = `<style>${scopeComponentCss(cssContent, scopeHash)}</style>`;
    }
    componentStyleCache.set(fileName, scopedStyle ? escapeTemplateLiteral(scopedStyle) : '');

    source = source.replace(/<slot\s*><\/slot>/g, '{@raw props.children || ""}');
    source = source.replace(/<slot\s*\/>/g, '{@raw props.children || ""}');

    const subComponentNames = collectComponentMap(parsed.componentImports);
    for (const subFileName of subComponentNames.values()) {
      const subStyle = componentStyleCache.get(subFileName);
      if (subStyle) {
        const existing = componentStyleCache.get(fileName) || '';
        if (!existing.includes(subStyle)) {
          componentStyleCache.set(fileName, existing + subStyle);
        }
      }
    }

    const actionPropNames = new Set<string>();
    for (const match of source.matchAll(/\baction=\{([A-Za-z_$][\w$]*)\}/g)) {
      actionPropNames.add(match[1]);
    }
    componentActionCache.set(fileName, actionPropNames);

    const body = compileTemplate(source, subComponentNames, undefined, undefined);
    const scopeOpen = `__html += '<div class="${scopeHash}">';`;
    const scopeClose = `__html += '</div>';`;
    const bodyLines = body.split('\n');
    const scopedBody = [bodyLines[0], scopeOpen, ...bodyLines.slice(1), scopeClose].join('\n');
    const fnBody = transpiledPropsCode ? `${transpiledPropsCode}\n  ${scopedBody}` : scopedBody;
    const compiled = `function ${funcName}(props, __esc) {\n  ${fnBody}\n  return __html;\n}`;

    compiledComponentCache.set(fileName, compiled);
    return compiled;
  }

  function collectComponentMap(componentImports: Record<string, string>): Map<string, string> {
    const componentNames = new Map<string, string>();
    for (const [pascalName, fileName] of Object.entries(componentImports)) {
      ensureCompiled(fileName);
      componentNames.set(pascalName, fileName);
    }
    return componentNames;
  }

  function getActionPropNames(fileName: string): Set<string> {
    return componentActionCache.get(fileName) ?? new Set<string>();
  }

  function collectStyles(componentNames: Map<string, string>): string[] {
    const styles: string[] = [];
    for (const fileName of componentNames.values()) {
      const css = componentStyleCache.get(fileName);
      if (css) styles.push(css);
    }
    return styles;
  }

  function resolveActionProps(
    template: string,
    componentNames: Map<string, string>,
    shouldInclude?: (fnName: string) => boolean,
  ): Set<string> {
    const names = new Set<string>();
    for (const [pascalName, compFileName] of componentNames.entries()) {
      const actionPropNames = getActionPropNames(compFileName);
      const compTagRegex = new RegExp(`<${pascalName}\\b([\\s\\S]*?)(?:/?)>`, 'g');
      for (const tagMatch of template.matchAll(compTagRegex)) {
        const attrs = tagMatch[1];
        for (const propName of actionPropNames) {
          const propRegex = new RegExp(`\\b${propName}=\\{([A-Za-z_$][\\w$]*)\\}`);
          const propMatch = attrs.match(propRegex);
          if (!propMatch) continue;
          const fnName = propMatch[1];
          if (!shouldInclude || shouldInclude(fnName)) {
            names.add(fnName);
          }
        }
      }
    }
    return names;
  }

  function getCompiledComponents(): string[] {
    return Array.from(compiledComponentCache.values());
  }

  return {
    ensureCompiled,
    collectComponentMap,
    getActionPropNames,
    collectStyles,
    resolveActionProps,
    getCompiledComponents,
  };
}
