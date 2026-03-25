import type { ParsedFile } from './parser.js';
import { stripTopLevelImports } from './parser.js';
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
  schemaExpression: string;
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
  headBody: string;
  componentStyles: string[];
  clientModuleHref?: string | null;
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
  renderHeadBody: string;
  isDev: boolean;
  parsed: RoutePipelineParsedFile;
  fnToModule: Record<string, string>;
  rpcNameMap?: Map<string, string>;
  componentStyles: string[];
  clientModuleHref?: string | null;
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

function extractDeclaredConstName(statement: string): string | null {
  const match = statement.trim().match(/^const\s+([A-Za-z_$][\w$]*)\s*=/);
  return match ? match[1] : null;
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
  const { pattern, renderBody, renderHeadBody, isDev, parsed, fnToModule, rpcNameMap, componentStyles, clientModuleHref } = opts;
  const hasFns = Object.keys(fnToModule).length > 0;
  const queryDefs = parsed.dataGetQueries ?? [];
  const queryVars = queryDefs.map((query) => query.asName);
  const scriptSegments = (parsed.scriptSegments ?? []).filter((segment) => !!segment.script);
  const hasSegmentedScripts = scriptSegments.length > 1;
  const routeDevDecls = buildDevAliasDeclarations(parsed.devAliases, isDev);
  const routeImportDeclLines = parsed.scriptImportDecls ?? [];
  const routeImportDecls = routeImportDeclLines.join('\n');
  const importedBindingNames = new Set(Object.keys(fnToModule));
  const renderScopeActionNames = new Set(parsed.actionFunctions);
  // Filter out params/breadcrumbs from render prelude since they come from data destructuring
  const reservedRenderVars = new Set(['params', 'breadcrumbs']);
  const renderImportPrelude = routeImportDeclLines
    .filter((statement) => {
      const declaredName = extractDeclaredConstName(statement);
      if (!declaredName) return true;
      if (renderScopeActionNames.has(declaredName)) return false;
      if (reservedRenderVars.has(declaredName)) return false;
      return true;
    })
    .join('\n');

  let scriptBody = '';
  let renderPreludeSource = '';
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
    renderPreludeSource = buildSegmentedScriptBody({
      segments: scriptSegments,
      fnToModule,
      importDecls: renderImportPrelude,
      workerEnvAliases: parsed.workerEnvAliases,
      devAliases: parsed.devAliases,
      isDev,
      asyncMode: false,
    });
  } else {
    const strippedScriptBody = parsed.script
      ? stripTopLevelImports(parsed.script)
      : '';
    scriptBody = [routeDevDecls, routeImportDecls, strippedScriptBody].filter(Boolean).join('\n');
    renderPreludeSource = [routeDevDecls, renderImportPrelude, strippedScriptBody].filter(Boolean).join('\n');
    scriptBody = rewriteImportedFunctionCalls(scriptBody, fnToModule);
    scriptBody = rewriteWorkerEnvAliases(scriptBody, parsed.workerEnvAliases);
    renderPreludeSource = rewriteImportedFunctionCalls(renderPreludeSource, fnToModule);
    renderPreludeSource = rewriteWorkerEnvAliases(renderPreludeSource, parsed.workerEnvAliases);
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

  // TypeScript is preserved — wrangler's esbuild handles transpilation

  const scriptReturnVars = parsed.script
    ? parsed.dataVars.filter((name) =>
      !queryVars.includes(name) &&
      !importedBindingNames.has(name) &&
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
      const schemaExpression = moduleId
        ? `${moduleId}.schemas?.[${JSON.stringify(name)}]`
        : `(typeof schemas !== 'undefined' ? schemas?.[${JSON.stringify(name)}] : undefined)`;
      return { name, rpcId, expression: moduleId ? `${moduleId}.${name}` : name, schemaExpression };
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
  const renderPrelude = !scriptUsesAwait
    ? renderPreludeSource
    : renderImportPrelude;

  return {
    pattern,
    load: loadPlan,
    actions,
    rpc,
    render: {
      prelude: renderPrelude,
      dataVars: renderDataVars,
      body: renderBody,
      headBody: renderHeadBody,
      componentStyles,
      clientModuleHref: clientModuleHref ?? null,
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
    const rpcSchemaEntries = plan.rpc
      .map((rpc) => `'${rpc.rpcId}': ${rpc.schemaExpression}`)
      .join(', ');
    parts.push(`    rpcSchemas: { ${rpcSchemaEntries} }`);
    // Also emit allowedQueries for query override validation
    const allowedQueryNames = plan.rpc.map((rpc) => `'${rpc.rpcId}'`).join(', ');
    parts.push(`    allowedQueries: [${allowedQueryNames}]`);
  }

  const destructure = `const { ${plan.render.dataVars.join(', ')} } = data;\n      `;
  let finalHeadRenderBody = plan.render.headBody;
  if (plan.render.componentStyles.length > 0) {
    const lines = plan.render.headBody.split('\n');
    const styleLines = plan.render.componentStyles.map((css) => `__parts.push(\`${css}\\n\`);`);
    finalHeadRenderBody = [lines[0], ...styleLines, ...lines.slice(1)].join('\n');
  }
  if (plan.render.clientModuleHref) {
    finalHeadRenderBody += `\n__parts.push(\`<script type="module" src="${plan.render.clientModuleHref}"></script>\\n\`);`;
  }

  parts.push(`    render(data) {
      ${destructure}${plan.render.prelude ? plan.render.prelude + '\n      ' : ''}const __head = (() => {
        ${finalHeadRenderBody}
        return __html;
      })();
      const __rendered = (() => {
        const __fragments = Object.create(null);
        const __fragmentStack = [];
        const __parts = [];
        const __emit = (chunk) => {
          const __value = chunk == null ? '' : String(chunk);
          __parts.push(__value);
          for (const __fragmentId of __fragmentStack) {
            __fragments[__fragmentId] = (__fragments[__fragmentId] || '') + __value;
          }
        };
        const __pushFragment = (id) => {
          const __key = String(id);
          if (!Object.prototype.hasOwnProperty.call(__fragments, __key)) {
            __fragments[__key] = '';
          }
          __fragmentStack.push(__key);
        };
        const __popFragment = () => {
          __fragmentStack.pop();
        };
        ${plan.render.body}
        return { html: __parts.join(''), fragments: __fragments };
      })();
      return { html: __rendered.html, head: __head, fragments: __rendered.fragments };
    }`);

  return `  {\n${parts.join(',\n')}\n  }`;
}
