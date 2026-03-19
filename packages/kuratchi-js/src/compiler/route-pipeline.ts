import type { ParsedFile } from './parser.js';
import { stripTopLevelImports } from './parser.js';
import { transpileTypeScript } from './transpile.js';
import {
  buildDevAliasDeclarations,
  buildSegmentedScriptBody,
  rewriteImportedFunctionCalls,
  rewriteWorkerEnvAliases,
  type RouteScriptSegment,
} from './script-transform.js';

export interface RouteDataGetQuery {
  fnName: string;
  argsExpr: string;
  asName: string;
  key?: string;
  rpcId?: string;
}

export interface RouteActionBinding {
  name: string;
  expression: string;
}

export interface RouteRpcBinding {
  name: string;
  rpcId: string;
  expression: string;
}

export interface RouteLoadPlan {
  mode: 'none' | 'explicit' | 'generated';
  code: string;
  returnVars: string[];
  scriptUsesAwait: boolean;
}

export interface RouteRenderPlan {
  prelude: string;
  dataVars: string[];
  body: string;
  componentStyles: string[];
}

export interface RouteBuildPlan {
  pattern: string;
  load: RouteLoadPlan;
  actions: RouteActionBinding[];
  rpc: RouteRpcBinding[];
  render: RouteRenderPlan;
}

export interface RoutePipelineParsedFile extends ParsedFile {
  scriptImportDecls?: string[];
  scriptSegments?: RouteScriptSegment[];
}

