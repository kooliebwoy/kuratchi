import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  type AuthConfigEntry,
  type DoConfigEntry,
  type OrmDatabaseEntry,
  type SecurityConfigEntry,
  type WorkerClassConfigEntry,
} from './compiler-shared.js';

type ConfigBlockKind = 'call-object' | 'call-empty';

interface ConfigBlockMatch {
  kind: ConfigBlockKind;
  body: string;
}

export interface UiConfigEntry {
  theme: string;
  radius: string;
  library?: 'tailwindcss';
  plugins: string[];
}

export interface CssConfigEntry {
  /** Enable Tailwind CSS processing via @tailwindcss/postcss */
  tailwind: boolean;
  /** Tailwind plugins to load (e.g., 'daisyui', '@tailwindcss/forms') */
  plugins: string[];
  /** Enable CSS minification via Lightning CSS (default: true in production) */
  minify: boolean;
}

function skipWhitespace(source: string, start: number): number {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

function extractBalancedBody(source: string, start: number, openChar: string, closeChar: string): string | null {
  if (source[start] !== openChar) return null;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    else if (source[i] === closeChar) {
      depth--;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

function readConfigBlock(source: string, key: string): ConfigBlockMatch | null {
  const keyRegex = new RegExp(`\\b${key}\\s*:`);
  const keyMatch = keyRegex.exec(source);
  if (!keyMatch) return null;

  const colonIdx = source.indexOf(':', keyMatch.index);
  if (colonIdx === -1) return null;

  const valueIdx = skipWhitespace(source, colonIdx + 1);
  if (valueIdx >= source.length) return null;

  if (source[valueIdx] === '{') {
    throw new Error(`[kuratchi] "${key}" config must use an adapter call (e.g. ${key}: kuratchi${key[0].toUpperCase()}${key.slice(1)}Config({...})).`);
  }

  const callOpen = source.indexOf('(', valueIdx);
  if (callOpen === -1) return null;
  const argIdx = skipWhitespace(source, callOpen + 1);
  if (argIdx >= source.length) return null;

  if (source[argIdx] === ')') return { kind: 'call-empty', body: '' };
  if (source[argIdx] === '{') {
    const body = extractBalancedBody(source, argIdx, '{', '}');
    if (body == null) return null;
    return { kind: 'call-object', body };
  }

  return { kind: 'call-empty', body: '' };
}

function normalizeUiPluginName(plugin: string): string {
  const normalized = plugin.trim();
  if (!normalized) return normalized;
  if (normalized === 'forms') return '@tailwindcss/forms';
  return normalized;
}

function readUiConfig(projectDir: string): UiConfigEntry | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const uiBlock = readConfigBlock(source, 'ui');
  if (!uiBlock) return null;

  const themeMatch = uiBlock.body.match(/theme\s*:\s*['"]([^'"]+)['"]/);
  const radiusMatch = uiBlock.body.match(/radius\s*:\s*['"]([^'"]+)['"]/);
  const libraryMatch = uiBlock.body.match(/library\s*:\s*['"]([^'"]+)['"]/);
  const pluginsMatch = uiBlock.body.match(/plugins\s*:\s*\[([\s\S]*?)\]/);
  const plugins: string[] = [];
  if (pluginsMatch) {
    const itemRegex = /['"]([^'"]+)['"]/g;
    let pluginMatch: RegExpExecArray | null;
    while ((pluginMatch = itemRegex.exec(pluginsMatch[1])) !== null) {
      const plugin = normalizeUiPluginName(pluginMatch[1]);
      if (plugin) plugins.push(plugin);
    }
  }

  return {
    theme: themeMatch?.[1] ?? 'dark',
    radius: radiusMatch?.[1] ?? 'default',
    library: libraryMatch?.[1] === 'tailwindcss' ? 'tailwindcss' : undefined,
    plugins,
  };
}

/**
 * Read the @kuratchi/ui theme CSS.
 * Note: Tailwind CSS is now handled by the CSS pipeline (css-pipeline.ts),
 * not by the UI adapter. This function only loads the @kuratchi/ui theme.css.
 */
export function readUiTheme(projectDir: string): string | null {
  const uiConfig = readUiConfig(projectDir);
  if (!uiConfig) return null;

  const themeValue = uiConfig.theme ?? 'default';

  if (themeValue === 'default' || themeValue === 'dark' || themeValue === 'light' || themeValue === 'system') {
    const candidates = [
      path.join(projectDir, 'node_modules', '@kuratchi/ui', 'src', 'styles', 'theme.css'),
      path.join(path.resolve(projectDir, '../..'), 'packages', 'kuratchi-ui', 'src', 'styles', 'theme.css'),
      path.join(path.resolve(projectDir, '../..'), 'node_modules', '@kuratchi/ui', 'src', 'styles', 'theme.css'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, 'utf-8');
      }
    }
    console.warn(`[kuratchi] ui.theme: "${themeValue}" configured but @kuratchi/ui theme.css not found`);
    return null;
  }

  const customPath = path.resolve(projectDir, themeValue);
  if (fs.existsSync(customPath)) {
    return fs.readFileSync(customPath, 'utf-8');
  }

  console.warn(`[kuratchi] ui.theme: "${themeValue}" not found at ${customPath}`);
  return null;
}

export function readUiConfigValues(projectDir: string): { theme: string; radius: string } | null {
  const uiConfig = readUiConfig(projectDir);
  if (!uiConfig) return null;
  return {
    theme: uiConfig.theme,
    radius: uiConfig.radius,
  };
}

/**
 * Read CSS configuration from kuratchi.config.ts.
 *
 * Example config:
 * ```ts
 * export default defineConfig({
 *   css: {
 *     tailwind: true,
 *     plugins: ['daisyui'],
 *     minify: true,
 *   },
 * });
 * ```
 */
export function readCssConfig(projectDir: string): CssConfigEntry | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const cssBlock = readConfigBlock(source, 'css');
  if (!cssBlock) return null;

  const tailwindMatch = cssBlock.body.match(/tailwind\s*:\s*(true|false)/);
  const minifyMatch = cssBlock.body.match(/minify\s*:\s*(true|false)/);
  const pluginsMatch = cssBlock.body.match(/plugins\s*:\s*\[([\s\S]*?)\]/);

  const plugins: string[] = [];
  if (pluginsMatch) {
    const itemRegex = /['"]([^'"]+)['"]/g;
    let pluginMatch: RegExpExecArray | null;
    while ((pluginMatch = itemRegex.exec(pluginsMatch[1])) !== null) {
      const plugin = normalizeUiPluginName(pluginMatch[1]);
      if (plugin) plugins.push(plugin);
    }
  }

  return {
    tailwind: tailwindMatch?.[1] === 'true',
    plugins,
    minify: minifyMatch?.[1] !== 'false', // default true
  };
}

