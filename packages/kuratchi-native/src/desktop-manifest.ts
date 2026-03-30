import * as fs from 'node:fs';
import * as path from 'node:path';

import type { DesktopConfigEntry } from './desktop-config.js';

export interface DesktopManifest {
  formatVersion: 1;
  generatedAt: string;
  projectDir: string;
  app: {
    name: string;
    id: string;
    initialPath: string;
    window: {
      title: string;
      width: number;
      height: number;
    };
  };
  runtime: {
    workerEntrypoint: string;
    assetsRoot: string | null;
    compatibilityDate: string;
    compatibilityFlags: string[];
    cloudflareAccountId: string | null;
  };
  bindings: {
    desktop: {
      notifications: boolean;
      files: boolean;
    };
    remote: Array<
      | {
          binding: string;
          type: 'd1';
          remote: boolean;
          databaseId: string;
          databaseName: string | null;
        }
      | {
          binding: string;
          type: 'r2';
          remote: boolean;
          bucketName: string;
        }
    >;
  };
}

interface WranglerDesktopConfig {
  compatibilityDate: string;
  compatibilityFlags: string[];
  cloudflareAccountId: string | null;
  d1Databases: Array<{
    binding: string;
    databaseId: string;
    databaseName: string | null;
    remote: boolean;
  }>;
  r2Buckets: Array<{
    binding: string;
    bucketName: string;
    remote: boolean;
  }>;
}

export function buildDesktopManifest(opts: {
  projectDir: string;
  workerFile: string;
  desktopConfig: DesktopConfigEntry | null;
}): DesktopManifest | null {
  const { projectDir, workerFile, desktopConfig } = opts;
  if (!desktopConfig) return null;

  const wranglerConfig = readDesktopWranglerConfig(projectDir);
  const projectName = path.basename(projectDir);
  const appName = desktopConfig.appName ?? projectName;
  const appId = desktopConfig.appId ?? `dev.kuratchi.${projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const assetsRoot = resolveAssetsRoot(projectDir);

  const remoteBindings = desktopConfig.remoteBindings.map((binding) => {
    if (binding.type === 'd1') {
      const wranglerBinding = wranglerConfig.d1Databases.find((entry) => entry.binding === binding.binding && entry.remote);
      if (!wranglerBinding) {
        throw new Error(`Desktop manifest could not resolve remote D1 binding "${binding.binding}" from wrangler.jsonc.`);
      }
      return {
        binding: binding.binding,
        type: 'd1' as const,
        remote: true,
        databaseId: wranglerBinding.databaseId,
        databaseName: wranglerBinding.databaseName,
      };
    }

    const wranglerBinding = wranglerConfig.r2Buckets.find((entry) => entry.binding === binding.binding && entry.remote);
    if (!wranglerBinding) {
      throw new Error(`Desktop manifest could not resolve remote R2 binding "${binding.binding}" from wrangler.jsonc.`);
    }
    return {
      binding: binding.binding,
      type: 'r2' as const,
      remote: true,
      bucketName: wranglerBinding.bucketName,
    };
  });

  return {
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    projectDir,
    app: {
      name: appName,
      id: appId,
      initialPath: desktopConfig.initialPath || '/',
      window: {
        title: desktopConfig.windowTitle ?? appName,
        width: desktopConfig.windowWidth,
        height: desktopConfig.windowHeight,
      },
    },
    runtime: {
      workerEntrypoint: workerFile,
      assetsRoot,
      compatibilityDate: wranglerConfig.compatibilityDate,
      compatibilityFlags: wranglerConfig.compatibilityFlags,
      cloudflareAccountId: wranglerConfig.cloudflareAccountId,
    },
    bindings: {
      desktop: {
        notifications: desktopConfig.bindings.notifications,
        files: desktopConfig.bindings.files,
      },
      remote: remoteBindings,
    },
  };
}

export function writeDesktopManifest(projectDir: string, manifest: DesktopManifest): string {
  const outFile = path.join(projectDir, '.kuratchi', 'desktop.manifest.json');
  const next = `${JSON.stringify(manifest, null, 2)}\n`;
  if (fs.existsSync(outFile)) {
    const current = fs.readFileSync(outFile, 'utf-8');
    if (current === next) return outFile;
  }
  fs.writeFileSync(outFile, next, 'utf-8');
  return outFile;
}

function resolveAssetsRoot(projectDir: string): string | null {
  const publicDir = path.join(projectDir, '.kuratchi', 'public');
  if (fs.existsSync(publicDir)) return publicDir;

  const srcAssets = path.join(projectDir, 'src', 'assets');
  if (fs.existsSync(srcAssets)) return srcAssets;

  return null;
}

function readDesktopWranglerConfig(projectDir: string): WranglerDesktopConfig {
  const configPath = ['wrangler.jsonc', 'wrangler.json']
    .map((name) => path.join(projectDir, name))
    .find((candidate) => fs.existsSync(candidate));

  if (!configPath) {
    throw new Error('Desktop runtime requires wrangler.jsonc or wrangler.json for compatibility settings and remote bindings.');
  }

  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(stripJsonComments(rawConfig)) as {
    account_id?: string;
    compatibility_date?: string;
    compatibility_flags?: string[];
    d1_databases?: Array<{
      binding?: string;
      database_id?: string;
      database_name?: string;
      remote?: boolean;
    }>;
    r2_buckets?: Array<{
      binding?: string;
      bucket_name?: string;
      remote?: boolean;
    }>;
  };

  if (!parsed.compatibility_date) {
    throw new Error(`Missing compatibility_date in ${path.basename(configPath)}.`);
  }

  return {
    compatibilityDate: parsed.compatibility_date,
    compatibilityFlags: Array.isArray(parsed.compatibility_flags) ? parsed.compatibility_flags : [],
    cloudflareAccountId: typeof parsed.account_id === 'string' && parsed.account_id.trim().length > 0
      ? parsed.account_id.trim()
      : null,
    d1Databases: Array.isArray(parsed.d1_databases)
      ? parsed.d1_databases
          .filter((entry) => entry.binding && entry.database_id)
          .map((entry) => ({
            binding: entry.binding as string,
            databaseId: entry.database_id as string,
            databaseName: entry.database_name ?? null,
            remote: entry.remote !== false,
          }))
      : [],
    r2Buckets: Array.isArray(parsed.r2_buckets)
      ? parsed.r2_buckets
          .filter((entry) => entry.binding && entry.bucket_name)
          .map((entry) => ({
            binding: entry.binding as string,
            bucketName: entry.bucket_name as string,
            remote: entry.remote !== false,
          }))
      : [],
  };
}

function stripJsonComments(content: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];

    if (inString) {
      result += ch;
      if (ch === '\\' && i + 1 < content.length) {
        result += next;
        i += 2;
        continue;
      }
      if (ch === stringChar) {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === '\'') {
      inString = true;
      stringChar = ch;
      result += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      while (i < content.length && content[i] !== '\n') i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }

    result += ch;
    i += 1;
  }

  return result;
}
