/**
 * Template compiler â€” native JS flow control in HTML.
 *
 * Syntax:
 *   {expression}                â†’ escaped output
 *   {@html expression}          â†’ sanitized HTML output
 *   {@raw expression}           â†’ raw HTML output (unescaped)
 *   {=html expression}          â†’ legacy alias for {@raw expression}
 *   for (const x of arr) {     â†’ JS for loop (inline in HTML)
 *     <li>{x.name}</li>
 *   }
 *   if (condition) {            â†’ JS if block
 *     <p>yes</p>
 *   } else {
 *     <p>no</p>
 *   }
 *
 * The compiler scans line-by-line:
 *   - Lines that are pure JS control flow (for/if/else/}) â†’ emitted as JS
 *   - Everything else â†’ emitted as HTML string with {expr} interpolation
 */

// Patterns that identify a line as JS control flow (trimmed)
const JS_CONTROL_PATTERNS = [
  /^\s*for\s*\(/, // for (...)
  /^\s*if\s*\(/,  // if (...)
  /^\s*switch\s*\(/, // switch (...)
  /^\s*case\s+.+:\s*$/, // case ...:
  /^\s*default\s*:\s*$/, // default:
  /^\s*break\s*;\s*$/, // break;
  /^\s*continue\s*;\s*$/, // continue;
  /^\s*\}\s*else\s*if\s*\(/, // } else if (...)
  /^\s*\}\s*else\s*\{?\s*$/, // } else {  or  } else
  /^\s*\}\s*$/,   // }
  /^\s*\w[\w.]*\s*(\+\+|--)\s*;\s*$/, // varName++;  varName--;
  /^\s*(let|const|var)\s+/, // let x = ...; const y = ...;
];

function isJsControlLine(line: string): boolean {
  return JS_CONTROL_PATTERNS.some(p => p.test(line));
}

/** HTML boolean attributes that should be present or absent, never have a value */
const BOOLEAN_ATTRIBUTES = new Set([
  'disabled',
  'checked',
  'selected',
  'readonly',
  'required',
  'hidden',
  'open',
  'autofocus',
  'autoplay',
  'controls',
  'default',
  'defer',
  'formnovalidate',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'playsinline',
  'reversed',
  'async',
]);

function isBooleanAttribute(name: string): boolean {
  return BOOLEAN_ATTRIBUTES.has(name.toLowerCase());
}

export interface TemplateRenderSections {
  bodyTemplate: string;
  headTemplate: string;
}

export interface CompileTemplateOptions {
  emitCall?: string;
  enableFragmentManifest?: boolean;
  appendNewline?: boolean;
  clientRouteRegistry?: ClientRouteRegistry;
  awaitQueryBindings?: Map<string, { asName: string; rpcId: string }>;
  /** Directory of the importing file, used for rewriting $lib/ imports */
  importerDir?: string;
}

const FRAGMENT_OPEN_MARKER = '<!--__KURATCHI_FRAGMENT_OPEN:';
const FRAGMENT_CLOSE_MARKER = '<!--__KURATCHI_FRAGMENT_CLOSE-->';

export function splitTemplateRenderSections(template: string): TemplateRenderSections {
  const bodyLines: string[] = [];
  const headLines: string[] = [];
  const lines = template.split('\n');
  let inHead = false;
  let inStyle = false;
  let inScript = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const opensStyle = /<style[\s>]/i.test(trimmed);
    const closesStyle = /<\/style>/i.test(trimmed);
    const opensScript = /<script[\s>]/i.test(trimmed);
    const closesScript = /<\/script>/i.test(trimmed);
    const inRawBlock = inStyle || inScript || opensStyle || opensScript;

    if (inRawBlock) {
      let remaining = line;
      let bodyLine = '';
      let headLine = '';

      while (remaining.length > 0) {
        if (!inHead) {
          const openMatch = remaining.match(/<head(?:\s[^>]*)?>/i);
          if (!openMatch || openMatch.index === undefined) {
            bodyLine += remaining;
            break;
          }

          bodyLine += remaining.slice(0, openMatch.index);
          remaining = remaining.slice(openMatch.index + openMatch[0].length);

          const closeMatch = remaining.match(/<\/head>/i);
          if (!closeMatch || closeMatch.index === undefined) {
            headLine += remaining;
            remaining = '';
            inHead = true;
            break;
          }

          headLine += remaining.slice(0, closeMatch.index);
          remaining = remaining.slice(closeMatch.index + closeMatch[0].length);
        } else {
          const closeMatch = remaining.match(/<\/head>/i);
          if (!closeMatch || closeMatch.index === undefined) {
            headLine += remaining;
            remaining = '';
            break;
          }

          headLine += remaining.slice(0, closeMatch.index);
          remaining = remaining.slice(closeMatch.index + closeMatch[0].length);
          inHead = false;
        }
      }

      bodyLines.push(bodyLine);
      headLines.push(headLine);

      if (opensStyle && !closesStyle) inStyle = true;
      if (closesStyle) inStyle = false;
      if (opensScript && !closesScript) inScript = true;
      if (closesScript) inScript = false;
      continue;
    }

    if (isJsControlLine(trimmed) && !/<\/?head(?:\s|>)/i.test(line)) {
      bodyLines.push(line);
      headLines.push(line);
      continue;
    }

    let remaining = line;
    let bodyLine = '';
    let headLine = '';

    while (remaining.length > 0) {
      if (!inHead) {
        const openMatch = remaining.match(/<head(?:\s[^>]*)?>/i);
        if (!openMatch || openMatch.index === undefined) {
          bodyLine += remaining;
          break;
        }

        bodyLine += remaining.slice(0, openMatch.index);
        remaining = remaining.slice(openMatch.index + openMatch[0].length);

        const closeMatch = remaining.match(/<\/head>/i);
        if (!closeMatch || closeMatch.index === undefined) {
          headLine += remaining;
          remaining = '';
          inHead = true;
          break;
        }

        headLine += remaining.slice(0, closeMatch.index);
        remaining = remaining.slice(closeMatch.index + closeMatch[0].length);
      } else {
        const closeMatch = remaining.match(/<\/head>/i);
        if (!closeMatch || closeMatch.index === undefined) {
          headLine += remaining;
          remaining = '';
          break;
        }

        headLine += remaining.slice(0, closeMatch.index);
        remaining = remaining.slice(closeMatch.index + closeMatch[0].length);
        inHead = false;
      }
    }

    bodyLines.push(bodyLine);
    headLines.push(headLine);
  }

  return {
    bodyTemplate: bodyLines.join('\n'),
    headTemplate: headLines.join('\n'),
  };
}

function buildAppendStatement(expression: string, emitCall?: string): string {
  // When emitCall is provided, use it (e.g., __emit(expr))
  // Otherwise, use array push for O(n) performance
  return emitCall ? `${emitCall}(${expression});` : `__parts.push(${expression});`;
}

function buildPollFragmentExpr(inner: string, rpcNameMap?: Map<string, string>, pollIndex = 0): string | null {
  const callMatch = inner.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
  if (!callMatch) return null;

  const fnName = callMatch[1];
  const rpcName = rpcNameMap?.get(fnName) || fnName;
  const argsExpr = (callMatch[2] || '').trim();
  const fragmentPrefix = `__poll_${pollIndex}`;
  if (!argsExpr) return JSON.stringify(`${fragmentPrefix}_${rpcName}`);
  return `${JSON.stringify(fragmentPrefix + '_')} + String(${argsExpr}).replace(/[^a-zA-Z0-9]/g, '_')`;
}

function extractPollFragmentExpr(tagText: string, rpcNameMap?: Map<string, string>, pollIndex = 0): string | null {
  const pollMatch = tagText.match(/\bdata-poll=\{([\s\S]*?)\}/);
  if (!pollMatch) return null;
  const inner = pollMatch[1].trim();
  return buildPollFragmentExpr(inner, rpcNameMap, pollIndex);
}

function findTagEnd(template: string, start: number): number {
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let braceDepth = 0;

  for (let i = start; i < template.length; i++) {
    const ch = template[i];
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
    if (ch === '>' && braceDepth === 0) {
      return i;
    }
  }

  return -1;
}

function instrumentPollFragments(template: string, rpcNameMap?: Map<string, string>): string {
  const out: string[] = [];
  const stack: Array<{ tagName: string; fragmentExpr: string | null }> = [];
  let cursor = 0;
  let pollIndex = 0;

  while (cursor < template.length) {
    const lt = template.indexOf('<', cursor);
    if (lt === -1) {
      out.push(template.slice(cursor));
      break;
    }

    out.push(template.slice(cursor, lt));

    if (template.startsWith('<!--', lt)) {
      const commentEnd = template.indexOf('-->', lt + 4);
      if (commentEnd === -1) {
        out.push(template.slice(lt));
        break;
      }
      out.push(template.slice(lt, commentEnd + 3));
      cursor = commentEnd + 3;
      continue;
    }

    const tagEnd = findTagEnd(template, lt + 1);
    if (tagEnd === -1) {
      out.push(template.slice(lt));
      break;
    }

    const tagText = template.slice(lt, tagEnd + 1);
    const closingMatch = tagText.match(/^<\s*\/\s*([A-Za-z][\w:-]*)\s*>$/);
    if (closingMatch) {
      const closingTag = closingMatch[1].toLowerCase();
      const last = stack[stack.length - 1];
      if (last && last.tagName === closingTag) {
        if (last.fragmentExpr) out.push(FRAGMENT_CLOSE_MARKER);
        stack.pop();
      }
      out.push(tagText);
      cursor = tagEnd + 1;
      continue;
    }

    const openMatch = tagText.match(/^<\s*([A-Za-z][\w:-]*)\b/);
    if (!openMatch) {
      out.push(tagText);
      cursor = tagEnd + 1;
      continue;
    }

    const tagName = openMatch[1].toLowerCase();
    const isVoidLike = /\/\s*>$/.test(tagText) || /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tagName);
    const fragmentExpr = extractPollFragmentExpr(tagText, rpcNameMap, pollIndex);
    const instrumentedTagText = fragmentExpr
      ? tagText.replace(/\bdata-poll=\{([\s\S]*?)\}/, (match) => `${match} data-kuratchi-poll-fragment={${fragmentExpr}}`)
      : tagText;

    out.push(instrumentedTagText);

    if (fragmentExpr) {
      pollIndex += 1;
      out.push(`${FRAGMENT_OPEN_MARKER}${encodeURIComponent(fragmentExpr)}-->`);
      if (isVoidLike) {
        out.push(FRAGMENT_CLOSE_MARKER);
      }
    }

    if (!isVoidLike) {
      stack.push({ tagName, fragmentExpr });
    }

    cursor = tagEnd + 1;
  }

  return out.join('');
}

