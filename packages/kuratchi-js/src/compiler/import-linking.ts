import ts from 'typescript';

export interface ImportBinding {
  imported: string;
  local: string;
}

export interface ParsedImportStatement {
  bindings: ImportBinding[];
  moduleSpecifier: string | null;
  namespaceImport: string | null;
}

export interface RouteImportEntry {
  line: string;
  importerDir: string;
}

interface RouteQueryReference {
  fnName: string;
}

export function parseImportStatement(source: string): ParsedImportStatement {
  const sourceFile = ts.createSourceFile('kuratchi-import.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = sourceFile.statements.find(ts.isImportDeclaration);
  if (!statement || !ts.isStringLiteral(statement.moduleSpecifier)) {
    return { bindings: [], moduleSpecifier: null, namespaceImport: null };
  }

  const bindings: ImportBinding[] = [];
  let namespaceImport: string | null = null;
  const clause = statement.importClause;
  if (clause) {
    if (clause.name) {
      bindings.push({ imported: 'default', local: clause.name.text });
    }

    if (clause.namedBindings) {
      if (ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          bindings.push({
            imported: element.propertyName?.text || element.name.text,
            local: element.name.text,
          });
        }
      } else if (ts.isNamespaceImport(clause.namedBindings)) {
        namespaceImport = clause.namedBindings.name.text;
      }
    }
  }

  return {
    bindings,
    moduleSpecifier: statement.moduleSpecifier.text,
    namespaceImport,
  };
}

function isTypePosition(node: ts.Node): boolean {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (ts.isTypeNode(current)) return true;
  }
  return false;
}

function isReferenceIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;

  if (isTypePosition(node)) return false;
  if (ts.isImportClause(parent) || ts.isImportSpecifier(parent) || ts.isNamespaceImport(parent) || ts.isNamedImports(parent)) return false;
  if (ts.isExportSpecifier(parent)) return false;
  if (ts.isBindingElement(parent) || ts.isParameter(parent) || ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isClassDeclaration(parent)) {
    return parent.name !== node;
  }
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent) && parent.right === node) return false;
  if (ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) {
    return parent.name !== node;
  }
  if (ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) return false;

  return true;
}

export function collectReferencedIdentifiers(source: string): Set<string> {
  const refs = new Set<string>();
  const sourceFile = ts.createSourceFile('kuratchi-ref.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      refs.add(node.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return refs;
}

export function parseNamedImportBindings(line: string): ImportBinding[] {
  return parseImportStatement(line).bindings.filter((binding) => binding.imported !== 'default');
}

export function filterImportsByNeededBindings(imports: string[], neededBindings: Set<string>): string[] {
  const selected: string[] = [];
  for (const line of imports) {
    const parsed = parseImportStatement(line);
    const hasNeededBinding = parsed.bindings.some((binding) => neededBindings.has(binding.local))
      || (parsed.namespaceImport ? neededBindings.has(parsed.namespaceImport) : false);
    if (hasNeededBinding) selected.push(line);
  }
  return selected;
}

const RESERVED_RENDER_VARS = new Set(['params', 'breadcrumbs']);

export function linkRouteServerImports(opts: {
  routeServerImportEntries: RouteImportEntry[];
  routeClientImportEntries: RouteImportEntry[];
  actionFunctions: string[];
  pollFunctions: string[];
  dataGetQueries: RouteQueryReference[];
  routeScriptReferenceSource: string;
  resolveCompiledImportPath: (origPath: string, importerDir: string, outFileDir: string) => string;
  outFileDir: string;
  allocateModuleId: () => string;
}): {
  fnToModule: Record<string, string>;
  routeImportDecls: string[];
  importStatements: string[];
} {
  const fnToModule: Record<string, string> = {};
  const routeImportDeclMap = new Map<string, string>();
  const importStatements: string[] = [];
  const neededServerFns = new Set<string>([
    ...opts.actionFunctions,
    ...opts.pollFunctions,
    ...opts.dataGetQueries.map((query) => query.fnName),
  ]);

  const routeServerImports = opts.routeServerImportEntries.length > 0
    ? opts.routeServerImportEntries
    : opts.routeClientImportEntries.filter((entry) => (
      filterImportsByNeededBindings([entry.line], neededServerFns).length > 0
    ));

  for (const entry of routeServerImports) {
    const parsed = parseImportStatement(entry.line);
    if (!parsed.moduleSpecifier) continue;
    const isWorkerEnvModule = parsed.moduleSpecifier === 'cloudflare:workers';
    const isKuratchiEnvModule = parsed.moduleSpecifier === '@kuratchi/js/environment';

    const importPath = opts.resolveCompiledImportPath(parsed.moduleSpecifier, entry.importerDir, opts.outFileDir);
    const moduleId = opts.allocateModuleId();
    importStatements.push(`import * as ${moduleId} from '${importPath}';`);

    for (const binding of parsed.bindings) {
      if ((isWorkerEnvModule && binding.imported === 'env') || (isKuratchiEnvModule && binding.imported === 'dev')) {
        continue;
      }
      fnToModule[binding.local] = moduleId;
      if (!routeImportDeclMap.has(binding.local) && !RESERVED_RENDER_VARS.has(binding.local)) {
        const accessExpr = binding.imported === 'default' ? `${moduleId}.default` : `${moduleId}.${binding.imported}`;
        routeImportDeclMap.set(binding.local, `const ${binding.local} = ${accessExpr};`);
      }
    }

    if (parsed.namespaceImport) {
      fnToModule[parsed.namespaceImport] = moduleId;
      if (!routeImportDeclMap.has(parsed.namespaceImport)) {
        routeImportDeclMap.set(parsed.namespaceImport, `const ${parsed.namespaceImport} = ${moduleId};`);
      }
    }
  }

  return {
    fnToModule,
    routeImportDecls: Array.from(routeImportDeclMap.values()),
    importStatements,
  };
}
