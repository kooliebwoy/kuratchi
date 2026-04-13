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

function isLibImport(line: string): boolean {
  return /\bfrom\s+['"]\$lib\//.test(line);
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
    // Include $lib/ imports for browser bundling
    ...parsed.serverImports.filter(isLibImport).map((line) => ({
      line,
      importerDir: path.dirname(fullPath),
    })),
    ...parsed.clientImports.filter(isLibImport).map((line) => ({
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
  const mergedRequestImports = [...parsed.requestImports];
  const mergedRouteClientImports = [...parsed.routeClientImports];
  const mergedRouteClientImportBindings = [...parsed.routeClientImportBindings];
  
  // RFC 0002: Track client-first script model fields
  const mergedServerRpcImports = [...parsed.serverRpcImports];
  const mergedServerRpcFunctions = [...parsed.serverRpcFunctions];
  const mergedSsrAwaitCalls = [...parsed.ssrAwaitCalls];
  const mergedClientNpmImports = [...parsed.clientNpmImports];

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
    // Include $lib/ imports from layout for browser bundling
    for (const line of layoutParsed.serverImports.filter(isLibImport)) {
      routeBrowserImportEntries.push({ line, importerDir: path.dirname(layoutPath) });
    }
    for (const line of layoutParsed.clientImports.filter(isLibImport)) {
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
    for (const imp of layoutParsed.requestImports) {
      if (!mergedRequestImports.some(r => r.alias === imp.alias)) {
        mergedRequestImports.push({ ...imp });
      }
    }
    
    // RFC 0002: Merge client-first script model fields from layouts
    for (const line of layoutParsed.serverRpcImports) {
      pushUnique(mergedServerRpcImports, line);
    }
    for (const fn of layoutParsed.serverRpcFunctions) {
      pushUnique(mergedServerRpcFunctions, fn);
    }
    for (const call of layoutParsed.ssrAwaitCalls) {
      if (!mergedSsrAwaitCalls.some((c) => c.varName === call.varName)) {
        mergedSsrAwaitCalls.push({ ...call });
      }
    }
    for (const line of layoutParsed.clientNpmImports) {
      pushUnique(mergedClientNpmImports, line);
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
    requestImports: mergedRequestImports,
    scriptImportDecls: routeImportDecls,
    scriptSegments: routeScriptSegments,
    // RFC 0002: Client-first script model fields
    serverRpcImports: mergedServerRpcImports,
    serverRpcFunctions: mergedServerRpcFunctions,
    ssrAwaitCalls: mergedSsrAwaitCalls,
    clientNpmImports: mergedClientNpmImports,
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