/**
 * Compile a template string into a JS render function body.
 *
 * The generated code expects `data` in scope (destructured load return)
 * and an `__esc` helper for HTML-escaping.
 */
export function compileTemplate(
  template: string,
  componentNames?: Map<string, string>,
  actionNames?: Set<string>,
  rpcNameMap?: Map<string, string>,
  options: CompileTemplateOptions = {},
): string {
  const emitCall = options.emitCall;
  if (options.enableFragmentManifest) {
    template = instrumentPollFragments(template, rpcNameMap);
  }
  // Use array accumulation for O(n) performance instead of O(n²) string concatenation
  const useArrayAccum = !emitCall;
  const out: string[] = useArrayAccum ? ['const __parts = [];'] : ['let __html = "";'];
  const lines = template.split('\n');
  let inStyle = false;
  let inScript = false;
  let scriptBuffer: string[] = [];
  let inHtmlTag = false;
  let htmlAttrQuote: '"' | "'" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track <style> blocks â€” emit CSS as literal, no parsing
    if (trimmed.match(/<style[\s>]/i)) inStyle = true;
    if (inStyle) {
      out.push(buildAppendStatement(`\`${escapeLiteral(line)}\\n\``, emitCall));
      if (trimmed.match(/<\/style>/i)) inStyle = false;
      continue;
    }

    // Track <script> blocks â€” transform reactive ($:) client syntax first.
    if (!inScript && trimmed.match(/<script[\s>]/i)) {
      inScript = true;
      scriptBuffer = [line];
      if (trimmed.match(/<\/script>/i)) {
        const transformed = transformClientScriptBlock(scriptBuffer.join('\n'), options.clientRouteRegistry, options.importerDir);
        for (const scriptLine of transformed.split('\n')) {
          out.push(buildAppendStatement(`\`${escapeLiteral(scriptLine)}\\n\``, emitCall));
        }
        scriptBuffer = [];
        inScript = false;
      }
      continue;
    }
    if (inScript) {
      scriptBuffer.push(line);
      if (trimmed.match(/<\/script>/i)) {
        const transformed = transformClientScriptBlock(scriptBuffer.join('\n'), options.clientRouteRegistry, options.importerDir);
        for (const scriptLine of transformed.split('\n')) {
          out.push(buildAppendStatement(`\`${escapeLiteral(scriptLine)}\\n\``, emitCall));
        }
        scriptBuffer = [];
        inScript = false;
      }
      continue;
    }

    const startedInsideQuotedAttr = !!htmlAttrQuote;
    const nextHtmlState = advanceHtmlTagState(line, inHtmlTag, htmlAttrQuote);
    if (startedInsideQuotedAttr) {
      out.push(buildAppendStatement(`\`${escapeLiteral(line)}\n\``, emitCall));
      inHtmlTag = nextHtmlState.inTag;
      htmlAttrQuote = nextHtmlState.quote;
      continue;
    }
    inHtmlTag = nextHtmlState.inTag;
    htmlAttrQuote = nextHtmlState.quote;


    // Skip empty lines
    if (!trimmed) {
      out.push(buildAppendStatement(`"\\n"`, emitCall));
      continue;
    }

    // One-line inline if/else with branch content:
    // if (cond) { text/html } else { text/html }
    // Compile branch content as template output instead of raw JS.
    const inlineIfElse = tryCompileInlineIfElseLine(trimmed, actionNames, rpcNameMap, options);
    if (inlineIfElse) {
      out.push(...inlineIfElse);
      continue;
    }

    // JS control flow lines â†’ emit as raw JS
    if (isJsControlLine(trimmed)) {
      out.push(trimmed);
      continue;
    }

    // Component tags: <StatCard attr="val" attr={expr} /> (PascalCase, explicitly imported)
    if (componentNames && componentNames.size > 0) {
      // Multi-line component tag: if line starts with <PascalCase but doesn't close,
      // join continuation lines until we find the closing > or />
      let joinedTrimmed = trimmed;
      let joinedExtra = 0;
      const multiLineStart = trimmed.match(/^<([A-Z]\w*)(?:\s|$)/);
      if (multiLineStart && !trimmed.match(/>/) && componentNames.has(multiLineStart[1])) {
        // Keep joining lines until we find > or />
        let j = i + 1;
        while (j < lines.length) {
          const nextTrimmed = lines[j].trim();
          joinedTrimmed += ' ' + nextTrimmed;
          joinedExtra++;
          if (nextTrimmed.match(/\/?>$/)) break;
          j++;
        }
      }

      // Self-closing: <Card attr="x" />
      const componentLine = tryCompileComponentTag(joinedTrimmed, componentNames, actionNames, rpcNameMap, options);
      if (componentLine) {
        i += joinedExtra;
        out.push(componentLine);
        continue;
      }

      // Opening tag with children: <Card attr="x">
      const openResult = tryMatchComponentOpen(joinedTrimmed, componentNames, actionNames);
      if (openResult) {
        i += joinedExtra;
        // Collect lines until the matching </TagName>
        const childLines: string[] = [];
        let depth = 1;
        i++;
        while (i < lines.length) {
          const childTrimmed = lines[i].trim();
          // Check for nested opening of the same component
          if (childTrimmed.match(new RegExp(`^<${openResult.tagName}[\\s>]`)) && !childTrimmed.match(/\/>/)) {
            depth++;
          }
          if (childTrimmed === `</${openResult.tagName}>`) {
            depth--;
            if (depth === 0) break;
          }
          childLines.push(lines[i]);
          i++;
        }

        // Compile children into a sub-render block
        const childTemplate = childLines.join('\n');
        const childBody = compileTemplate(childTemplate, componentNames, actionNames, rpcNameMap, {
          clientRouteRegistry: options.clientRouteRegistry,
          awaitQueryBindings: options.awaitQueryBindings,
        });
        // Wrap in an IIFE that returns the children HTML
        const childrenExpr = `(function() { ${childBody}; return __html; })()`;
        out.push(buildAppendStatement(`${openResult.funcName}({ ${openResult.propsStr}${openResult.propsStr ? ', ' : ''}children: ${childrenExpr} }, __esc)`, emitCall));
        continue;
      }
    }

    // HTML line â†’ compile {expr} interpolations
    // Handle multi-line expressions: if a line has unclosed {, join continuation lines
    let htmlLine = line;
    let extraLines = 0;
    if (hasUnclosedBrace(htmlLine)) {
      let j = i + 1;
      while (j < lines.length && hasUnclosedBrace(htmlLine)) {
        htmlLine += '\n' + lines[j];
        extraLines++;
        j++;
      }
      i += extraLines;
    }
    out.push(...compileHtmlLineStatements(htmlLine, actionNames, rpcNameMap, options));
  }
  // For non-emit mode, add final join to produce __html
  if (!emitCall) {
    out.push('let __html = __parts.join(\'\');');
  }
  return out.join('\n');
}

