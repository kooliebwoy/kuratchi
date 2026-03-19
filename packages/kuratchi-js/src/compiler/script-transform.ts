import ts from 'typescript';

import { stripTopLevelImports } from './parser.js';

export interface RouteScriptSegment {
  script: string;
  dataVars: string[];
}

interface ScopeFrame {
  names: Set<string>;
}

function collectBindingNames(name: ts.BindingName, out: Set<string>) {
  if (ts.isIdentifier(name)) {
    out.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    collectBindingNames(element.name, out);
  }
}

function collectScopeBindings(node: ts.Node): Set<string> {
  const names = new Set<string>();

  const collectVariableStatement = (statement: ts.VariableStatement) => {
    for (const declaration of statement.declarationList.declarations) {
      collectBindingNames(declaration.name, names);
    }
  };

  if (ts.isSourceFile(node)) {
    for (const statement of node.statements) {
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (!clause) continue;
        if (clause.name) names.add(clause.name.text);
        if (clause.namedBindings) {
          if (ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              names.add(element.name.text);
            }
          } else if (ts.isNamespaceImport(clause.namedBindings)) {
            names.add(clause.namedBindings.name.text);
          }
        }
        continue;
      }
      if (ts.isVariableStatement(statement)) {
        collectVariableStatement(statement);
        continue;
      }
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) {
        names.add(statement.name.text);
      }
    }
    return names;
  }

  if (ts.isBlock(node) || ts.isModuleBlock(node)) {
    for (const statement of node.statements) {
      if (ts.isVariableStatement(statement)) {
        collectVariableStatement(statement);
        continue;
      }
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) {
        names.add(statement.name.text);
      }
    }
    return names;
  }

  if (ts.isCatchClause(node)) {
    if (node.variableDeclaration) {
      collectBindingNames(node.variableDeclaration.name, names);
    }
    return names;
  }

  if (ts.isFunctionLike(node)) {
    if (node.name && ts.isIdentifier(node.name)) names.add(node.name.text);
    for (const parameter of node.parameters) {
      collectBindingNames(parameter.name, names);
    }
    return names;
  }

  return names;
}

function isScopeNode(node: ts.Node): boolean {
  return ts.isSourceFile(node)
    || ts.isBlock(node)
    || ts.isModuleBlock(node)
    || ts.isCatchClause(node)
    || ts.isFunctionLike(node);
}

function shouldRewriteEnvIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isImportClause(parent) || ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent) || ts.isNamedImports(parent)) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return false;
  if (ts.isParameter(parent) && parent.name === node) return false;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return false;
  if (ts.isClassDeclaration(parent) && parent.name === node) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent) && parent.right === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return false;
  return true;
}

function transformSource(
  source: string,
  visitorFactory: (ctx: {
    isShadowed: (name: string) => boolean;
    factory: ts.NodeFactory;
  }) => ts.Visitor,
): string {
  const sourceFile = ts.createSourceFile('kuratchi-script.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const scopeStack: ScopeFrame[] = [];

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const result = ts.transform(sourceFile, [context => {
    const baseFactory = visitorFactory({
      isShadowed(name: string) {
        for (let i = scopeStack.length - 1; i >= 0; i--) {
          if (scopeStack[i].names.has(name)) return true;
        }
        return false;
      },
      factory: context.factory,
    });

    const visitNode: ts.Visitor = (node) => {
      let pushed = false;
      if (isScopeNode(node)) {
        scopeStack.push({ names: collectScopeBindings(node) });
        pushed = true;
      }

      const transformed = baseFactory(node) as ts.Node;
      const visited = ts.visitEachChild(transformed, visitNode, context);

      if (pushed) scopeStack.pop();
      return visited;
    };

    return file => ts.visitNode(file, visitNode) as ts.SourceFile;
  }]);

  const transformedFile = result.transformed[0] as ts.SourceFile;
  const printed = printer.printFile(transformedFile);
  result.dispose();
  return printed;
}

export function rewriteImportedFunctionCalls(source: string, fnToModule: Record<string, string>): string {
  const fnEntries = Object.entries(fnToModule).filter(([fnName]) => /^[A-Za-z_$][\w$]*$/.test(fnName));
  if (fnEntries.length === 0) return source;
  const fnSet = new Set(fnEntries.map(([fnName]) => fnName));

  return transformSource(source, ({ isShadowed, factory }) => (node) => {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && fnSet.has(node.expression.text)
      && !isShadowed(node.expression.text)
    ) {
      const moduleId = fnToModule[node.expression.text];
      return factory.updateCallExpression(
        node,
        factory.createPropertyAccessExpression(factory.createIdentifier(moduleId), factory.createIdentifier(node.expression.text)),
        node.typeArguments,
        node.arguments,
      );
    }
    return node;
  });
}

export function rewriteWorkerEnvAliases(source: string, aliases: string[]): string {
  const aliasSet = new Set(aliases.filter((alias) => /^[A-Za-z_$][\w$]*$/.test(alias)));
  if (aliasSet.size === 0) return source;

  return transformSource(source, ({ isShadowed, factory }) => (node) => {
    if (
      ts.isIdentifier(node)
      && aliasSet.has(node.text)
      && !isShadowed(node.text)
      && shouldRewriteEnvIdentifier(node)
    ) {
      return factory.createIdentifier('__env');
    }
    return node;
  });
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