export function readOrmConfig(projectDir: string): OrmDatabaseEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return [];

  const source = fs.readFileSync(configPath, 'utf-8');
  const ormBlock = readConfigBlock(source, 'orm');
  if (!ormBlock) return [];

  const importMap = new Map<string, string>();
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(source)) !== null) {
    const names = match[1].split(',').map((name) => name.trim()).filter(Boolean);
    const importPath = match[2];
    for (const name of names) {
      importMap.set(name, importPath);
    }
  }

  const databasesIdx = ormBlock.body.search(/databases\s*:\s*\{/);
  if (databasesIdx === -1) return [];
  const dbBraceStart = ormBlock.body.indexOf('{', databasesIdx);
  if (dbBraceStart === -1) return [];
  const databasesBody = extractBalancedBody(ormBlock.body, dbBraceStart, '{', '}');
  if (databasesBody == null) return [];

  const entries: OrmDatabaseEntry[] = [];
  const entryRegex = /(\w+)\s*:\s*\{\s*schema\s*:\s*(\w+)([^}]*)\}/g;
  while ((match = entryRegex.exec(databasesBody)) !== null) {
    const binding = match[1];
    const schemaExportName = match[2];
    const rest = match[3] || '';

    const skipMatch = rest.match(/skipMigrations\s*:\s*(true|false)/);
    const skipMigrations = skipMatch?.[1] === 'true';

    const typeMatch = rest.match(/type\s*:\s*['"]?(d1|do)['"]?/);
    const type = (typeMatch?.[1] as 'd1' | 'do') ?? 'd1';
    const remoteMatch = rest.match(/remote\s*:\s*(true|false)/);
    const remote = remoteMatch?.[1] === 'true';

    const schemaImportPath = importMap.get(schemaExportName);
    if (!schemaImportPath) continue;

    entries.push({ binding, schemaImportPath, schemaExportName, skipMigrations, type, remote });
  }

  return entries;
}

export function readAuthConfig(projectDir: string): AuthConfigEntry | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const authBlockMatch = readConfigBlock(source, 'auth');
  if (!authBlockMatch) return null;
  const authBlock = authBlockMatch.body;

  const cookieMatch = authBlock.match(/cookieName\s*:\s*['"]([^'"]+)['"]/);
  const secretMatch = authBlock.match(/secretEnvKey\s*:\s*['"]([^'"]+)['"]/);
  const sessionMatch = authBlock.match(/sessionEnabled\s*:\s*(true|false)/);

  return {
    cookieName: cookieMatch?.[1] ?? 'kuratchi_session',
    secretEnvKey: secretMatch?.[1] ?? 'AUTH_SECRET',
    sessionEnabled: sessionMatch?.[1] !== 'false',
    hasCredentials: /credentials\s*:/.test(authBlock),
    hasActivity: /activity\s*:/.test(authBlock),
    hasRoles: /roles\s*:/.test(authBlock),
    hasOAuth: /oauth\s*:/.test(authBlock),
    hasGuards: /guards\s*:/.test(authBlock),
    hasRateLimit: /rateLimit\s*:/.test(authBlock),
    hasTurnstile: /turnstile\s*:/.test(authBlock),
    hasOrganization: /organizations\s*:/.test(authBlock),
  };
}

