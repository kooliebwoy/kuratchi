import ts from 'typescript';

/**
 * HTML file parser.
 *
 * Extracts the top-level compile-time <script> block (before the HTML document).
 * A top-level block containing reactive `$:` labels is preserved in template output
 * as client script.
 * Everything else is the template — full HTML with native JS flow control.
 * <style> inside the HTML is NOT extracted; it's part of the template.
 */

export interface ParsedFile {
  /** Script content (compile-time code, minus imports) */
  script: string | null;
  /** Explicit server-side load function exported from the route script */
  loadFunction: string | null;
  /** Template — the full HTML document with inline JS flow control */
  template: string;
  /** All imports from the script block */
  serverImports: string[];
  /** Whether the script has server-side code (beyond imports) */
  hasLoad: boolean;
  /** Action functions referenced via action={fn} in the template */
  actionFunctions: string[];
  /** Top-level variable names declared in the script (const/let/var) */
  dataVars: string[];
  /** Component imports: import Name from '$lib/file.html' → { Name: 'file' } */
  componentImports: Record<string, string>;
  /** Poll functions referenced via data-poll={fn(args)} in the template */
  pollFunctions: string[];
  /** Query blocks referenced via data-get={fn(args)} data-as="name" */
  dataGetQueries: Array<{ fnName: string; argsExpr: string; asName: string; key?: string; rpcId?: string }>;
  /** Imports found in a top-level client script block */
  clientImports: string[];
  /** Top-level names returned from explicit load() */
  loadReturnVars: string[];
  /** Local aliases for Cloudflare Workers env imported from cloudflare:workers */
  workerEnvAliases: string[];
  /** Local aliases for dev imported from @kuratchi/js/environment */
  devAliases: string[];
}

interface ParseFileOptions {
  kind?: 'route' | 'layout' | 'component';
  filePath?: string;
}

interface TopLevelImportStatement {
  text: string;
  start: number;
  end: number;
}

function getTopLevelImportStatements(source: string): TopLevelImportStatement[] {
  const sourceFile = ts.createSourceFile('kuratchi-script.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: TopLevelImportStatement[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    imports.push({
      text: source.slice(statement.getStart(sourceFile), statement.getEnd()),
      start: statement.getStart(sourceFile),
      end: statement.getEnd(),
    });
  }

  return imports;
}

export function stripTopLevelImports(source: string): string {
  const imports = getTopLevelImportStatements(source);
  if (imports.length === 0) return source.trim();

  let cursor = 0;
  let output = '';
  for (const statement of imports) {
    output += source.slice(cursor, statement.start);
    cursor = statement.end;
  }
  output += source.slice(cursor);
  return output.trim();
}

function hasReactiveLabel(scriptBody: string): boolean {
  return /\$\s*:/.test(scriptBody);
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`';
      continue;
    }

    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === delimiter && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(input.slice(start));
  return parts;
}

function findTopLevelChar(input: string, target: string): number {
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`';
      continue;
    }

    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === target && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      return i;
    }
  }

  return -1;
}

function pushIdentifier(name: string, out: string[]) {
  if (!name) return;
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return;
  if (!out.includes(name)) out.push(name);
}

function findMatchingToken(input: string, openPos: number, openChar: string, closeChar: string): number {
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let i = openPos; i < input.length; i++) {
    const ch = input[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`';
      continue;
    }

    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractCloudflareEnvAliases(importLine: string): string[] {
  if (!/from\s+['"]cloudflare:workers['"]/.test(importLine)) return [];
  const namedMatch = importLine.match(/import\s*\{([\s\S]*?)\}\s*from\s+['"]cloudflare:workers['"]/);
  if (!namedMatch) return [];

  const aliases: string[] = [];
  for (const rawPart of splitTopLevel(namedMatch[1], ',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const envMatch = part.match(/^env(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
    if (envMatch) aliases.push(envMatch[1] || 'env');
  }
  return aliases;
}

function extractKuratchiEnvironmentDevAliases(importLine: string): string[] {
  if (!/from\s+['"]@kuratchi\/js\/environment['"]/.test(importLine)) return [];
  const namedMatch = importLine.match(/import\s*\{([\s\S]*?)\}\s*from\s+['"]@kuratchi\/js\/environment['"]/);
  if (!namedMatch) {
    throw new Error('[kuratchi compiler] @kuratchi/js/environment only supports named imports.');
  }

  const aliases: string[] = [];
  for (const rawPart of splitTopLevel(namedMatch[1], ',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const devMatch = part.match(/^dev(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
    if (!devMatch) {
      throw new Error('[kuratchi compiler] @kuratchi/js/environment currently only exports `dev`.');
    }
    aliases.push(devMatch[1] || 'dev');
  }
  return aliases;
}

function extractReturnObjectKeys(body: string): string[] {
  const keys: string[] = [];
  let i = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  while (i < body.length) {
    const ch = body[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`';
      i++;
      continue;
    }

    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);

    if (depthParen !== 0 || depthBracket !== 0 || depthBrace !== 0) {
      i++;
      continue;
    }

    const rest = body.slice(i);
    const returnMatch = /^return\b/.exec(rest);
    if (!returnMatch) {
      i++;
      continue;
    }

    i += returnMatch[0].length;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] !== '{') continue;

    const closeIdx = findMatchingToken(body, i, '{', '}');
    if (closeIdx === -1) break;

    const objectBody = body.slice(i + 1, closeIdx);
    for (const rawProp of splitTopLevel(objectBody, ',')) {
      const prop = rawProp.trim();
      if (!prop || prop.startsWith('...')) continue;
      const keyMatch = prop.match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
      if (keyMatch) pushIdentifier(keyMatch[1], keys);
    }
    break;
  }

  return keys;
}

