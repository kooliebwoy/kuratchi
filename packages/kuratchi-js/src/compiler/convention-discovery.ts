import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  type ClassStaticTuning,
  type ConventionClassEntry,
  type ContainerConfigEntry,
  type QueueConsumerEntry,
  type WorkerClassConfigEntry,
} from './compiler-shared.js';

export function resolveClassExportFromFile(
  absPath: string,
  errorLabel: string,
): { className: string; exportKind: 'named' | 'default' } {
  if (!fs.existsSync(absPath)) {
    throw new Error(`[kuratchi] ${errorLabel} file not found: ${absPath}`);
  }
  const fileSource = fs.readFileSync(absPath, 'utf-8');
  const defaultClass = fileSource.match(/export\s+default\s+class\s+(\w+)/);
  if (defaultClass) {
    return { className: defaultClass[1], exportKind: 'default' };
  }
  const namedClass = fileSource.match(/export\s+class\s+(\w+)/);
  if (namedClass) {
    return { className: namedClass[1], exportKind: 'named' };
  }
  throw new Error(`[kuratchi] ${errorLabel} must export a class via "export class X" or "export default class X". File: ${absPath}`);
}

export function discoverConventionClassFiles(
  projectDir: string,
  dir: string,
  suffix: string,
  errorLabel: string,
): ConventionClassEntry[] {
  const absDir = path.join(projectDir, dir);
  const files = discoverFilesWithSuffix(absDir, suffix);
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const resolved = resolveClassExportFromFile(absPath, errorLabel);
    return {
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
    };
  });
}

export function discoverFilesWithSuffix(dir: string, suffix: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (absDir: string) => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && abs.endsWith(suffix)) {
        out.push(abs);
      }
    }
  };
  walk(dir);
  return out;
}

/** Returns all files in a directory (non-recursive) whose extension is one of the given extensions. */
export function discoverFilesWithExtensions(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];
  const extSet = new Set(extensions.map((e) => e.toLowerCase()));
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (extSet.has(ext)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

export function discoverWorkflowFiles(projectDir: string): WorkerClassConfigEntry[] {
  const serverDir = path.join(projectDir, 'src', 'server');
  const files = discoverFilesWithSuffix(serverDir, '.workflow.ts');
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const fileName = path.basename(absPath, '.workflow.ts');
    const binding = fileName.toUpperCase().replace(/-/g, '_') + '_WORKFLOW';
    const resolved = resolveClassExportFromFile(absPath, '.workflow');
    return {
      binding,
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
    };
  });
}

export function discoverContainerFiles(projectDir: string): ContainerConfigEntry[] {
  const serverDir = path.join(projectDir, 'src', 'server');
  const files = discoverFilesWithSuffix(serverDir, '.container.ts');
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const fileName = path.basename(absPath, '.container.ts');
    const binding = fileName.toUpperCase().replace(/-/g, '_') + '_CONTAINER';
    const resolved = resolveClassExportFromFile(absPath, '.container');
    const tuning = parseClassStaticTuning(fs.readFileSync(absPath, 'utf-8'));
    const resolvedDockerfile = resolveSiblingDockerfile(absPath, fileName);
    const image = tuning.image ?? (resolvedDockerfile
      ? toRelativePosix(projectDir, resolvedDockerfile)
      : undefined);
    if (!image) {
      throw new Error(
        `[kuratchi] .container file '${path.relative(projectDir, absPath)}' has no image declared. ` +
        `Add \`static image = '...';\` to the class (Dockerfile path or registry reference), ` +
        `or create a sibling Dockerfile at '${fileName}.Dockerfile'.`,
      );
    }
    return {
      kind: 'container' as const,
      binding,
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
      image,
      instanceType: tuning.instanceType,
      maxInstances: tuning.maxInstances,
      sqlite: tuning.sqlite,
      resolvedDockerfile,
    };
  });
}

/**
 * Discover .sandbox.ts files — the Cloudflare Sandbox SDK variant of a container.
 *
 * Convention: `python.sandbox.ts` → binding `PYTHON_SANDBOX`, class exported via
 * `export default class PythonSandbox extends Sandbox<Env> {}`. SQLite storage is
 * always on (the Sandbox runtime requires it). If no image is declared and no
 * sibling Dockerfile exists, the default image is pinned to the installed
 * `@cloudflare/sandbox` package version so the image stays in lockstep with the SDK.
 */
export function discoverSandboxFiles(projectDir: string): ContainerConfigEntry[] {
  const serverDir = path.join(projectDir, 'src', 'server');
  const files = discoverFilesWithSuffix(serverDir, '.sandbox.ts');
  if (files.length === 0) return [];

  const defaultImage = resolveSandboxDefaultImage(projectDir);

  return files.map((absPath) => {
    const fileName = path.basename(absPath, '.sandbox.ts');
    const binding = fileName.toUpperCase().replace(/-/g, '_') + '_SANDBOX';
    const resolved = resolveClassExportFromFile(absPath, '.sandbox');
    const tuning = parseClassStaticTuning(fs.readFileSync(absPath, 'utf-8'));
    const resolvedDockerfile = resolveSiblingDockerfile(absPath, fileName);
    const image = tuning.image
      ?? (resolvedDockerfile ? toRelativePosix(projectDir, resolvedDockerfile) : undefined)
      ?? defaultImage;
    return {
      kind: 'sandbox' as const,
      binding,
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
      image,
      instanceType: tuning.instanceType,
      maxInstances: tuning.maxInstances,
      // Sandbox always uses SQLite storage; ignore any author-supplied `static sqlite`.
      sqlite: true,
      resolvedDockerfile,
    };
  });
}