export function readDoConfig(projectDir: string): DoConfigEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return readWranglerDoConfig(projectDir);

  const source = fs.readFileSync(configPath, 'utf-8');
  const doIdx = source.search(/durableObjects\s*:\s*\{/);
  if (doIdx === -1) return readWranglerDoConfig(projectDir);

  const braceStart = source.indexOf('{', doIdx);
  if (braceStart === -1) return readWranglerDoConfig(projectDir);

  let depth = 0;
  let braceEnd = braceStart;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  const doBlock = source.slice(braceStart + 1, braceEnd);

  const entries: DoConfigEntry[] = [];
  const objRegex = /(\w+)\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = objRegex.exec(doBlock)) !== null) {
    const binding = match[1];
    const body = match[2];

    const cnMatch = body.match(/className\s*:\s*['"](\w+)['"]/);
    if (!cnMatch) continue;

    const entry: DoConfigEntry = { binding, className: cnMatch[1] };

    const stubIdMatch = body.match(/stubId\s*:\s*['"]([^'"]+)['"]/);
    if (stubIdMatch) entry.stubId = stubIdMatch[1];

    const filesMatch = body.match(/files\s*:\s*\[([\s\S]*?)\]/);
    if (filesMatch) {
      const list: string[] = [];
      const itemRegex = /['"]([^'"]+)['"]/g;
      let fileMatch: RegExpExecArray | null;
      while ((fileMatch = itemRegex.exec(filesMatch[1])) !== null) {
        list.push(fileMatch[1]);
      }
      if (list.length > 0) entry.files = list;
    }

    entries.push(entry);
  }

  const foundBindings = new Set(entries.map((entry) => entry.binding));
  const pairRegex = /(\w+)\s*:\s*['"](\w+)['"]\s*[,}\n]/g;
  while ((match = pairRegex.exec(doBlock)) !== null) {
    if (foundBindings.has(match[1])) continue;
    if (['className', 'stubId'].includes(match[1])) continue;
    entries.push({ binding: match[1], className: match[2] });
  }

  return entries.length > 0 ? entries : readWranglerDoConfig(projectDir);
}

/** Read durable_objects.bindings from wrangler.jsonc / wrangler.json as fallback. */
function readWranglerDoConfig(projectDir: string): DoConfigEntry[] {
  const candidates = ['wrangler.jsonc', 'wrangler.json'];
  const wranglerPath = candidates
    .map((file) => path.join(projectDir, file))
    .find((filePath) => fs.existsSync(filePath));
  if (!wranglerPath) return [];

  const source = fs.readFileSync(wranglerPath, 'utf-8');
  const bindingsMatch = source.match(/"durable_objects"\s*:\s*\{[\s\S]*?"bindings"\s*:\s*\[([\s\S]*?)\][\s\S]*?\}/);
  if (!bindingsMatch) return [];
  const bindingsBody = bindingsMatch[1];

  const entries: DoConfigEntry[] = [];
  const objectRegex = /\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = objectRegex.exec(bindingsBody)) !== null) {
    const body = m[1];
    const bindingMatch = body.match(/"name"\s*:\s*"([^"]+)"/);
    const classMatch = body.match(/"class_name"\s*:\s*"([^"]+)"/);
    if (!bindingMatch || !classMatch) continue;
    entries.push({ binding: bindingMatch[1], className: classMatch[1] });
  }
  return entries;
}

