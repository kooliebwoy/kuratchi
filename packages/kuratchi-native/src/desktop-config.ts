import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DesktopBindingEntry {
  notifications: boolean;
  files: boolean;
}

export interface DesktopRemoteBindingEntry {
  binding: string;
  type: 'd1' | 'r2';
  remote: boolean;
}

export interface DesktopConfigEntry {
  appName: string | null;
  appId: string | null;
  initialPath: string;
  windowTitle: string | null;
  windowWidth: number;
  windowHeight: number;
  bindings: DesktopBindingEntry;
  remoteBindings: DesktopRemoteBindingEntry[];
}

function extractBalancedBody(source: string, start: number, openChar: string, closeChar: string): string | null {
  if (source[start] !== openChar) return null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === openChar) depth += 1;
    else if (source[i] === closeChar) {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

export function readDesktopConfig(projectDir: string): DesktopConfigEntry | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const desktopIdx = source.search(/\bdesktop\s*:\s*\{/);
  if (desktopIdx === -1) return null;

  const braceStart = source.indexOf('{', desktopIdx);
  if (braceStart === -1) return null;
  const body = extractBalancedBody(source, braceStart, '{', '}');
  if (body == null) return null;

  const appNameMatch = body.match(/appName\s*:\s*['"]([^'"]+)['"]/);
  const appIdMatch = body.match(/appId\s*:\s*['"]([^'"]+)['"]/);
  const initialPathMatch = body.match(/initialPath\s*:\s*['"]([^'"]+)['"]/);

  let windowTitle: string | null = null;
  let windowWidth = 1100;
  let windowHeight = 780;
  const windowIdx = body.search(/\bwindow\s*:\s*\{/);
  if (windowIdx !== -1) {
    const windowBraceStart = body.indexOf('{', windowIdx);
    const windowBody = windowBraceStart === -1 ? null : extractBalancedBody(body, windowBraceStart, '{', '}');
    if (windowBody != null) {
      const titleMatch = windowBody.match(/title\s*:\s*['"]([^'"]+)['"]/);
      const widthMatch = windowBody.match(/width\s*:\s*(\d+)/);
      const heightMatch = windowBody.match(/height\s*:\s*(\d+)/);
      windowTitle = titleMatch?.[1] ?? null;
      windowWidth = widthMatch ? Number(widthMatch[1]) : 1100;
      windowHeight = heightMatch ? Number(heightMatch[1]) : 780;
    }
  }

  const bindings = { notifications: false, files: false };
  const bindingsIdx = body.search(/\bbindings\s*:\s*\{/);
  if (bindingsIdx !== -1) {
    const bindingsBraceStart = body.indexOf('{', bindingsIdx);
    const bindingsBody = bindingsBraceStart === -1 ? null : extractBalancedBody(body, bindingsBraceStart, '{', '}');
    if (bindingsBody != null) {
      const notificationsMatch = bindingsBody.match(/notifications\s*:\s*(true|false)/);
      bindings.notifications = notificationsMatch?.[1] === 'true';
      const filesMatch = bindingsBody.match(/files\s*:\s*(true|false)/);
      bindings.files = filesMatch?.[1] === 'true';
    }
  }

  const remoteBindings: DesktopConfigEntry['remoteBindings'] = [];
  const remoteIdx = body.search(/\bremoteBindings\s*:\s*\{/);
  if (remoteIdx !== -1) {
    const remoteBraceStart = body.indexOf('{', remoteIdx);
    const remoteBody = remoteBraceStart === -1 ? null : extractBalancedBody(body, remoteBraceStart, '{', '}');
    if (remoteBody != null) {
      const entryRegex = /(\w+)\s*:\s*\{\s*type\s*:\s*['"](d1|r2)['"]([^}]*)\}/g;
      let match: RegExpExecArray | null;
      while ((match = entryRegex.exec(remoteBody)) !== null) {
        const rest = match[3] || '';
        const remoteMatch = rest.match(/remote\s*:\s*(true|false)/);
        remoteBindings.push({
          binding: match[1],
          type: match[2] as 'd1' | 'r2',
          remote: remoteMatch?.[1] !== 'false',
        });
      }
    }
  }

  return {
    appName: appNameMatch?.[1] ?? null,
    appId: appIdMatch?.[1] ?? null,
    initialPath: initialPathMatch?.[1] ?? '/',
    windowTitle,
    windowWidth,
    windowHeight,
    bindings,
    remoteBindings,
  };
}
