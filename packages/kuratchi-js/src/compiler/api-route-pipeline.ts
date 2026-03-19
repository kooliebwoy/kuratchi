import * as fs from 'node:fs';
import * as path from 'node:path';

const ALL_API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export function compileApiRoute(opts: {
  pattern: string;
  fullPath: string;
  projectDir: string;
  transformModule: (entryAbsPath: string) => string;
  allocateModuleId: () => string;
  pushImport: (statement: string) => void;
}): string {
  const outFileDir = path.join(opts.projectDir, '.kuratchi');
  const absRoutePath = opts.transformModule(opts.fullPath);
  let importPath = path.relative(outFileDir, absRoutePath).replace(/\\/g, '/');
  if (!importPath.startsWith('.')) importPath = './' + importPath;

  const moduleId = opts.allocateModuleId();
  opts.pushImport(`import * as ${moduleId} from '${importPath}';`);

  const apiSource = fs.readFileSync(opts.fullPath, 'utf-8');
  const exportedMethods = ALL_API_METHODS.filter((method) => {
    const fnPattern = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
    const reExportPattern = new RegExp(`export\\s*\\{[^}]*\\b\\w+\\s+as\\s+${method}\\b`);
    const namedExportPattern = new RegExp(`export\\s*\\{[^}]*\\b${method}\\b`);
    return fnPattern.test(apiSource) || reExportPattern.test(apiSource) || namedExportPattern.test(apiSource);
  });

  const methodEntries = exportedMethods
    .map((method) => `${method}: ${moduleId}.${method}`)
    .join(', ');

  return `{ pattern: '${opts.pattern}', __api: true, ${methodEntries} }`;
}
