import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import type { DesktopManifest } from './desktop-manifest.js';

export interface MacOSBundleOptions {
  projectDir: string;
  outputDir: string;
  manifest: DesktopManifest;
  hostBinary: string;
  workerBundle: string;
  assetsDir: string | null;
  createDmg: boolean;
  iconPath?: string;
}

export interface MacOSBundleResult {
  appPath: string;
  dmgPath: string | null;
}

export async function createMacOSBundle(options: MacOSBundleOptions): Promise<MacOSBundleResult> {
  const {
    projectDir,
    outputDir,
    manifest,
    hostBinary,
    workerBundle,
    assetsDir,
    createDmg,
    iconPath,
  } = options;

  const appName = manifest.app.name || path.basename(projectDir);
  const bundleId = manifest.app.id || `dev.kuratchi.${appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const appBundleName = `${appName}.app`;
  const appPath = path.join(outputDir, appBundleName);

  console.log(`[kuratchi-native] Creating macOS app bundle: ${appBundleName}`);

  // Clean previous build
  if (fs.existsSync(appPath)) {
    fs.rmSync(appPath, { recursive: true, force: true });
  }

  // Create .app bundle structure
  // MyApp.app/
  //   Contents/
  //     Info.plist
  //     MacOS/
  //       MyApp (host binary)
  //       launcher (shell script that starts embedded workerd + host)
  //     Resources/
  //       AppIcon.icns
  //       worker/ (bundled worker code)
  //       assets/ (static assets)
  //       manifest.json

  const contentsDir = path.join(appPath, 'Contents');
  const macosDir = path.join(contentsDir, 'MacOS');
  const resourcesDir = path.join(contentsDir, 'Resources');
  const workerDir = path.join(resourcesDir, 'worker');

  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.mkdirSync(workerDir, { recursive: true });

  // Copy host binary
  const hostBinaryDest = path.join(macosDir, 'workerd-desktop-host');
  fs.copyFileSync(hostBinary, hostBinaryDest);
  fs.chmodSync(hostBinaryDest, 0o755);

  // Copy the pre-bundled worker (not the raw .kuratchi files)
  // The bundled worker.js has all dependencies resolved
  fs.copyFileSync(workerBundle, path.join(workerDir, 'worker.js'));

  // Copy wrangler.jsonc and create production config
  const wranglerSrc = path.join(projectDir, 'wrangler.jsonc');
  if (fs.existsSync(wranglerSrc)) {
    const wranglerContent = fs.readFileSync(wranglerSrc, 'utf-8');
    // Parse JSONC (strip comments)
    const jsonContent = wranglerContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    try {
      const wranglerConfig = JSON.parse(jsonContent);
      // Use the pre-bundled worker.js - tell wrangler not to re-bundle
      wranglerConfig.main = './worker.js';
      wranglerConfig.no_bundle = true;
      // Keep account_id (needed for AI binding in remote mode)
      // Update D1 databases to use local mode
      if (wranglerConfig.d1_databases) {
        for (const db of wranglerConfig.d1_databases) {
          db.database_id = 'local';
        }
      }
      fs.writeFileSync(
        path.join(workerDir, 'wrangler.json'),
        JSON.stringify(wranglerConfig, null, 2),
      );
    } catch {
      // Fallback: copy as-is
      fs.copyFileSync(wranglerSrc, path.join(workerDir, 'wrangler.json'));
    }
  }

  // Copy assets if present
  if (assetsDir && fs.existsSync(assetsDir)) {
    const assetsDest = path.join(resourcesDir, 'assets');
    copyDirRecursive(assetsDir, assetsDest);
  }

  // Bundle Node.js and wrangler for the app
  await bundleNodeAndWrangler(projectDir, resourcesDir);

  // Write production manifest (paths adjusted for bundle)
  const productionManifest = {
    ...manifest,
    projectDir: '', // Not needed in production
    runtime: {
      ...manifest.runtime,
      workerEntrypoint: '../Resources/worker/worker.js',
      assetsRoot: assetsDir ? '../Resources/assets' : null,
    },
  };
  fs.writeFileSync(
    path.join(resourcesDir, 'manifest.json'),
    JSON.stringify(productionManifest, null, 2),
  );

  // Create launcher script that starts embedded workerd and host
  const launcherScript = createLauncherScript(appName, manifest, projectDir);
  const launcherPath = path.join(macosDir, appName);
  fs.writeFileSync(launcherPath, launcherScript);
  fs.chmodSync(launcherPath, 0o755);

  // Create Info.plist
  const infoPlist = createInfoPlist({
    appName,
    bundleId,
    version: '1.0.0',
    executableName: appName,
    iconFile: iconPath ? 'AppIcon' : undefined,
  });
  fs.writeFileSync(path.join(contentsDir, 'Info.plist'), infoPlist);

  // Copy icon if provided
  if (iconPath && fs.existsSync(iconPath)) {
    const iconDest = path.join(resourcesDir, 'AppIcon.icns');
    if (iconPath.endsWith('.icns')) {
      fs.copyFileSync(iconPath, iconDest);
    } else if (iconPath.endsWith('.png')) {
      // Convert PNG to ICNS using sips (macOS built-in)
      await convertPngToIcns(iconPath, iconDest);
    }
  }

  console.log(`[kuratchi-native] App bundle created: ${appPath}`);

  // Create DMG if requested
  let dmgPath: string | null = null;
  if (createDmg) {
    dmgPath = await createDmgImage(outputDir, appPath, appName);
  }

  return { appPath, dmgPath };
}

function createLauncherScript(appName: string, manifest: DesktopManifest, projectDir: string): string {
  const initialPath = manifest.app.initialPath || '/';
  const port = 19787; // Fixed port for production embedded server

  return `#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$(dirname "$SCRIPT_DIR")/Resources"
MANIFEST_PATH="$RESOURCES_DIR/manifest.json"
HOST_BINARY="$SCRIPT_DIR/workerd-desktop-host"
DATA_DIR="$HOME/Library/Application Support/${appName}"

# Original project directory (for development/linked mode)
PROJECT_DIR="${projectDir}"

# Ensure data directory exists for local D1/KV storage
mkdir -p "$DATA_DIR"

export WRANGLER_SEND_METRICS=false
export NO_D1_WARNING=true

# Set up PATH for GUI apps (Finder doesn't inherit shell PATH)
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin:$PATH"

# Find npx
NPX_BIN=""
if [ -x /opt/homebrew/bin/npx ]; then
  NPX_BIN="/opt/homebrew/bin/npx"
elif [ -x /usr/local/bin/npx ]; then
  NPX_BIN="/usr/local/bin/npx"
elif [ -x "$HOME/.nvm/versions/node/*/bin/npx" ]; then
  NPX_BIN=$(ls -1 $HOME/.nvm/versions/node/*/bin/npx 2>/dev/null | head -1)
elif command -v npx &> /dev/null; then
  NPX_BIN="npx"
fi

if [ -z "$NPX_BIN" ]; then
  osascript -e 'display alert "Node.js Required" message "Please install Node.js from https://nodejs.org to run this application."'
  exit 1
fi

# Run wrangler from the original project directory (has node_modules)
cd "$PROJECT_DIR"

# Start wrangler in the background using npx
"$NPX_BIN" wrangler dev \\
  --port ${port} \\
  --persist-to "$DATA_DIR" &
WRANGLER_PID=$!

# Wait for wrangler to be ready (up to 30 seconds)
echo "Starting worker runtime..."
for i in {1..60}; do
  if curl -s "http://127.0.0.1:${port}/" > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# Launch the desktop host
"$HOST_BINARY" \\
  --manifest "$MANIFEST_PATH" \\
  --app-url "http://127.0.0.1:${port}${initialPath}"

# Cleanup wrangler when host exits
kill $WRANGLER_PID 2>/dev/null || true
`;
}

function createInfoPlist(options: {
  appName: string;
  bundleId: string;
  version: string;
  executableName: string;
  iconFile?: string;
}): string {
  const { appName, bundleId, version, executableName, iconFile } = options;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>${executableName}</string>
  <key>CFBundleIdentifier</key>
  <string>${bundleId}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${appName}</string>
  <key>CFBundleDisplayName</key>
  <string>${appName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
  <key>CFBundleVersion</key>
  <string>${version}</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.15</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>${iconFile ? `
  <key>CFBundleIconFile</key>
  <string>${iconFile}</string>` : ''}
</dict>
</plist>
`;
}

async function convertPngToIcns(pngPath: string, icnsPath: string): Promise<void> {
  const iconsetDir = icnsPath.replace('.icns', '.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });

  // Create different icon sizes using sips
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const size of sizes) {
    const outputFile = path.join(iconsetDir, `icon_${size}x${size}.png`);
    await runCommand('sips', ['-z', String(size), String(size), pngPath, '--out', outputFile]);

    // Also create @2x versions for Retina
    if (size <= 512) {
      const retinaFile = path.join(iconsetDir, `icon_${size / 2}x${size / 2}@2x.png`);
      if (size >= 32) {
        await runCommand('sips', ['-z', String(size), String(size), pngPath, '--out', retinaFile]);
      }
    }
  }

  // Convert iconset to icns
  await runCommand('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);

  // Clean up iconset
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

async function createDmgImage(outputDir: string, appPath: string, appName: string): Promise<string> {
  const dmgPath = path.join(outputDir, `${appName}.dmg`);
  const tempDmgPath = path.join(outputDir, `${appName}-temp.dmg`);

  console.log(`[kuratchi-native] Creating DMG: ${dmgPath}`);

  // Remove existing DMG files
  if (fs.existsSync(dmgPath)) fs.unlinkSync(dmgPath);
  if (fs.existsSync(tempDmgPath)) fs.unlinkSync(tempDmgPath);

  // Create a temporary DMG
  const volumeName = appName;
  const appSize = getDirSize(appPath);
  const dmgSize = Math.ceil((appSize / 1024 / 1024) + 50); // Add 50MB buffer

  await runCommand('hdiutil', [
    'create',
    '-srcfolder', appPath,
    '-volname', volumeName,
    '-fs', 'HFS+',
    '-fsargs', '-c c=64,a=16,e=16',
    '-format', 'UDRW',
    '-size', `${dmgSize}m`,
    tempDmgPath,
  ]);

  // Mount the DMG to customize it
  const mountResult = await runCommandCapture('hdiutil', [
    'attach',
    '-readwrite',
    '-noverify',
    tempDmgPath,
  ]);

  const mountPoint = mountResult.stdout
    .split('\n')
    .find((line) => line.includes('/Volumes/'))
    ?.split('\t')
    .pop()
    ?.trim();

  if (mountPoint) {
    // Create Applications symlink
    const applicationsLink = path.join(mountPoint, 'Applications');
    if (!fs.existsSync(applicationsLink)) {
      fs.symlinkSync('/Applications', applicationsLink);
    }

    // Unmount
    await runCommand('hdiutil', ['detach', mountPoint]);
  }

  // Convert to compressed read-only DMG
  await runCommand('hdiutil', [
    'convert',
    tempDmgPath,
    '-format', 'UDZO',
    '-imagekey', 'zlib-level=9',
    '-o', dmgPath,
  ]);

  // Clean up temp DMG
  fs.unlinkSync(tempDmgPath);

  console.log(`[kuratchi-native] DMG created: ${dmgPath}`);
  return dmgPath;
}

async function bundleNodeAndWrangler(_projectDir: string, _resourcesDir: string): Promise<void> {
  // Note: We no longer bundle node_modules - the launcher script uses npx wrangler
  // This keeps the app bundle small and avoids dependency issues
  console.log('[kuratchi-native] App will use system wrangler via npx.');
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getDirSize(dirPath: string): number {
  let size = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  return size;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

function runCommandCapture(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => { stdout += data.toString(); });
    child.stderr?.on('data', (data) => { stderr += data.toString(); });

    child.on('exit', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
    child.on('error', reject);
  });
}
