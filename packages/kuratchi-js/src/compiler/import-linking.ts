export interface ImportBinding {
  imported: string;
  local: string;
}

export interface RouteImportEntry {
  line: string;
  importerDir: string;
}

interface RouteQueryReference {
  fnName: string;
}

export function parseNamedImportBindings(line: string): ImportBinding[] {
  const namesMatch = line.match(/import\s*\{([^}]+)\}/);
  if (!namesMatch) return [];

  return namesMatch[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const parts = name.split(/\s+as\s+/).map((part) => part.trim()).filter(Boolean);
      return {
        imported: parts[0] || '',
        local: parts[1] || parts[0] || '',
      };
    })
    .filter((binding) => !!binding.imported && !!binding.local);
}

export function filterImportsByNeededBindings(imports: string[], neededBindings: Set<string>): string[] {
  const selected: string[] = [];
  for (const line of imports) {
    const bindings = parseNamedImportBindings(line);
    if (bindings.length === 0) continue;
    if (bindings.some((binding) => neededBindings.has(binding.local))) {
      selected.push(line);
    }
  }
  return selected;
}

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
    const pathMatch = entry.line.match(/from\s+['"]([^'"]+)['"]/);
    if (!pathMatch) continue;

    const importPath = opts.resolveCompiledImportPath(pathMatch[1], entry.importerDir, opts.outFileDir);
    const moduleId = opts.allocateModuleId();
    importStatements.push(`import * as ${moduleId} from '${importPath}';`);

    for (const binding of parseNamedImportBindings(entry.line)) {
      fnToModule[binding.local] = moduleId;
      if (opts.routeScriptReferenceSource.includes(binding.local) && !routeImportDeclMap.has(binding.local)) {
        routeImportDeclMap.set(binding.local, `const ${binding.local} = ${moduleId}.${binding.imported};`);
      }
    }

    const starMatch = entry.line.match(/import\s*\*\s*as\s+(\w+)/);
    if (!starMatch) continue;

    fnToModule[starMatch[1]] = moduleId;
    if (opts.routeScriptReferenceSource.includes(starMatch[1]) && !routeImportDeclMap.has(starMatch[1])) {
      routeImportDeclMap.set(starMatch[1], `const ${starMatch[1]} = ${moduleId};`);
    }
  }

  return {
    fnToModule,
    routeImportDecls: Array.from(routeImportDeclMap.values()),
    importStatements,
  };
}