/**
 * Check if a string has unclosed template braces (more { than }).
 * Respects string quotes to avoid false positives.
 */
function hasUnclosedBrace(src: string): boolean {
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

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

    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }

  return depth > 0;
}

function advanceHtmlTagState(
  src: string,
  startInTag: boolean,
  startQuote: '"' | "'" | null,
): { inTag: boolean; quote: '"' | "'" | null } {
  let inTag = startInTag;
  let quote = startQuote;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (!inTag) {
      if (ch === '<') {
        inTag = true;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'";
      continue;
    }

    if (ch === '>') {
      inTag = false;
    }
  }

  return { inTag, quote };
}

function transformClientScriptBlock(
  block: string,
  clientRouteRegistry?: ClientRouteRegistry,
  importerDir?: string,
): string {
  const match = block.match(/^([\s\S]*?<script\b[^>]*>)([\s\S]*?)(<\/script>\s*)$/i);
  if (!match) return block;

  let openTag = match[1];
  let body = match[2];
  const closeTag = match[3];

  // Check if the script has ES module imports (import ... from '...')
  const hasEsModuleImports = /^\s*import\s+.+\s+from\s+['"][^'"]+['"]/m.test(body);

  // Rewrite $lib/ imports to bundled asset paths
  let hasRewrittenClientImports = false;
  if (clientRouteRegistry && importerDir) {
    body = body.replace(
      /^(\s*import\s+.+\s+from\s+['"]\$lib\/[^'"]+['"];?\s*)$/gm,
      (importLine) => {
        const rewritten = clientRouteRegistry.rewriteClientImport(importLine.trim(), importerDir);
        if (rewritten) {
          hasRewrittenClientImports = true;
          return importLine.replace(importLine.trim(), rewritten);
        }
        return importLine;
      }
    );
  }

  // Add type="module" if the script has ES module imports and doesn't already have it
  if ((hasEsModuleImports || hasRewrittenClientImports) && !/type\s*=\s*["']module["']/i.test(openTag)) {
    openTag = openTag.replace(/<script\b/i, '<script type="module"');
  }

  // TypeScript is preserved — wrangler's esbuild handles transpilation
  if (!/\$\s*:/.test(body)) {
    return `${openTag}${body}${closeTag}`;
  }

  const out: string[] = [];

  const lines = body.split('\n');
  const reactiveVars = new Set<string>();
  const rewritten = lines.map((line) => {
    const m = line.match(/^(\s*)let\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);\s*$/);
    if (!m) return line;
    const indent = m[1] ?? '';
    const name = m[2];
    const expr = (m[3] ?? '').trim();
    if (!expr || (!expr.startsWith('[') && !expr.startsWith('{'))) return line;
    reactiveVars.add(name);
    return `${indent}let ${name} = __k$.state(${expr});`;
  });

  const assignRegexes = Array.from(reactiveVars).map((name) => ({
    name,
    re: new RegExp(`^(\\s*)${name}\\s*=\\s*([^;]+);\\s*$`),
  }));

  let inReactiveBlock = false;
  let blockIndent = '';
  let blockDepth = 0;

  for (const line of rewritten) {
    let current = line;

    for (const { name, re } of assignRegexes) {
      const am = current.match(re);
      if (!am) continue;
      const indent = am[1] ?? '';
      const expr = (am[2] ?? '').trim();
      current = `${indent}${name} = __k$.replace(${name}, ${expr});`;
      break;
    }

    if (!inReactiveBlock) {
      const rm = current.match(/^(\s*)\$:\s*(.*)$/);
      if (!rm) {
        out.push(current);
        continue;
      }
      const indent = rm[1] ?? '';
      const expr = (rm[2] ?? '').trim();
      if (!expr) continue;

      if (expr.startsWith('{')) {
        const tail = expr.slice(1);
        out.push(`${indent}__k$.effect(() => {`);
        inReactiveBlock = true;
        blockIndent = indent;
        blockDepth = 1 + braceDelta(tail);
        if (tail.trim()) out.push(`${indent}${tail}`);
        if (blockDepth <= 0) {
          out.push(`${indent}});`);
          inReactiveBlock = false;
          blockIndent = '';
          blockDepth = 0;
        }
        continue;
      }

      const normalized = expr.endsWith(';') ? expr : `${expr};`;
      out.push(`${indent}__k$.effect(() => { ${normalized} });`);
      continue;
    }

    const nextDepth = blockDepth + braceDelta(current);
    if (nextDepth <= 0 && current.trim() === '}') {
      out.push(`${blockIndent}});`);
      inReactiveBlock = false;
      blockIndent = '';
      blockDepth = 0;
      continue;
    }
    out.push(current);
    blockDepth = nextDepth;
  }

  if (inReactiveBlock) out.push(`${blockIndent}});`);

  let insertAt = 0;
  while (insertAt < out.length) {
    const t = out[insertAt].trim();
    if (!t || t.startsWith('//')) {
      insertAt++;
      continue;
    }
    if (/^\/\*/.test(t)) {
      insertAt++;
      continue;
    }
    if (/^import\s/.test(t)) {
      insertAt++;
      continue;
    }
    break;
  }
  out.splice(insertAt, 0, 'const __k$ = window.__kuratchiReactive;');

  // TypeScript is preserved — wrangler's esbuild handles transpilation
  return `${openTag}${out.join('\n')}${closeTag}`;
}

