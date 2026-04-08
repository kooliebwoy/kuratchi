#!/usr/bin/env node

import { compile } from '@kuratchi/js/compiler';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { readDesktopConfig } from './desktop-config.js';
import { buildDesktopManifest, writeDesktopManifest } from './desktop-manifest.js';
import { createMacOSBundle } from './bundle-macos.js';

const args = process.argv.slice(2);
const command = args[0];
const projectDir = process.cwd();
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let cachedScriptRuntimeExecutable: string | null = null;

void main().catch((err: any) => {
  console.error(`[kuratchi-native] ${err?.message ?? err}`);
  process.exit(1);
});

async function main() {
  switch (command) {
    case 'run':
    case 'desktop':
      await runDesktop();
      return;
    case 'build':
      await buildDesktop();
      return;
    default:
      console.log(`
Kuratchi Native

Usage:
  kuratchi-native desktop   Compile routes and launch the desktop host
  kuratchi-native run       Alias for \`desktop\`
  kuratchi-native build     Build a production macOS .app bundle (and optional .dmg)

Build Options:
  --no-dmg                  Skip DMG creation
  --icon <path>             Path to app icon (.png or .icns)
  --out <dir>               Output directory (default: ./dist)
`);
      process.exit(1);
  }
}

async function runDesktop(): Promise<void> {
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    throw new Error('`kuratchi-native desktop` is currently implemented for Windows and macOS only.');
  }

  console.log('[kuratchi-native] Compiling...');
  const outFile = await compile({ projectDir, isDev: true });
  console.log(`[kuratchi-native] Built -> ${path.relative(projectDir, outFile)}`);

  const desktopConfig = readDesktopConfig(projectDir);
  const desktopManifest = buildDesktopManifest({
    projectDir,
    workerFile: outFile,
    desktopConfig,
  });
  if (desktopManifest) {
    writeDesktopManifest(projectDir, desktopManifest);
  }

  const manifestPath = path.join(projectDir, '.kuratchi', 'desktop.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Desktop manifest not found. Add a desktop block to kuratchi.config.ts before running `kuratchi-native desktop`.');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
    app?: { name?: string; initialPath?: string };
  };
  const appName = manifest.app?.name ?? path.basename(projectDir);
  const runtimePort = await findOpenPort(8787, 8899);
  const desktopApiPort = await findOpenPort(runtimePort + 1, 9199);
  const desktopApiOrigin = `http://127.0.0.1:${desktopApiPort}`;
  const appUrl = `http://127.0.0.1:${runtimePort}${manifest.app?.initialPath ?? '/'}`;

  const stopWatching = startCompilerWatch();
  console.log('[kuratchi-native] Watching for changes...');

  const wrangler = startDesktopWranglerDev(runtimePort);
  let host: ChildProcess | null = null;

  const cleanup = () => {
    stopWatching();
    if (!wrangler.killed) wrangler.kill();
    if (host && !host.killed) host.kill();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  await waitForHttp(appUrl);

  const hostBinary = await ensureDesktopHostBinary();
  console.log(`[kuratchi-native] ${appName} available at ${appUrl}`);

  host = spawn(hostBinary, [
    '--manifest',
    manifestPath,
    '--app-url',
    appUrl,
    '--desktop-api-origin',
    desktopApiOrigin,
  ], {
    cwd: projectDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      KURATCHI_PROJECT_DIR: projectDir,
    },
  });

  await waitForHttp(`${desktopApiOrigin}/health`);

  await new Promise<void>((resolve, reject) => {
    host.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`desktop host exited with code ${code}`));
        return;
      }
      resolve();
    });
    host.on('error', reject);
    wrangler.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`wrangler exited with code ${code}`));
        return;
      }
      resolve();
    });
    wrangler.on('error', reject);
  }).catch((err: any) => {
    console.error(`[kuratchi-native] Failed to launch desktop host: ${err?.message ?? err}`);
    process.exit(1);
  }).finally(() => {
    cleanup();
  });
}

