#!/usr/bin/env node
/**
 * CLI entry point â€” kuratchi build | watch | create
 */

import { compile } from './compiler/index.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as net from 'node:net';
import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0];

const projectDir = process.cwd();

void main().catch((err: any) => {
  console.error(`[kuratchi] ${err?.message ?? err}`);
  process.exit(1);
});

async function main() {
  switch (command) {
    case 'build':
      runBuild();
      return;
    case 'watch':
      await runWatch(false);
      return;
    case 'dev':
      await runWatch(true);
      return;
    case 'create':
      await runCreate();
      return;
    case 'types':
      await runTypes();
      return;
    default:
      console.log(`
KuratchiJS CLI

Usage:
  kuratchi create [name]  Scaffold a new KuratchiJS project
  kuratchi build          Compile routes once
  kuratchi dev            Compile, watch for changes, and start wrangler dev server
  kuratchi watch          Compile + watch only (no wrangler — for custom setups)
  kuratchi types          Generate TypeScript types from schema to src/app.d.ts
`);
      process.exit(1);
  }
}

async function runCreate() {
  const { create } = await import('./create.js');
  const remaining = args.slice(1);
  const flags = remaining.filter(a => a.startsWith('-'));
  const positional = remaining.filter(a => !a.startsWith('-'));
  await create(positional[0], flags);
}

async function runTypes() {
  const { writeAppTypes } = await import('./compiler/type-generator.js');
  writeAppTypes({ projectDir });
}

async function runBuild(isDev = false) {
  console.log('[kuratchi] Compiling...');
  try {
    const outFile = await compile({ projectDir, isDev });
    console.log(`[kuratchi] Built â†’ ${path.relative(projectDir, outFile)}`);
  } catch (err: any) {
    console.error(`[kuratchi] Build failed: ${err.message}`);
    process.exit(1);
  }
}

async function runWatch(withWrangler = false): Promise<void> {
  await runBuild(true);

  const routesDir = path.join(projectDir, 'src', 'routes');
  const serverDir = path.join(projectDir, 'src', 'server');
  const watchDirs = [routesDir, serverDir].filter(d => fs.existsSync(d));

  let rebuildTimeout: ReturnType<typeof setTimeout> | null = null;

  const triggerRebuild = () => {
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      console.log('[kuratchi] File changed, rebuilding...');
      try {
        await compile({ projectDir, isDev: true });
        console.log('[kuratchi] Rebuilt.');
      } catch (err: any) {
        console.error(`[kuratchi] Rebuild failed: ${err.message}`);
      }
    }, 100);
  };

  for (const dir of watchDirs) {
    fs.watch(dir, { recursive: true }, triggerRebuild);
  }

  console.log('[kuratchi] Watching for changes...');

  // `kuratchi dev` also starts the wrangler dev server.
  // `kuratchi watch` is the compiler-only mode for custom setups.
  if (withWrangler) {
    await startWranglerDev();
    return;
  }

  await new Promise(() => {});
}

function hasPortFlag(inputArgs: string[]): boolean {
  for (let i = 0; i < inputArgs.length; i++) {
    const arg = inputArgs[i];
    if (arg === '--port' || arg === '-p') return true;
    if (arg.startsWith('--port=')) return true;
    if (arg.startsWith('-p=')) return true;
  }
  return false;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findOpenPort(start = 8787, end = 8899): Promise<number> {
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No open dev port found in range ${start}-${end}`);
}

async function startWranglerDev(): Promise<void> {
  const passthroughArgs = args.slice(1);
  const wranglerArgs = ['dev', ...passthroughArgs];

  if (!hasPortFlag(passthroughArgs)) {
    const port = await findOpenPort();
    wranglerArgs.push('--port', String(port));
    console.log(`[kuratchi] Starting wrangler dev on port ${port}`);
  }

  const wrangler = spawnWranglerProcess(wranglerArgs);

  const cleanup = () => {
    if (!wrangler.killed) wrangler.kill();
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  await new Promise<void>((resolve, reject) => {
    wrangler.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`wrangler exited with code ${code}`));
        return;
      }
      resolve();
    });

    wrangler.on('error', (err) => {
      reject(err);
    });
  }).catch((err: any) => {
    console.error(`[kuratchi] Failed to start wrangler dev: ${err?.message ?? err}`);
    process.exit(1);
  });
}

function resolveWranglerBin(): string | null {
  try {
    const projectPackageJson = path.join(projectDir, 'package.json');
    const projectRequire = createRequire(projectPackageJson);
    return projectRequire.resolve('wrangler/bin/wrangler.js');
  } catch {
    return null;
  }
}

function getNodeExecutable(): string {
  if (!process.versions.bun) return process.execPath;
  return 'node';
}

function spawnWranglerProcess(wranglerArgs: string[]): ChildProcess {
  const localWranglerBin = resolveWranglerBin();
  const stdio: ['pipe', 'inherit', 'inherit'] = ['pipe', 'inherit', 'inherit'];

  if (localWranglerBin) {
    return spawn(getNodeExecutable(), [localWranglerBin, ...wranglerArgs], {
      cwd: projectDir,
      stdio,
    });
  }

  const fallbackCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return spawn(fallbackCommand, ['wrangler', ...wranglerArgs], {
    cwd: projectDir,
    stdio,
  });
}