function extractAwaitTemplateCall(expr: string): { fnName: string; argsExpr: string; awaitExpr: string } | null {
  const match = expr.trim().match(/^await\s+([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
  if (!match) return null;
  const fnName = match[1];
  const argsExpr = (match[2] || '').trim();
  return { fnName, argsExpr, awaitExpr: `${fnName}(${argsExpr})` };
}

function braceDelta(line: string): number {
  let delta = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'" && !inSingle) {
      inSingle = true;
      continue;
    }
    if (inSingle && ch === "'") {
      inSingle = false;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"' && !inDouble) {
      inDouble = true;
      continue;
    }
    if (inDouble && ch === '"') {
      inDouble = false;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (ch === '{') delta++;
    else if (ch === '}') delta--;
  }

  return delta;
}

function findMatching(src: string, openPos: number, openChar: string, closeChar: string): number {
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  for (let i = openPos; i < src.length; i++) {
    const ch = src[i];
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
    if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function compileInlineBranchContent(
  content: string,
  actionNames?: Set<string>,
  rpcNameMap?: Map<string, string>,
  options: CompileTemplateOptions = {},
): string[] {
  const c = content.trim();
  if (!c) return [];
  return compileHtmlLineStatements(c, actionNames, rpcNameMap, { ...options, appendNewline: false });
}

function tryCompileInlineIfElseLine(
  line: string,
  actionNames?: Set<string>,
  rpcNameMap?: Map<string, string>,
  options: CompileTemplateOptions = {},
): string[] | null {
  if (!line.startsWith('if')) return null;
  const ifMatch = line.match(/^if\s*\(/);
  if (!ifMatch) return null;

  const openParen = line.indexOf('(');
  const closeParen = findMatching(line, openParen, '(', ')');
  if (openParen === -1 || closeParen === -1) return null;

  const condition = line.slice(openParen + 1, closeParen).trim();
  if (!condition) return null;

  const firstOpenBrace = line.indexOf('{', closeParen + 1);
  if (firstOpenBrace === -1) return null;
  const firstCloseBrace = findMatching(line, firstOpenBrace, '{', '}');
  if (firstCloseBrace === -1) return null;

  const afterFirst = line.slice(firstCloseBrace + 1);
  let pos = 0;
  while (pos < afterFirst.length && /\s/.test(afterFirst[pos])) pos++;
  if (!afterFirst.slice(pos).startsWith('else')) return null;
  pos += 'else'.length;
  while (pos < afterFirst.length && /\s/.test(afterFirst[pos])) pos++;
  if (afterFirst[pos] !== '{') return null;

  const elseOpen = firstCloseBrace + 1 + pos;
  const elseClose = findMatching(line, elseOpen, '{', '}');
  if (elseClose === -1) return null;

  const trailing = line.slice(elseClose + 1).trim();
  if (trailing.length > 0) return null;

  const thenContent = line.slice(firstOpenBrace + 1, firstCloseBrace);
  const elseContent = line.slice(elseOpen + 1, elseClose);

  const out: string[] = [];
  out.push(`if (${condition}) {`);
  out.push(...compileInlineBranchContent(thenContent, actionNames, rpcNameMap, options));
  out.push(`} else {`);
  out.push(...compileInlineBranchContent(elseContent, actionNames, rpcNameMap, options));
  out.push(`}`);
  return out;
}

/** Derive the __c_ function name from a fileName (may include package prefix like @kuratchi/ui:badge) */
function componentFuncName(fileName: string): string {
  const name = fileName.includes(':') ? fileName.split(':').pop()! : fileName;
  return '__c_' + name.replace(/[\/\-]/g, '_');
}

/** Parse component attributes string into a JS object literal fragment */
function parseComponentAttrs(attrsStr: string, actionNames?: Set<string>): string {
  const props: string[] = [];
  let i = 0;

  while (i < attrsStr.length) {
    while (i < attrsStr.length && /\s/.test(attrsStr[i])) i++;
    if (i >= attrsStr.length) break;

    const nameStart = i;
    while (i < attrsStr.length && /[\w-]/.test(attrsStr[i])) i++;
    if (i === nameStart) {
      i++;
      continue;
    }

    const key = attrsStr.slice(nameStart, i).replace(/-/g, '_'); // kebab-case -> snake_case for JS

    while (i < attrsStr.length && /\s/.test(attrsStr[i])) i++;
    if (attrsStr[i] !== '=') {
      props.push(`${key}: true`);
      continue;
    }

    i++; // skip '='
    while (i < attrsStr.length && /\s/.test(attrsStr[i])) i++;
    if (i >= attrsStr.length) {
      props.push(`${key}: true`);
      break;
    }

    if (attrsStr[i] === '"' || attrsStr[i] === "'") {
      const quote = attrsStr[i];
      i++;
      const valueStart = i;
      while (i < attrsStr.length) {
        if (attrsStr[i] === '\\') {
          i += 2;
          continue;
        }
        if (attrsStr[i] === quote) break;
        i++;
      }
      const literal = attrsStr.slice(valueStart, i);
      props.push(`${key}: ${JSON.stringify(literal)}`);
      if (i < attrsStr.length && attrsStr[i] === quote) i++;
      continue;
    }

    if (attrsStr[i] === '{') {
      const closeIdx = findClosingBrace(attrsStr, i);
      const expr = attrsStr.slice(i + 1, closeIdx).trim();
      // If this expression is a known server action function, pass its name as a string
      // literal instead of a variable reference â€” action functions are not in scope in
      // the render function, but their string names are what the runtime dispatches on.
      const isAction = actionNames?.has(expr);
      props.push(isAction ? `${key}: ${JSON.stringify(expr)}` : `${key}: (${expr})`);
      i = closeIdx + 1;
      continue;
    }

    const valueStart = i;
    while (i < attrsStr.length && !/\s/.test(attrsStr[i])) i++;
    const bare = attrsStr.slice(valueStart, i);
    props.push(`${key}: ${JSON.stringify(bare)}`);
  }

  return props.join(', ');
}

/**
 * Try to compile a self-closing component tag into a function call.
 * Returns null if the line is not a component tag.
 *
 * Matches: <StatCard attr="literal" attr={expr} />
 * Generates: __html += __c_stat_card({ attr: "literal", attr: (expr) }, __esc);
 */
function tryCompileComponentTag(
  line: string,
  componentNames: Map<string, string>,
  actionNames?: Set<string>,
  rpcNameMap?: Map<string, string>,
  options: CompileTemplateOptions = {},
): string | null {
  // Match self-closing tags: <TagName ...attrs... />
  const selfCloseMatch = line.match(/^<([A-Z]\w*)\s*(.*?)\s*\/>\s*$/);
  // Match open+close on same line with no content: <TagName ...attrs...></TagName>
  const emptyPairMatch = !selfCloseMatch ? line.match(/^<([A-Z]\w*)\s*(.*?)\s*><\/\1>\s*$/) : null;
  // Match open+close on same line with inline content: <TagName ...attrs...>content</TagName>
  const inlinePairMatch = !selfCloseMatch && !emptyPairMatch ? line.match(/^<([A-Z]\w*)\s*(.*?)>([\s\S]+)<\/\1>\s*$/) : null;

  const match = selfCloseMatch || emptyPairMatch;
  if (match) {
    const tagName = match[1];
    const fileName = componentNames.get(tagName);
    if (!fileName) return null;
    const funcName = componentFuncName(fileName);
    const propsStr = parseComponentAttrs(match[2].trim(), actionNames);
    return buildAppendStatement(`${funcName}({ ${propsStr} }, __esc)`, options.emitCall);
  }

  if (inlinePairMatch) {
    const tagName = inlinePairMatch[1];
    const fileName = componentNames.get(tagName);
    if (!fileName) return null;
    const funcName = componentFuncName(fileName);
    const propsStr = parseComponentAttrs(inlinePairMatch[2].trim(), actionNames);
    const innerContent = inlinePairMatch[3];
    // Compile the inline content as a mini-template to handle {expr} interpolation
    const childBody = compileTemplate(innerContent, componentNames, actionNames, rpcNameMap, {
      clientRouteRegistry: options.clientRouteRegistry,
      awaitQueryBindings: options.awaitQueryBindings,
    });
    const childrenExpr = `(function() { ${childBody}; return __html; })()`;
    return buildAppendStatement(`${funcName}({ ${propsStr}${propsStr ? ', ' : ''}children: ${childrenExpr} }, __esc)`, options.emitCall);
  }

  return null;
}

/**
 * Try to match a component opening tag (not self-closing).
 * Returns parsed info if matched, null otherwise.
 *
 * Matches: <Card attr="x" attr={expr}>
 */
function tryMatchComponentOpen(line: string, componentNames: Map<string, string>, actionNames?: Set<string>): { tagName: string; funcName: string; propsStr: string } | null {
  const match = line.match(/^<([A-Z]\w*)(\s[^>]*)?>\s*$/);
  if (!match) return null;

  const tagName = match[1];
  const fileName = componentNames.get(tagName);
  if (!fileName) return null;

  const funcName = componentFuncName(fileName);
  const propsStr = parseComponentAttrs((match[2] || '').trim(), actionNames);

  return { tagName, funcName, propsStr };
}

/**
 * Expand shorthand attribute syntax before main compilation:
 *   style={color}  â†’ style="color: {color}"
 *   <div {id}>     â†’ <div id="{id}">
 */
function expandShorthands(line: string): string {
  // style={prop} â†’ style="prop: {prop}"  (CSS property shorthand)
  line = line.replace(/\bstyle=\{(\w+)\}/g, (_match, prop) => {
    return `style="${prop}: {${prop}}"`;
  });

  // Bare {ident} inside a tag â†’ attr="{ident}"
  // Only match simple identifiers in attribute position (after < or after a space inside a tag)
  line = line.replace(/(<\w[\w-]*\s(?:[^>]*?\s)?)\{(\w+)\}(?=[\s/>])/g, (_match, before, ident) => {
    return `${before}${ident}="{${ident}}"`;
  });

  return line;
}

function compileHtmlLineStatements(
  line: string,
  actionNames?: Set<string>,
  rpcNameMap?: Map<string, string>,
  options: CompileTemplateOptions = {},
): string[] {
  const markerRegex = /<!--__KURATCHI_FRAGMENT_(OPEN:([\s\S]*?)|CLOSE)-->/g;
  const statements: string[] = [];
  let cursor = 0;
  let sawLiteral = false;
  let match: RegExpExecArray | null;

  while ((match = markerRegex.exec(line)) !== null) {
    const literal = line.slice(cursor, match.index);
    if (literal) {
      statements.push(compileHtmlSegment(literal, actionNames, rpcNameMap, { ...options, appendNewline: false }));
      sawLiteral = true;
    }

    if (match[1].startsWith('OPEN:')) {
      const encodedExpr = match[2] || '';
      statements.push(`__pushFragment(${decodeURIComponent(encodedExpr)});`);
    } else {
      statements.push(`__popFragment();`);
    }

    cursor = match.index + match[0].length;
  }

  const tail = line.slice(cursor);
  if (tail || sawLiteral || options.appendNewline !== false) {
    const appendNewline = options.appendNewline !== false;
    if (tail || appendNewline) {
      statements.push(compileHtmlSegment(tail, actionNames, rpcNameMap, { ...options, appendNewline }));
    }
  }

  return statements.filter(Boolean);
}

import type { ClientRouteRegistry } from './client-module-pipeline.js';

/**
 * Compile a single HTML segment, replacing {expr} with escaped output,
 * {@html expr} with sanitized HTML, and {@raw expr} with raw output.
 * Handles attribute values like value={x}.
 */
function compileHtmlSegment(
  line: string,
  actionNames?: Set<string>,
  rpcNameMap?: Map<string, string>,
  options: CompileTemplateOptions = {},
): string {
  // Expand shorthand syntax before main compilation
  line = expandShorthands(line);

  let result = '';
  let pos = 0;
  let pendingActionHiddenInput: string | null = null;

  while (pos < line.length) {
    const braceIdx = findNextTemplateBrace(line, pos);

    if (braceIdx === -1) {
      // No more braces â€” rest is literal
      result += escapeLiteral(line.slice(pos));
      break;
    }

    // Literal text before the brace
    if (braceIdx > pos) {
      result += escapeLiteral(line.slice(pos, braceIdx));
    }

    // Find matching closing brace
    const closeIdx = findClosingBrace(line, braceIdx);
    const inner = line.slice(braceIdx + 1, closeIdx).trim();

    // Sanitized HTML: {@html expr}
    if (inner.startsWith('@html ')) {
      const expr = inner.slice(6).trim();
      result += `\${__sanitizeHtml(${expr})}`;
    } else if (inner.startsWith('@raw ')) {
      // Unsafe raw HTML: {@raw expr}
      const expr = inner.slice(5).trim();
      result += `\${__rawHtml(${expr})}`;
    } else if (inner.startsWith('=html ')) {
      // Legacy alias for raw HTML: {=html expr}
      const expr = inner.slice(6).trim();
      result += `\${__rawHtml(${expr})}`;
    } else {
      // Check if this is an attribute value: attr={expr}
      const charBefore = braceIdx > 0 ? line[braceIdx - 1] : '';
      if (charBefore === '=') {
        // Check what attribute this is for
        // Look backwards from braceIdx to find the attribute name
        const beforeBrace = line.slice(0, braceIdx);
        const attrMatch = beforeBrace.match(/([\w-]+)=$/);
        const attrName = attrMatch ? attrMatch[1] : '';

        if (attrName === 'data-dialog-data') {
          // data-dialog-data={expr} â†’ data-dialog-data="JSON.stringify(expr)" (HTML-escaped)
          result += `"\${__esc(JSON.stringify(${inner}))}"`;
          pos = closeIdx + 1;
          continue;
        } else if (attrName === 'data-refresh') {
          // data-refresh={fn(args)} or data-refresh={keyExpr}
          // - fn(args): emit refresh function + serialized args
          // - otherwise: emit refresh token string
          const callMatch = inner.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
          result = result.replace(new RegExp(`\\s*${attrName}=$`), '');
          if (callMatch) {
            const fnName = callMatch[1];
            const rpcName = rpcNameMap?.get(fnName) || fnName;
            const argsExpr = (callMatch[2] || '').trim();
            result += ` data-refresh="${rpcName}"`;
            if (argsExpr) {
              result += ` data-refresh-args="\${__esc(JSON.stringify([${argsExpr}]))}"`;
            }
          } else {
            result += ` data-refresh="\${__esc(${inner})}"`;
          }
          pos = closeIdx + 1;
          continue;
        } else if (attrName === 'data-post' || attrName === 'data-put' || attrName === 'data-patch' || attrName === 'data-delete') {
          // data-post={fn(args)} etc â€” action-style declarative calls
          const method = attrName.slice('data-'.length).toUpperCase();
          const callMatch = inner.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
          result = result.replace(new RegExp(`\\s*${attrName}=$`), '');
          if (callMatch && actionNames?.has(callMatch[1])) {
            const fnName = callMatch[1];
            const argsExpr = (callMatch[2] || '').trim();
            result += ` data-action="${fnName}" data-action-event="click" data-action-method="${method}"`;
            result += ` data-args="\${__esc(JSON.stringify([${argsExpr}]))}"`;
          } else {
            result += ` ${attrName}="${escapeLiteral(inner)}"`;
          }
          pos = closeIdx + 1;
          continue;
        } else if (attrName === 'data-get' || attrName === 'data-loading' || attrName === 'data-error' || attrName === 'data-empty' || attrName === 'data-success') {
          // data-get={fn(args)} and companion state attrs
          // Emit stable metadata attributes instead of evaluating expression in SSR.
          const callMatch = inner.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
          result = result.replace(new RegExp(`\\s*${attrName}=$`), '');
          if (callMatch) {
            const fnName = callMatch[1];
            const rpcName = rpcNameMap?.get(fnName) || fnName;
            const argsExpr = (callMatch[2] || '').trim();
            result += ` ${attrName}="${rpcName}"`;
            if (argsExpr) {
              result += ` ${attrName}-args="\${__esc(JSON.stringify([${argsExpr}]))}"`;
            }
          } else {
            // Non-call expression mode (e.g., data-get={someUrl})
            result += ` ${attrName}="\${__esc(${inner})}"`;
          }
          pos = closeIdx + 1;
          continue;
        } else if (attrName === 'data-kuratchi-poll-fragment') {
          result = result.replace(/\s*data-kuratchi-poll-fragment=$/, '');
          result += ` data-poll-id="\${__signFragment(${inner})}"`;
          pos = closeIdx + 1;
          continue;
        } else if (attrName === 'data-poll') {
          // data-poll={fn(args)} → data-poll="fnName" data-poll-args="[serialized]"
          const pollCallMatch = inner.match(/^(\w+)\((.*)\)$/);
          if (pollCallMatch) {
            const fnName = pollCallMatch[1];
            const rpcName = rpcNameMap?.get(fnName) || fnName;
            const argsExpr = pollCallMatch[2].trim();
            // Remove the trailing "data-poll=" we already appended
            result = result.replace(/\s*data-poll=$/, '');
            // Emit data-poll and data-poll-args. The signed poll fragment ID is emitted
            // from the synthetic data-kuratchi-poll-fragment attribute injected earlier.
            result += ` data-poll="${rpcName}"`;
            if (argsExpr) {
              result += ` data-poll-args="\${__esc(JSON.stringify([${argsExpr}]))}"`;
            }
          }
          pos = closeIdx + 1;
          continue;
        } else if (attrName === 'action') {
          // action={fnName} -> server action dispatch via hidden _action field.
          const isSimpleIdentifier = /^[A-Za-z_$][\w$]*$/.test(inner);
          // When actionNames is undefined we're inside a shared component template.
          // Allow any simple identifier â€” the consuming route is responsible for
          // importing the function, and the runtime validates at dispatch time.
          const isServerAction = isSimpleIdentifier && (actionNames === undefined || actionNames.has(inner));

          if (!isServerAction) {
            throw new Error(`Invalid action expression: "${inner}". Use action={myActionFn} for server actions.`);
          }

          // Remove trailing `action=` from output and inject _action hidden field + CSRF token.
          result = result.replace(/\s*action=$/, '');
          const actionValue = actionNames === undefined
            ? `\${__esc(${inner})}`
            : inner;
          // Inject both _action and _csrf hidden fields for server action forms
          pendingActionHiddenInput = `\\n<input type="hidden" name="_action" value="${actionValue}">\\n<input type="hidden" name="_csrf" value="\${__getCsrfToken()}">`;
          pos = closeIdx + 1;
          continue;
        } else if (/^on[A-Za-z]+$/i.test(attrName)) {
          // onClick/onChange/...={expr} â€” check if it's a server action or plain client JS
          const eventName = attrName.slice(2).toLowerCase();
          const actionCallMatch = inner.match(/^(\w+)\((.*)\)$/);
          if (actionCallMatch && actionNames?.has(actionCallMatch[1])) {
            // Server action: onClick={deleteTodo(id)}
            // â†’ data attributes consumed by the client action bridge
            const fnName = actionCallMatch[1];
            const argsExpr = actionCallMatch[2].trim();
            // Remove the trailing "onX=" we already appended
            result = result.replace(new RegExp(`\\s*${attrName}=$`), '');
            // Emit data-action, data-args, and which browser event should trigger it.
            result += ` data-action="${fnName}" data-args="\${__esc(JSON.stringify([${argsExpr}]))}" data-action-event="${eventName}"`;
          } else {
            const clientRegistration = options.clientRouteRegistry?.registerEventHandler(eventName, inner) ?? null;
            if (clientRegistration) {
              result = result.replace(new RegExp(`\\s*${attrName}=$`), '');
              result += ` data-client-route="${clientRegistration.routeId}" data-client-handler="${clientRegistration.handlerId}" data-client-event="${eventName}"`;
              if (clientRegistration.argsExpr) {
                result += ` data-client-args="\${__esc(JSON.stringify([${clientRegistration.argsExpr}]))}"`;
              }
            } else if (options.clientRouteRegistry?.hasBindingReference(inner)) {
              throw new Error(
                `Unsupported client handler expression: "${inner}". ` +
                `Top-level $lib event handlers must be a direct function reference or call, like onClick={openDialog()} or onClick={helpers.openDialog()}.`,
              );
            } else {
              // Plain client-side event handler: onClick={myFn()}
              // Emit as native inline handler (lowercased event attribute).
              result = result.replace(new RegExp(`\\s*${attrName}=$`), ` on${eventName}=`);
              result += `"${escapeLiteral(inner)}"`;
            }
          }
          pos = closeIdx + 1;
          continue;
        } else if (isBooleanAttribute(attrName)) {
          // Boolean attributes: disabled={expr} → conditionally include the attribute or omit entirely
          // Remove the trailing "attrName=" we already appended, we'll handle it with a ternary
          result = result.replace(new RegExp(`\\s*${attrName}=$`), '');
          result += `\${${inner} ? ' ${attrName}' : ''}`;
          pos = closeIdx + 1;
          continue;
        } else {
          // Regular attribute: value={expr} â†’ value="escaped"
          result += `"\${__esc(${inner})}"`;
        }
      } else {
        const awaitCall = extractAwaitTemplateCall(inner);
        const awaitBinding = awaitCall ? options.awaitQueryBindings?.get(awaitCall.awaitExpr) : null;
        if (awaitCall && awaitBinding) {
          result += `<span data-remote-read="${awaitBinding.rpcId}" data-get="${awaitBinding.rpcId}"`;
          if (awaitCall.argsExpr) {
            result += ` data-get-args="\${__esc(JSON.stringify([${awaitCall.argsExpr}]))}"`;
          }
          result += `>\${__esc(((${awaitBinding.asName} && ${awaitBinding.asName}.data) ?? ''))}</span>`;
        } else {
          result += `\${__esc(${inner})}`;
        }
      }
    }

    pos = closeIdx + 1;
  }

  if (pendingActionHiddenInput && result.includes('>')) {
    const gtIndex = result.indexOf('>');
    result = result.slice(0, gtIndex + 1) + pendingActionHiddenInput + result.slice(gtIndex + 1);
  }

  return buildAppendStatement(`\`${result}${options.appendNewline === false ? '' : '\\n'}\``, options.emitCall);
}

/** Escape characters that would break a JS template literal. */
function escapeLiteral(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function findNextTemplateBrace(src: string, startPos: number): number {
  return src.indexOf('{', startPos);
}


/** Find the matching closing `}` for an opening `{`, handling nesting. */
function findClosingBrace(src: string, openPos: number): number {
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let i = openPos; i < src.length; i++) {
    const ch = src[i];

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

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return src.length - 1;
}

/**
 * Generate the full render function source code.
 */
export function generateRenderFunction(template: string): string {
  const body = compileTemplate(template);

  return `function render(data) {
  const __rawHtml = (v) => {
    if (v == null) return '';
    return String(v);
  };
  const __sanitizeHtml = (v) => {
    let html = __rawHtml(v);
    html = html.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, '');
    html = html.replace(/<iframe\\b[^>]*>[\\s\\S]*?<\\/iframe>/gi, '');
    html = html.replace(/<object\\b[^>]*>[\\s\\S]*?<\\/object>/gi, '');
    html = html.replace(/<embed\\b[^>]*>/gi, '');
    html = html.replace(/\\son[a-z]+\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
    html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*([\"'])\\s*javascript:[\\s\\S]*?\\2/gi, ' $1="#"');
    html = html.replace(/\\s(href|src|xlink:href)\\s*=\\s*javascript:[^\\s>]+/gi, ' $1="#"');
    html = html.replace(/\\ssrcdoc\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^\\s>]+)/gi, '');
    return html;
  };
  const __esc = (v) => {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  ${body}
}`;
}

// TypeScript transpilation removed — wrangler's esbuild handles it