export function readWorkerClassConfig(projectDir: string, key: 'containers' | 'workflows'): WorkerClassConfigEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return [];
  const source = fs.readFileSync(configPath, 'utf-8');

  const keyIdx = source.search(new RegExp(`\\b${key}\\s*:\\s*\\{`));
  if (keyIdx === -1) return [];

  const braceStart = source.indexOf('{', keyIdx);
  if (braceStart === -1) return [];
  const body = extractBalancedBody(source, braceStart, '{', '}');
  if (body == null) return [];

  const entries: WorkerClassConfigEntry[] = [];
  const expectedSuffix = key === 'containers' ? '.container' : '.workflow';
  const allowedExt = /\.(ts|js|mjs|cjs)$/i;
  const requiredFilePattern = new RegExp(`\\${expectedSuffix}\\.(ts|js|mjs|cjs)$`, 'i');

  const resolveClassFromFile = (binding: string, filePath: string): { className: string; exportKind: 'named' | 'default' } => {
    if (!requiredFilePattern.test(filePath)) {
      throw new Error(`[kuratchi] ${key}.${binding} must reference a file ending in "${expectedSuffix}.ts|js|mjs|cjs". Received: ${filePath}`);
    }
    if (!allowedExt.test(filePath)) {
      throw new Error(`[kuratchi] ${key}.${binding} file must be a TypeScript or JavaScript module. Received: ${filePath}`);
    }
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);
    if (!fs.existsSync(absPath)) {
      throw new Error(`[kuratchi] ${key}.${binding} file not found: ${filePath}`);
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
    throw new Error(`[kuratchi] ${key}.${binding} must export a class via "export class X" or "export default class X". File: ${filePath}`);
  };

  const objRegex = /(\w+)\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = objRegex.exec(body)) !== null) {
    const binding = match[1];
    const entryBody = match[2];
    const fileMatch = entryBody.match(/file\s*:\s*['"]([^'"]+)['"]/);
    if (!fileMatch) continue;
    const inferred = resolveClassFromFile(binding, fileMatch[1]);
    const classMatch = entryBody.match(/className\s*:\s*['"](\w+)['"]/);
    const className = classMatch?.[1] ?? inferred.className;
    entries.push({
      binding,
      className,
      file: fileMatch[1],
      exportKind: inferred.exportKind,
    });
  }

  const foundBindings = new Set(entries.map((entry) => entry.binding));
  const pairRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]\s*[,}\n]/g;
  while ((match = pairRegex.exec(body)) !== null) {
    const binding = match[1];
    const file = match[2];
    if (foundBindings.has(binding)) continue;
    if (binding === 'file' || binding === 'className') continue;
    const inferred = resolveClassFromFile(binding, file);
    entries.push({
      binding,
      className: inferred.className,
      file,
      exportKind: inferred.exportKind,
    });
  }

  return entries;
}

