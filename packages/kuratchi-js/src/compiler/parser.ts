import ts from 'typescript';
import { collectReferencedIdentifiers, parseNamedImportBindings } from './import-linking.js';

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
  dataGetQueries: Array<{ fnName: string; argsExpr: string; asName: string; key?: string; rpcId?: string; awaitExpr?: string }>;
  /** Imports found in a top-level client script block */
  clientImports: string[];
  /** Top-level route/layout imports from $lib/* */
  routeClientImports: string[];
  /** Local binding names introduced by top-level $lib/* imports */
  routeClientImportBindings: string[];
  /** Top-level names returned from explicit load() */
  loadReturnVars: string[];
  /** Local aliases for Cloudflare Workers env imported from cloudflare:workers */
  workerEnvAliases: string[];
  /** Local aliases for dev imported from @kuratchi/js/environment */
  devAliases: string[];
  
  // === New fields for RFC 0002: Client-First Script Model ===
  /** Raw client script content (the entire <script> block body) */
  clientScriptRaw: string | null;
  /** Imports from $server/ - these become RPC calls */
  serverRpcImports: string[];
  /** Function names imported from $server/ */
  serverRpcFunctions: string[];
  /** Top-level await calls to $server/ functions - executed at SSR time */
  ssrAwaitCalls: Array<{ varName: string; fnName: string; argsExpr: string }>;
  /** npm package imports in client script - bundled with esbuild */
  clientNpmImports: string[];
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

const TEMPLATE_JS_CONTROL_PATTERNS = [
  /^\s*for\s*\(/,
  /^\s*if\s*\(/,
  /^\s*switch\s*\(/,
  /^\s*case\s+.+:\s*$/,
  /^\s*default\s*:\s*$/,
  /^\s*break\s*;\s*$/,
  /^\s*continue\s*;\s*$/,
  /^\s*\}\s*else\s*if\s*\(/,
  /^\s*\}\s*else\s*\{?\s*$/,
  /^\s*\}\s*$/,
  /^\s*\w[\w.]*\s*(\+\+|--)\s*;\s*$/,
  /^\s*(let|const|var)\s+/,
];

function isTemplateJsControlLine(line: string): boolean {
  return TEMPLATE_JS_CONTROL_PATTERNS.some((pattern) => pattern.test(line));
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

interface TemplateTag {
  name: string;
  attrs: Map<string, string>;
  closing: boolean;
}

function findTemplateTagEnd(source: string, start: number): number {
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let braceDepth = 0;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
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
    if (ch === '{') {
      braceDepth++;
      continue;
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (ch === '>' && braceDepth === 0) return i;
  }

  return -1;
}

function parseTemplateTagAttributes(source: string): Map<string, string> {
  const attrs = new Map<string, string>();
  let i = 0;

  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (i >= source.length) break;

    const nameStart = i;
    while (i < source.length && /[^\s=/>]/.test(source[i])) i++;
    const name = source.slice(nameStart, i);
    if (!name) break;

    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] !== '=') {
      attrs.set(name, '');
      continue;
    }

    i++;
    while (i < source.length && /\s/.test(source[i])) i++;
    if (i >= source.length) {
      attrs.set(name, '');
      break;
    }

    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i];
      const valueStart = i;
      i++;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      attrs.set(name, source.slice(valueStart, i));
      continue;
    }

    if (source[i] === '{') {
      const valueStart = i;
      const closeIdx = findMatchingToken(source, i, '{', '}');
      if (closeIdx === -1) {
        attrs.set(name, source.slice(valueStart));
        break;
      }
      i = closeIdx + 1;
      attrs.set(name, source.slice(valueStart, i));
      continue;
    }

    const valueStart = i;
    while (i < source.length && /[^\s>]/.test(source[i])) i++;
    attrs.set(name, source.slice(valueStart, i));
  }

  return attrs;
}

