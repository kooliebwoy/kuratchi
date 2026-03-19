import * as fs from 'node:fs';
import * as path from 'node:path';

import { type ConventionClassEntry, type WorkerClassConfigEntry } from './compiler-shared.js';

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