interface AnalyzeRouteOptions {
  pattern: string;
  renderBody: string;
  isDev: boolean;
  parsed: RoutePipelineParsedFile;
  fnToModule: Record<string, string>;
  rpcNameMap?: Map<string, string>;
  componentStyles: string[];
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

function buildLoadQueryStateCode(opts: {
  queries: RouteDataGetQuery[];
  fnToModule: Record<string, string>;
  rpcNameMap?: Map<string, string>;
}): string {
  const lines: string[] = [];

  for (const query of opts.queries) {
    const fnName = query.fnName;
    const rpcId = query.rpcId || opts.rpcNameMap?.get(fnName) || fnName;
    const argsExpr = (query.argsExpr || '').trim();
    const asName = query.asName;
    const defaultArgs = argsExpr ? `[${argsExpr}]` : '[]';
    const moduleId = opts.fnToModule[fnName];
    const qualifiedFn = moduleId ? `${moduleId}.${fnName}` : fnName;

    lines.push(`let ${asName} = { state: 'loading', loading: true, error: null, data: null, empty: false, success: false };`);
    lines.push(`const __qOverride_${asName} = __getLocals().__queryOverride;`);
    lines.push(`const __qArgs_${asName} = ${defaultArgs};`);
    lines.push(`const __qShouldRun_${asName} = !!(__qOverride_${asName} && __qOverride_${asName}.fn === '${rpcId}' && Array.isArray(__qOverride_${asName}.args) && JSON.stringify(__qOverride_${asName}.args) === JSON.stringify(__qArgs_${asName}));`);
    lines.push(`if (__qShouldRun_${asName}) {`);
    lines.push(`  try {`);
    lines.push(`    const __qData_${asName} = await ${qualifiedFn}(...__qArgs_${asName});`);
    lines.push(`    const __qEmpty_${asName} = Array.isArray(__qData_${asName}) ? __qData_${asName}.length === 0 : (__qData_${asName} == null);`);
    lines.push(`    ${asName} = { state: __qEmpty_${asName} ? 'empty' : 'success', loading: false, error: null, data: __qData_${asName}, empty: __qEmpty_${asName}, success: !__qEmpty_${asName} };`);
    lines.push(`  } catch (err) {`);
    lines.push(`    const __qErr_${asName} = (err && err.message) ? String(err.message) : String(err);`);
    lines.push(`    ${asName} = { state: 'error', loading: false, error: __qErr_${asName}, data: null, empty: false, success: false };`);
    lines.push(`  }`);
    lines.push(`}`);
  }

  return lines.join('\n');
}

function buildGeneratedLoadPlan(opts: {
  pattern: string;
  scriptBody: string;
  scriptUsesAwait: boolean;
  scriptReturnVars: string[];
  queries: RouteDataGetQuery[];
  hasSegmentedScripts: boolean;
  fnToModule: Record<string, string>;
  rpcNameMap?: Map<string, string>;
}): RouteLoadPlan {
  const loadSections: string[] = [];
  if (opts.scriptBody && opts.scriptUsesAwait) {
    loadSections.push(opts.scriptBody);
  }
  if (opts.queries.length > 0) {
    loadSections.push(buildLoadQueryStateCode({
      queries: opts.queries,
      fnToModule: opts.fnToModule,
      rpcNameMap: opts.rpcNameMap,
    }));
  }

  const queryVars = opts.queries.map((query) => query.asName);
  const returnVars = dedupe([...opts.scriptReturnVars, ...queryVars]);
  const loadLines: string[] = [];
  if (loadSections.length > 0) {
    loadLines.push(loadSections.join('\n'));
  }

  if (returnVars.length > 0) {
    if (opts.hasSegmentedScripts && opts.scriptUsesAwait) {
      const segmentReturnEntries = opts.scriptReturnVars.map((name) => `${name}: __segmentData.${name}`);
      const queryReturnEntries = queryVars
        .filter((name) => !opts.scriptReturnVars.includes(name))
        .map((name) => name);
      loadLines.push(`return { ${[...segmentReturnEntries, ...queryReturnEntries].join(', ')} };`);
    } else {
      loadLines.push(`return { ${returnVars.join(', ')} };`);
    }
  }

  return {
    mode: 'generated',
    code: `async load(__routeParams = {}) {\n      ${loadLines.join('\n      ')}\n    }`,
    returnVars,
    scriptUsesAwait: opts.scriptUsesAwait,
  };
}

function assertRoutePlanInvariants(opts: {
  pattern: string;
  loadReturnVars: string[];
  actionNames: string[];
  queryVars: string[];
}): void {
  const loadReturnSet = new Set(opts.loadReturnVars);
  const leakedActions = opts.actionNames.filter((name) => loadReturnSet.has(name));
  if (leakedActions.length > 0) {
    throw new Error(
      `[kuratchi compiler] ${opts.pattern}\nGenerated load data cannot include action bindings: ${leakedActions.join(', ')}`,
    );
  }

  const reservedQueryNames = opts.queryVars.filter((name) => opts.actionNames.includes(name));
  if (reservedQueryNames.length > 0) {
    throw new Error(
      `[kuratchi compiler] ${opts.pattern}\nQuery aliases cannot collide with action bindings: ${reservedQueryNames.join(', ')}`,
    );
  }
}

export function analyzeRouteBuild(opts: AnalyzeRouteOptions): RouteBuildPlan {
  const { pattern, renderBody, isDev, parsed, fnToModule, rpcNameMap, componentStyles } = opts;
  const hasFns = Object.keys(fnToModule).length > 0;
  const queryDefs = parsed.dataGetQueries ?? [];
  const queryVars = queryDefs.map((query) => query.asName);
  const scriptSegments = (parsed.scriptSegments ?? []).filter((segment) => !!segment.script);
  const hasSegmentedScripts = scriptSegments.length > 1;
  const routeDevDecls = buildDevAliasDeclarations(parsed.devAliases, isDev);
  const routeImportDecls = (parsed.scriptImportDecls ?? []).join('\n');

  let scriptBody = '';
  let scriptUsesAwait = false;
  if (hasSegmentedScripts) {
    const combinedScript = scriptSegments.map((segment) => stripTopLevelImports(segment.script)).join('\n');
    scriptUsesAwait = /\bawait\b/.test(combinedScript);
    scriptBody = buildSegmentedScriptBody({
      segments: scriptSegments,
      fnToModule,
      importDecls: routeImportDecls,
      workerEnvAliases: parsed.workerEnvAliases,
      devAliases: parsed.devAliases,
      isDev,
      asyncMode: scriptUsesAwait,
    });
  } else {
    scriptBody = parsed.script
      ? stripTopLevelImports(parsed.script)
      : '';
    scriptBody = [routeDevDecls, routeImportDecls, scriptBody].filter(Boolean).join('\n');
    scriptBody = rewriteImportedFunctionCalls(scriptBody, fnToModule);
    scriptBody = rewriteWorkerEnvAliases(scriptBody, parsed.workerEnvAliases);
    scriptUsesAwait = /\bawait\b/.test(scriptBody);
  }

  let explicitLoadFunction = parsed.loadFunction
    ? parsed.loadFunction.replace(/^export\s+/, '').trim()
    : '';
  if (explicitLoadFunction) {
    explicitLoadFunction = [routeDevDecls, explicitLoadFunction].filter(Boolean).join('\n');
    explicitLoadFunction = rewriteImportedFunctionCalls(explicitLoadFunction, fnToModule);
    explicitLoadFunction = rewriteWorkerEnvAliases(explicitLoadFunction, parsed.workerEnvAliases);
    if (routeImportDecls) explicitLoadFunction = explicitLoadFunction.replace('{', `{\n${routeImportDecls}\n`);
  }

  if (explicitLoadFunction && scriptUsesAwait) {
    throw new Error(
      `[kuratchi compiler] ${pattern}\nTop-level await cannot be mixed with export async function load(). Move async server work into load().`,
    );
  }

  if (scriptBody) {
    scriptBody = transpileTypeScript(scriptBody, `route-script:${pattern}.ts`);
  }
  if (explicitLoadFunction) {
    explicitLoadFunction = transpileTypeScript(explicitLoadFunction, `route-load:${pattern}.ts`);
  }

  const scriptReturnVars = parsed.script
    ? parsed.dataVars.filter((name) =>
      !queryVars.includes(name) &&
      !parsed.actionFunctions.includes(name) &&
      !parsed.pollFunctions.includes(name),
    )
    : [];

  const loadPlan = explicitLoadFunction
    ? {
      mode: 'explicit' as const,
      code: `load: ${explicitLoadFunction}`,
      returnVars: [...parsed.loadReturnVars],
      scriptUsesAwait: false,
    }
    : ((scriptBody && scriptUsesAwait) || queryDefs.length > 0)
      ? buildGeneratedLoadPlan({
        pattern,
        scriptBody,
        scriptUsesAwait,
        scriptReturnVars,
        queries: queryDefs,
        hasSegmentedScripts,
        fnToModule,
        rpcNameMap,
      })
      : {
        mode: 'none' as const,
        code: '',
        returnVars: [],
        scriptUsesAwait,
      };

  const actions = hasFns
    ? parsed.actionFunctions.map((name) => {
      const moduleId = fnToModule[name];
      return { name, expression: moduleId ? `${moduleId}.${name}` : name };
    })
    : [];

  const rpc = hasFns
    ? parsed.pollFunctions.map((name) => {
      const moduleId = fnToModule[name];
      const rpcId = rpcNameMap?.get(name) || name;
      return { name, rpcId, expression: moduleId ? `${moduleId}.${name}` : name };
    })
    : [];

  assertRoutePlanInvariants({
    pattern,
    loadReturnVars: loadPlan.returnVars,
    actionNames: actions.map((action) => action.name),
    queryVars,
  });

  const renderDataVars = dedupe([
    ...queryVars,
    ...(scriptUsesAwait ? scriptReturnVars : []),
    ...parsed.actionFunctions,
    'params',
    'breadcrumbs',
  ]);

  return {
    pattern,
    load: loadPlan,
    actions,
    rpc,
    render: {
      prelude: scriptBody && !scriptUsesAwait ? scriptBody : '',
      dataVars: renderDataVars,
      body: renderBody,
      componentStyles,
    },
  };
}

export function emitRouteObject(plan: RouteBuildPlan): string {
  const parts: string[] = [];
  parts.push(`    pattern: '${plan.pattern}'`);

  if (plan.load.mode === 'explicit' || plan.load.mode === 'generated') {
    parts.push(`    ${plan.load.code}`);
  }

  if (plan.actions.length > 0) {
    const actionEntries = plan.actions
      .map((action) => `'${action.name}': ${action.expression}`)
      .join(', ');
    parts.push(`    actions: { ${actionEntries} }`);
  }

  if (plan.rpc.length > 0) {
    const rpcEntries = plan.rpc
      .map((rpc) => `'${rpc.rpcId}': ${rpc.expression}`)
      .join(', ');
    parts.push(`    rpc: { ${rpcEntries} }`);
  }

  const destructure = `const { ${plan.render.dataVars.join(', ')} } = data;\n      `;
  let finalRenderBody = plan.render.body;
  if (plan.render.componentStyles.length > 0) {
    const lines = plan.render.body.split('\n');
    const styleLines = plan.render.componentStyles.map((css) => `__html += \`${css}\\n\`;`);
    finalRenderBody = [lines[0], ...styleLines, ...lines.slice(1)].join('\n');
  }

  parts.push(`    render(data) {
      ${destructure}${plan.render.prelude ? plan.render.prelude + '\n      ' : ''}${finalRenderBody}
      return __html;
    }`);

  return `  {\n${parts.join(',\n')}\n  }`;
}