function tokenizeTemplateTags(template: string): TemplateTag[] {
  const tags: TemplateTag[] = [];
  let cursor = 0;

  while (cursor < template.length) {
    const lt = template.indexOf('<', cursor);
    if (lt === -1) break;

    if (template.startsWith('<!--', lt)) {
      const commentEnd = template.indexOf('-->', lt + 4);
      if (commentEnd === -1) break;
      cursor = commentEnd + 3;
      continue;
    }

    const tagEnd = findTemplateTagEnd(template, lt + 1);
    if (tagEnd === -1) break;
    const raw = template.slice(lt + 1, tagEnd).trim();
    cursor = tagEnd + 1;
    if (!raw || raw.startsWith('!')) continue;

    const closing = raw.startsWith('/');
    const normalized = closing ? raw.slice(1).trim() : raw;
    const nameMatch = normalized.match(/^([A-Za-z][\w:-]*)/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const attrSource = normalized.slice(name.length).replace(/\/\s*$/, '').trim();
    tags.push({
      name,
      attrs: closing ? new Map() : parseTemplateTagAttributes(attrSource),
      closing,
    });
  }

  return tags;
}

function extractBracedAttributeExpression(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  return trimmed.slice(1, -1).trim();
}

function extractAttributeText(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  const braced = extractBracedAttributeExpression(trimmed);
  if (braced && /^[A-Za-z_$][\w$]*$/.test(braced)) return braced;
  return trimmed || null;
}

function extractCallExpression(value: string | undefined): { fnName: string; argsExpr: string } | null {
  const expr = extractBracedAttributeExpression(value);
  if (!expr) return null;
  const match = expr.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
  if (!match) return null;
  return { fnName: match[1], argsExpr: (match[2] || '').trim() };
}

function extractAwaitCallExpression(expr: string): { fnName: string; argsExpr: string } | null {
  const match = expr.trim().match(/^await\s+([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
  if (!match) return null;
  return { fnName: match[1], argsExpr: (match[2] || '').trim() };
}

function collectAwaitTemplateQueries(template: string): Array<{ fnName: string; argsExpr: string; asName: string; awaitExpr: string }> {
  const source = template.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const queries: Array<{ fnName: string; argsExpr: string; asName: string; awaitExpr: string }> = [];
  const seen = new Map<string, string>();

  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '{') continue;
    const closeIdx = findMatchingToken(source, i, '{', '}');
    if (closeIdx === -1) continue;
    const inner = source.slice(i + 1, closeIdx).trim();
    const call = extractAwaitCallExpression(inner);
    if (call) {
      const awaitExpr = `${call.fnName}(${call.argsExpr})`;
      if (!seen.has(awaitExpr)) {
        const asName = `__await_query_${queries.length}`;
        seen.set(awaitExpr, asName);
        queries.push({ fnName: call.fnName, argsExpr: call.argsExpr, asName, awaitExpr });
      }
    }
    i = closeIdx;
  }

  return queries;
}

function extractTopLevelImportNames(source: string): string[] {
  const sourceFile = ts.createSourceFile('kuratchi-inline-client.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) pushIdentifier(clause.name.text, names);
    if (!clause.namedBindings) continue;
    if (ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        pushIdentifier(element.name.text, names);
      }
    } else if (ts.isNamespaceImport(clause.namedBindings)) {
      pushIdentifier(clause.namedBindings.name.text, names);
    }
  }

  return names;
}

function extractImportModuleSpecifier(source: string): string | null {
  const sourceFile = ts.createSourceFile('kuratchi-import-spec.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statement = sourceFile.statements.find(ts.isImportDeclaration);
  if (!statement || !ts.isStringLiteral(statement.moduleSpecifier)) return null;
  return statement.moduleSpecifier.text;
}

function isExecutableTemplateScript(attrs: string): boolean {
  if (/\bsrc\s*=/i.test(attrs)) return false;
  const typeMatch = attrs.match(/\btype\s*=\s*(['"])(.*?)\1/i);
  const type = typeMatch?.[2]?.trim().toLowerCase();
  if (!type) return true;
  return type === 'module' || type === 'text/javascript' || type === 'application/javascript';
}

function collectTemplateClientDeclaredNames(template: string): string[] {
  const declared = new Set<string>();
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(template)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    if (!isExecutableTemplateScript(attrs)) continue;
    // TypeScript source works directly for reference collection
    for (const name of extractTopLevelImportNames(body)) declared.add(name);
    for (const name of extractTopLevelDataVars(body)) declared.add(name);
    for (const name of extractTopLevelFunctionNames(body)) declared.add(name);
  }

  return Array.from(declared);
}

function stripLeadingTopLevelScriptBlock(template: string): string {
  return template.replace(/^(\s*)<script(\s[^>]*)?\s*>[\s\S]*?<\/script>\s*/i, '');
}

function stripTemplateRawBlocks(template: string): string {
  return template
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

function extractBraceExpressions(line: string): Array<{ expression: string; attrName: string | null }> {
  const expressions: Array<{ expression: string; attrName: string | null }> = [];
  let cursor = 0;

  while (cursor < line.length) {
    const openIdx = line.indexOf('{', cursor);
    if (openIdx === -1) break;
    const closeIdx = findMatchingToken(line, openIdx, '{', '}');
    if (closeIdx === -1) break;

    const expression = line.slice(openIdx + 1, closeIdx).trim();
    const beforeBrace = line.slice(0, openIdx);
    const charBefore = openIdx > 0 ? line[openIdx - 1] : '';
    let attrName: string | null = null;
    if (charBefore === '=') {
      const attrMatch = beforeBrace.match(/([\w-]+)=$/);
      attrName = attrMatch ? attrMatch[1] : null;
    }

    expressions.push({ expression, attrName });
    cursor = closeIdx + 1;
  }

  return expressions;
}

function collectServerTemplateReferences(template: string): Set<string> {
  const refs = new Set<string>();
  const stripped = stripTemplateRawBlocks(template);
  const lines = stripped.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isTemplateJsControlLine(trimmed)) {
      for (const ref of collectReferencedIdentifiers(trimmed)) refs.add(ref);
    }

    for (const entry of extractBraceExpressions(line)) {
      if (!entry.expression) continue;
      if (entry.attrName && /^on[A-Za-z]+$/i.test(entry.attrName)) continue;
      for (const ref of collectReferencedIdentifiers(entry.expression)) refs.add(ref);
    }
  }

  return refs;
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

// === RFC 0002: Client-First Script Model Helpers ===

/**
 * Check if an import is from $server/
 */
function isServerRpcImport(moduleSpecifier: string | null): boolean {
  return moduleSpecifier?.startsWith('$server/') ?? false;
}

/**
 * Extract function names from a $server/ import statement
 */
function extractServerRpcFunctionNames(importLine: string): string[] {
  const names: string[] = [];
  const sourceFile = ts.createSourceFile('kuratchi-rpc-import.ts', importLine, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    
    // Default import
    if (clause.name) {
      names.push(clause.name.text);
    }
    
    // Named imports: import { fn1, fn2 } from '$server/...'
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        names.push(element.name.text);
      }
    }
    
    // Namespace import: import * as server from '$server/...'
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      names.push(clause.namedBindings.name.text);
    }
  }
  
  return names;
}

/**
 * Extract top-level await calls to specific function names.
 * Returns: { varName: 'messages', fnName: 'getMessages', argsExpr: 'params.id' }
 */
function extractTopLevelAwaitCalls(scriptBody: string, targetFunctions: Set<string>): Array<{ varName: string; fnName: string; argsExpr: string }> {
  const calls: Array<{ varName: string; fnName: string; argsExpr: string }> = [];
  const sourceFile = ts.createSourceFile('kuratchi-await-calls.ts', scriptBody, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  
  for (const statement of sourceFile.statements) {
    // Look for: const varName = await fnName(args);
    if (!ts.isVariableStatement(statement)) continue;
    
    for (const decl of statement.declarationList.declarations) {
      if (!decl.initializer) continue;
      if (!ts.isIdentifier(decl.name)) continue;
      
      const varName = decl.name.text;
      let awaitExpr = decl.initializer;
      
      // Unwrap await expression
      if (ts.isAwaitExpression(awaitExpr)) {
        awaitExpr = awaitExpr.expression;
      } else {
        continue; // Not an await call
      }
      
      // Check if it's a call expression
      if (!ts.isCallExpression(awaitExpr)) continue;
      
      // Get the function name
      let fnName: string | null = null;
      if (ts.isIdentifier(awaitExpr.expression)) {
        fnName = awaitExpr.expression.text;
      } else if (ts.isPropertyAccessExpression(awaitExpr.expression)) {
        // Handle namespace.fn() calls
        fnName = awaitExpr.expression.getText(sourceFile);
      }
      
      if (!fnName || !targetFunctions.has(fnName.split('.')[0])) continue;
      
      // Extract arguments as string
      const argsExpr = awaitExpr.arguments
        .map(arg => arg.getText(sourceFile))
        .join(', ');
      
      calls.push({ varName, fnName, argsExpr });
    }
  }
  
  return calls;
}

/**
 * Check if a module specifier is an npm package (not a relative/alias import)
 */
function isNpmPackageImport(moduleSpecifier: string | null): boolean {
  if (!moduleSpecifier) return false;
  // Not npm if starts with . / $ or is a kuratchi: virtual module
  if (moduleSpecifier.startsWith('.')) return false;
  if (moduleSpecifier.startsWith('/')) return false;
  if (moduleSpecifier.startsWith('$')) return false;
  if (moduleSpecifier.startsWith('kuratchi:')) return false;
  if (moduleSpecifier.startsWith('cloudflare:')) return false;
  // Looks like an npm package
  return true;
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
  const routeClientImports: string[] = [];
  const routeClientImportBindings: string[] = [];
  const componentImports: Record<string, string> = {};
  const workerEnvAliases: string[] = [];
  const devAliases: string[] = [];
  if (script) {
    for (const statement of getTopLevelImportStatements(script)) {
      const line = statement.text.trim();
      const moduleSpecifier = extractImportModuleSpecifier(line);
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
        // $lib/ imports are isomorphic - they work in both server and client contexts
        // Add to serverImports so they're available in templates, and also track for client bundling
        if (moduleSpecifier?.startsWith('$lib/')) {
          routeClientImports.push(line);
          // Don't add to routeClientImportBindings - $lib/ bindings ARE allowed in server templates
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

    // TypeScript source works directly for reference collection
    const serverScriptRefs = new Set<string>(collectReferencedIdentifiers(scriptBody));
    if (loadFunction) {
      for (const ref of collectReferencedIdentifiers(loadFunction)) serverScriptRefs.add(ref);
    }
    const leakedClientScriptBindings = routeClientImportBindings.filter((name) => serverScriptRefs.has(name));
    if (leakedClientScriptBindings.length > 0) {
      throw new Error(
        `[kuratchi compiler] ${options.filePath || kind}\n` +
        `Top-level $lib imports cannot be used in server route code: ${leakedClientScriptBindings.join(', ')}.\n` +
        `Move this usage to a client event handler or inline client script.`,
      );
    }
    const topLevelVars = extractTopLevelDataVars(scriptBody);
    for (const v of topLevelVars) dataVars.push(v);
    const topLevelFns = extractTopLevelFunctionNames(scriptBody);
    for (const fn of topLevelFns) {
      if (!dataVars.includes(fn)) dataVars.push(fn);
    }
    for (const name of loadReturnVars) {
      if (!dataVars.includes(name)) dataVars.push(name);
    }

    // Server import named bindings are also data vars (available in templates)
    for (const line of serverImports) {
      for (const binding of parseNamedImportBindings(line)) {
        const localName = binding.local.trim();
        if (localName && !dataVars.includes(localName)) dataVars.push(localName);
      }
    }
  }

  const hasLoad = scriptBody.length > 0 || !!loadFunction;

  // Strip HTML comments from the template before scanning for action references.
  // This prevents commented-out code (<!-- ... -->) from being parsed as live
  // action expressions, which would cause false "Invalid action expression" errors.
  const templateWithoutComments = template.replace(/<!--[\s\S]*?-->/g, '');
  const templateTags = tokenizeTemplateTags(templateWithoutComments);
  const actionFunctions: string[] = [];
  const pollFunctions: string[] = [];
  const dataGetQueries: Array<{ fnName: string; argsExpr: string; asName: string; key?: string; awaitExpr?: string }> = [];
  let warnedLegacyActionAttrs = false;

  for (const tag of templateTags) {
    if (tag.closing) continue;

    const actionExpr = extractBracedAttributeExpression(tag.attrs.get('action'));
    if (actionExpr && /^[A-Za-z_$][\w$]*$/.test(actionExpr) && !actionFunctions.includes(actionExpr)) {
      actionFunctions.push(actionExpr);
    }

    for (const [attrName, attrValue] of tag.attrs.entries()) {
      if (!warnedLegacyActionAttrs && (attrName === 'data-action' || attrName === 'data-args')) {
        warnedLegacyActionAttrs = true;
        console.warn(
          `[kuratchi] ${options.filePath || kind}: authored data-action/data-args are deprecated. ` +
          `Use data-post={fn(...)} or action={fn} instead.`,
        );
      }
      if (/^on[A-Za-z]+$/i.test(attrName)) {
        const actionCall = extractCallExpression(attrValue);
        if (actionCall && !actionFunctions.includes(actionCall.fnName)) actionFunctions.push(actionCall.fnName);
      }
      if (/^data-(post|put|patch|delete)$/.test(attrName)) {
        const methodCall = extractCallExpression(attrValue);
        if (methodCall && !actionFunctions.includes(methodCall.fnName)) actionFunctions.push(methodCall.fnName);
      }
    }

    const pollCall = extractCallExpression(tag.attrs.get('data-poll'));
    if (pollCall && !pollFunctions.includes(pollCall.fnName)) {
      pollFunctions.push(pollCall.fnName);
    }

    const getCall = extractCallExpression(tag.attrs.get('data-get'));
    const asName = extractAttributeText(tag.attrs.get('data-as'));
    if (!getCall || !asName || !/^[A-Za-z_$][\w$]*$/.test(asName)) continue;

    const key = (extractAttributeText(tag.attrs.get('data-key')) || asName).trim();

    if (!pollFunctions.includes(getCall.fnName)) pollFunctions.push(getCall.fnName);
    if (!dataVars.includes(asName)) dataVars.push(asName);

    const exists = dataGetQueries.some((q) => q.asName === asName);
    if (!exists) dataGetQueries.push({ fnName: getCall.fnName, argsExpr: getCall.argsExpr, asName, key });
  }

  for (const awaitQuery of collectAwaitTemplateQueries(templateWithoutComments)) {
    if (!pollFunctions.includes(awaitQuery.fnName)) pollFunctions.push(awaitQuery.fnName);
    if (!dataVars.includes(awaitQuery.asName)) dataVars.push(awaitQuery.asName);
    const exists = dataGetQueries.some((query) => query.awaitExpr === awaitQuery.awaitExpr);
    if (!exists) {
      dataGetQueries.push({
        fnName: awaitQuery.fnName,
        argsExpr: awaitQuery.argsExpr,
        asName: awaitQuery.asName,
        key: awaitQuery.asName,
        awaitExpr: awaitQuery.awaitExpr,
      });
    }
  }

  for (const clientBinding of routeClientImportBindings) {
    const idx = actionFunctions.indexOf(clientBinding);
    if (idx !== -1) actionFunctions.splice(idx, 1);
  }

  const templateTemplateScriptSource = clientScript ? stripLeadingTopLevelScriptBlock(template) : template;
  const templateClientDeclaredNames = collectTemplateClientDeclaredNames(templateTemplateScriptSource);
  const serverTemplateRefs = collectServerTemplateReferences(template);
  const leakedRouteClientTemplateBindings = routeClientImportBindings.filter((name) => serverTemplateRefs.has(name));
  if (leakedRouteClientTemplateBindings.length > 0) {
    throw new Error(
      `[kuratchi compiler] ${options.filePath || kind}\n` +
      `Top-level $lib imports cannot be used in server-rendered template output: ${leakedRouteClientTemplateBindings.join(', ')}.\n` +
      `Move this usage into a client event handler or inline client script.`,
    );
  }
  if (templateClientDeclaredNames.length > 0) {
    const leakedNames = templateClientDeclaredNames.filter((name) => serverTemplateRefs.has(name));
    if (leakedNames.length > 0) {
      throw new Error(
        `[kuratchi compiler] ${options.filePath || kind}\n` +
        `Client template <script> bindings cannot be used in server-rendered template output: ${leakedNames.join(', ')}.\n` +
        `Move shared/pure helpers into the top route <script> or a $lib module.`,
      );
    }
  }

  /*
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
  */

  // === RFC 0002: Parse client-first script model ===
  // RFC 0002 only applies to CLIENT scripts (those with reactive $: labels).
  // In the current model:
  // - Script without $: = server-side code, $server/ imports are regular imports
  // - Script with $: = client-side code, $server/ imports become RPC calls
  //
  // We only populate RFC 0002 fields for client scripts that have $server/ imports.
  
  let clientScriptRaw: string | null = null;
  const serverRpcImports: string[] = [];
  const serverRpcFunctions: string[] = [];
  let ssrAwaitCalls: Array<{ varName: string; fnName: string; argsExpr: string }> = [];
  const clientNpmImports: string[] = [];
  
  // Only process RFC 0002 for client scripts (those with reactive $: labels)
  // clientScript is set earlier in parseFile when the script has reactive labels
  if (clientScript) {
    clientScriptRaw = clientScript;
    
    // Parse imports from the client script
    for (const statement of getTopLevelImportStatements(clientScript)) {
      const line = statement.text.trim();
      const moduleSpecifier = extractImportModuleSpecifier(line);
      
      // Detect $server/ imports - these become RPC in client scripts
      if (isServerRpcImport(moduleSpecifier)) {
        serverRpcImports.push(line);
        const fnNames = extractServerRpcFunctionNames(line);
        for (const fn of fnNames) {
          if (!serverRpcFunctions.includes(fn)) {
            serverRpcFunctions.push(fn);
          }
        }
      }
      // Detect npm package imports - these get bundled
      else if (isNpmPackageImport(moduleSpecifier)) {
        clientNpmImports.push(line);
      }
    }
    
    // Find top-level await calls to $server/ functions
    // These execute at SSR time and their results are available to the template
    if (serverRpcFunctions.length > 0) {
      const rpcFunctionSet = new Set(serverRpcFunctions);
      const scriptBodyWithoutImports = stripTopLevelImports(clientScript);
      ssrAwaitCalls = extractTopLevelAwaitCalls(scriptBodyWithoutImports, rpcFunctionSet);
      
      // Add SSR await result variables to dataVars so they're available in template
      for (const call of ssrAwaitCalls) {
        if (!dataVars.includes(call.varName)) {
          dataVars.push(call.varName);
        }
      }
    }
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
    routeClientImports,
    routeClientImportBindings,
    loadReturnVars,
    workerEnvAliases,
    devAliases,
    // RFC 0002 fields
    clientScriptRaw,
    serverRpcImports,
    serverRpcFunctions,
    ssrAwaitCalls,
    clientNpmImports,
  };
}

// TypeScript transpilation removed — wrangler's esbuild handles it
