import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFile, stripTopLevelImports, type ParsedFile } from './parser.js';
import type { RouteImportEntry } from './import-linking.js';

export interface RouteScriptSegment {
  script: string;
  dataVars: string[];
}

export interface MergedRouteParsed extends ParsedFile {
  scriptImportDecls: string[];
  scriptSegments: RouteScriptSegment[];
}

export interface RouteStatePlan {
  effectiveTemplate: string;
  routeImportDecls: string[];
  routeScriptReferenceSource: string;
  routeServerImportEntries: RouteImportEntry[];
  routeClientImportEntries: RouteImportEntry[];
  routeBrowserImportEntries: RouteImportEntry[];
  mergedParsed: MergedRouteParsed;
}

function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) target.push(value);
}

function isSharedImport(line: string): boolean {
  return /\bfrom\s+['"]\$shared\//.test(line);
}

export function assembleRouteState(opts: {
  parsed: ParsedFile;
  fullPath: string;
  routesDir: string;
  layoutRelativePaths: string[];
  fileContents?: Map<string, string>;
}): RouteStatePlan {
  const { parsed, fullPath, routesDir, layoutRelativePaths, fileContents } = opts;

  let effectiveTemplate = parsed.template;
  const routeScriptParts: string[] = [];
  const routeScriptSegments: RouteScriptSegment[] = [];
  const routeServerImportEntries: RouteImportEntry[] = parsed.serverImports.map((line) => ({
    line,
    importerDir: path.dirname(fullPath),
  }));
  const routeClientImportEntries: RouteImportEntry[] = parsed.clientImports.map((line) => ({
    line,
    importerDir: path.dirname(fullPath),
  }));
  const routeBrowserImportEntries: RouteImportEntry[] = [
    ...parsed.routeClientImports.map((line) => ({
      line,
      importerDir: path.dirname(fullPath),
    })),
    ...parsed.serverImports.filter(isSharedImport).map((line) => ({
      line,
      importerDir: path.dirname(fullPath),
    })),
  ];
  const mergedActionFunctions = [...parsed.actionFunctions];
  const mergedDataVars = [...parsed.dataVars];
  const mergedPollFunctions = [...parsed.pollFunctions];
  const mergedDataGetQueries = parsed.dataGetQueries.map((query) => ({ ...query }));
  const mergedComponentImports: Record<string, string> = { ...parsed.componentImports };
  const mergedWorkerEnvAliases = [...parsed.workerEnvAliases];
  const mergedDevAliases = [...parsed.devAliases];
  const mergedRouteClientImports = [...parsed.routeClientImports];
  const mergedRouteClientImportBindings = [...parsed.routeClientImportBindings];

  for (const layoutRelPath of layoutRelativePaths) {
    if (layoutRelPath === 'layout.html') continue;

    const layoutPath = path.join(routesDir, layoutRelPath);
    const layoutSource = fileContents?.get(layoutPath) ?? (fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf-8') : null);
    if (!layoutSource) continue;
    const layoutParsed = parseFile(layoutSource, { kind: 'layout', filePath: layoutPath });
    if (layoutParsed.loadFunction) {
      throw new Error(`${layoutRelPath} cannot export load(); nested layouts currently share the child route load lifecycle.`);
    }

    const layoutSlot = layoutParsed.template.match(/<slot\s*><\/slot>|<slot\s*\/>/);
    if (!layoutSlot) {
      throw new Error(`${layoutRelPath} must contain <slot></slot> or <slot />`);
    }

    if (layoutParsed.script) {
      routeScriptParts.push(layoutParsed.script);
      routeScriptSegments.push({ script: layoutParsed.script, dataVars: [...layoutParsed.dataVars] });
    }

    for (const line of layoutParsed.serverImports) {
      routeServerImportEntries.push({ line, importerDir: path.dirname(layoutPath) });
    }
    for (const line of layoutParsed.clientImports) {
      routeClientImportEntries.push({ line, importerDir: path.dirname(layoutPath) });
    }
    for (const line of layoutParsed.routeClientImports) {
      routeBrowserImportEntries.push({ line, importerDir: path.dirname(layoutPath) });
      pushUnique(mergedRouteClientImports, line);
    }
    for (const line of layoutParsed.serverImports.filter(isSharedImport)) {
      routeBrowserImportEntries.push({ line, importerDir: path.dirname(layoutPath) });
    }
    for (const binding of layoutParsed.routeClientImportBindings) {
      pushUnique(mergedRouteClientImportBindings, binding);
    }
    for (const fnName of layoutParsed.actionFunctions) {
      pushUnique(mergedActionFunctions, fnName);
    }
    for (const varName of layoutParsed.dataVars) {
      pushUnique(mergedDataVars, varName);
    }
    for (const fnName of layoutParsed.pollFunctions) {
      pushUnique(mergedPollFunctions, fnName);
    }
    for (const query of layoutParsed.dataGetQueries) {
      if (!mergedDataGetQueries.some((existing) => existing.asName === query.asName)) {
        mergedDataGetQueries.push({ ...query });
      }
    }
    for (const [pascalName, fileName] of Object.entries(layoutParsed.componentImports)) {
      mergedComponentImports[pascalName] = fileName;
    }
    for (const alias of layoutParsed.workerEnvAliases) {
      pushUnique(mergedWorkerEnvAliases, alias);
    }
    for (const alias of layoutParsed.devAliases) {
      pushUnique(mergedDevAliases, alias);
    }

    effectiveTemplate = layoutParsed.template.replace(layoutSlot[0], effectiveTemplate);
  }

  if (parsed.script) {
    routeScriptParts.push(parsed.script);
    routeScriptSegments.push({ script: parsed.script, dataVars: [...parsed.dataVars] });
  }

  const routeImportDecls: string[] = [];
  const routeScriptReferenceSource = [
    ...routeScriptParts.map((script) => stripTopLevelImports(script)),
    parsed.loadFunction || '',
  ].join('\n');

  const mergedParsed: MergedRouteParsed = {
    ...parsed,
    template: effectiveTemplate,
    script: routeScriptParts.length > 0 ? routeScriptParts.join('\n\n') : parsed.script,
    serverImports: routeServerImportEntries.map((entry) => entry.line),
    clientImports: routeClientImportEntries.map((entry) => entry.line),
    routeClientImports: mergedRouteClientImports,
    routeClientImportBindings: mergedRouteClientImportBindings,
    actionFunctions: mergedActionFunctions,
    dataVars: mergedDataVars,
    componentImports: mergedComponentImports,
    pollFunctions: mergedPollFunctions,
    dataGetQueries: mergedDataGetQueries,
    workerEnvAliases: mergedWorkerEnvAliases,
    devAliases: mergedDevAliases,
    scriptImportDecls: routeImportDecls,
    scriptSegments: routeScriptSegments,
  };

  return {
    effectiveTemplate,
    routeImportDecls,
    routeScriptReferenceSource,
    routeServerImportEntries,
    routeClientImportEntries,
    routeBrowserImportEntries,
    mergedParsed,
  };
}
