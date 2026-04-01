import * as fs from 'node:fs';
import * as path from 'node:path';

import { type ConventionClassEntry, type QueueConsumerEntry, type WorkerClassConfigEntry } from './compiler-shared.js';

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

export function discoverContainerFiles(projectDir: string): WorkerClassConfigEntry[] {
  const serverDir = path.join(projectDir, 'src', 'server');
  const files = discoverFilesWithSuffix(serverDir, '.container.ts');
  if (files.length === 0) return [];

  return files.map((absPath) => {
    const fileName = path.basename(absPath, '.container.ts');
    const binding = fileName.toUpperCase().replace(/-/g, '_') + '_CONTAINER';
    const resolved = resolveClassExportFromFile(absPath, '.container');
    return {
      binding,
      className: resolved.className,
      file: path.relative(projectDir, absPath).replace(/\\/g, '/'),
      exportKind: resolved.exportKind,
    };
  });
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
    const exportKind = resolveQueueHandlerExport(absPath);
    return {
      binding,
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
