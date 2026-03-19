import * as path from 'node:path';
import { parseFile, stripTopLevelImports, type ParsedFile } from './parser.js';
import { compileTemplate } from './template.js';
import type { ComponentCompiler } from './component-pipeline.js';
import { parseNamedImportBindings } from './import-linking.js';
import { buildDevAliasDeclarations, rewriteImportedFunctionCalls } from './script-transform.js';

export interface LayoutBuildPlan {
  compiledLayout: string | null;
  componentNames: Map<string, string>;
  importParsed: ParsedFile | null;
}

export function compileLayoutPlan(opts: {
  renderSource: string;
  importSource: string;
  layoutFile: string;
  isDev: boolean;
  componentCompiler: ComponentCompiler;
}): LayoutBuildPlan {
  const importParsed = parseFile(opts.importSource, { kind: 'layout', filePath: opts.layoutFile });
  let renderTemplateSource = opts.renderSource;
  const importScriptMatch = opts.importSource.match(/^(\s*)<script(\s[^>]*)?\s*>([\s\S]*?)<\/script>/);
  if (importScriptMatch) {
    const body = importScriptMatch[3].trim();
    const isServerScript = !/\$\s*:/.test(body);
    if (isServerScript) {
      renderTemplateSource = opts.renderSource.replace(importScriptMatch[0], '').trim();
    }
  }
  const componentNames = opts.componentCompiler.collectComponentMap(importParsed.componentImports);
  const hasLayoutScript = !!(importParsed.script && (componentNames.size > 0 || importParsed.hasLoad));

  if (hasLayoutScript) {
    let layoutTemplate = renderTemplateSource.replace(/<slot\s*><\/slot>/g, '{@raw __content}');
    layoutTemplate = layoutTemplate.replace(/<slot\s*\/>/g, '{@raw __content}');

    const layoutActionNames = new Set(importParsed.actionFunctions);
    for (const fnName of opts.componentCompiler.resolveActionProps(importParsed.template, componentNames)) {
      layoutActionNames.add(fnName);
    }

    const layoutRenderBody = compileTemplate(layoutTemplate, componentNames, layoutActionNames);
    const layoutComponentStyles = opts.componentCompiler.collectStyles(componentNames);
    let finalLayoutBody = layoutRenderBody;
    if (layoutComponentStyles.length > 0) {
      const lines = layoutRenderBody.split('\n');
      const styleLines = layoutComponentStyles.map((css) => `__html += \`${css}\\n\`;`);
      finalLayoutBody = [lines[0], ...styleLines, ...lines.slice(1)].join('\n');
    }

    let layoutScriptBody = stripTopLevelImports(importParsed.script!);
    const layoutDevDecls = buildDevAliasDeclarations(importParsed.devAliases, opts.isDev);
    layoutScriptBody = [layoutDevDecls, layoutScriptBody].filter(Boolean).join('\n');

    return {
      compiledLayout: `function __layout(__content) {
  const __esc = (v) => { if (v == null) return ''; return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  ${layoutScriptBody ? layoutScriptBody + '\n  ' : ''}${finalLayoutBody}
  return __html;
}`,
      componentNames,
      importParsed,
    };
  }

  const slotMarker = '<slot></slot>';
  const slotIdx = opts.renderSource.indexOf(slotMarker);
  if (slotIdx === -1) {
    throw new Error('layout.html must contain <slot></slot>');
  }

  const escLayout = (source: string) => source.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, () => '\\$');
  const before = escLayout(opts.renderSource.slice(0, slotIdx));
  const after = escLayout(opts.renderSource.slice(slotIdx + slotMarker.length));

  return {
    compiledLayout: `const __layoutBefore = \`${before}\`;\nconst __layoutAfter = \`${after}\`;\nfunction __layout(content) {\n  return __layoutBefore + content + __layoutAfter;\n}`,
    componentNames,
    importParsed,
  };
}

export function finalizeLayoutPlan(opts: {
  plan: LayoutBuildPlan;
  layoutFile: string;
  projectDir: string;
  resolveCompiledImportPath: (origPath: string, importerDir: string, outFileDir: string) => string;
  allocateModuleId: () => string;
  pushImport: (statement: string) => void;
  componentCompiler: ComponentCompiler;
}): {
  compiledLayout: string | null;
  compiledLayoutActions: string | null;
  isLayoutAsync: boolean;
} {
  let compiledLayout = opts.plan.compiledLayout;
  let compiledLayoutActions: string | null = null;

  if (compiledLayout && opts.plan.importParsed && opts.plan.importParsed.serverImports.length > 0) {
    const layoutFileDir = path.dirname(opts.layoutFile);
    const outFileDir = path.join(opts.projectDir, '.kuratchi');
    const layoutFnToModule: Record<string, string> = {};

    for (const imp of opts.plan.importParsed.serverImports) {
      const pathMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (!pathMatch) continue;
      const origPath = pathMatch[1];
      const importPath = opts.resolveCompiledImportPath(origPath, layoutFileDir, outFileDir);

      const moduleId = opts.allocateModuleId();
      opts.pushImport(`import * as ${moduleId} from '${importPath}';`);

      for (const binding of parseNamedImportBindings(imp)) {
        layoutFnToModule[binding.local] = moduleId;
      }
      const starMatch = imp.match(/import\s*\*\s*as\s+(\w+)/);
      if (starMatch) {
        layoutFnToModule[starMatch[1]] = moduleId;
      }
    }

    compiledLayout = rewriteImportedFunctionCalls(compiledLayout, layoutFnToModule);

    const layoutActionNames = new Set(opts.plan.importParsed.actionFunctions);
    for (const fnName of opts.componentCompiler.resolveActionProps(opts.plan.importParsed.template, opts.plan.componentNames)) {
      layoutActionNames.add(fnName);
    }

    if (layoutActionNames.size > 0) {
      const actionEntries = Array.from(layoutActionNames)
        .filter((fnName) => fnName in layoutFnToModule)
        .map((fnName) => `'${fnName}': ${layoutFnToModule[fnName]}.${fnName}`)
        .join(', ');
      if (actionEntries) {
        compiledLayoutActions = `{ ${actionEntries} }`;
      }
    }
  }

  const isLayoutAsync = !!(compiledLayout && /\bawait\b/.test(compiledLayout));
  if (compiledLayout && isLayoutAsync) {
    compiledLayout = compiledLayout.replace(/^function __layout\(/, 'async function __layout(');
  }

  return {
    compiledLayout,
    compiledLayoutActions,
    isLayoutAsync,
  };
}