function extractExplicitLoad(scriptBody: string): { loadFunction: string | null; remainingScript: string; returnVars: string[] } {
  let i = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  while (i < scriptBody.length) {
    const ch = scriptBody[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`';
      i++;
      continue;
    }

    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);

    if (depthParen !== 0 || depthBracket !== 0 || depthBrace !== 0) {
      i++;
      continue;
    }

    const rest = scriptBody.slice(i);
    const fnMatch = /^export\s+(async\s+)?function\s+load\s*/.exec(rest);
    if (!fnMatch) {
      i++;
      continue;
    }

    const openParen = i + fnMatch[0].length;
    if (scriptBody[openParen] !== '(') {
      throw new Error('[kuratchi compiler] Could not parse exported load() declaration.');
    }

    const closeParen = findMatchingToken(scriptBody, openParen, '(', ')');
    if (closeParen === -1) {
      throw new Error('[kuratchi compiler] Could not parse exported load() parameters.');
    }

    let openBrace = closeParen + 1;
    while (openBrace < scriptBody.length && /\s/.test(scriptBody[openBrace])) openBrace++;
    if (scriptBody[openBrace] !== '{') {
      throw new Error('[kuratchi compiler] export load() must use a function body.');
    }

    const closeBrace = findMatchingToken(scriptBody, openBrace, '{', '}');
    if (closeBrace === -1) {
      throw new Error('[kuratchi compiler] Could not parse exported load() body.');
    }

    return {
      loadFunction: scriptBody.slice(i, closeBrace + 1).trim(),
      remainingScript: `${scriptBody.slice(0, i)}\n${scriptBody.slice(closeBrace + 1)}`.trim(),
      returnVars: extractReturnObjectKeys(scriptBody.slice(openBrace + 1, closeBrace)),
    };
  }

  return { loadFunction: null, remainingScript: scriptBody.trim(), returnVars: [] };
}

function hasFrameworkEnvEscapeHatch(source: string): boolean {
  return /\bglobalThis\.__cloudflare_env__\b/.test(source) || /\b__cloudflare_env__\b/.test(source);
}

function buildEnvAccessError(
  kind: 'route' | 'layout' | 'component',
  filePath: string | undefined,
  detail: string,
): Error {
  const label = filePath || kind;
  const guidance =
    kind === 'route'
      ? 'Route top-level <script> is server-side. Client/reactive scripts cannot access Cloudflare env.'
      : kind === 'layout'
        ? 'Layout scripts cannot access Cloudflare env directly.'
        : 'Component scripts cannot access Cloudflare env directly.';
  return new Error(
    `[kuratchi compiler] ${label}\n${detail}\n${guidance}\nRead env on the server and pass the value into the template explicitly.`,
  );
}

function collectPatternNames(pattern: string, out: string[]) {
  const p = pattern.trim();
  if (!p) return;

  if (p.startsWith('{') && p.endsWith('}')) {
    const body = p.slice(1, -1);
    for (const partRaw of splitTopLevel(body, ',')) {
      let part = partRaw.trim();
      if (!part) continue;
      if (part.startsWith('...')) part = part.slice(3).trim();
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) part = part.slice(0, eqIdx).trim();
      const colonIdx = part.indexOf(':');
      if (colonIdx !== -1) {
        const rhs = part.slice(colonIdx + 1).trim();
        collectPatternNames(rhs, out);
      } else {
        pushIdentifier(part, out);
      }
    }
    return;
  }

  if (p.startsWith('[') && p.endsWith(']')) {
    const body = p.slice(1, -1);
    for (const partRaw of splitTopLevel(body, ',')) {
      let part = partRaw.trim();
      if (!part) continue;
      if (part.startsWith('...')) part = part.slice(3).trim();
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) part = part.slice(0, eqIdx).trim();
      collectPatternNames(part, out);
    }
    return;
  }

  const eqIdx = p.indexOf('=');
  const ident = (eqIdx === -1 ? p : p.slice(0, eqIdx)).trim();
  pushIdentifier(ident, out);
}

function isBoundaryChar(ch: string | undefined): boolean {
  if (!ch) return true;
  return !/[A-Za-z0-9_$]/.test(ch);
}

function extractTopLevelDataVars(scriptBody: string): string[] {
  const vars: string[] = [];
  let i = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < scriptBody.length) {
    const ch = scriptBody[i];
    const next = scriptBody[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`';
      i++;
      continue;
    }

    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);

    const atTopLevel = depthParen === 0 && depthBracket === 0 && depthBrace === 0;
    if (!atTopLevel) {
      i++;
      continue;
    }

    const remaining = scriptBody.slice(i);
    const match = /^(const|let|var)\b/.exec(remaining);
    if (!match) {
      i++;
      continue;
    }

    const keyword = match[1];
    const before = scriptBody[i - 1];
    const after = scriptBody[i + keyword.length];
    if (!isBoundaryChar(before) || !isBoundaryChar(after)) {
      i++;
      continue;
    }

    i += keyword.length;

    let declStart = i;
    let localParen = 0;
    let localBracket = 0;
    let localBrace = 0;
    let localQuote: '"' | "'" | '`' | null = null;
    let localEscaped = false;

    while (i < scriptBody.length) {
      const c = scriptBody[i];

      if (localQuote) {
        if (localEscaped) {
          localEscaped = false;
          i++;
          continue;
        }
        if (c === '\\') {
          localEscaped = true;
          i++;
          continue;
        }
        if (c === localQuote) localQuote = null;
        i++;
        continue;
      }

      if (c === '"' || c === "'" || c === '`') {
        localQuote = c as '"' | "'" | '`';
        i++;
        continue;
      }

      if (c === '(') localParen++;
      else if (c === ')') localParen = Math.max(0, localParen - 1);
      else if (c === '[') localBracket++;
      else if (c === ']') localBracket = Math.max(0, localBracket - 1);
      else if (c === '{') localBrace++;
      else if (c === '}') localBrace = Math.max(0, localBrace - 1);

      if (c === ';' && localParen === 0 && localBracket === 0 && localBrace === 0) {
        const decl = scriptBody.slice(declStart, i).trim();
        for (const item of splitTopLevel(decl, ',')) {
          const trimmed = item.trim();
          if (!trimmed) continue;
          const eqIdx = findTopLevelChar(trimmed, '=');
          const pattern = eqIdx === -1 ? trimmed : trimmed.slice(0, eqIdx).trim();
          collectPatternNames(pattern, vars);
        }
        i++;
        break;
      }

      i++;
    }

    // Semicolon-less declaration at EOF
    if (i >= scriptBody.length) {
      const decl = scriptBody.slice(declStart).trim();
      for (const item of splitTopLevel(decl, ',')) {
        const trimmed = item.trim();
        if (!trimmed) continue;
        const eqIdx = findTopLevelChar(trimmed, '=');
        const pattern = eqIdx === -1 ? trimmed : trimmed.slice(0, eqIdx).trim();
        collectPatternNames(pattern, vars);
      }
    }
  }

  return vars;
}