async function buildDesktop(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('`kuratchi-native build` is currently implemented for macOS only. Windows support coming soon.');
  }

  // Parse build-specific args
  const noDmg = args.includes('--no-dmg');
  const iconIndex = args.indexOf('--icon');
  const iconPath = iconIndex !== -1 ? args[iconIndex + 1] : undefined;
  const outIndex = args.indexOf('--out');
  const outputDir = outIndex !== -1 ? path.resolve(args[outIndex + 1]) : path.join(projectDir, 'dist');

  console.log('[kuratchi-native] Building production app...');

  // 1. Compile routes in production mode
  console.log('[kuratchi-native] Compiling routes...');
  const workerFile = await compile({ projectDir, isDev: false });
  console.log(`[kuratchi-native] Compiled -> ${path.relative(projectDir, workerFile)}`);

  // 2. Read desktop config and build manifest
  const desktopConfig = readDesktopConfig(projectDir);
  if (!desktopConfig) {
    throw new Error('No desktop configuration found. Add a `desktop` block to kuratchi.config.ts');
  }

  const desktopManifest = buildDesktopManifest({
    projectDir,
    workerFile,
    desktopConfig,
  });
  if (!desktopManifest) {
    throw new Error('Failed to build desktop manifest.');
  }

  // 3. Bundle the worker with wrangler
  console.log('[kuratchi-native] Bundling worker...');
  const bundleDir = path.join(projectDir, '.kuratchi', 'bundle');
  if (!fs.existsSync(bundleDir)) fs.mkdirSync(bundleDir, { recursive: true });

  const workerBundle = await bundleWorker(workerFile, bundleDir);
  console.log(`[kuratchi-native] Bundled -> ${path.relative(projectDir, workerBundle)}`);

  // 4. Ensure host binary exists
  const hostBinary = await ensureDesktopHostBinary();

  // 5. Resolve assets directory
  const assetsDir = resolveAssetsDir();

  // 6. Create output directory
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 7. Create macOS app bundle
  const result = await createMacOSBundle({
    projectDir,
    outputDir,
    manifest: desktopManifest,
    hostBinary,
    workerBundle,
    assetsDir,
    createDmg: !noDmg,
    iconPath,
  });

  console.log('');
  console.log('[kuratchi-native] Build complete!');
  console.log(`  App: ${result.appPath}`);
  if (result.dmgPath) {
    console.log(`  DMG: ${result.dmgPath}`);
  }
  console.log('');
  console.log('To install, drag the app to /Applications or open the DMG.');
}

