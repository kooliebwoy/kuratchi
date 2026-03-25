import * as path from 'node:path';
import { compileTemplate, splitTemplateRenderSections } from './template.js';
import { analyzeRouteBuild, emitRouteObject, type RouteRpcBinding } from './route-pipeline.js';
import { linkRouteServerImports } from './import-linking.js';
import type { ComponentCompiler } from './component-pipeline.js';
import type { ClientModuleCompiler } from './client-module-pipeline.js';
import type { RouteStatePlan } from './route-state-pipeline.js';

export function compilePageRoute(opts: {
  pattern: string;
  routeIndex: number;
  projectDir: string;
  isDev: boolean;
  routeState: RouteStatePlan;
  componentCompiler: ComponentCompiler;
  clientModuleCompiler: ClientModuleCompiler;
  assetsPrefix: string;
  resolveCompiledImportPath: (origPath: string, importerDir: string, outFileDir: string) => string;
  allocateModuleId: () => string;
  pushImport: (statement: string) => void;
}): string {
  const outFileDir = path.join(opts.projectDir, '.kuratchi');
  const routeModuleLinkPlan = linkRouteServerImports({
    routeServerImportEntries: opts.routeState.routeServerImportEntries,
    routeClientImportEntries: opts.routeState.routeClientImportEntries,
    actionFunctions: opts.routeState.mergedParsed.actionFunctions,
    pollFunctions: opts.routeState.mergedParsed.pollFunctions,
    dataGetQueries: opts.routeState.mergedParsed.dataGetQueries,
    routeScriptReferenceSource: opts.routeState.routeScriptReferenceSource,
    resolveCompiledImportPath: opts.resolveCompiledImportPath,
    outFileDir,
    allocateModuleId: opts.allocateModuleId,
  });
  for (const statement of routeModuleLinkPlan.importStatements) {
    opts.pushImport(statement);
  }
  opts.routeState.routeImportDecls.push(...routeModuleLinkPlan.routeImportDecls);

  const fnToModule = routeModuleLinkPlan.fnToModule;
  const routeComponentNames = opts.componentCompiler.collectComponentMap(opts.routeState.mergedParsed.componentImports);

  for (const routeFnName of opts.componentCompiler.resolveActionProps(
    opts.routeState.effectiveTemplate,
    routeComponentNames,
    (fnName) => fnName in fnToModule,
  )) {
    if (!opts.routeState.mergedParsed.actionFunctions.includes(routeFnName)) {
      opts.routeState.mergedParsed.actionFunctions.push(routeFnName);
    }
  }

  const dataVarsSet = new Set(opts.routeState.mergedParsed.dataVars);
  const actionNames = new Set(
    opts.routeState.mergedParsed.actionFunctions.filter((fnName) => fnName in fnToModule || dataVarsSet.has(fnName)),
  );

  const rpcNameMap = new Map<string, string>();
  let rpcCounter = 0;
  for (const fnName of opts.routeState.mergedParsed.pollFunctions) {
    if (!rpcNameMap.has(fnName)) {
      rpcNameMap.set(fnName, `rpc_${opts.routeIndex}_${rpcCounter++}`);
    }
  }
  for (const query of opts.routeState.mergedParsed.dataGetQueries) {
    if (!rpcNameMap.has(query.fnName)) {
      rpcNameMap.set(query.fnName, `rpc_${opts.routeIndex}_${rpcCounter++}`);
    }
    query.rpcId = rpcNameMap.get(query.fnName)!;
  }

  const clientRouteRegistry = opts.clientModuleCompiler.createRouteRegistry(
    opts.routeIndex,
    opts.routeState.routeBrowserImportEntries,
  );
  const awaitQueryBindings = new Map(
    opts.routeState.mergedParsed.dataGetQueries
      .filter((query) => !!query.awaitExpr)
      .map((query) => [query.awaitExpr!, { asName: query.asName, rpcId: query.rpcId || rpcNameMap.get(query.fnName) || query.fnName }]),
  );
  const renderSections = splitTemplateRenderSections(opts.routeState.effectiveTemplate);
  const renderBody = compileTemplate(
    renderSections.bodyTemplate,
    routeComponentNames,
    actionNames,
    rpcNameMap,
    { emitCall: '__emit', enableFragmentManifest: true, clientRouteRegistry, awaitQueryBindings },
  );
  const renderHeadBody = compileTemplate(
    renderSections.headTemplate,
    routeComponentNames,
    actionNames,
    rpcNameMap,
    { clientRouteRegistry, awaitQueryBindings },
  );
  const clientEntryAsset = clientRouteRegistry.buildEntryAsset();
  const clientServerProxyBindings = clientRouteRegistry.getServerProxyBindings();
  const clientServerProxyModules = new Map<string, string>();
  const extraRpcBindings: RouteRpcBinding[] = [];
  const seenClientServerRpcIds = new Set<string>();

  for (const binding of clientServerProxyBindings) {
    const moduleKey = `${binding.importerDir}::${binding.moduleSpecifier}`;
    let moduleId = clientServerProxyModules.get(moduleKey);
    if (!moduleId) {
      moduleId = opts.allocateModuleId();
      clientServerProxyModules.set(moduleKey, moduleId);
      const importPath = opts.resolveCompiledImportPath(binding.moduleSpecifier, binding.importerDir, outFileDir);
      opts.pushImport(`import * as ${moduleId} from '${importPath}';`);
    }

    if (!seenClientServerRpcIds.has(binding.rpcId)) {
      seenClientServerRpcIds.add(binding.rpcId);
      extraRpcBindings.push({
        name: `${binding.moduleSpecifier}:${binding.importedName}`,
        rpcId: binding.rpcId,
        expression: binding.importedName === 'default' ? `${moduleId}.default` : `${moduleId}.${binding.importedName}`,
        schemaExpression: binding.importedName === 'default'
          ? 'undefined'
          : `${moduleId}.schemas?.[${JSON.stringify(binding.importedName)}]`,
      });
    }
  }

  const clientModuleHref = clientEntryAsset ? `${opts.assetsPrefix}${clientEntryAsset.assetName}` : null;

  const routePlan = analyzeRouteBuild({
    pattern: opts.pattern,
    renderBody,
    renderHeadBody,
    isDev: opts.isDev,
    parsed: opts.routeState.mergedParsed,
    fnToModule,
    rpcNameMap,
    extraRpcBindings,
    componentStyles: opts.componentCompiler.collectStyles(routeComponentNames),
    clientModuleHref,
  });

  return emitRouteObject(routePlan);
}