function extractTopLevelFunctionNames(scriptBody: string): string[] {
  const names: string[] = [];
  let i = 0;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < scriptBody.length) {
    const ch = scriptBody[i];
    const next = scriptBody[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        i++;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch as '"' | "'" | '`';
      i++;
      continue;
    }

    if (ch === '(') depthParen++;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket++;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace++;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);

    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      const rest = scriptBody.slice(i);
      const fnMatch = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(rest);
      if (fnMatch) {
        pushIdentifier(fnMatch[1], names);
        i += fnMatch[0].length;
        continue;
      }
    }

    i++;
  }

  return names;
}

/**
 * Parse a .html route file.
 *
 * The top-level compile-time <script> block is extracted for the compiler.
 * If it includes reactive `$:` labels, it is preserved in template output.
 * Everything else (the HTML document) becomes the template.
 */
export function parseFile(source: string, options: ParseFileOptions = {}): ParsedFile {
  const kind = options.kind || 'route';
  let script: string | null = null;
  let clientScript: string | null = null;
  let template = source;

  // Extract the first top-level compile-time <script>...</script> block.
  // Client blocks (reactive `$:` labels) stay in the template
  // and are emitted for browser execution.
  const scriptMatch = template.match(/^(\s*)<script(\s[^>]*)?\s*>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    const body = scriptMatch[3].trim();
    if (!hasReactiveLabel(body)) {
      script = body;
      template = template.slice(scriptMatch[0].length).trim();
    } else {
      clientScript = body;
    }
  }

  // Extract all imports from script
  const serverImports: string[] = [];
  const clientImports: string[] = [];
  const componentImports: Record<string, string> = {};
  const workerEnvAliases: string[] = [];
  const devAliases: string[] = [];
  if (script) {
    for (const statement of getTopLevelImportStatements(script)) {
      const line = statement.text.trim();
      // Check for component imports: import Name from '$lib/file.html' or '@kuratchi/ui/file.html'
      const libMatch = line.match(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\$lib\/([^'"]+\.html)['"]/s);
      const pkgMatch = !libMatch ? line.match(/import\s+([A-Za-z_$][\w$]*)\s+from\s+['"](@[^/'"]+\/[^/'"]+)\/([^'"]+\.html)['"]/s) : null;
      if (libMatch) {
        const componentName = libMatch[1]; // e.g. "StatCard"
        const fileName = libMatch[2].replace('.html', ''); // e.g. "stat-card"
        componentImports[componentName] = fileName;
      } else if (pkgMatch) {
        const componentName = pkgMatch[1]; // e.g. "Badge"
        const pkg = pkgMatch[2]; // e.g. "@kuratchi/ui"
        const fileName = pkgMatch[3].replace('.html', ''); // e.g. "badge"
        componentImports[componentName] = `${pkg}:${fileName}`; // e.g. "@kuratchi/ui:badge"
      } else {
        const devImportAliases = extractKuratchiEnvironmentDevAliases(line);
        if (devImportAliases.length > 0) {
          for (const alias of devImportAliases) {
            if (!devAliases.includes(alias)) devAliases.push(alias);
          }
          continue;
        }
        serverImports.push(line);
      }
      for (const alias of extractCloudflareEnvAliases(line)) {
        if (!workerEnvAliases.includes(alias)) workerEnvAliases.push(alias);
      }
    }
  }
  if (clientScript) {
    for (const statement of getTopLevelImportStatements(clientScript)) {
      const line = statement.text.trim();
      clientImports.push(line);
      if (extractKuratchiEnvironmentDevAliases(line).length > 0) {
        throw new Error(
          `[kuratchi compiler] ${options.filePath || kind}\nClient <script> blocks cannot import from @kuratchi/js/environment.\nUse route server script code and pass values into the template explicitly.`,
        );
      }
      if (extractCloudflareEnvAliases(line).length > 0) {
        throw buildEnvAccessError(
          kind,
          options.filePath,
          'Client <script> blocks cannot import env from cloudflare:workers.',
        );
      }
    }
    if (hasFrameworkEnvEscapeHatch(clientScript)) {
      throw buildEnvAccessError(
        kind,
        options.filePath,
        'Client <script> blocks cannot access framework env internals.',
      );
    }
  }

  // Extract top-level variable declarations from script body (after removing imports)
  const dataVars: string[] = [];
  const loadReturnVars: string[] = [];
  let scriptBody = '';
  let loadFunction: string | null = null;
  if (script) {
    const rawScriptBody = stripTopLevelImports(script);
    const explicitLoad = extractExplicitLoad(rawScriptBody);
    scriptBody = explicitLoad.remainingScript;
    loadFunction = explicitLoad.loadFunction;
    for (const name of explicitLoad.returnVars) {
      if (!loadReturnVars.includes(name)) loadReturnVars.push(name);
    }

    if (hasFrameworkEnvEscapeHatch(rawScriptBody)) {
      throw buildEnvAccessError(
        kind,
        options.filePath,
        'Route/component scripts cannot access framework env internals.',
      );
    }

    if (workerEnvAliases.length > 0 && kind !== 'route') {
      throw buildEnvAccessError(
        kind,
        options.filePath,
        `Imported env from cloudflare:workers in a ${kind} script.`,
      );
    }

    const transpiledScriptBody = transpileTypeScript(scriptBody, 'route-script.ts');
    const topLevelVars = extractTopLevelDataVars(transpiledScriptBody);
    for (const v of topLevelVars) dataVars.push(v);
    const topLevelFns = extractTopLevelFunctionNames(transpiledScriptBody);
    for (const fn of topLevelFns) {
      if (!dataVars.includes(fn)) dataVars.push(fn);
    }
    for (const name of loadReturnVars) {
      if (!dataVars.includes(name)) dataVars.push(name);
    }

    // Server import named bindings are also data vars (available in templates)
    for (const line of serverImports) {
      const namesMatch = line.match(/import\s*\{([^}]+)\}/);
      if (!namesMatch) continue;
      for (const part of namesMatch[1].split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const segments = trimmed.split(/\s+as\s+/);
        const localName = (segments[1] || segments[0]).trim();
        if (localName && !dataVars.includes(localName)) dataVars.push(localName);
      }
    }
  }

  const hasLoad = scriptBody.length > 0 || !!loadFunction;

  // Strip HTML comments from the template before scanning for action references.
  // This prevents commented-out code (<!-- ... -->) from being parsed as live
  // action expressions, which would cause false "Invalid action expression" errors.
  const templateWithoutComments = template.replace(/<!--[\s\S]*?-->/g, '');

  // Extract action functions referenced in template: action={fnName}
  const actionFunctions: string[] = [];
  const actionRegex = /action=\{(\w+)\}/g;
  let am;
  while ((am = actionRegex.exec(templateWithoutComments)) !== null) {
    if (!actionFunctions.includes(am[1])) {
      actionFunctions.push(am[1]);
    }
  }
  // Also collect onX={fnName(...)} candidates (e.g. onclick, onClick, onChange)
  // — the compiler will filter these against actual imports to determine server actions.
  const eventActionRegex = /on[A-Za-z]+\s*=\{(\w+)\s*\(/g;
  let em;
  while ((em = eventActionRegex.exec(templateWithoutComments)) !== null) {
    if (!actionFunctions.includes(em[1])) {
      actionFunctions.push(em[1]);
    }
  }
  // Collect method-style action attributes: data-post/data-put/data-patch/data-delete
  const methodActionRegex = /data-(?:post|put|patch|delete)\s*=\{(\w+)\s*\(/g;
  let mm;
  while ((mm = methodActionRegex.exec(templateWithoutComments)) !== null) {
    if (!actionFunctions.includes(mm[1])) {
      actionFunctions.push(mm[1]);
    }
  }

  // Extract poll functions referenced in template: data-poll={fnName(args)}
  const pollFunctions: string[] = [];
  const pollRegex = /data-poll=\{(\w+)\s*\(/g;
  let pm;
  while ((pm = pollRegex.exec(templateWithoutComments)) !== null) {
    if (!pollFunctions.includes(pm[1])) {
      pollFunctions.push(pm[1]);
    }
  }

  // Extract query blocks: tags that include both data-get={fn(args)} and data-as=...
  const dataGetQueries: Array<{ fnName: string; argsExpr: string; asName: string; key?: string }> = [];
  const tagRegex = /<[^>]+>/g;
  let tm;
  while ((tm = tagRegex.exec(templateWithoutComments)) !== null) {
    const tag = tm[0];
    const getMatch = tag.match(/\bdata-get=\{([\s\S]*?)\}/);
    if (!getMatch) continue;
    const call = getMatch[1].trim();
    const callMatch = call.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
    if (!callMatch) continue;
    const fnName = callMatch[1];
    const argsExpr = (callMatch[2] || '').trim();

    const asMatch =
      tag.match(/\bdata-as="([A-Za-z_$][\w$]*)"/) ||
      tag.match(/\bdata-as='([A-Za-z_$][\w$]*)'/) ||
      tag.match(/\bdata-as=\{([A-Za-z_$][\w$]*)\}/);
    if (!asMatch) continue;
    const asName = asMatch[1];

    const keyMatch =
      tag.match(/\bdata-key="([^"]+)"/) ||
      tag.match(/\bdata-key='([^']+)'/) ||
      tag.match(/\bdata-key=\{([^}]+)\}/);
    const key = keyMatch?.[1]?.trim() || asName;

    if (!pollFunctions.includes(fnName)) pollFunctions.push(fnName);
    if (!dataVars.includes(asName)) dataVars.push(asName);

    const exists = dataGetQueries.some((q) => q.asName === asName);
    if (!exists) dataGetQueries.push({ fnName, argsExpr, asName, key });
  }

  return {
    script,
    loadFunction,
    template,
    serverImports,
    hasLoad,
    actionFunctions,
    dataVars,
    componentImports,
    pollFunctions,
    dataGetQueries,
    clientImports,
    loadReturnVars,
    workerEnvAliases,
    devAliases,
  };
}

import { transpileTypeScript } from './transpile.js';