/**
 * Extract `static <field> = <literal>` declarations from a class source file.
 * Parses only JSON-safe literals (strings, numbers, booleans). Non-literal values
 * (function calls, env lookups, template literals with interpolation) are ignored —
 * wrangler-sync needs compile-time-known values.
 */
export function parseClassStaticTuning(source: string): ClassStaticTuning {
  const tuning: ClassStaticTuning = {};
  const rules: Array<{ field: keyof ClassStaticTuning; match: RegExp; coerce: (raw: string) => any }> = [
    { field: 'image', match: /^\s*static\s+image\s*(?::\s*[^=]+)?=\s*(['"])([^'"]+)\1\s*;?\s*$/m, coerce: (m) => m },
    { field: 'instanceType', match: /^\s*static\s+instanceType\s*(?::\s*[^=]+)?=\s*(['"])(lite|standard)\1\s*;?\s*$/m, coerce: (m) => m },
    { field: 'maxInstances', match: /^\s*static\s+maxInstances\s*(?::\s*[^=]+)?=\s*(\d+)\s*;?\s*$/m, coerce: (m) => Number(m) },
    { field: 'sqlite', match: /^\s*static\s+sqlite\s*(?::\s*[^=]+)?=\s*(true|false)\s*;?\s*$/m, coerce: (m) => m === 'true' },
  ];

  for (const rule of rules) {
    const match = source.match(rule.match);
    if (!match) continue;
    // For patterns with a quoted capture, the second group holds the value;
    // otherwise the first group is the raw value.
    const raw = match[2] ?? match[1];
    (tuning as any)[rule.field] = rule.coerce(raw);
  }

  return tuning;
}

/** Look for `<basename>.Dockerfile` next to the source file. Returns abs path or null. */
function resolveSiblingDockerfile(sourceAbsPath: string, basename: string): string | null {
  const dir = path.dirname(sourceAbsPath);
  const candidates = [
    path.join(dir, `${basename}.Dockerfile`),
    path.join(dir, basename, 'Dockerfile'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function toRelativePosix(projectDir: string, absPath: string): string {
  const rel = path.relative(projectDir, absPath).replace(/\\/g, '/');
  return rel.startsWith('.') || rel.startsWith('/') ? rel : `./${rel}`;
}

/**
 * Read the installed `@cloudflare/sandbox` package version and produce
 * `docker.io/cloudflare/sandbox:<version>` as the default image. Falls back
 * to the generic `:latest` tag if the package isn't locally installed — the
 * subsequent `wrangler deploy` will surface a clearer error than we can here.
 */
function resolveSandboxDefaultImage(projectDir: string): string {
  try {
    const pkgPath = path.join(projectDir, 'node_modules', '@cloudflare', 'sandbox', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
      if (pkg.version) return `docker.io/cloudflare/sandbox:${pkg.version}`;
    }
  } catch {
    // fall through
  }
  return 'docker.io/cloudflare/sandbox:latest';
}

/**
 * Discover queue consumer files in src/server/*.queue.ts
 * 
 * Convention: notifications.queue.ts → expects NOTIFICATIONS queue binding
 * The file must export a default async function that handles MessageBatch.
 */
export function discoverQueueConsumerFiles(projectDir: string): QueueConsumerEntry[] {
  const serverDir = path.join(projectDir, 'src', 'server');
  const files = discoverFilesWithSuffix(serverDir, '.queue.ts');
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const fileName = path.basename(absPath, '.queue.ts');
    const binding = fileName.toUpperCase().replace(/-/g, '_');
    // Queue name is the filename as-is (lowercase with hyphens) - this is what Cloudflare sends in batch.queue
    const queueName = fileName;
    const exportKind = resolveQueueHandlerExport(absPath);
    return {
      binding,
      queueName,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind,
    };
  });
}

function resolveQueueHandlerExport(absPath: string): 'named' | 'default' {
  if (!fs.existsSync(absPath)) {
    throw new Error(`[kuratchi] .queue file not found: ${absPath}`);
  }
  const fileSource = fs.readFileSync(absPath, 'utf-8');
  // Check for default export (function or async function)
  if (/export\s+default\s+(async\s+)?function/.test(fileSource)) {
    return 'default';
  }
  // Check for named export called 'queue' or 'handler'
  if (/export\s+(async\s+)?function\s+(queue|handler)\s*\(/.test(fileSource)) {
    return 'named';
  }
  throw new Error(
    `[kuratchi] .queue file must export a default function or a named "queue"/"handler" function. File: ${absPath}`
  );
}