async function bundleWorker(workerFile: string, bundleDir: string): Promise<string> {
  const outputFile = path.join(bundleDir, 'worker.js');

  // Use esbuild to bundle the worker into a single file with all dependencies
  // We need to resolve node_modules from the project directory
  const nodeModulesPath = path.join(projectDir, 'node_modules');
  
  const esbuildScript = `
    const esbuild = require('esbuild');
    const path = require('path');
    
    esbuild.buildSync({
      entryPoints: ['${workerFile.replace(/\\/g, '/')}'],
      bundle: true,
      outfile: '${outputFile.replace(/\\/g, '/')}',
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      minify: false,
      sourcemap: false,
      // Mark cloudflare: imports as external (they're provided by workerd)
      external: ['cloudflare:*', 'node:*'],
      // Resolve modules from project's node_modules
      nodePaths: ['${nodeModulesPath.replace(/\\/g, '/')}'],
      // Conditions for Workers environment
      conditions: ['workerd', 'worker', 'browser', 'import', 'default'],
      mainFields: ['browser', 'module', 'main'],
      resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
      },
      define: {
        'process.env.NODE_ENV': '"production"',
      },
    });
    console.log('Bundle created successfully');
  `;

  const esbuildResult = spawnSync('node', ['-e', esbuildScript], {
    cwd: projectDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  if (esbuildResult.status === 0) {
    console.log('[kuratchi-native] Worker bundled successfully.');
    return outputFile;
  }

  // Log the error for debugging
  const stderr = esbuildResult.stderr?.toString() || '';
  if (stderr) {
    console.log('[kuratchi-native] esbuild error:', stderr.slice(0, 500));
  }

  // Fallback: try using bun build
  console.log('[kuratchi-native] Trying bun build as fallback...');
  const bunResult = spawnSync('bun', [
    'build',
    workerFile,
    '--outfile', outputFile,
    '--target', 'browser',
    '--format', 'esm',
    '--external', 'cloudflare:*',
  ], {
    cwd: projectDir,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (bunResult.status === 0) {
    // Post-process: stub out node:* imports that aren't available in Workers
    let bundledCode = fs.readFileSync(outputFile, 'utf-8');
    
    // Replace node:os EOL import with a simple newline constant
    bundledCode = bundledCode.replace(
      /import\s*{\s*EOL\s+as\s+(\w+)\s*}\s*from\s*["']node:os["'];?/g,
      'const $1 = "\\n";'
    );
    
    // Replace any remaining node:* imports with empty stubs
    bundledCode = bundledCode.replace(
      /import\s+.*\s+from\s*["']node:[^"']+["'];?/g,
      '/* node: import stubbed for Workers */'
    );
    
    fs.writeFileSync(outputFile, bundledCode);
    console.log('[kuratchi-native] Worker bundled with bun.');
    return outputFile;
  }

  // Final fallback: just copy the compiled worker (won't work standalone)
  console.log('[kuratchi-native] Warning: Could not bundle worker, using compiled output directly.');
  console.log('[kuratchi-native] The app may not work correctly without bundled dependencies.');
  fs.copyFileSync(workerFile, outputFile);

  return outputFile;
}

function resolveAssetsDir(): string | null {
  const publicDir = path.join(projectDir, '.kuratchi', 'public');
  if (fs.existsSync(publicDir)) return publicDir;

  const srcAssets = path.join(projectDir, 'src', 'assets');
  if (fs.existsSync(srcAssets)) return srcAssets;

  return null;
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

function getScriptRuntimeExecutable(): string {
  if (cachedScriptRuntimeExecutable) return cachedScriptRuntimeExecutable;

  if (!process.versions.bun) {
    cachedScriptRuntimeExecutable = process.execPath;
    return cachedScriptRuntimeExecutable;
  }

  const nodeExecutable = findExecutableOnPath('node');
  cachedScriptRuntimeExecutable = nodeExecutable ?? process.execPath;
  return cachedScriptRuntimeExecutable;
}

function startDesktopWranglerDev(port: number): ChildProcess {
  const wranglerArgs = ['dev', '--port', String(port)];
  console.log(`[kuratchi-native] Starting wrangler dev on port ${port}`);
  return spawnWranglerProcess(wranglerArgs);
}

function startCompilerWatch(): () => void {
  const routesDir = path.join(projectDir, 'src', 'routes');
  const serverDir = path.join(projectDir, 'src', 'server');
  const watchDirs = [routesDir, serverDir].filter((dir) => fs.existsSync(dir));
  const watchers: fs.FSWatcher[] = [];

  let rebuildTimeout: ReturnType<typeof setTimeout> | null = null;

  const triggerRebuild = () => {
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      console.log('[kuratchi-native] File changed, rebuilding...');
      try {
        await compile({ projectDir, isDev: true });
        console.log('[kuratchi-native] Rebuilt.');
      } catch (err: any) {
        console.error(`[kuratchi-native] Rebuild failed: ${err.message}`);
      }
    }, 100);
  };

  for (const dir of watchDirs) {
    watchers.push(fs.watch(dir, { recursive: true }, triggerRebuild));
  }

  return () => {
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    for (const watcher of watchers) watcher.close();
  };
}

function resolveDesktopHostBinary(): string | null {
  const override = process.env.KURATCHI_DESKTOP_HOST_BINARY;
  if (override && fs.existsSync(override)) return override;

  const binaryName = process.platform === 'win32' ? 'workerd-desktop-host.exe' : 'workerd-desktop-host';

  const candidates: string[] = [];

  if (process.platform === 'win32') {
    candidates.push(
      path.join(packageRoot, 'out', 'windows-host', binaryName),
      path.join(packageRoot, 'out', 'cargo-target', 'aarch64-pc-windows-msvc', 'release', binaryName),
      path.join(packageRoot, 'out', 'cargo-target', 'x86_64-pc-windows-msvc', 'release', binaryName),
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      path.join(packageRoot, 'out', 'macos-host', binaryName),
      path.join(packageRoot, 'host', 'rust', 'desktop-host', 'target', 'release', binaryName),
      path.join(packageRoot, 'host', 'rust', 'desktop-host', 'target', 'aarch64-apple-darwin', 'release', binaryName),
      path.join(packageRoot, 'host', 'rust', 'desktop-host', 'target', 'x86_64-apple-darwin', 'release', binaryName),
      path.join(packageRoot, 'out', 'cargo-target', 'aarch64-apple-darwin', 'release', binaryName),
      path.join(packageRoot, 'out', 'cargo-target', 'x86_64-apple-darwin', 'release', binaryName),
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

async function ensureDesktopHostBinary(): Promise<string> {
  const existing = resolveDesktopHostBinary();
  if (existing) return existing;

  let buildScript: string;
  let buildCommand: string;
  let buildArgs: string[];

  if (process.platform === 'win32') {
    buildScript = path.join(packageRoot, 'tools', 'build-windows-host.cmd');
    buildCommand = 'cmd.exe';
    buildArgs = ['/d', '/s', '/c', buildScript];
  } else if (process.platform === 'darwin') {
    buildScript = path.join(packageRoot, 'tools', 'build-macos-host.sh');
    buildCommand = '/bin/sh';
    buildArgs = [buildScript];
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  if (!fs.existsSync(buildScript)) {
    throw new Error(`Missing desktop host build script at ${buildScript}`);
  }

  console.log('[kuratchi-native] Building desktop host...');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(buildCommand, buildArgs, {
      cwd: packageRoot,
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`desktop host build exited with code ${code ?? 1}`));
    });
    child.on('error', reject);
  });

  const hostBinary = resolveDesktopHostBinary();
  if (!hostBinary) {
    throw new Error('Desktop host build completed but no host executable was found.');
  }
  return hostBinary;
}

function spawnWranglerProcess(wranglerArgs: string[]): ChildProcess {
  const localWranglerBin = resolveWranglerBin();
  const stdio: ['pipe', 'inherit', 'inherit'] = ['pipe', 'inherit', 'inherit'];

  if (localWranglerBin) {
    return spawn(getScriptRuntimeExecutable(), [localWranglerBin, ...wranglerArgs], {
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

async function findOpenPort(start: number, end: number): Promise<number> {
  for (let port = start; port <= end; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No open port found in range ${start}-${end}`);
}

async function waitForHttp(url: string): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function findExecutableOnPath(command: string): string | null {
  const pathEnv = process.env.PATH;
  if (!pathEnv) return null;

  const pathEntries = pathEnv.split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT?.split(';').filter(Boolean) ?? ['.EXE', '.CMD', '.BAT', '.COM'])
    : [''];
  const hasExtension = !!path.extname(command);

  for (const entry of pathEntries) {
    if (hasExtension) {
      const candidate = path.join(entry, command);
      if (isExecutableFile(candidate)) return candidate;
      continue;
    }

    for (const ext of extensions) {
      const candidate = path.join(entry, `${command}${process.platform === 'win32' ? ext.toLowerCase() : ext}`);
      if (isExecutableFile(candidate)) return candidate;
      const exactCaseCandidate = path.join(entry, `${command}${ext}`);
      if (exactCaseCandidate !== candidate && isExecutableFile(exactCaseCandidate)) return exactCaseCandidate;
    }
  }

  return null;
}

function isExecutableFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

