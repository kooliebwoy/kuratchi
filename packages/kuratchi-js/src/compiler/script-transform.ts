import { stripTopLevelImports } from './parser.js';

export interface RouteScriptSegment {
  script: string;
  dataVars: string[];
}

export function rewriteImportedFunctionCalls(source: string, fnToModule: Record<string, string>): string {
  let out = source;
  for (const [fnName, moduleId] of Object.entries(fnToModule)) {
    if (!/^[A-Za-z_$][\w$]*$/.test(fnName)) continue;
    const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
    out = out.replace(callRegex, `${moduleId}.${fnName}(`);
  }
  return out;
}

export function rewriteWorkerEnvAliases(source: string, aliases: string[]): string {
  let out = source;
  for (const alias of aliases) {
    if (!/^[A-Za-z_$][\w$]*$/.test(alias)) continue;
    const aliasRegex = new RegExp(`(?<!\\.)\\b${alias}\\b`, 'g');
    out = out.replace(aliasRegex, '__env');
  }
  return out;
}

export function buildDevAliasDeclarations(aliases: string[], isDev: boolean): string {
  if (!aliases || aliases.length === 0) return '';
  return aliases.map((alias) => `const ${alias} = ${isDev ? 'true' : 'false'};`).join('\n');
}

export function buildSegmentedScriptBody(opts: {
  segments: RouteScriptSegment[];
  fnToModule: Record<string, string>;
  importDecls?: string;
  workerEnvAliases: string[];
  devAliases: string[];
  isDev: boolean;
  asyncMode: boolean;
}): string {
  const { segments, fnToModule, importDecls, workerEnvAliases, devAliases, isDev, asyncMode } = opts;
  const lines: string[] = [];
  const routeDevDecls = buildDevAliasDeclarations(devAliases, isDev);
  if (routeDevDecls) lines.push(routeDevDecls);
  if (importDecls) lines.push(importDecls);
  lines.push('const __segmentData: Record<string, any> = {};');

  const availableVars: string[] = [];
  let segmentIndex = 0;
  for (const segment of segments) {
    if (!segment.script) continue;
    let segmentBody = stripTopLevelImports(segment.script);
    segmentBody = rewriteImportedFunctionCalls(segmentBody, fnToModule);
    segmentBody = rewriteWorkerEnvAliases(segmentBody, workerEnvAliases);
    if (!segmentBody.trim()) continue;

    const returnVars = segment.dataVars.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
    const segmentVar = '__segment_' + segmentIndex++;
    const invokePrefix = asyncMode ? 'await ' : '';
    const factoryPrefix = asyncMode ? 'async ' : '';

    lines.push('const ' + segmentVar + ' = ' + invokePrefix + '(' + factoryPrefix + '(__ctx: Record<string, any>) => {');
    lines.push(segmentBody);
    lines.push(returnVars.length > 0 ? 'return { ' + returnVars.join(', ') + ' };' : 'return {};');
    lines.push('})(__segmentData);');
    lines.push('Object.assign(__segmentData, ' + segmentVar + ');');

    for (const name of returnVars) {
      if (!availableVars.includes(name)) availableVars.push(name);
    }
  }

  if (!asyncMode && availableVars.length > 0) {
    lines.push('const { ' + availableVars.join(', ') + ' } = __segmentData;');
  }

  return lines.join('\n');
}
