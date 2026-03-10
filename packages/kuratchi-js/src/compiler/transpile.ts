import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let tsImpl: any;
let bunTranspiler: any;

function transpileWithBun(source: string): string | null {
  const BunRuntime = (globalThis as any).Bun;
  if (!BunRuntime?.Transpiler) return null;

  if (!bunTranspiler) {
    bunTranspiler = new BunRuntime.Transpiler({ loader: 'ts' });
  }

  const output = bunTranspiler.transformSync(source);
  return typeof output === 'string' ? output.trim() : String(output).trim();
}

function getTypeScript(): any {
  if (!tsImpl) {
    const localTsPath = fileURLToPath(new URL('../../node_modules/typescript/lib/typescript.js', import.meta.url));
    if (fs.existsSync(localTsPath)) {
      tsImpl = require(localTsPath);
    } else {
      tsImpl = require(require.resolve('typescript', { paths: [process.cwd()] }));
    }
  }
  return tsImpl;
}

function formatDiagnostic(diag: any): string {
  if (!diag.file || typeof diag.start !== 'number') {
    return getTypeScript().flattenDiagnosticMessageText(diag.messageText, '\n');
  }

  const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
  const message = getTypeScript().flattenDiagnosticMessageText(diag.messageText, '\n');
  return `${diag.file.fileName}:${pos.line + 1}:${pos.character + 1} ${message}`;
}

export function transpileTypeScript(
  source: string,
  contextLabel: string,
  compilerOptions: Record<string, unknown> = {},
): string {
  if (!source.trim()) return source;
  const bunOutput = transpileWithBun(source);
  if (bunOutput !== null) return bunOutput;

  const ts = getTypeScript();

  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false,
      ...compilerOptions,
    },
    reportDiagnostics: true,
    fileName: contextLabel,
  });

  const diagnostics = (result.diagnostics || []).filter(
    (diag: any) => diag.category === ts.DiagnosticCategory.Error,
  );
  if (diagnostics.length > 0) {
    const rendered = diagnostics.map(formatDiagnostic).join('\n');
    throw new Error(`[kuratchi compiler] TypeScript transpile failed for ${contextLabel}\n${rendered}`);
  }

  return result.outputText.trim();
}