export function readAssetsPrefix(projectDir: string): string {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return '/assets/';
  const source = fs.readFileSync(configPath, 'utf-8');
  const match = source.match(/assetsPrefix\s*:\s*['"]([^'"]+)['"]/);
  if (!match) return '/assets/';
  let prefix = match[1];
  if (!prefix.startsWith('/')) prefix = '/' + prefix;
  if (!prefix.endsWith('/')) prefix += '/';
  return prefix;
}

export function readSecurityConfig(projectDir: string): SecurityConfigEntry {
  const defaults: SecurityConfigEntry = {
    csrfEnabled: true,
    csrfCookieName: '__kuratchi_csrf',
    csrfHeaderName: 'x-kuratchi-csrf',
    rpcRequireAuth: false,
    actionRequireAuth: false,
    contentSecurityPolicy: null,
    strictTransportSecurity: null,
    permissionsPolicy: null,
  };

  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return defaults;

  const source = fs.readFileSync(configPath, 'utf-8');
  const securityBlock = readConfigBlock(source, 'security');
  if (!securityBlock) return defaults;

  const body = securityBlock.body;

  // Parse CSRF settings
  const csrfEnabledMatch = body.match(/csrfEnabled\s*:\s*(true|false)/);
  if (csrfEnabledMatch) {
    defaults.csrfEnabled = csrfEnabledMatch[1] === 'true';
  }

  const csrfCookieMatch = body.match(/csrfCookieName\s*:\s*['"]([^'"]+)['"]/);
  if (csrfCookieMatch) {
    defaults.csrfCookieName = csrfCookieMatch[1];
  }

  const csrfHeaderMatch = body.match(/csrfHeaderName\s*:\s*['"]([^'"]+)['"]/);
  if (csrfHeaderMatch) {
    defaults.csrfHeaderName = csrfHeaderMatch[1];
  }

  // Parse RPC settings
  const rpcAuthMatch = body.match(/rpcRequireAuth\s*:\s*(true|false)/);
  if (rpcAuthMatch) {
    defaults.rpcRequireAuth = rpcAuthMatch[1] === 'true';
  }

  // Parse action settings
  const actionAuthMatch = body.match(/actionRequireAuth\s*:\s*(true|false)/);
  if (actionAuthMatch) {
    defaults.actionRequireAuth = actionAuthMatch[1] === 'true';
  }

  // Parse security headers
  const cspMatch = body.match(/contentSecurityPolicy\s*:\s*['"`]([^'"`]+)['"`]/);
  if (cspMatch) {
    defaults.contentSecurityPolicy = cspMatch[1];
  }

  const hstsMatch = body.match(/strictTransportSecurity\s*:\s*['"`]([^'"`]+)['"`]/);
  if (hstsMatch) {
    defaults.strictTransportSecurity = hstsMatch[1];
  }

  const permMatch = body.match(/permissionsPolicy\s*:\s*['"`]([^'"`]+)['"`]/);
  if (permMatch) {
    defaults.permissionsPolicy = permMatch[1];
  }

  return defaults;
}
