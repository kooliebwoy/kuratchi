/**
 * Compiler �" scans a project's routes/ directory, parses .html files,
 * and generates a single Worker entry point.
 */

import { parseFile, stripTopLevelImports } from './parser.js';
import { compileTemplate } from './template.js';
import { transpileTypeScript } from './transpile.js';
import { filePathToPattern } from '../runtime/router.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export { parseFile } from './parser.js';
export { compileTemplate, generateRenderFunction } from './template.js';

const FRAMEWORK_PACKAGE_NAME = getFrameworkPackageName();
const RUNTIME_CONTEXT_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/context.js`;
const RUNTIME_DO_IMPORT = `${FRAMEWORK_PACKAGE_NAME}/runtime/do.js`;

function getFrameworkPackageName(): string {
  try {
    const raw = fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8');
    const parsed = JSON.parse(raw) as { name?: string };
    return parsed.name || '@kuratchi/js';
  } catch {
    return '@kuratchi/js';
  }
}

export interface CompileOptions {
  /** Absolute path to the project root */
  projectDir: string;
  /** Override path for routes.js (default: .kuratchi/routes.js). worker.js is always co-located. */
  outFile?: string;
  /** Whether this is a dev build (sets __kuratchi_DEV__ global) */
  isDev?: boolean;
}

export interface CompiledRoute {
  /** Route pattern (e.g., '/todos', '/blog/:slug') */
  pattern: string;
  /** Relative file path from routes/ (e.g., 'todos', 'blog/[slug]') */
  filePath: string;
  /** Whether it has a load function */
  hasLoad: boolean;
  /** Whether it has actions */
  hasActions: boolean;
  /** Whether it has RPC functions */
  hasRpc: boolean;
}

function compactInlineJs(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*([{}();,:])\s*/g, '$1')
    .trim();
}

function rewriteImportedFunctionCalls(source: string, fnToModule: Record<string, string>): string {
  let out = source;
  for (const [fnName, moduleId] of Object.entries(fnToModule)) {
    if (!/^[A-Za-z_$][\w$]*$/.test(fnName)) continue;
    const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
    out = out.replace(callRegex, `${moduleId}.${fnName}(`);
  }
  return out;
}

function rewriteWorkerEnvAliases(source: string, aliases: string[]): string {
  let out = source;
  for (const alias of aliases) {
    if (!/^[A-Za-z_$][\w$]*$/.test(alias)) continue;
    // Negative lookbehind: don't rewrite property accesses like __m16.env
    const aliasRegex = new RegExp(`(?<!\\.)\\b${alias}\\b`, 'g');
    out = out.replace(aliasRegex, '__env');
  }
  return out;
}

function buildDevAliasDeclarations(aliases: string[], isDev: boolean): string {
  if (!aliases || aliases.length === 0) return '';
  return aliases.map((alias) => `const ${alias} = ${isDev ? 'true' : 'false'};`).join('\n');
}

interface ImportBinding {
  imported: string;
  local: string;
}

function parseNamedImportBindings(line: string): ImportBinding[] {
  const namesMatch = line.match(/import\s*\{([^}]+)\}/);
  if (!namesMatch) return [];
  return namesMatch[1]
    .split(',')
    .map(n => n.trim())
    .filter(Boolean)
    .map(n => {
      const parts = n.split(/\s+as\s+/).map(p => p.trim()).filter(Boolean);
      return {
        imported: parts[0] || '',
        local: parts[1] || parts[0] || '',
      };
    })
    .filter((binding) => !!binding.imported && !!binding.local);
}

function filterClientImportsForServer(
  imports: string[],
  neededFns: Set<string>,
): string[] {
  const selected: string[] = [];
  for (const line of imports) {
    const bindings = parseNamedImportBindings(line);
    if (bindings.length === 0) continue;
    if (bindings.some((binding) => neededFns.has(binding.local))) {
      selected.push(line);
    }
  }
  return selected;
}

/**
 * Compile a project's src/routes/ into .kuratchi/routes.js
 *
 * The generated module exports { app } �" an object with a fetch() method
 * that handles routing, load functions, form actions, and rendering.
 * Returns the path to .kuratchi/worker.js � the stable wrangler entry point that
 * re-exports everything from routes.js (default fetch handler + named DO class exports).
 * No src/index.ts is needed in user projects.
 */
export function compile(options: CompileOptions): string {
  const { projectDir } = options;
  const srcDir = path.join(projectDir, 'src');
  const routesDir = path.join(srcDir, 'routes');

  if (!fs.existsSync(routesDir)) {
    throw new Error(`Routes directory not found: ${routesDir}`);
  }

  // Discover all .html route files
  const routeFiles = discoverRoutes(routesDir);

  // Component compilation cache �" only compile components that are actually imported
  const libDir = path.join(srcDir, 'lib');
  const compiledComponentCache: Map<string, string> = new Map(); // fileName �' compiled function code
  const componentStyleCache: Map<string, string> = new Map(); // fileName �' escaped CSS string (or empty)
  // Tracks which prop names inside a component are used as action={propName}.
  // e.g. db-studio uses action={runQueryAction} �' stores 'runQueryAction'.
  // When the route passes runQueryAction={runAdminSqlQuery}, the compiler knows
  // to add 'runAdminSqlQuery' to the route's actionFunctions.
  const componentActionCache: Map<string, Set<string>> = new Map(); // fileName �' Set of action prop names

  function compileComponent(fileName: string): string | null {
    if (compiledComponentCache.has(fileName)) return compiledComponentCache.get(fileName)!;

    let filePath: string;
    let funcName: string;

    // Package component: "@kuratchi/ui:badge" �' resolve from package
    const pkgMatch = fileName.match(/^(@[^:]+):(.+)$/);
    if (pkgMatch) {
      const pkgName = pkgMatch[1]; // e.g. "@kuratchi/ui"
      const componentFile = pkgMatch[2]; // e.g. "badge"
      funcName = '__c_' + componentFile.replace(/[\/\-]/g, '_');
      // Resolve the package's src/lib/ directory
      filePath = resolvePackageComponent(projectDir, pkgName, componentFile);
      if (!filePath || !fs.existsSync(filePath)) return null;
    } else {
      // Local component: resolve from src/lib/
      funcName = '__c_' + fileName.replace(/[\/\-]/g, '_');
      filePath = path.join(libDir, fileName + '.html');
      if (!fs.existsSync(filePath)) return null;
    }
    // Generate a short scope hash for scoped CSS
    const scopeHash = 'dz-' + crypto.createHash('md5').update(fileName).digest('hex').slice(0, 6);
    const rawSource = fs.readFileSync(filePath, 'utf-8');

    // Use parseFile to properly split the <script> block from the template, and to
    // separate component imports (import X from '@kuratchi/ui/x.html') from regular code.
    // This prevents import lines from being inlined verbatim in the compiled function body.
    const compParsed = parseFile(rawSource, { kind: 'component', filePath });

    // propsCode = script body with all import lines stripped out
    const propsCode = compParsed.script
      ? stripTopLevelImports(compParsed.script)
      : '';
    const devDecls = buildDevAliasDeclarations(compParsed.devAliases, !!options.isDev);
    const effectivePropsCode = [devDecls, propsCode].filter(Boolean).join('\n');
    const transpiledPropsCode = propsCode
      ? transpileTypeScript(effectivePropsCode, `component-script:${fileName}.ts`)
      : devDecls
        ? transpileTypeScript(devDecls, `component-script:${fileName}.ts`)
      : '';

    // template source (parseFile already removes the <script> block)
    let source = compParsed.template;

    // Extract optional <style> block �" CSS is scoped and injected once per route at compile time
    let styleBlock = '';
    const styleMatch = source.match(/<style[\s>][\s\S]*?<\/style>/i);
    if (styleMatch) {
      styleBlock = styleMatch[0];
      source = source.replace(styleMatch[0], '').trim();
    }

    // Scope the CSS: prefix every selector with .dz-{hash}
    let scopedStyle = '';
    if (styleBlock) {
      // Extract the CSS content between <style> and </style>
      const cssContent = styleBlock.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, '').trim();
      // Prefix each rule's selector(s) with the scope class
      const scopedCSS = cssContent.replace(
        /([^{}]+)\{/g,
        (match, selectors: string) => {
          const scoped = selectors
            .split(',')
            .map((s: string) => `.${scopeHash} ${s.trim()}`)
            .join(', ');
          return scoped + ' {';
        }
      );
      scopedStyle = `<style>${scopedCSS}</style>`;
    }

    // Store escaped scoped CSS separately for compile-time injection into routes
    const escapedStyle = scopedStyle
      ? scopedStyle.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
      : '';
    componentStyleCache.set(fileName, escapedStyle);

    // Replace <slot></slot> and <slot /> with children output
    source = source.replace(/<slot\s*><\/slot>/g, '{@raw props.children || ""}');
    source = source.replace(/<slot\s*\/>/g, '{@raw props.children || ""}');

    // Build a sub-component map from the component's own component imports so that
    // <Alert>, <Badge>, <Dialog>, etc. get expanded instead of emitted as raw tags.
    const subComponentNames: Map<string, string> = new Map();
    for (const [subPascal, subFileName] of Object.entries(compParsed.componentImports)) {
      compileComponent(subFileName); // compile on first use (cached)
      subComponentNames.set(subPascal, subFileName);
      // Collect sub-component styles so they're available when the route gathers styles
      const subStyle = componentStyleCache.get(subFileName);
      if (subStyle) {
        const existing = componentStyleCache.get(fileName) || '';
        if (!existing.includes(subStyle)) {
          componentStyleCache.set(fileName, existing + subStyle);
        }
      }
    }

    // Scan the component template for action={propName} uses.
    // These prop names are "action props" �" when the route passes actionProp={routeFn},
    // the compiler knows to add routeFn to the route's actionFunctions so it ends up
    // in the route's actions map and can be dispatched at runtime.
    const actionPropNames = new Set<string>();
    for (const match of source.matchAll(/\baction=\{([A-Za-z_$][\w$]*)\}/g)) {
      actionPropNames.add(match[1]);
    }
    componentActionCache.set(fileName, actionPropNames);

    const body = compileTemplate(source, subComponentNames, undefined, undefined);
    // Wrap component output in a scoped div
    const scopeOpen = `__html += '<div class="${scopeHash}">';`;
    const scopeClose = `__html += '</div>';`;
    // Insert scope open after 'let __html = "";' (first line of body) and scope close at end
    const bodyLines = body.split('\n');
    const scopedBody = [bodyLines[0], scopeOpen, ...bodyLines.slice(1), scopeClose].join('\n');
    const fnBody = transpiledPropsCode ? `${transpiledPropsCode}\n  ${scopedBody}` : scopedBody;
    const compiled = `function ${funcName}(props, __esc) {\n  ${fnBody}\n  return __html;\n}`;
    compiledComponentCache.set(fileName, compiled);
    return compiled;
  }

  // App layout: src/routes/layout.html (convention �" wraps all routes automatically)
  const layoutFile = path.join(routesDir, 'layout.html');
  let compiledLayout: string | null = null;
  const layoutComponentNames: Map<string, string> = new Map();
  if (fs.existsSync(layoutFile)) {
    let source = fs.readFileSync(layoutFile, 'utf-8');

    // Inject UI theme CSS if configured in kuratchi.config.ts
    const themeCSS = readUiTheme(projectDir);
    const uiConfigValues = readUiConfigValues(projectDir);

    // Patch <html> tag: set server-default theme class and data-radius from config
    if (uiConfigValues) {
      source = patchHtmlTag(source, uiConfigValues.theme, uiConfigValues.radius);
    }

    // Inject anti-FOUC theme init before CSS so saved light/dark/system preference
    // is restored before first paint, preventing a flash on hard navigations.
    if (uiConfigValues) {
      const themeInitScript = `<script>(function(){try{var d=document.documentElement;var s=localStorage.getItem('kui-theme');var fallback=d.getAttribute('data-theme')==='system'?'system':(d.classList.contains('dark')?'dark':'light');var p=(s==='light'||s==='dark'||s==='system')?s:fallback;d.classList.remove('dark');d.removeAttribute('data-theme');if(p==='dark'){d.classList.add('dark');}else if(p==='system'){d.setAttribute('data-theme','system');}}catch(e){}})()</script>`;
      source = source.replace('</head>', themeInitScript + '\n</head>');
    }

    if (themeCSS) {
      source = source.replace('</head>', `<style>${themeCSS}</style>\n</head>`);
    }

    // Inject @view-transition CSS for cross-document transitions (MPA)
    const viewTransitionCSS = `<style>@view-transition { navigation: auto; }</style>`;
    source = source.replace('</head>', viewTransitionCSS + '\n</head>');

    // Inject progressive client bridge:
    // - server actions bound via onX={serverAction(...)} -> [data-action][data-action-event]
    // - declarative confirm="..."
    // - declarative checkbox groups: data-select-all / data-select-item
    const bridgeSource = `(function(){
  function by(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var __refreshSeq = Object.create(null);
  function syncGroup(group){
    var items = by('[data-select-item]').filter(function(el){ return el.getAttribute('data-select-item') === group; });
    var masters = by('[data-select-all]').filter(function(el){ return el.getAttribute('data-select-all') === group; });
    if(!items.length || !masters.length) return;
    var all = items.every(function(i){ return !!i.checked; });
    var any = items.some(function(i){ return !!i.checked; });
    masters.forEach(function(m){ m.checked = all; m.indeterminate = any && !all; });
  }
  function inferQueryKey(getName, argsRaw){
    if(!getName) return '';
    return 'query:' + String(getName) + '|' + (argsRaw || '[]');
  }
  function blockKey(el){
    if(!el || !el.getAttribute) return '';
    var explicit = el.getAttribute('data-key');
    if(explicit) return 'key:' + explicit;
    var inferred = inferQueryKey(el.getAttribute('data-get'), el.getAttribute('data-get-args'));
    if(inferred) return inferred;
    var asName = el.getAttribute('data-as');
    if(asName) return 'as:' + asName;
    return '';
  }
  function escHtml(v){
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function setBlocksLoading(blocks){
    blocks.forEach(function(el){
      el.setAttribute('aria-busy','true');
      el.setAttribute('data-kuratchi-loading','1');
      var text = el.getAttribute('data-loading-text');
      if(text && !el.hasAttribute('data-as')){ el.innerHTML = '<p>' + escHtml(text) + '</p>'; return; }
      el.style.opacity = '0.6';
    });
  }
  function clearBlocksLoading(blocks){
    blocks.forEach(function(el){
      el.removeAttribute('aria-busy');
      el.removeAttribute('data-kuratchi-loading');
      el.style.opacity = '';
    });
  }
  function replaceBlocksWithKey(key){
    if(!key || typeof DOMParser === 'undefined'){ location.reload(); return Promise.resolve(); }
    var oldBlocks = by('[data-get]').filter(function(el){ return blockKey(el) === key; });
    if(!oldBlocks.length){ location.reload(); return Promise.resolve(); }
    var first = oldBlocks[0];
    var qFn = first ? (first.getAttribute('data-get') || '') : '';
    var qArgs = first ? String(first.getAttribute('data-get-args') || '[]') : '[]';
    var seq = (__refreshSeq[key] || 0) + 1;
    __refreshSeq[key] = seq;
    setBlocksLoading(oldBlocks);
    var headers = { 'x-kuratchi-refresh': '1' };
    if(qFn){ headers['x-kuratchi-query-fn'] = String(qFn); headers['x-kuratchi-query-args'] = qArgs; }
    return fetch(location.pathname + location.search, { headers: headers })
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function(html){
        if(__refreshSeq[key] !== seq) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newBlocks = by('[data-get]', doc).filter(function(el){ return blockKey(el) === key; });
        if(!oldBlocks.length || !newBlocks.length){ location.reload(); return; }
        for(var i=0;i<oldBlocks.length;i++){ if(newBlocks[i]) oldBlocks[i].outerHTML = newBlocks[i].outerHTML; }
        by('[data-select-all]').forEach(function(m){ var g=m.getAttribute('data-select-all'); if(g) syncGroup(g); });
      })
      .catch(function(){
        if(__refreshSeq[key] === seq) clearBlocksLoading(oldBlocks);
        location.reload();
      });
  }
  function replaceBlocksByDescriptor(fnName, argsRaw){
    if(!fnName || typeof DOMParser === 'undefined'){ location.reload(); return Promise.resolve(); }
    var normalizedArgs = String(argsRaw || '[]');
    var oldBlocks = by('[data-get]').filter(function(el){
      return (el.getAttribute('data-get') || '') === String(fnName) &&
        String(el.getAttribute('data-get-args') || '[]') === normalizedArgs;
    });
    if(!oldBlocks.length){ location.reload(); return Promise.resolve(); }
    var key = 'fn:' + String(fnName) + '|' + normalizedArgs;
    var seq = (__refreshSeq[key] || 0) + 1;
    __refreshSeq[key] = seq;
    setBlocksLoading(oldBlocks);
    return fetch(location.pathname + location.search, {
      headers: {
        'x-kuratchi-refresh': '1',
        'x-kuratchi-query-fn': String(fnName),
        'x-kuratchi-query-args': normalizedArgs,
      }
    })
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function(html){
        if(__refreshSeq[key] !== seq) return;
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newBlocks = by('[data-get]', doc).filter(function(el){
          return (el.getAttribute('data-get') || '') === String(fnName) &&
            String(el.getAttribute('data-get-args') || '[]') === normalizedArgs;
        });
        if(!newBlocks.length){ location.reload(); return; }
        for(var i=0;i<oldBlocks.length;i++){ if(newBlocks[i]) oldBlocks[i].outerHTML = newBlocks[i].outerHTML; }
        by('[data-select-all]').forEach(function(m){ var g=m.getAttribute('data-select-all'); if(g) syncGroup(g); });
      })
      .catch(function(){
        if(__refreshSeq[key] === seq) clearBlocksLoading(oldBlocks);
        location.reload();
      });
  }
  function refreshByDescriptor(fnName, argsRaw){
    if(!fnName) { location.reload(); return Promise.resolve(); }
    return replaceBlocksByDescriptor(fnName, argsRaw || '[]');
  }
  function refreshNearest(el){
    var host = el && el.closest ? el.closest('[data-get]') : null;
    if(!host){ location.reload(); return Promise.resolve(); }
    return replaceBlocksWithKey(blockKey(host));
  }
  function refreshTargets(raw){
    if(!raw){ location.reload(); return Promise.resolve(); }
    var keys = String(raw).split(',').map(function(v){ return v.trim(); }).filter(Boolean);
    if(!keys.length){ location.reload(); return Promise.resolve(); }
    return Promise.all(keys.map(function(k){ return replaceBlocksWithKey('key:' + k); })).then(function(){});
  }
  function act(e){
    if(e.type === 'click'){
      var g = e.target && e.target.closest ? e.target.closest('[data-get]') : null;
      if(g && !g.hasAttribute('data-as') && !g.hasAttribute('data-action')){
        var getUrl = g.getAttribute('data-get');
        if(getUrl){
          if(/^[a-z][a-z0-9+\-.]*:/i.test(getUrl) && !/^https?:/i.test(getUrl)) return;
          e.preventDefault();
          location.assign(getUrl);
          return;
        }
      }
      var r = e.target && e.target.closest ? e.target.closest('[data-refresh]') : null;
      if(r && !r.hasAttribute('data-action')){
        e.preventDefault();
        var rf = r.getAttribute('data-refresh');
        var ra = r.getAttribute('data-refresh-args');
        if(ra !== null){ refreshByDescriptor(rf, ra || '[]'); return; }
        if(rf && rf.trim()){ refreshTargets(rf); return; }
        refreshNearest(r);
        return;
      }
    }
    var sel = '[data-action][data-action-event="' + e.type + '"]';
    var b = e.target && e.target.closest ? e.target.closest(sel) : null;
    if(!b) return;
    e.preventDefault();
    var fd = new FormData();
    fd.append('_action', b.getAttribute('data-action') || '');
    fd.append('_args', b.getAttribute('data-args') || '[]');
    var m = b.getAttribute('data-action-method');
    if(m) fd.append('_method', String(m).toUpperCase());
    fetch(location.pathname, { method: 'POST', body: fd })
      .then(function(r){
        if(!r.ok){
          return r.json().then(function(j){ throw new Error((j && j.error) || ('HTTP ' + r.status)); }).catch(function(){ throw new Error('HTTP ' + r.status); });
        }
        return r.json();
      })
      .then(function(j){
        if(j && j.redirectTo){ location.assign(j.redirectTo); return; }
        if(!b.hasAttribute('data-refresh')) return;
        var refreshFn = b.getAttribute('data-refresh');
        var refreshArgs = b.getAttribute('data-refresh-args');
        if(refreshArgs !== null){ return refreshByDescriptor(refreshFn, refreshArgs || '[]'); }
        if(refreshFn && refreshFn.trim()){ return refreshTargets(refreshFn); }
        return refreshNearest(b);
      })
      .catch(function(err){ console.error('[kuratchi] client action error:', err); });
  }
  ['click','change','input','focus','blur'].forEach(function(ev){ document.addEventListener(ev, act, true); });
  function autoLoadQueries(){
    var seen = Object.create(null);
    by('[data-get][data-as]').forEach(function(el){
      var fn = el.getAttribute('data-get');
      if(!fn) return;
      var args = String(el.getAttribute('data-get-args') || '[]');
      var key = String(fn) + '|' + args;
      if(seen[key]) return;
      seen[key] = true;
      replaceBlocksByDescriptor(fn, args);
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoLoadQueries, { once: true });
  } else {
    autoLoadQueries();
  }
  document.addEventListener('click', function(e){
    var b = e.target && e.target.closest ? e.target.closest('[command="fill-dialog"]') : null;
    if(!b) return;
    var targetId = b.getAttribute('commandfor');
    if(!targetId) return;
    var dialog = document.getElementById(targetId);
    if(!dialog) return;
    var raw = b.getAttribute('data-dialog-data');
    if(!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch(_err) { return; }
    Object.keys(data).forEach(function(k){
      var inp = dialog.querySelector('[name="col_' + k + '"]');
      if(inp){
        inp.value = data[k] === null || data[k] === undefined ? '' : String(data[k]);
        inp.placeholder = data[k] === null || data[k] === undefined ? 'NULL' : '';
      }
      var hidden = dialog.querySelector('#dialog-field-' + k);
      if(hidden){
        hidden.value = data[k] === null || data[k] === undefined ? '' : String(data[k]);
      }
    });
    var rowidInp = dialog.querySelector('[name="rowid"]');
    if(rowidInp && data.rowid !== undefined) rowidInp.value = String(data.rowid);
    if(typeof dialog.showModal === 'function') dialog.showModal();
  }, true);
  (function initPoll(){
    var prev = {};
    function bindPollEl(el){
      if(!el || !el.getAttribute) return;
      if(el.getAttribute('data-kuratchi-poll-bound') === '1') return;
      var fn = el.getAttribute('data-poll');
      if(!fn) return;
      el.setAttribute('data-kuratchi-poll-bound', '1');
      var args = el.getAttribute('data-poll-args') || '[]';
      var iv = parseInt(el.getAttribute('data-interval') || '', 10) || 3000;
      var key = String(fn) + args;
      if(!(key in prev)) prev[key] = null;
      (function tick(){
        setTimeout(function(){
          fetch(location.pathname + '?_rpc=' + encodeURIComponent(String(fn)) + '&_args=' + encodeURIComponent(args), { headers: { 'x-kuratchi-rpc': '1' } })
            .then(function(r){ return r.json(); })
            .then(function(j){
              if(j && j.ok){
                var s = JSON.stringify(j.data);
                if(prev[key] !== null && prev[key] !== s){ location.reload(); return; }
                prev[key] = s;
              }
              tick();
            })
            .catch(function(){ tick(); });
        }, iv);
      })();
    }
    function scan(){
      by('[data-poll]').forEach(bindPollEl);
    }
    scan();
    setInterval(scan, 500);
  })();
  function confirmClick(e){
    var el = e.target && e.target.closest ? e.target.closest('[confirm]') : null;
    if(!el) return;
    var msg = el.getAttribute('confirm');
    if(!msg) return;
    if(!window.confirm(msg)){ e.preventDefault(); e.stopPropagation(); }
  }
  document.addEventListener('click', confirmClick, true);
  document.addEventListener('submit', function(e){
    var f = e.target && e.target.matches && e.target.matches('form[confirm]') ? e.target : null;
    if(!f) return;
    var msg = f.getAttribute('confirm');
    if(!msg) return;
    if(!window.confirm(msg)){ e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('submit', function(e){
    if(e.defaultPrevented) return;
    var f = e.target;
    if(!f || !f.querySelector) return;
    var aInput = f.querySelector('input[name="_action"]');
    if(!aInput) return;
    var aName = aInput.value;
    if(!aName) return;
    f.setAttribute('data-action-loading', aName);
    Array.prototype.slice.call(f.querySelectorAll('button[type="submit"],button:not([type="button"]):not([type="reset"])')).forEach(function(b){ b.disabled = true; });
  }, true);
  document.addEventListener('change', function(e){
    var t = e.target;
    if(!t || !t.getAttribute) return;
    var gAll = t.getAttribute('data-select-all');
    if(gAll){
      by('[data-select-item]').filter(function(i){ return i.getAttribute('data-select-item') === gAll; }).forEach(function(i){ i.checked = !!t.checked; });
      syncGroup(gAll);
      return;
    }
    var gItem = t.getAttribute('data-select-item');
    if(gItem) syncGroup(gItem);
  }, true);
  by('[data-select-all]').forEach(function(m){ var g = m.getAttribute('data-select-all'); if(g) syncGroup(g); });
})();`;
    const reactiveRuntimeSource = `(function(g){
  if(g.__kuratchiReactive) return;
  const targetMap = new WeakMap();
  const proxyMap = new WeakMap();
  let active = null;
  const queue = new Set();
  let flushing = false;
  function queueRun(fn){
    queue.add(fn);
    if(flushing) return;
    flushing = true;
    Promise.resolve().then(function(){
      try {
        const jobs = Array.from(queue);
        queue.clear();
        for (const job of jobs) job();
      } finally {
        flushing = false;
      }
    });
  }
  function cleanup(effect){
    const deps = effect.__deps || [];
    for (const dep of deps) dep.delete(effect);
    effect.__deps = [];
  }
  function track(target, key){
    if(!active) return;
    let depsMap = targetMap.get(target);
    if(!depsMap){ depsMap = new Map(); targetMap.set(target, depsMap); }
    let dep = depsMap.get(key);
    if(!dep){ dep = new Set(); depsMap.set(key, dep); }
    if(dep.has(active)) return;
    dep.add(active);
    if(!active.__deps) active.__deps = [];
    active.__deps.push(dep);
  }
  function trigger(target, key){
    const depsMap = targetMap.get(target);
    if(!depsMap) return;
    const effects = new Set();
    const add = function(k){
      const dep = depsMap.get(k);
      if(dep) dep.forEach(function(e){ effects.add(e); });
    };
    add(key);
    add('*');
    effects.forEach(function(e){ queueRun(e); });
  }
  function isObject(value){ return value !== null && typeof value === 'object'; }
  function proxify(value){
    if(!isObject(value)) return value;
    if(proxyMap.has(value)) return proxyMap.get(value);
    const proxy = new Proxy(value, {
      get(target, key, receiver){
        track(target, key);
        const out = Reflect.get(target, key, receiver);
        return isObject(out) ? proxify(out) : out;
      },
      set(target, key, next, receiver){
        const prev = target[key];
        const result = Reflect.set(target, key, next, receiver);
        if(prev !== next) trigger(target, key);
        if(Array.isArray(target) && key !== 'length') trigger(target, 'length');
        return result;
      },
      deleteProperty(target, key){
        const had = Object.prototype.hasOwnProperty.call(target, key);
        const result = Reflect.deleteProperty(target, key);
        if(had) trigger(target, key);
        return result;
      }
    });
    proxyMap.set(value, proxy);
    return proxy;
  }
  function effect(fn){
    const run = function(){
      cleanup(run);
      active = run;
      try { fn(); } finally { active = null; }
    };
    run.__deps = [];
    run();
    return function(){ cleanup(run); };
  }
  function state(initial){ return proxify(initial); }
  function replace(_prev, next){ return proxify(next); }
  g.__kuratchiReactive = { state, effect, replace };
})(window);`;
    const actionScript = `<script>${options.isDev ? bridgeSource : compactInlineJs(bridgeSource)}</script>`;
    const reactiveRuntimeScript = `<script>${options.isDev ? reactiveRuntimeSource : compactInlineJs(reactiveRuntimeSource)}</script>`;
    if (source.includes('</head>')) {
      source = source.replace('</head>', reactiveRuntimeScript + '\n</head>');
    } else {
      source = reactiveRuntimeScript + '\n' + source;
    }
    source = source.replace('</body>', actionScript + '\n</body>');

    // Parse layout for <script> block (component imports + data vars)
    const layoutParsed = parseFile(source, { kind: 'layout', filePath: layoutFile });
    const hasLayoutScript = layoutParsed.script && (Object.keys(layoutParsed.componentImports).length > 0 || layoutParsed.hasLoad);

    if (hasLayoutScript) {
      // Dynamic layout �" has component imports and/or data declarations
      // Compile component imports from layout
      for (const [pascalName, fileName] of Object.entries(layoutParsed.componentImports)) {
        compileComponent(fileName);
        layoutComponentNames.set(pascalName, fileName);
      }

      // Replace <slot></slot> with content parameter injection
      let layoutTemplate = layoutParsed.template.replace(/<slot\s*><\/slot>/g, '{@raw __content}');
      layoutTemplate = layoutTemplate.replace(/<slot\s*\/>/g, '{@raw __content}');

      // Build layout action names so action={fn} works in layouts, including action props
      // passed through child components like <Dashboard footerSignOutAction={signOut}>.
      const layoutActionNames = new Set(layoutParsed.actionFunctions);
      for (const [pascalName, compFileName] of layoutComponentNames.entries()) {
        const actionPropNames = componentActionCache.get(compFileName);
        const compTagRegex = new RegExp(`<${pascalName}\\b([\\s\\S]*?)(?:/?)>`, 'g');
        for (const tagMatch of layoutParsed.template.matchAll(compTagRegex)) {
          const attrs = tagMatch[1];
          if (actionPropNames && actionPropNames.size > 0) {
            for (const propName of actionPropNames) {
              const propRegex = new RegExp(`\\b${propName}=\\{([A-Za-z_$][\\w$]*)\\}`);
              const propMatch = attrs.match(propRegex);
              if (propMatch) {
                layoutActionNames.add(propMatch[1]);
              }
            }
          }
        }
      }

      // Compile the layout template with component + action support
      const layoutRenderBody = compileTemplate(layoutTemplate, layoutComponentNames, layoutActionNames);

      // Collect component CSS for layout
      const layoutComponentStyles: string[] = [];
      for (const fileName of layoutComponentNames.values()) {
        const css = componentStyleCache.get(fileName);
        if (css) layoutComponentStyles.push(css);
      }

      // Inject component CSS after 'let __html = "";'
      let finalLayoutBody = layoutRenderBody;
      if (layoutComponentStyles.length > 0) {
        const lines = layoutRenderBody.split('\n');
        const styleLines = layoutComponentStyles.map(css => `__html += \`${css}\\n\`;`);
        finalLayoutBody = [lines[0], ...styleLines, ...lines.slice(1)].join('\n');
      }

      // Build the layout script body (data vars, etc.)
      let layoutScriptBody = stripTopLevelImports(layoutParsed.script!);
      const layoutDevDecls = buildDevAliasDeclarations(layoutParsed.devAliases, !!options.isDev);
      layoutScriptBody = [layoutDevDecls, layoutScriptBody].filter(Boolean).join('\n');

      compiledLayout = `function __layout(__content) {
  const __esc = (v) => { if (v == null) return ''; return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  ${layoutScriptBody ? layoutScriptBody + '\n  ' : ''}${finalLayoutBody}
  return __html;
}`;
    } else {
      // Static layout �" no components, use fast string split (original behavior)
      const slotMarker = '<slot></slot>';
      const slotIdx = source.indexOf(slotMarker);
      if (slotIdx === -1) {
        throw new Error('layout.html must contain <slot></slot>');
      }
      const escLayout = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, () => '\\$');
      const before = escLayout(source.slice(0, slotIdx));
      const after = escLayout(source.slice(slotIdx + slotMarker.length));
      compiledLayout = `const __layoutBefore = \`${before}\`;\nconst __layoutAfter = \`${after}\`;\nfunction __layout(content) {\n  return __layoutBefore + content + __layoutAfter;\n}`;
    }
  }

  // Custom error pages: src/routes/NNN.html (e.g. 404.html, 500.html, 401.html, 403.html)
  // Only compiled if the user explicitly creates them �" otherwise the framework's built-in default is used
  const compiledErrorPages: Map<number, string> = new Map();
  for (const file of fs.readdirSync(routesDir)) {
    const match = file.match(/^(\d{3})\.html$/);
    if (!match) continue;
    const status = parseInt(match[1], 10);
    const source = fs.readFileSync(path.join(routesDir, file), 'utf-8');
    const body = compileTemplate(source);
    // 500.html receives `error` as a variable; others don't need it
    compiledErrorPages.set(status, `function __error_${status}(error) {\n  ${body}\n  return __html;\n}`);
  }

  // Read assets prefix from kuratchi.config.ts (default: /assets/)
  const assetsPrefix = readAssetsPrefix(projectDir);

  // Read kuratchi.config.ts at build time to discover ORM database configs
  const ormDatabases = readOrmConfig(projectDir);

  // Read auth config from kuratchi.config.ts
  const authConfig = readAuthConfig(projectDir);

  // Read Durable Object config and discover handler files
  const doConfig = readDoConfig(projectDir);
  const containerConfig = readWorkerClassConfig(projectDir, 'containers');
  const workflowConfig = readWorkerClassConfig(projectDir, 'workflows');
  const agentConfig = discoverConventionClassFiles(projectDir, path.join('src', 'server'), '.agent.ts', '.agent');
  const doHandlers = doConfig.length > 0
    ? discoverDoHandlers(srcDir, doConfig, ormDatabases)
    : [];

  // Generate handler proxy modules in .kuratchi/do/ (must happen BEFORE route processing
  // so that $durable-objects/X imports can be redirected to the generated proxies)
  const doProxyDir = path.join(projectDir, '.kuratchi', 'do');
  const doHandlerProxyPaths = new Map<string, string>();
  const registerDoProxyPath = (sourceAbsNoExt: string, proxyAbsNoExt: string) => {
    doHandlerProxyPaths.set(sourceAbsNoExt.replace(/\\/g, '/'), proxyAbsNoExt.replace(/\\/g, '/'));
  };
  if (doHandlers.length > 0) {
    if (!fs.existsSync(doProxyDir)) fs.mkdirSync(doProxyDir, { recursive: true });

    for (const handler of doHandlers) {
      const proxyCode = generateHandlerProxy(handler, projectDir);
      const proxyFile = path.join(doProxyDir, handler.fileName + '.js');
      const proxyFileDir = path.dirname(proxyFile);
      if (!fs.existsSync(proxyFileDir)) fs.mkdirSync(proxyFileDir, { recursive: true });
      writeIfChanged(proxyFile, proxyCode);
      const handlerAbsNoExt = handler.absPath.replace(/\\/g, '/').replace(/\.ts$/, '');
      const proxyAbsNoExt = proxyFile.replace(/\\/g, '/').replace(/\.js$/, '');
      registerDoProxyPath(handlerAbsNoExt, proxyAbsNoExt);
      // Backward-compatible alias for '.do' suffix.
      registerDoProxyPath(handlerAbsNoExt.replace(/\.do$/, ''), proxyAbsNoExt.replace(/\.do$/, ''));
      // Backward-compatible alias for `$durable-objects/<name>` imports.
      registerDoProxyPath(path.join(srcDir, 'durable-objects', handler.fileName).replace(/\\/g, '/'), proxyAbsNoExt);
      registerDoProxyPath(
        path.join(srcDir, 'durable-objects', handler.fileName.replace(/\.do$/, '')).replace(/\\/g, '/'),
        proxyAbsNoExt.replace(/\.do$/, ''),
      );
      if (handler.fileName.endsWith('.do')) {
        const aliasFileName = handler.fileName.slice(0, -3);
        const aliasProxyFile = path.join(doProxyDir, aliasFileName + '.js');
        const aliasCode = `// Auto-generated alias for .do handler\nexport * from './${handler.fileName}.js';\n`;
        const aliasProxyDir = path.dirname(aliasProxyFile);
        if (!fs.existsSync(aliasProxyDir)) fs.mkdirSync(aliasProxyDir, { recursive: true });
        writeIfChanged(aliasProxyFile, aliasCode);
        registerDoProxyPath(handlerAbsNoExt.replace(/\.do$/, ''), aliasProxyFile.replace(/\\/g, '/').replace(/\.js$/, ''));
      }
    }
  }

  const resolveExistingModuleFile = (absBase: string): string | null => {
    const candidates = [
      absBase,
      absBase + '.ts',
      absBase + '.js',
      absBase + '.mjs',
      absBase + '.cjs',
      path.join(absBase, 'index.ts'),
      path.join(absBase, 'index.js'),
      path.join(absBase, 'index.mjs'),
      path.join(absBase, 'index.cjs'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  };

  const toModuleSpecifier = (fromFileAbs: string, toFileAbs: string): string => {
    let rel = path.relative(path.dirname(fromFileAbs), toFileAbs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
  };

  const transformedServerModules = new Map<string, string>();
  const modulesOutDir = path.join(projectDir, '.kuratchi', 'modules');

  const resolveDoProxyTarget = (absPath: string): string | null => {
    const normalizedNoExt = absPath.replace(/\\/g, '/').replace(/\.[^.\/]+$/, '');
    const proxyNoExt = doHandlerProxyPaths.get(normalizedNoExt);
    if (!proxyNoExt) return null;
    return resolveExistingModuleFile(proxyNoExt) ?? (fs.existsSync(proxyNoExt + '.js') ? proxyNoExt + '.js' : null);
  };

  const resolveImportTarget = (importerAbs: string, spec: string): string | null => {
    if (spec.startsWith('$')) {
      const slashIdx = spec.indexOf('/');
      const folder = slashIdx === -1 ? spec.slice(1) : spec.slice(1, slashIdx);
      const rest = slashIdx === -1 ? '' : spec.slice(slashIdx + 1);
      if (!folder) return null;
      const abs = path.join(srcDir, folder, rest);
      return resolveExistingModuleFile(abs) ?? abs;
    }
    if (spec.startsWith('.')) {
      const abs = path.resolve(path.dirname(importerAbs), spec);
      return resolveExistingModuleFile(abs) ?? abs;
    }
    return null;
  };

  const transformServerModule = (entryAbsPath: string): string => {
    const resolved = resolveExistingModuleFile(entryAbsPath) ?? entryAbsPath;
    const normalized = resolved.replace(/\\/g, '/');
    const cached = transformedServerModules.get(normalized);
    if (cached) return cached;

    const relFromProject = path.relative(projectDir, resolved);
    const outPath = path.join(modulesOutDir, relFromProject);
    transformedServerModules.set(normalized, outPath);

    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    if (!/\.(ts|js|mjs|cjs)$/i.test(resolved) || !fs.existsSync(resolved)) {
      const passthrough = resolved;
      transformedServerModules.set(normalized, passthrough);
      return passthrough;
    }

    const source = fs.readFileSync(resolved, 'utf-8');
    const rewriteSpecifier = (spec: string): string => {
      const target = resolveImportTarget(resolved, spec);
      if (!target) return spec;

      const doProxyTarget = resolveDoProxyTarget(target);
      if (doProxyTarget) return toModuleSpecifier(outPath, doProxyTarget);

      const normalizedTarget = target.replace(/\\/g, '/');
      const inProject = normalizedTarget.startsWith(projectDir.replace(/\\/g, '/') + '/');
      if (!inProject) return spec;

      const targetResolved = resolveExistingModuleFile(target) ?? target;
      if (!/\.(ts|js|mjs|cjs)$/i.test(targetResolved)) return spec;
      const rewrittenTarget = transformServerModule(targetResolved);
      return toModuleSpecifier(outPath, rewrittenTarget);
    };

    let rewritten = source.replace(/(from\s+)(['"])([^'"]+)\2/g, (_m, p1: string, q: string, spec: string) => {
      return `${p1}${q}${rewriteSpecifier(spec)}${q}`;
    });
    rewritten = rewritten.replace(/(import\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g, (_m, p1: string, q: string, spec: string, p4: string) => {
      return `${p1}${q}${rewriteSpecifier(spec)}${q}${p4}`;
    });

    writeIfChanged(outPath, rewritten);
    return outPath;
  };

  const resolveCompiledImportPath = (origPath: string, importerDir: string, outFileDir: string): string => {
    const isBareModule = !origPath.startsWith('.') && !origPath.startsWith('/') && !origPath.startsWith('$');
    if (isBareModule) return origPath;

    let absImport: string;
    if (origPath.startsWith('$')) {
      const slashIdx = origPath.indexOf('/');
      const folder = slashIdx === -1 ? origPath.slice(1) : origPath.slice(1, slashIdx);
      const rest = slashIdx === -1 ? '' : origPath.slice(slashIdx + 1);
      absImport = path.join(srcDir, folder, rest);
    } else {
      absImport = path.resolve(importerDir, origPath);
    }

    const doProxyTarget = resolveDoProxyTarget(absImport);
    const target = doProxyTarget ?? transformServerModule(absImport);

    let relPath = path.relative(outFileDir, target).replace(/\\/g, '/');
    if (!relPath.startsWith('.')) relPath = './' + relPath;
    return relPath;
  };

  // Parse and compile each route
  const compiledRoutes: string[] = [];
  const allImports: string[] = [];

  let moduleCounter = 0;

  // Layout server import resolution �" resolve non-component imports to module IDs
  let isLayoutAsync = false;
  let compiledLayoutActions: string | null = null;
  if (compiledLayout && fs.existsSync(path.join(routesDir, 'layout.html'))) {
    const layoutSource = fs.readFileSync(path.join(routesDir, 'layout.html'), 'utf-8');
    const layoutParsedForImports = parseFile(layoutSource, { kind: 'layout', filePath: layoutFile });
    if (layoutParsedForImports.serverImports.length > 0) {
      const layoutFileDir = routesDir;
      const outFileDir = path.join(projectDir, '.kuratchi');
      const layoutFnToModule: Record<string, string> = {};

      for (const imp of layoutParsedForImports.serverImports) {
        const pathMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (!pathMatch) continue;
        const origPath = pathMatch[1];
        const importPath = resolveCompiledImportPath(origPath, layoutFileDir, outFileDir);

        const moduleId = `__m${moduleCounter++}`;
        allImports.push(`import * as ${moduleId} from '${importPath}';`);

        const namesMatch = imp.match(/import\s*\{([^}]+)\}/);
        if (namesMatch) {
          const names = namesMatch[1]
            .split(',')
            .map(n => n.trim())
            .filter(Boolean)
            .map(n => {
              const parts = n.split(/\s+as\s+/).map(p => p.trim()).filter(Boolean);
              return parts[1] || parts[0] || '';
            })
            .filter(Boolean);
          for (const name of names) {
            layoutFnToModule[name] = moduleId;
          }
        }
        const starMatch = imp.match(/import\s*\*\s*as\s+(\w+)/);
        if (starMatch) {
          layoutFnToModule[starMatch[1]] = moduleId;
        }
      }

      // Rewrite function calls in the compiled layout body
      for (const [fnName, moduleId] of Object.entries(layoutFnToModule)) {
        if (!/^[A-Za-z_$][\w$]*$/.test(fnName)) continue;
        const callRegex = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
        compiledLayout = compiledLayout!.replace(callRegex, `${moduleId}.${fnName}(`);
      }

      // Generate layout actions map for action={fn} in layouts and action props passed
      // through layout components.
      const layoutActionNames = new Set(layoutParsedForImports.actionFunctions);
      for (const [pascalName, compFileName] of layoutComponentNames.entries()) {
        const actionPropNames = componentActionCache.get(compFileName);
        const compTagRegex = new RegExp(`<${pascalName}\\b([\\s\\S]*?)(?:/?)>`, 'g');
        for (const tagMatch of layoutParsedForImports.template.matchAll(compTagRegex)) {
          const attrs = tagMatch[1];
          if (actionPropNames && actionPropNames.size > 0) {
            for (const propName of actionPropNames) {
              const propRegex = new RegExp(`\\b${propName}=\\{([A-Za-z_$][\\w$]*)\\}`);
              const propMatch = attrs.match(propRegex);
              if (propMatch) {
                layoutActionNames.add(propMatch[1]);
              }
            }
          }
        }
      }

      if (layoutActionNames.size > 0) {
        const actionEntries = Array.from(layoutActionNames)
          .filter(fn => fn in layoutFnToModule)
          .map(fn => `'${fn}': ${layoutFnToModule[fn]}.${fn}`)
          .join(', ');
        if (actionEntries) {
          compiledLayoutActions = `{ ${actionEntries} }`;
        }
      }
    }

    // Detect if the compiled layout uses await �' make it async
    isLayoutAsync = /\bawait\b/.test(compiledLayout!);
    if (isLayoutAsync) {
      compiledLayout = compiledLayout!.replace(/^function __layout\(/, 'async function __layout(');
    }
  }

  for (let i = 0; i < routeFiles.length; i++) {
    const rf = routeFiles[i];
    const fullPath = path.join(routesDir, rf.file);
    const pattern = filePathToPattern(rf.name);

    // -- API route (index.ts / index.js) --
    if (rf.type === 'api') {
      const outFileDir = path.join(projectDir, '.kuratchi');
      // Resolve the route file's absolute path through transformServerModule
      // so that $-prefixed imports inside it get rewritten correctly
      const absRoutePath = transformServerModule(fullPath);
      let importPath = path.relative(outFileDir, absRoutePath).replace(/\\/g, '/');
      if (!importPath.startsWith('.')) importPath = './' + importPath;
      const moduleId = `__m${moduleCounter++}`;
      allImports.push(`import * as ${moduleId} from '${importPath}';`);

      // Scan the source for exported method handlers (only include what exists)
      const apiSource = fs.readFileSync(fullPath, 'utf-8');
      const allMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      const exportedMethods = allMethods.filter(m => {
        // Match: export function GET, export async function GET, export { ... as GET }
        const fnPattern = new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`);
        const reExportPattern = new RegExp(`export\\s*\\{[^}]*\\b\\w+\\s+as\\s+${m}\\b`);
        const namedExportPattern = new RegExp(`export\\s*\\{[^}]*\\b${m}\\b`);
        return fnPattern.test(apiSource) || reExportPattern.test(apiSource) || namedExportPattern.test(apiSource);
      });
      const methodEntries = exportedMethods
        .map(m => `${m}: ${moduleId}.${m}`)
        .join(', ');
      compiledRoutes.push(`{ pattern: '${pattern}', __api: true, ${methodEntries} }`);
      continue;
    }

    // -- Page route (page.html) --
    const source = fs.readFileSync(fullPath, 'utf-8');
    const parsed = parseFile(source, { kind: 'route', filePath: fullPath });

    let effectiveTemplate = parsed.template;
    const routeScriptParts: string[] = [];
    const routeScriptSegments: Array<{ script: string; dataVars: string[] }> = [];
    const routeServerImportEntries: Array<{ line: string; importerDir: string }> = parsed.serverImports.map((line) => ({
      line,
      importerDir: path.dirname(fullPath),
    }));
    const routeClientImportEntries: Array<{ line: string; importerDir: string }> = parsed.clientImports.map((line) => ({
      line,
      importerDir: path.dirname(fullPath),
    }));
    const mergedActionFunctions = [...parsed.actionFunctions];
    const mergedDataVars = [...parsed.dataVars];
    const mergedPollFunctions = [...parsed.pollFunctions];
    const mergedDataGetQueries = parsed.dataGetQueries.map((query) => ({ ...query }));
    const mergedComponentImports: Record<string, string> = { ...parsed.componentImports };
    const mergedWorkerEnvAliases = [...parsed.workerEnvAliases];
    const mergedDevAliases = [...parsed.devAliases];

    for (const layoutRelPath of rf.layouts) {
      if (layoutRelPath === 'layout.html') continue;
      const layoutPath = path.join(routesDir, layoutRelPath);
      if (!fs.existsSync(layoutPath)) continue;
      const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
      const layoutParsed = parseFile(layoutSource, { kind: 'layout', filePath: layoutPath });
      if (layoutParsed.loadFunction) {
        throw new Error(`${layoutRelPath} cannot export load(); nested layouts currently share the child route load lifecycle.`);
      }
      const layoutSlot = layoutParsed.template.match(/<slot\s*><\/slot>|<slot\s*\/>/);
      if (!layoutSlot) {
        throw new Error(`${layoutRelPath} must contain <slot></slot> or <slot />`);
      }
      if (layoutParsed.script) {
        routeScriptParts.push(layoutParsed.script);
        routeScriptSegments.push({ script: layoutParsed.script, dataVars: [...layoutParsed.dataVars] });
      }
      for (const line of layoutParsed.serverImports) {
        routeServerImportEntries.push({ line, importerDir: path.dirname(layoutPath) });
      }
      for (const line of layoutParsed.clientImports) {
        routeClientImportEntries.push({ line, importerDir: path.dirname(layoutPath) });
      }
      for (const fnName of layoutParsed.actionFunctions) {
        if (!mergedActionFunctions.includes(fnName)) mergedActionFunctions.push(fnName);
      }
      for (const varName of layoutParsed.dataVars) {
        if (!mergedDataVars.includes(varName)) mergedDataVars.push(varName);
      }
      for (const fnName of layoutParsed.pollFunctions) {
        if (!mergedPollFunctions.includes(fnName)) mergedPollFunctions.push(fnName);
      }
      for (const query of layoutParsed.dataGetQueries) {
        if (!mergedDataGetQueries.some((existing) => existing.asName === query.asName)) {
          mergedDataGetQueries.push({ ...query });
        }
      }
      for (const [pascalName, fileName] of Object.entries(layoutParsed.componentImports)) {
        mergedComponentImports[pascalName] = fileName;
      }
      for (const alias of layoutParsed.workerEnvAliases) {
        if (!mergedWorkerEnvAliases.includes(alias)) mergedWorkerEnvAliases.push(alias);
      }
      for (const alias of layoutParsed.devAliases) {
        if (!mergedDevAliases.includes(alias)) mergedDevAliases.push(alias);
      }
      effectiveTemplate = layoutParsed.template.replace(layoutSlot[0], effectiveTemplate);
    }

    if (parsed.script) {
      routeScriptParts.push(parsed.script);
      routeScriptSegments.push({ script: parsed.script, dataVars: [...parsed.dataVars] });
    }

    const routeImportDecls: string[] = [];
    const routeImportDeclMap = new Map<string, string>();
    const routeScriptReferenceSource = [ ...routeScriptParts.map((script) => stripTopLevelImports(script)), parsed.loadFunction || '' ].join('\n');

    const mergedParsed = {
      ...parsed,
      template: effectiveTemplate,
      script: routeScriptParts.length > 0 ? routeScriptParts.join('\n\n') : parsed.script,
      serverImports: routeServerImportEntries.map((entry) => entry.line),
      clientImports: routeClientImportEntries.map((entry) => entry.line),
      actionFunctions: mergedActionFunctions,
      dataVars: mergedDataVars,
      componentImports: mergedComponentImports,
      pollFunctions: mergedPollFunctions,
      dataGetQueries: mergedDataGetQueries,
      workerEnvAliases: mergedWorkerEnvAliases,
      devAliases: mergedDevAliases,
      scriptImportDecls: routeImportDecls,
      scriptSegments: routeScriptSegments,
    };

    // Build a mapping: functionName ? moduleId for all imports in this route
    const fnToModule: Record<string, string> = {};
    const outFileDir = path.join(projectDir, '.kuratchi');

    const neededServerFns = new Set<string>([
      ...mergedActionFunctions,
      ...mergedPollFunctions,
      ...mergedDataGetQueries.map((q) => q.fnName),
    ]);
    const routeServerImports = routeServerImportEntries.length > 0
      ? routeServerImportEntries
      : routeClientImportEntries.filter((entry) => filterClientImportsForServer([entry.line], neededServerFns).length > 0);

    if (routeServerImports.length > 0) {
      for (const entry of routeServerImports) {
        const imp = entry.line;
        const pathMatch = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (!pathMatch) continue;
        const origPath = pathMatch[1];

        const importPath = resolveCompiledImportPath(origPath, entry.importerDir, outFileDir);

        const moduleId = `__m${moduleCounter++}`;
        allImports.push(`import * as ${moduleId} from '${importPath}';`);

        const namedBindings = parseNamedImportBindings(imp);
        if (namedBindings.length > 0) {
          for (const binding of namedBindings) {
            fnToModule[binding.local] = moduleId;
            if (routeScriptReferenceSource.includes(binding.local) && !routeImportDeclMap.has(binding.local)) {
              routeImportDeclMap.set(binding.local, `const ${binding.local} = ${moduleId}.${binding.imported};`);
            }
          }
        }
        const starMatch = imp.match(/import\s*\*\s*as\s+(\w+)/);
        if (starMatch) {
          fnToModule[starMatch[1]] = moduleId;
          if (routeScriptReferenceSource.includes(starMatch[1]) && !routeImportDeclMap.has(starMatch[1])) {
            routeImportDeclMap.set(starMatch[1], `const ${starMatch[1]} = ${moduleId};`);
          }
        }
      }
    }
    routeImportDecls.push(...routeImportDeclMap.values());
    const routeComponentNames: Map<string, string> = new Map();
    for (const [pascalName, fileName] of Object.entries(mergedComponentImports)) {
      compileComponent(fileName);
      routeComponentNames.set(pascalName, fileName);
    }

    for (const [pascalName, compFileName] of routeComponentNames.entries()) {
      const actionPropNames = componentActionCache.get(compFileName);
      const compTagRegex = new RegExp(`<${pascalName}\\b([\\s\\S]*?)(?:/?)>`, 'g');
      for (const tagMatch of effectiveTemplate.matchAll(compTagRegex)) {
        const attrs = tagMatch[1];
        if (actionPropNames && actionPropNames.size > 0) {
          for (const propName of actionPropNames) {
            const propRegex = new RegExp(`\\b${propName}=\\{([A-Za-z_$][\\w$]*)\\}`);
            const propMatch = attrs.match(propRegex);
            if (propMatch) {
              const routeFnName = propMatch[1];
              if (routeFnName in fnToModule && !mergedActionFunctions.includes(routeFnName)) {
                mergedActionFunctions.push(routeFnName);
              }
            }
          }
        }
      }
    }

    const dataVarsSet = new Set(mergedDataVars);
    const actionNames = new Set(mergedActionFunctions.filter(fn => fn in fnToModule || dataVarsSet.has(fn)));
    const rpcNameMap = new Map<string, string>();
    let rpcCounter = 0;
    for (const fnName of mergedPollFunctions) {
      if (!rpcNameMap.has(fnName)) {
        rpcNameMap.set(fnName, `rpc_${i}_${rpcCounter++}`);
      }
    }
    for (const q of mergedDataGetQueries) {
      if (!rpcNameMap.has(q.fnName)) {
        rpcNameMap.set(q.fnName, `rpc_${i}_${rpcCounter++}`);
      }
      q.rpcId = rpcNameMap.get(q.fnName)!;
    }

    const renderBody = compileTemplate(effectiveTemplate, routeComponentNames, actionNames, rpcNameMap);

    // Collect component CSS for this route (compile-time dedup)
    const routeComponentStyles: string[] = [];
    for (const fileName of routeComponentNames.values()) {
      const css = componentStyleCache.get(fileName);
      if (css) routeComponentStyles.push(css);
    }

    // Build the route module object
    const routeObj = buildRouteObject({
      index: i,
      pattern,
      renderBody,
      isDev: !!options.isDev,
      parsed: mergedParsed,
      fnToModule,
      rpcNameMap,
      componentStyles: routeComponentStyles,
    });

    compiledRoutes.push(routeObj);
  }

  // Scan src/assets/ for static files to embed (recursive)
  const assetsDir = path.join(srcDir, 'assets');
  const compiledAssets: { name: string; content: string; mime: string; etag: string }[] = [];
  if (fs.existsSync(assetsDir)) {
    const mimeTypes: Record<string, string> = {
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.txt': 'text/plain; charset=utf-8',
    };
    const scanAssets = (dir: string, prefix: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.isDirectory()) {
          scanAssets(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        const mime = mimeTypes[ext];
        if (!mime) continue;
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
        const etag = '"' + crypto.createHash('md5').update(content).digest('hex').slice(0, 12) + '"';
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        compiledAssets.push({ name, content, mime, etag });
      }
    };
    scanAssets(assetsDir, '');
  }

  // Collect only the components that were actually imported by routes
  const compiledComponents = Array.from(compiledComponentCache.values());

  // Generate the routes module
  const rawRuntimeImportPath = resolveRuntimeImportPath(projectDir);
  let runtimeImportPath: string | undefined;
  if (rawRuntimeImportPath) {
    // Resolve the runtime file's absolute path and pass it through transformServerModule
    // so that $durable-objects/* and other project imports get rewritten to their proxies.
    const runtimeAbs = path.resolve(path.join(projectDir, '.kuratchi'), rawRuntimeImportPath);
    const transformedRuntimePath = transformServerModule(runtimeAbs);
    const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.js');
    runtimeImportPath = toModuleSpecifier(outFile, transformedRuntimePath);
  }
  const hasRuntime = !!runtimeImportPath;
  const output = generateRoutesModule({
    projectDir,
    serverImports: allImports,
    compiledRoutes,
    compiledLayout,
    compiledComponents,
    compiledAssets,
    compiledErrorPages,
    ormDatabases,
    authConfig,
    doConfig,
    doHandlers,
    isDev: options.isDev ?? false,
    isLayoutAsync,
    compiledLayoutActions,
    hasRuntime,
    runtimeImportPath,
    assetsPrefix,
  });

  // Write to .kuratchi/routes.js
  const outFile = options.outFile ?? path.join(projectDir, '.kuratchi', 'routes.js');
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  writeIfChanged(outFile, output);

  // Generate .kuratchi/worker.js � the stable wrangler entry point.
  // routes.js already exports the default fetch handler and all named DO classes;
  // worker.js explicitly re-exports them so wrangler.jsonc can reference a
  // stable filename while routes.js is freely regenerated.
  const workerFile = path.join(outDir, 'worker.js');
  const workerClassExports = [...agentConfig, ...containerConfig, ...workflowConfig]
    .map((entry) => {
      const importPath = toWorkerImportPath(projectDir, outDir, entry.file);
      if (entry.exportKind === 'default') {
        return `export { default as ${entry.className} } from '${importPath}';`;
      }
      return `export { ${entry.className} } from '${importPath}';`;
    });
  const workerLines = [
    '// Auto-generated by kuratchi \u2014 do not edit.',
    "export { default } from './routes.js';",
    ...doConfig.map(c => `export { ${c.className} } from './routes.js';`),
    ...workerClassExports,
    '',
  ];
  writeIfChanged(workerFile, workerLines.join('\n'));

  return workerFile;
}

// �"��"� Helpers �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

/**
 * Write a file only if its content has changed.
 * Prevents unnecessary filesystem events that would retrigger wrangler's file watcher.
 */
function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8');
    if (existing === content) return;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

type ConfigBlockKind = 'call-object' | 'call-empty';

interface ConfigBlockMatch {
  kind: ConfigBlockKind;
  body: string;
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

/**
 * Read ui.theme from kuratchi.config.ts and return the theme CSS content.
 * Returns null if no theme is configured.
 */
function readUiTheme(projectDir: string): string | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const uiBlock = readConfigBlock(source, 'ui');
  if (!uiBlock) return null;

  // Adapter form defaults to the bundled Kuratchi UI theme when ui config is present.
  const themeMatch = uiBlock.body.match(/theme\s*:\s*['"]([^'"]+)['"]/);
  const themeValue = themeMatch?.[1] ?? 'default';

  if (themeValue === 'default' || themeValue === 'dark' || themeValue === 'light' || themeValue === 'system') {
    // Resolve @kuratchi/ui/src/styles/theme.css from package
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

  // Custom path �" resolve relative to project root
  const customPath = path.resolve(projectDir, themeValue);
  if (fs.existsSync(customPath)) {
    return fs.readFileSync(customPath, 'utf-8');
  }

  console.warn(`[kuratchi] ui.theme: "${themeValue}" not found at ${customPath}`);
  return null;
}

/**
 * Read ui.theme and ui.radius config values from kuratchi.config.ts.
 * Returns null if no ui block is present.
 */
function readUiConfigValues(projectDir: string): { theme: string; radius: string } | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;
  const source = fs.readFileSync(configPath, 'utf-8');
  const uiBlock = readConfigBlock(source, 'ui');
  if (!uiBlock) return null;
  const themeMatch = uiBlock.body.match(/theme\s*:\s*['"]([^'"]+)['"]/);
  const radiusMatch = uiBlock.body.match(/radius\s*:\s*['"]([^'"]+)['"]/);
  return {
    theme: themeMatch?.[1] ?? 'dark',
    radius: radiusMatch?.[1] ?? 'default',
  };
}

/**
 * Patch the opening <html> tag in a layout source string to reflect ui config.
 * theme='dark'   ? ensures class="dark" is present, removes data-theme.
 * theme='light'  ? ensures class="dark" is absent, removes data-theme.
 * theme='system' ? removes class="dark", sets data-theme="system".
 * radius='none'|'full' ? sets data-radius; radius='default' ? removes it.
 */
function patchHtmlTag(source: string, theme: string, radius: string): string {
  return source.replace(/(<html\b)([^>]*)(>)/i, (_m: string, open: string, attrs: string, close: string) => {
    if (theme === 'dark') {
      if (/\bclass\s*=\s*"([^"]*)"/i.test(attrs)) {
        attrs = attrs.replace(/class\s*=\s*"([^"]*)"/i, (_mc: string, cls: string) => {
          const classes = cls.split(/\s+/).filter(Boolean);
          if (!classes.includes('dark')) classes.unshift('dark');
          return `class="${classes.join(' ')}"`;
        });
      } else {
        attrs += ' class="dark"';
      }
      attrs = attrs.replace(/\s*data-theme\s*=\s*"[^"]*"/i, '');
    } else if (theme === 'light') {
      attrs = attrs.replace(/class\s*=\s*"([^"]*)"/i, (_mc: string, cls: string) => {
        const classes = cls.split(/\s+/).filter(Boolean).filter((c: string) => c !== 'dark');
        return classes.length ? `class="${classes.join(' ')}"` : '';
      });
      attrs = attrs.replace(/\s*data-theme\s*=\s*"[^"]*"/i, '');
    } else if (theme === 'system') {
      attrs = attrs.replace(/class\s*=\s*"([^"]*)"/i, (_mc: string, cls: string) => {
        const classes = cls.split(/\s+/).filter(Boolean).filter((c: string) => c !== 'dark');
        return classes.length ? `class="${classes.join(' ')}"` : '';
      });
      if (/data-theme\s*=/i.test(attrs)) {
        attrs = attrs.replace(/data-theme\s*=\s*"[^"]*"/i, 'data-theme="system"');
      } else {
        attrs += ' data-theme="system"';
      }
    }
    attrs = attrs.replace(/\s*data-radius\s*=\s*"[^"]*"/i, '');
    if (radius === 'none' || radius === 'full') {
      attrs += ` data-radius="${radius}"`;
    }
    return open + attrs + close;
  });
}

/**
 * Resolve a component .html file from a package (e.g. @kuratchi/ui).
 * Searches: node_modules, then workspace siblings (../../packages/).
 */
function resolvePackageComponent(projectDir: string, pkgName: string, componentFile: string): string {
  // 1. Try node_modules (standard resolution)
  const nmPath = path.join(projectDir, 'node_modules', pkgName, 'src', 'lib', componentFile + '.html');
  if (fs.existsSync(nmPath)) return nmPath;

  // 2. Try workspace layout: project is in apps/X or packages/X, sibling packages in packages/
  // @kuratchi/ui �' kuratchi-ui (convention: scope stripped, slash �' dash)
  const pkgDirName = pkgName.replace(/^@/, '').replace(/\//g, '-');
  const workspaceRoot = path.resolve(projectDir, '../..');
  const wsPath = path.join(workspaceRoot, 'packages', pkgDirName, 'src', 'lib', componentFile + '.html');
  if (fs.existsSync(wsPath)) return wsPath;

  // 3. Try one level up (monorepo root node_modules)
  const rootNmPath = path.join(workspaceRoot, 'node_modules', pkgName, 'src', 'lib', componentFile + '.html');
  if (fs.existsSync(rootNmPath)) return rootNmPath;

  return '';
}

interface RouteFile {
  /** File path relative to routes/ (e.g., 'todos.html') */
  file: string;
  /** Route name without extension (e.g., 'todos', 'blog/[slug]') */
  name: string;
  /** Applicable layout files (outermost -> innermost), relative to routes/ */
  layouts: string[];
  /** Route type: 'page' for .html routes, 'api' for route.ts/route.js */
  type: 'page' | 'api';
}

function discoverRoutes(routesDir: string): RouteFile[] {
  const results: RouteFile[] = [];
  const registered = new Set<string>();

  function getLayoutsForPrefix(prefix: string): string[] {
    const layouts: string[] = [];
    if (fs.existsSync(path.join(routesDir, 'layout.html'))) layouts.push('layout.html');
    if (!prefix) return layouts;

    const parts = prefix.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const rel = `${current}/layout.html`;
      if (fs.existsSync(path.join(routesDir, rel))) layouts.push(rel);
    }
    return layouts;
  }

  function walk(dir: string, prefix: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Folder-based page route: routes/db/page.html ? /db
        const pageFile = path.join(dir, entry.name, 'page.html');
        if (fs.existsSync(pageFile)) {
          const routeFile = `${childPrefix}/page.html`;
          if (!registered.has(routeFile)) {
            registered.add(routeFile);
            results.push({ file: routeFile, name: childPrefix, layouts: getLayoutsForPrefix(childPrefix), type: 'page' });
          }
        }
        // Folder-based API route: routes/api/v1/health/index.ts -> /api/v1/health
        const apiFile = ['index.ts', 'index.js'].find(f =>
          fs.existsSync(path.join(dir, entry.name, f))
        );
        if (apiFile && !fs.existsSync(pageFile)) {
          const routeFile = `${childPrefix}/${apiFile}`;
          if (!registered.has(routeFile)) {
            registered.add(routeFile);
            results.push({ file: routeFile, name: childPrefix, layouts: [], type: 'api' });
          }
        }
        // Always recurse into subdirectory (for nested routes like /admin/roles)
        walk(path.join(dir, entry.name), childPrefix);
      } else if (entry.name === 'layout.html' || entry.name === '404.html' || entry.name === '500.html') {
        // Skip � layout.html is the app layout, 404/500 are error pages, not routes
        continue;
      } else if (entry.name === 'index.ts' || entry.name === 'index.js') {
        // API route file in current directory -> index API route for this prefix
        const routeFile = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!registered.has(routeFile)) {
          registered.add(routeFile);
          results.push({ file: routeFile, name: prefix || 'index', layouts: [], type: 'api' });
        }
      } else if (entry.name === 'page.html') {
        // page.html in current directory ? index route for this prefix
        const routeFile = prefix ? `${prefix}/page.html` : 'page.html';
        if (!registered.has(routeFile)) {
          registered.add(routeFile);
          results.push({ file: routeFile, name: prefix || 'index', layouts: getLayoutsForPrefix(prefix), type: 'page' });
        }
      } else if (entry.name.endsWith('.html') && entry.name !== 'page.html') {
        // File-based route: routes/about.html ? /about (fallback)
        const name = prefix
          ? `${prefix}/${entry.name.replace('.html', '')}`
          : entry.name.replace('.html', '');
        results.push({
          file: prefix ? `${prefix}/${entry.name}` : entry.name,
          name,
          layouts: getLayoutsForPrefix(prefix),
          type: 'page',
        });
      }
    }
  }

  walk(routesDir, '');

  // Sort: static routes first, then dynamic, then catch-all
  results.sort((a, b) => {
    const aScore = a.name.includes('[...') ? 2 : a.name.includes('[') ? 1 : 0;
    const bScore = b.name.includes('[...') ? 2 : b.name.includes('[') ? 1 : 0;
    return aScore - bScore || a.name.localeCompare(b.name);
  });

  return results;
}

function buildSegmentedScriptBody(opts: {
  segments: Array<{ script: string; dataVars: string[] }>;
  fnToModule: Record<string, string>;
  importDecls?: string;
  workerEnvAliases: string[];
  devAliases: string[];
  isDev: boolean;
  asyncMode: boolean;
}): string {
  const { segments, fnToModule, importDecls, workerEnvAliases, devAliases, isDev, asyncMode } = opts;
  const lines: string[] = [];
  const routeDevDecls = buildDevAliasDeclarations(devAliases, isDev);
  if (routeDevDecls) lines.push(routeDevDecls);
  if (importDecls) lines.push(importDecls);
  lines.push('const __segmentData: Record<string, any> = {};');

  const availableVars: string[] = [];
  let segmentIndex = 0;
  for (const segment of segments) {
    if (!segment.script) continue;
    let segmentBody = stripTopLevelImports(segment.script);
    segmentBody = rewriteImportedFunctionCalls(segmentBody, fnToModule);
    segmentBody = rewriteWorkerEnvAliases(segmentBody, workerEnvAliases);
    if (!segmentBody.trim()) continue;

    const returnVars = segment.dataVars.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
    const segmentVar = '__segment_' + segmentIndex++;
    const invokePrefix = asyncMode ? 'await ' : '';
    const factoryPrefix = asyncMode ? 'async ' : '';

    lines.push('const ' + segmentVar + ' = ' + invokePrefix + '(' + factoryPrefix + '(__ctx: Record<string, any>) => {');
    lines.push(segmentBody);
    lines.push(returnVars.length > 0 ? 'return { ' + returnVars.join(', ') + ' };' : 'return {};');
    lines.push('})(__segmentData);');
    lines.push('Object.assign(__segmentData, ' + segmentVar + ');');

    for (const name of returnVars) {
      if (!availableVars.includes(name)) availableVars.push(name);
    }
  }

  if (!asyncMode && availableVars.length > 0) {
    lines.push('const { ' + availableVars.join(', ') + ' } = __segmentData;');
  }

  return lines.join('\n');
}
function buildRouteObject(opts: {
  index: number;
  pattern: string;
  renderBody: string;
  isDev: boolean;
  parsed: ReturnType<typeof parseFile>;
  fnToModule: Record<string, string>;
  rpcNameMap?: Map<string, string>;
  componentStyles: string[];
}): string {
  const { pattern, renderBody, isDev, parsed, fnToModule, rpcNameMap, componentStyles } = opts;
  const hasFns = Object.keys(fnToModule).length > 0;

  const parts: string[] = [];
  parts.push(`    pattern: '${pattern}'`);

  const queryVars = ((parsed as any).dataGetQueries as Array<{ asName: string }> | undefined)?.map((q) => q.asName) ?? [];
  const scriptSegments = (((parsed as any).scriptSegments as Array<{ script: string; dataVars: string[] }> | undefined) ?? [])
    .filter((segment) => !!segment.script);
  const hasSegmentedScripts = scriptSegments.length > 1;
  const routeDevDecls = buildDevAliasDeclarations(parsed.devAliases, isDev);
  const routeImportDecls = (((parsed as any).scriptImportDecls as string[] | undefined) ?? []).join('\n');

  let scriptBody = '';
  let scriptUsesAwait = false;
  if (hasSegmentedScripts) {
    const combinedScript = scriptSegments.map((segment) => stripTopLevelImports(segment.script)).join('\n');
    scriptUsesAwait = /\bawait\b/.test(combinedScript);
    scriptBody = buildSegmentedScriptBody({
      segments: scriptSegments,
      fnToModule,
      importDecls: routeImportDecls,
      workerEnvAliases: parsed.workerEnvAliases,
      devAliases: parsed.devAliases,
      isDev,
      asyncMode: scriptUsesAwait,
    });
  } else {
    scriptBody = parsed.script
      ? stripTopLevelImports(parsed.script)
      : '';
    scriptBody = [routeDevDecls, routeImportDecls, scriptBody].filter(Boolean).join('\n');
    scriptBody = rewriteImportedFunctionCalls(scriptBody, fnToModule);
    scriptBody = rewriteWorkerEnvAliases(scriptBody, parsed.workerEnvAliases);
    scriptUsesAwait = /\bawait\b/.test(scriptBody);
  }

  let explicitLoadFunction = parsed.loadFunction
    ? parsed.loadFunction.replace(/^export\s+/, '').trim()
    : '';
  if (explicitLoadFunction) {
    explicitLoadFunction = [routeDevDecls, explicitLoadFunction].filter(Boolean).join('\n');
    explicitLoadFunction = rewriteImportedFunctionCalls(explicitLoadFunction, fnToModule);
    explicitLoadFunction = rewriteWorkerEnvAliases(explicitLoadFunction, parsed.workerEnvAliases);
    if (routeImportDecls) explicitLoadFunction = explicitLoadFunction.replace('{', `{\n${routeImportDecls}\n`);
  }

  if (explicitLoadFunction && scriptUsesAwait) {
    throw new Error(
      `[kuratchi compiler] ${pattern}\nTop-level await cannot be mixed with export async function load(). Move async server work into load().`,
    );
  }

  if (scriptBody) {
    scriptBody = transpileTypeScript(scriptBody, `route-script:${pattern}.ts`);
  }
  if (explicitLoadFunction) {
    explicitLoadFunction = transpileTypeScript(explicitLoadFunction, `route-load:${pattern}.ts`);
  }
  const scriptReturnVars = parsed.script
    ? parsed.dataVars.filter((v) => !queryVars.includes(v))
    : [];

  // Load function �" internal server prepass for async route script bodies
  // and data-get query state hydration.
  const hasDataGetQueries = Array.isArray((parsed as any).dataGetQueries) && (parsed as any).dataGetQueries.length > 0;
  if (explicitLoadFunction) {
    parts.push(`    load: ${explicitLoadFunction}`);
  } else if ((scriptBody && scriptUsesAwait) || hasDataGetQueries) {
    let loadBody = '';
    if (scriptBody && scriptUsesAwait) {
      loadBody = scriptBody;
    }

    // Inject data-get query state blocks into load scope.
    // Each query exposes:
    //   { state, loading, error, data, empty, success }
    const queries = (parsed as any).dataGetQueries as Array<{ fnName: string; argsExpr: string; asName: string; rpcId?: string }>;
    if (hasDataGetQueries) {
      const queryLines: string[] = [];
      for (const q of queries) {
        const fnName = q.fnName;
        const rpcId = q.rpcId || rpcNameMap?.get(fnName) || fnName;
        const argsExpr = (q.argsExpr || '').trim();
        const asName = q.asName;
        const defaultArgs = argsExpr ? `[${argsExpr}]` : '[]';
        const moduleId = fnToModule[fnName];
        const qualifiedFn = moduleId ? `${moduleId}.${fnName}` : fnName;
        queryLines.push(`let ${asName} = { state: 'loading', loading: true, error: null, data: null, empty: false, success: false };`);
        queryLines.push(`const __qOverride_${asName} = __getLocals().__queryOverride;`);
        queryLines.push(`const __qArgs_${asName} = ${defaultArgs};`);
        queryLines.push(`const __qShouldRun_${asName} = !!(__qOverride_${asName} && __qOverride_${asName}.fn === '${rpcId}' && Array.isArray(__qOverride_${asName}.args) && JSON.stringify(__qOverride_${asName}.args) === JSON.stringify(__qArgs_${asName}));`);
        queryLines.push(`if (__qShouldRun_${asName}) {`);
        queryLines.push(`  try {`);
        queryLines.push(`    const __qData_${asName} = await ${qualifiedFn}(...__qArgs_${asName});`);
        queryLines.push(`    const __qEmpty_${asName} = Array.isArray(__qData_${asName}) ? __qData_${asName}.length === 0 : (__qData_${asName} == null);`);
        queryLines.push(`    ${asName} = { state: __qEmpty_${asName} ? 'empty' : 'success', loading: false, error: null, data: __qData_${asName}, empty: __qEmpty_${asName}, success: !__qEmpty_${asName} };`);
        queryLines.push(`  } catch (err) {`);
        queryLines.push(`    const __qErr_${asName} = (err && err.message) ? String(err.message) : String(err);`);
        queryLines.push(`    ${asName} = { state: 'error', loading: false, error: __qErr_${asName}, data: null, empty: false, success: false };`);
        queryLines.push(`  }`);
        queryLines.push(`}`);
      }
      loadBody = [loadBody, queryLines.join('\n')].filter(Boolean).join('\n');
    }

    const loadReturnVars = [...scriptReturnVars, ...queryVars];
    let returnObj = '';
    if (loadReturnVars.length > 0) {
      if (hasSegmentedScripts && scriptUsesAwait) {
        const segmentReturnEntries = scriptReturnVars.map((name) => name + ': __segmentData.' + name);
        const queryReturnEntries = queryVars
          .filter((name) => !scriptReturnVars.includes(name))
          .map((name) => name);
        returnObj = `
      return { ${[...segmentReturnEntries, ...queryReturnEntries].join(', ')} };`;
      } else {
        returnObj = `
      return { ${loadReturnVars.join(', ')} };`;
      }
    }
    parts.push(`    async load(__routeParams = {}) {
      ${loadBody}${returnObj}
    }`);
  }

  // Actions �" functions referenced via action={fn} in the template
  if (hasFns && parsed.actionFunctions.length > 0) {
    const actionEntries = parsed.actionFunctions
      .map(fn => {
        const moduleId = fnToModule[fn];
        return moduleId ? `'${fn}': ${moduleId}.${fn}` : `'${fn}': ${fn}`;
      })
      .join(', ');
    parts.push(`    actions: { ${actionEntries} }`);
  }

  // RPC �" functions referenced via data-poll={fn(args)} in the template
  if (hasFns && parsed.pollFunctions.length > 0) {
    const rpcEntries = parsed.pollFunctions
      .map(fn => {
        const moduleId = fnToModule[fn];
        const rpcId = rpcNameMap?.get(fn) || fn;
        return moduleId ? `'${rpcId}': ${moduleId}.${fn}` : `'${rpcId}': ${fn}`;
      })
      .join(', ');
    parts.push(`    rpc: { ${rpcEntries} }`);
  }

  // Render function �" template compiled to JS with native flow control
  // Destructure data vars so templates reference them directly (e.g., {todos} not {data.todos})
  // Auto-inject action state objects so templates can reference signIn.error, signIn.loading, etc.
  const renderPrelude = (scriptBody && !scriptUsesAwait) ? scriptBody : '';

  const allVars = [...queryVars];
  if (scriptUsesAwait) {
    for (const v of scriptReturnVars) {
      if (!allVars.includes(v)) allVars.push(v);
    }
  }
  for (const fn of parsed.actionFunctions) {
    if (!allVars.includes(fn)) allVars.push(fn);
  }
  if (!allVars.includes('params')) allVars.push('params');
  if (!allVars.includes('breadcrumbs')) allVars.push('breadcrumbs');
  const destructure = `const { ${allVars.join(', ')} } = data;\n      `;
  // Inject component CSS at compile time (once per route, no runtime dedup)
  // Must come after 'let __html = "";' (first line of renderBody)
  let finalRenderBody = renderBody;
  if (componentStyles.length > 0) {
    const lines = renderBody.split('\n');
    const styleLines = componentStyles.map(css => `__html += \`${css}\\n\`;`);
    finalRenderBody = [lines[0], ...styleLines, ...lines.slice(1)].join('\n');
  }
  parts.push(`    render(data) {
      ${destructure}${renderPrelude ? renderPrelude + '\n      ' : ''}${finalRenderBody}
      return __html;
    }`);

  return `  {\n${parts.join(',\n')}\n  }`;
}

interface OrmDatabaseEntry {
  binding: string;
  schemaImportPath: string;
  schemaExportName: string;
  skipMigrations: boolean;
  type: 'd1' | 'do';
}

function readOrmConfig(projectDir: string): OrmDatabaseEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return [];

  const source = fs.readFileSync(configPath, 'utf-8');
  const ormBlock = readConfigBlock(source, 'orm');
  if (!ormBlock) return [];

  // Extract schema imports: import { todoSchema } from './src/schemas/todo';
  const importMap = new Map<string, string>(); // exportName �' importPath
  const importRegex = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRegex.exec(source)) !== null) {
    const names = m[1].split(',').map(n => n.trim()).filter(Boolean);
    const importPath = m[2];
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

  // Pattern: BINDING: { schema: schemaName, skipMigrations?: true/false }
  const entries: OrmDatabaseEntry[] = [];
  const entryRegex = /(\w+)\s*:\s*\{\s*schema\s*:\s*(\w+)([^}]*)\}/g;
  while ((m = entryRegex.exec(databasesBody)) !== null) {
    const binding = m[1];
    const schemaExportName = m[2];
    const rest = m[3] || '';

    const skipMatch = rest.match(/skipMigrations\s*:\s*(true|false)/);
    const skipMigrations = skipMatch?.[1] === 'true';

    const typeMatch = rest.match(/type\s*:\s*['"]?(d1|do)['"]?/);
    const type = (typeMatch?.[1] as 'd1' | 'do') ?? 'd1';

    // Only include if the schema name maps to a known import (not 'orm', 'databases', etc.)
    const schemaImportPath = importMap.get(schemaExportName);
    if (!schemaImportPath) continue;

    entries.push({ binding, schemaImportPath, schemaExportName, skipMigrations, type });
  }

  return entries;
}

interface AuthConfigEntry {
  cookieName: string;
  secretEnvKey: string;
  sessionEnabled: boolean;
  hasCredentials: boolean;
  hasActivity: boolean;
  hasRoles: boolean;
  hasOAuth: boolean;
  hasGuards: boolean;
  hasRateLimit: boolean;
  hasTurnstile: boolean;
  hasOrganization: boolean;
}

function readAuthConfig(projectDir: string): AuthConfigEntry | null {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return null;

  const source = fs.readFileSync(configPath, 'utf-8');
  const authBlockMatch = readConfigBlock(source, 'auth');
  if (!authBlockMatch) return null;
  const authBlock = authBlockMatch.body;

  const cookieMatch = authBlock.match(/cookieName\s*:\s*['"]([^'"]+)['"]/);
  const secretMatch = authBlock.match(/secretEnvKey\s*:\s*['"]([^'"]+)['"]/);
  const sessionMatch = authBlock.match(/sessionEnabled\s*:\s*(true|false)/);

  // Detect sub-configs by looking for the key followed by a colon
  const hasCredentials = /credentials\s*:/.test(authBlock);
  const hasActivity = /activity\s*:/.test(authBlock);
  const hasRoles = /roles\s*:/.test(authBlock);
  const hasOAuth = /oauth\s*:/.test(authBlock);
  const hasGuards = /guards\s*:/.test(authBlock);
  const hasRateLimit = /rateLimit\s*:/.test(authBlock);
  const hasTurnstile = /turnstile\s*:/.test(authBlock);
  const hasOrganization = /organizations\s*:/.test(authBlock);

  return {
    cookieName: cookieMatch?.[1] ?? 'kuratchi_session',
    secretEnvKey: secretMatch?.[1] ?? 'AUTH_SECRET',
    sessionEnabled: sessionMatch?.[1] !== 'false',
    hasCredentials,
    hasActivity,
    hasRoles,
    hasOAuth,
    hasGuards,
    hasRateLimit,
    hasTurnstile,
    hasOrganization,
  };
}

// �"��"� Durable Object config + handler discovery �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

interface DoConfigEntry {
  /** DO namespace binding name (e.g. 'ORG_DB') */
  binding: string;
  /** Exported class name (e.g. 'OrganizationDO') */
  className: string;
  /** The user field path that identifies the DO stub (e.g. 'user.orgId') */
  stubId?: string;
  /** Optional handler file names mapped to this binding (e.g. ['sites.do.ts']) */
  files?: string[];
}

interface WorkerClassConfigEntry {
  /** Binding name (e.g. 'WORDPRESS_CONTAINER', 'NEW_SITE_WORKFLOW') */
  binding: string;
  /** Exported class name (e.g. 'WordPressContainer', 'NewSiteWorkflow') */
  className: string;
  /** Source file path relative to project root */
  file: string;
  /** Whether worker.js should re-export a named or default class export. */
  exportKind: 'named' | 'default';
}

interface ConventionClassEntry {
  /** Exported class name (e.g. 'SessionAgent') */
  className: string;
  /** Source file path relative to project root */
  file: string;
  /** Whether worker.js should re-export a named or default class export. */
  exportKind: 'named' | 'default';
}

interface DoHandlerEntry {
  /** File name without extension (e.g. 'sites') */
  fileName: string;
  /** Absolute path to the handler .ts file */
  absPath: string;
  /** DO binding this handler belongs to */
  binding: string;
  /** Handler mode: class-based or function-based */
  mode: 'class' | 'function';
  /** The default-exported class name (class mode only) */
  className?: string;
  /** Methods extracted from the class body (class mode only) */
  classMethods: DoClassMethodEntry[];
  /** Exported functions (function mode public RPC surface, plus lifecycle hooks) */
  exportedFunctions: string[];
}

interface DoClassMethodEntry {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  hasWorkerContextCalls: boolean;
  callsThisMethods: string[];
}

function toSafeIdentifier(input: string): string {
  const normalized = input.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
}

/**
 * Parse durableObjects config from kuratchi.config.ts.
 *
 * Supports both string shorthand and object form:
 *   durableObjects: {
 *     ORG_DB: { className: 'OrganizationDO', stubId: 'user.orgId' },
 *     CACHE_DB: 'CacheDO'
 *   }
 */
function readDoConfig(projectDir: string): DoConfigEntry[] {
  const configPath = path.join(projectDir, 'kuratchi.config.ts');
  if (!fs.existsSync(configPath)) return [];

  const source = fs.readFileSync(configPath, 'utf-8');

  // Find durableObjects block
  const doIdx = source.search(/durableObjects\s*:\s*\{/);
  if (doIdx === -1) return [];

  const braceStart = source.indexOf('{', doIdx);
  if (braceStart === -1) return [];

  // Balance braces
  let depth = 0, braceEnd = braceStart;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
  }
  const doBlock = source.slice(braceStart + 1, braceEnd);

  const entries: DoConfigEntry[] = [];

  // Match object form: BINDING: { className: '...', stubId: '...' }
  const objRegex = /(\w+)\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let m;
  while ((m = objRegex.exec(doBlock)) !== null) {
    const binding = m[1];
    const body = m[2];

    const cnMatch = body.match(/className\s*:\s*['"](\w+)['"]/);
    if (!cnMatch) continue;

    const entry: DoConfigEntry = { binding, className: cnMatch[1] };

    const stubIdMatch = body.match(/stubId\s*:\s*['"]([^'"]+)['"]/);
    if (stubIdMatch) entry.stubId = stubIdMatch[1];

    const filesMatch = body.match(/files\s*:\s*\[([\s\S]*?)\]/);
    if (filesMatch) {
      const list: string[] = [];
      const itemRegex = /['"]([^'"]+)['"]/g;
      let fm;
      while ((fm = itemRegex.exec(filesMatch[1])) !== null) {
        list.push(fm[1]);
      }
      if (list.length > 0) entry.files = list;
    }

    // (inject config removed �" DO methods are org-scoped, no auto-injection needed)

    entries.push(entry);
  }

  // Match string shorthand: BINDING: 'ClassName' (skip bindings already found)
  const foundBindings = new Set(entries.map(e => e.binding));
  const pairRegex = /(\w+)\s*:\s*['"](\w+)['"]\s*[,}\n]/g;
  while ((m = pairRegex.exec(doBlock)) !== null) {
    if (foundBindings.has(m[1])) continue;
    // Make sure this isn't a nested key like 'className'
    if (['className', 'stubId'].includes(m[1])) continue;
    entries.push({ binding: m[1], className: m[2] });
  }

  return entries;
}

function readWorkerClassConfig(projectDir: string, key: 'containers' | 'workflows'): WorkerClassConfigEntry[] {
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

  // Object form:
  // containers: { WORDPRESS_CONTAINER: { file: 'src/server/containers/wordpress.container.ts', className?: 'WordPressContainer' } }
  // workflows:  { NEW_SITE_WORKFLOW: { file: 'src/server/workflows/new-site.workflow.ts', className?: 'NewSiteWorkflow' } }
  const objRegex = /(\w+)\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(body)) !== null) {
    const binding = m[1];
    const entryBody = m[2];
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

  // String shorthand:
  // containers: { WORDPRESS_CONTAINER: 'src/server/containers/wordpress.container.ts' }
  // workflows:  { NEW_SITE_WORKFLOW: 'src/server/workflows/new-site.workflow.ts' }
  const foundBindings = new Set(entries.map((e) => e.binding));
  const pairRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]\s*[,}\n]/g;
  while ((m = pairRegex.exec(body)) !== null) {
    const binding = m[1];
    const file = m[2];
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

function resolveClassExportFromFile(absPath: string, errorLabel: string): { className: string; exportKind: 'named' | 'default' } {
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

function readAssetsPrefix(projectDir: string): string {
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

function discoverConventionClassFiles(
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

function discoverFilesWithSuffix(dir: string, suffix: string): string[] {
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

/**
 * Scan DO handler files.
 * - Class mode: default class extends kuratchiDO
 * - Function mode: exported functions in *.do.ts files (compiler wraps into DO class)
 */
function discoverDoHandlers(
  srcDir: string,
  doConfig: DoConfigEntry[],
  ormDatabases: OrmDatabaseEntry[],
): DoHandlerEntry[] {
  const serverDir = path.join(srcDir, 'server');
  const legacyDir = path.join(srcDir, 'durable-objects');
  const serverDoFiles = discoverFilesWithSuffix(serverDir, '.do.ts');
  const legacyDoFiles = discoverFilesWithSuffix(legacyDir, '.ts');
  const discoveredFiles = Array.from(new Set([...serverDoFiles, ...legacyDoFiles]));
  if (discoveredFiles.length === 0) return [];

  const bindings = new Set(doConfig.map(d => d.binding));
  const fileToBinding = new Map<string, string>();
  for (const entry of doConfig) {
    for (const rawFile of entry.files ?? []) {
      const normalized = rawFile.trim().replace(/^\.?[\\/]/, '').replace(/\\/g, '/').toLowerCase();
      if (!normalized) continue;
      fileToBinding.set(normalized, entry.binding);
      const base = path.basename(normalized);
      if (!fileToBinding.has(base)) fileToBinding.set(base, entry.binding);
    }
  }
  const handlers: DoHandlerEntry[] = [];
  const fileNameToAbsPath = new Map<string, string>();

  for (const absPath of discoveredFiles) {
    const file = path.basename(absPath);
    const source = fs.readFileSync(absPath, 'utf-8');

    const exportedFunctions = extractExportedFunctions(source);
    const hasClass = /extends\s+kuratchiDO\b/.test(source);
    if (!hasClass && exportedFunctions.length === 0) continue;

    // Extract class name when class mode is used.
    const classMatch = source.match(/export\s+default\s+class\s+(\w+)\s+extends\s+kuratchiDO/);
    const className = classMatch?.[1] ?? null;
    if (hasClass && !className) continue;

    // Binding resolution:
    // 1) explicit static binding in class
    // 2) config-mapped file name (supports .do.ts convention)
    // 3) if exactly one DO binding exists, infer that binding
    let binding: string | null = null;
    const bindingMatch = source.match(/static\s+binding\s*=\s*['"](\w+)['"]/);
    if (bindingMatch) {
      binding = bindingMatch[1];
    } else {
      const normalizedFile = file.replace(/\\/g, '/').toLowerCase();
      const normalizedRelFromSrc = path
        .relative(srcDir, absPath)
        .replace(/\\/g, '/')
        .toLowerCase();
      binding = fileToBinding.get(normalizedRelFromSrc) ?? fileToBinding.get(normalizedFile) ?? null;
      if (!binding && doConfig.length === 1) {
        binding = doConfig[0].binding;
      }
    }
    if (!binding) continue;
    if (!bindings.has(binding)) continue;

    // Extract class methods in class mode
    const classMethods = className ? extractClassMethods(source, className) : [];

    const fileName = file.replace(/\.ts$/, '');
    const existing = fileNameToAbsPath.get(fileName);
    if (existing && existing !== absPath) {
      throw new Error(
        `[KuratchiJS] Duplicate DO handler file name '${fileName}.ts' detected:\n- ${existing}\n- ${absPath}\nRename one file or move it to avoid proxy name collision.`,
      );
    }
    fileNameToAbsPath.set(fileName, absPath);

    handlers.push({
      fileName,
      absPath,
      binding,
      mode: hasClass ? 'class' : 'function',
      className: className ?? undefined,
      classMethods,
      exportedFunctions,
    });
  }

  return handlers;
}

/**
 * Extract method names from a class body using brace-balanced parsing.
 */
function extractClassMethods(source: string, className: string): DoClassMethodEntry[] {
  // Find: class ClassName extends kuratchiDO {
  const classIdx = source.search(new RegExp(`class\\s+${className}\\s+extends\\s+kuratchiDO`));
  if (classIdx === -1) return [];

  const braceStart = source.indexOf('{', classIdx);
  if (braceStart === -1) return [];

  // Balance braces to find end of class
  let depth = 0, braceEnd = braceStart;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
  }

  const classBody = source.slice(braceStart + 1, braceEnd);

  // Match method declarations with optional visibility/static/async modifiers.
  const methods: DoClassMethodEntry[] = [];
  const methodRegex = /^\s+(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(async)\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{/gm;
  const reserved = new Set([
    'constructor', 'static', 'get', 'set',
    'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
    'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
    'void', 'instanceof', 'in', 'of', 'await', 'yield', 'const',
    'let', 'var', 'function', 'class', 'import', 'export', 'default',
    'break', 'continue', 'with', 'super', 'this',
  ]);
  let m;
  while ((m = methodRegex.exec(classBody)) !== null) {
    const visibility = m[1] ?? 'public';
    const isStatic = !!m[2];
    const isAsync = !!m[3];
    const name = m[4]!;
    if (isStatic) continue;
    if (reserved.has(name)) continue;
    const matchText = m[0] ?? '';
    const openRel = matchText.lastIndexOf('{');
    const openAbs = openRel >= 0 ? m.index + openRel : -1;
    let hasWorkerContextCalls = false;
    const callsThisMethods: string[] = [];
    if (openAbs >= 0) {
      let depth = 0;
      let endAbs = openAbs;
      for (let i = openAbs; i < classBody.length; i++) {
        const ch = classBody[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            endAbs = i;
            break;
          }
        }
      }
      const bodySource = classBody.slice(openAbs + 1, endAbs);
      hasWorkerContextCalls = /\b(getCurrentUser|redirect|goto|getRequest|getLocals)\s*\(/.test(bodySource);
      const called = new Set<string>();
      const callRegex = /\bthis\.([A-Za-z_$][\w$]*)\s*\(/g;
      let cm;
      while ((cm = callRegex.exec(bodySource)) !== null) {
        called.add(cm[1]);
      }
      callsThisMethods.push(...called);
    }
    methods.push({
      name,
      visibility: visibility as 'public' | 'private' | 'protected',
      isStatic,
      isAsync,
      hasWorkerContextCalls,
      callsThisMethods,
    });
  }
  return methods;
}

function extractExportedFunctions(source: string): string[] {
  const out: string[] = [];
  const fnRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = fnRegex.exec(source)) !== null) out.push(m[1]);
  return out;
}

/**
 * Generate a proxy module for a DO handler file.
 *
 * The proxy provides auto-RPC function exports.
 * - Class mode: public class methods become RPC exports.
 * - Function mode: exported functions become RPC exports, excluding lifecycle hooks.
 */
function generateHandlerProxy(handler: DoHandlerEntry, projectDir: string): string {
  const doDir = path.join(projectDir, '.kuratchi', 'do');
  const origRelPath = path.relative(doDir, handler.absPath).replace(/\\/g, '/').replace(/\.ts$/, '.js');
  const handlerLocal = `__handler_${toSafeIdentifier(handler.fileName)}`;
  const lifecycle = new Set(['onInit', 'onAlarm', 'onMessage']);
  const rpcFunctions =
    handler.mode === 'function'
      ? handler.exportedFunctions.filter((n) => !lifecycle.has(n))
      : handler.classMethods.filter((m) => m.visibility === 'public').map((m) => m.name);

  const methods = handler.classMethods.map((m) => ({ ...m }));
  const methodMap = new Map(methods.map((m) => [m.name, m]));
  let changed = true;
  while (changed && handler.mode === 'class') {
    changed = false;
    for (const m of methods) {
      if (m.hasWorkerContextCalls) continue;
      for (const called of m.callsThisMethods) {
        const target = methodMap.get(called);
        if (target?.hasWorkerContextCalls) {
          m.hasWorkerContextCalls = true;
          changed = true;
          break;
        }
      }
    }
  }

  const workerContextMethods = handler.mode === 'class'
    ? methods.filter((m) => m.visibility === 'public' && m.hasWorkerContextCalls).map((m) => m.name)
    : [];
  const asyncMethods = handler.mode === 'class'
    ? methods.filter((m) => m.isAsync).map((m) => m.name)
    : [];

  const lines: string[] = [
    `// Auto-generated by KuratchiJS compiler �" do not edit.`,
    `import { __getDoStub } from '${RUNTIME_DO_IMPORT}';`,
    ...(handler.mode === 'class' ? [`import ${handlerLocal} from '${origRelPath}';`] : []),
    ``,
    `const __FD_TAG = '__kuratchi_form_data__';`,
    `function __isPlainObject(__v) {`,
    `  if (!__v || typeof __v !== 'object') return false;`,
    `  const __proto = Object.getPrototypeOf(__v);`,
    `  return __proto === Object.prototype || __proto === null;`,
    `}`,
    `function __encodeArg(__v, __seen = new WeakSet()) {`,
    `  if (typeof FormData !== 'undefined' && __v instanceof FormData) {`,
    `    return { [__FD_TAG]: Array.from(__v.entries()) };`,
    `  }`,
    `  if (Array.isArray(__v)) return __v.map((__x) => __encodeArg(__x, __seen));`,
    `  if (__isPlainObject(__v)) {`,
    `    if (__seen.has(__v)) throw new Error('[KuratchiJS] Circular object passed to DO RPC');`,
    `    __seen.add(__v);`,
    `    const __out = {};`,
    `    for (const [__k, __val] of Object.entries(__v)) __out[__k] = __encodeArg(__val, __seen);`,
    `    __seen.delete(__v);`,
    `    return __out;`,
    `  }`,
    `  return __v;`,
    `}`,
    `function __decodeArg(__v) {`,
    `  if (Array.isArray(__v)) return __v.map(__decodeArg);`,
    `  if (__isPlainObject(__v)) {`,
    `    const __obj = __v;`,
    `    if (__FD_TAG in __obj) {`,
    `      const __fd = new FormData();`,
    `      const __entries = Array.isArray(__obj[__FD_TAG]) ? __obj[__FD_TAG] : [];`,
    `      for (const __pair of __entries) {`,
    `        if (Array.isArray(__pair) && __pair.length >= 2) __fd.append(String(__pair[0]), __pair[1]);`,
    `      }`,
    `      return __fd;`,
    `    }`,
    `    const __out = {};`,
    `    for (const [__k, __val] of Object.entries(__obj)) __out[__k] = __decodeArg(__val);`,
    `    return __out;`,
    `  }`,
    `  return __v;`,
    `}`,
    ``,
  ];

  if (workerContextMethods.length > 0) {
    lines.push(`const __workerMethods = new Set(${JSON.stringify(workerContextMethods)});`);
    lines.push(`const __asyncMethods = new Set(${JSON.stringify(asyncMethods)});`);
    lines.push(`function __callWorkerMethod(__name, __args) {`);
    lines.push(`  const __self = new Proxy({}, {`);
    lines.push(`    get(_, __k) {`);
    lines.push(`      if (typeof __k !== 'string') return undefined;`);
    lines.push(`      if (__k === 'db') {`);
    lines.push(`        throw new Error("[KuratchiJS] Worker-executed DO method cannot use this.db directly. Move DB access into a non-public method and call it via this.<method>().");`);
    lines.push(`      }`);
      lines.push(`      if (__workerMethods.has(__k)) {`);
      lines.push(`        return (...__a) => ${handlerLocal}.prototype[__k].apply(__self, __a);`);
      lines.push(`      }`);
      lines.push(`      const __local = ${handlerLocal}.prototype[__k];`);
      lines.push(`      if (typeof __local === 'function' && !__asyncMethods.has(__k)) {`);
      lines.push(`        return (...__a) => __local.apply(__self, __a);`);
      lines.push(`      }`);
      lines.push(`      return async (...__a) => { const __s = await __getDoStub('${handler.binding}'); if (!__s) throw new Error('Not authenticated'); return __s[__k](...__a.map((__x) => __encodeArg(__x))); };`);
      lines.push(`    },`);
    lines.push(`  });`);
    lines.push(`  return ${handlerLocal}.prototype[__name].apply(__self, __args.map(__decodeArg));`);
    lines.push(`}`);
    lines.push(``);
  }

  // Export RPC methods
  for (const method of rpcFunctions) {
    if (workerContextMethods.includes(method)) {
      lines.push(`export async function ${method}(...a) { return __callWorkerMethod('${method}', a); }`);
    } else {
      lines.push(
        `export async function ${method}(...a) { const s = await __getDoStub('${handler.binding}'); if (!s) throw new Error('Not authenticated'); return s.${method}(...a.map((__x) => __encodeArg(__x))); }`
      );
    }
  }

  return lines.join('\n') + '\n';
}

function generateRoutesModule(opts: {
  projectDir: string;
  serverImports: string[];
  compiledRoutes: string[];
  compiledLayout: string | null;
  compiledComponents: string[];
  isDev: boolean;
  compiledAssets: { name: string; content: string; mime: string; etag: string }[];
  compiledErrorPages: Map<number, string>;
  ormDatabases: OrmDatabaseEntry[];
  authConfig: AuthConfigEntry | null;
  doConfig: DoConfigEntry[];
  doHandlers: DoHandlerEntry[];
  isLayoutAsync: boolean;
  compiledLayoutActions: string | null;
  hasRuntime: boolean;
  runtimeImportPath?: string;
  assetsPrefix: string;
}): string {
  const layoutBlock = opts.compiledLayout ?? 'function __layout(content) { return content; }';
  const layoutActionsBlock = opts.compiledLayoutActions
    ? `const __layoutActions = ${opts.compiledLayoutActions};`
    : 'const __layoutActions = {};';

  // Custom error page overrides (user-created NNN.html files)
  const customErrorFunctions = Array.from(opts.compiledErrorPages.entries())
    .map(([status, fn]) => fn)
    .join('\n\n');

  // Resolve path to the framework's context module from the output directory
  const contextImport = `import { __setRequestContext, __esc, __rawHtml, __sanitizeHtml, __setLocal, __getLocals, buildDefaultBreadcrumbs as __buildDefaultBreadcrumbs } from '${RUNTIME_CONTEXT_IMPORT}';`;
  const runtimeImport = opts.hasRuntime && opts.runtimeImportPath
    ? `import __kuratchiRuntime from '${opts.runtimeImportPath}';`
    : '';

  // Auth session init �" thin cookie parsing injected into Worker entry
  let authInit = '';
  if (opts.authConfig && opts.authConfig.sessionEnabled) {
    const cookieName = opts.authConfig.cookieName;
    authInit = `
// �"��"� Auth Session Init �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function __parseCookies(header) {
  const map = {};
  if (!header) return map;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    map[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return map;
}

function __initAuth(request) {
  const cookies = __parseCookies(request.headers.get('cookie'));
  __setLocal('session', null);
  __setLocal('user', null);
  __setLocal('auth', {
    cookies,
    sessionCookie: cookies['${cookieName}'] || null,
    cookieName: '${cookieName}',
  });
}
`;
  }
  const workerImport = `import { WorkerEntrypoint, env as __env } from 'cloudflare:workers';`;

  // ORM migration imports + init code
  let migrationImports = '';
  let migrationInit = '';
  if (opts.ormDatabases.length > 0) {
    const schemaImports: string[] = [];
    const migrateEntries: string[] = [];

    // Resolve schema import paths relative to .kuratchi output dir
    // Config imports are relative to project root (e.g., './src/schemas/todo')
    // Generated code lives in .kuratchi/routes.js, so we prefix ../ to reach project root
    for (const db of opts.ormDatabases) {
      const resolvedPath = db.schemaImportPath.replace(/^\.\//, '../');
      // Only D1 databases get runtime migration in the Worker fetch handler
      // DO databases are migrated via initDO() in the DO constructor
      if (!db.skipMigrations && db.type === 'd1') {
        schemaImports.push(`import { ${db.schemaExportName} } from '${resolvedPath}';`);
        migrateEntries.push(
          `    { binding: '${db.binding}', schema: ${db.schemaExportName} }`
        );
      }
    }

    if (migrateEntries.length > 0) {
      migrationImports = [
        `import { runMigrations } from '@kuratchi/orm/migrations';`,
        `import { kuratchiORM } from '@kuratchi/orm';`,
        ...schemaImports,
      ].join('\n');

      migrationInit = `
// �"��"� ORM Auto-Migration �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

let __migrated = false;
const __ormDatabases = [
${migrateEntries.join(',\n')}
];

async function __runMigrations() {
  if (__migrated) return;
  __migrated = true;
  for (const db of __ormDatabases) {
    const binding = __env[db.binding];
    if (!binding) continue;
    try {
      const executor = (sql, params) => {
        let stmt = binding.prepare(sql);
        if (params?.length) stmt = stmt.bind(...params);
        return stmt.all().then(r => ({ success: r.success ?? true, data: r.results, results: r.results }));
      };
      const result = await runMigrations({ execute: executor, schema: db.schema });
      if (result.applied) {
        console.log('[kuratchi] ' + db.binding + ': migrated (' + result.statementsRun + ' statements)');
      }
      if (result.warnings.length) {
        result.warnings.forEach(w => console.warn('[kuratchi] ' + db.binding + ': ' + w));
      }
    } catch (err) {
      console.error('[kuratchi] ' + db.binding + ' migration failed:', err.message);
    }
  }
}
`;
    }
  }

  // Auth plugin init �" import config + call @kuratchi/auth setup functions
  let authPluginImports = '';
  let authPluginInit = '';
  const ac = opts.authConfig;
  if (ac && (ac.hasCredentials || ac.hasActivity || ac.hasRoles || ac.hasOAuth || ac.hasGuards || ac.hasRateLimit || ac.hasTurnstile || ac.hasOrganization)) {
    const imports: string[] = [];
    const initLines: string[] = [];

    // Import the config file to read auth sub-configs at runtime
    imports.push(`import __kuratchiConfig from '../kuratchi.config';`);

    if (ac.hasCredentials) {
      imports.push(`import { configureCredentials as __configCreds } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.credentials) __configCreds(__kuratchiConfig.auth.credentials);`);
    }
    if (ac.hasActivity) {
      imports.push(`import { defineActivities as __defActivities } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.activity) __defActivities(__kuratchiConfig.auth.activity);`);
    }
    if (ac.hasRoles) {
      imports.push(`import { defineRoles as __defRoles } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.roles) __defRoles(__kuratchiConfig.auth.roles);`);
    }
    if (ac.hasOAuth) {
      imports.push(`import { configureOAuth as __configOAuth } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.oauth) {`);
      initLines.push(`    const oc = __kuratchiConfig.auth.oauth;`);
      initLines.push(`    const providers = {};`);
      initLines.push(`    if (oc.providers) {`);
      initLines.push(`      for (const [name, cfg] of Object.entries(oc.providers)) {`);
      initLines.push(`        providers[name] = { clientId: __env[cfg.clientIdEnv] || '', clientSecret: __env[cfg.clientSecretEnv] || '', scopes: cfg.scopes };`);
      initLines.push(`      }`);
      initLines.push(`    }`);
      initLines.push(`    __configOAuth({ providers, loginRedirect: oc.loginRedirect });`);
      initLines.push(`  }`);
    }
    if (ac.hasGuards) {
      imports.push(`import { configureGuards as __configGuards, checkGuard as __checkGuard } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.guards) __configGuards(__kuratchiConfig.auth.guards);`);
    }
    if (ac.hasRateLimit) {
      imports.push(`import { configureRateLimit as __configRL, checkRateLimit as __checkRL } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.rateLimit) __configRL(__kuratchiConfig.auth.rateLimit);`);
    }
    if (ac.hasTurnstile) {
      imports.push(`import { configureTurnstile as __configTS, checkTurnstile as __checkTS } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.turnstile) __configTS(__kuratchiConfig.auth.turnstile);`);
    }
    if (ac.hasOrganization) {
      imports.push(`import { configureOrganization as __configOrg } from '@kuratchi/auth';`);
      initLines.push(`  if (__kuratchiConfig.auth?.organizations) __configOrg(__kuratchiConfig.auth.organizations);`);
    }

    authPluginImports = imports.join('\n');
    authPluginInit = `
// �"��"� Auth Plugin Init �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

function __initAuthPlugins() {
${initLines.join('\n')}
}
`;
  }

  // �"��"� Durable Object class generation �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�
  let doImports = '';
  let doClassCode = '';
  let doResolverInit = '';

  if (opts.doConfig.length > 0 && opts.doHandlers.length > 0) {
    const doImportLines: string[] = [];
    const doClassLines: string[] = [];
    const doResolverLines: string[] = [];

    doImportLines.push(`import { DurableObject as __DO } from 'cloudflare:workers';`);
    doImportLines.push(`import { initDO as __initDO } from '@kuratchi/orm';`);
    doImportLines.push(`import { __registerDoResolver, __registerDoClassBinding, __setDoContext } from '${RUNTIME_DO_IMPORT}';`);
    doImportLines.push(`const __DO_FD_TAG = '__kuratchi_form_data__';`);
    doImportLines.push(`function __isDoPlainObject(__v) {`);
    doImportLines.push(`  if (!__v || typeof __v !== 'object') return false;`);
    doImportLines.push(`  const __proto = Object.getPrototypeOf(__v);`);
    doImportLines.push(`  return __proto === Object.prototype || __proto === null;`);
    doImportLines.push(`}`);
    doImportLines.push(`function __decodeDoArg(__v) {`);
    doImportLines.push(`  if (Array.isArray(__v)) return __v.map(__decodeDoArg);`);
    doImportLines.push(`  if (__isDoPlainObject(__v)) {`);
    doImportLines.push(`    if (__DO_FD_TAG in __v) {`);
    doImportLines.push(`      const __fd = new FormData();`);
    doImportLines.push(`      const __entries = Array.isArray(__v[__DO_FD_TAG]) ? __v[__DO_FD_TAG] : [];`);
    doImportLines.push(`      for (const __pair of __entries) { if (Array.isArray(__pair) && __pair.length >= 2) __fd.append(String(__pair[0]), __pair[1]); }`);
    doImportLines.push(`      return __fd;`);
    doImportLines.push(`    }`);
    doImportLines.push(`    const __out = {};`);
    doImportLines.push(`    for (const [__k, __val] of Object.entries(__v)) __out[__k] = __decodeDoArg(__val);`);
    doImportLines.push(`    return __out;`);
    doImportLines.push(`  }`);
    doImportLines.push(`  return __v;`);
    doImportLines.push(`}`);

    // We need getCurrentUser and getOrgStubByName for stub resolvers
    doImportLines.push(`import { getCurrentUser as __getCU, getOrgStubByName as __getOSBN } from '@kuratchi/auth';`);

    // Group handlers by binding
    const handlersByBinding = new Map<string, DoHandlerEntry[]>();
    for (const h of opts.doHandlers) {
      const list = handlersByBinding.get(h.binding) ?? [];
      list.push(h);
      handlersByBinding.set(h.binding, list);
    }

    // Import handler files + schema for each DO
    for (const doEntry of opts.doConfig) {
      const handlers = handlersByBinding.get(doEntry.binding) ?? [];
      const ormDb = opts.ormDatabases.find(d => d.binding === doEntry.binding);
      const fnHandlers = handlers.filter((h) => h.mode === 'function');
      const initHandlers = fnHandlers.filter((h) => h.exportedFunctions.includes('onInit'));
      const alarmHandlers = fnHandlers.filter((h) => h.exportedFunctions.includes('onAlarm'));
      const messageHandlers = fnHandlers.filter((h) => h.exportedFunctions.includes('onMessage'));

      // Import schema (paths are relative to project root; prefix ../ since we're in .kuratchi/)
      if (ormDb) {
        const schemaPath = ormDb.schemaImportPath.replace(/^\.\//, '../');
        doImportLines.push(`import { ${ormDb.schemaExportName} as __doSchema_${doEntry.binding} } from '${schemaPath}';`);
      }

      // Import handler classes
      for (const h of handlers) {
        let handlerImportPath = path
          .relative(path.join(opts.projectDir, '.kuratchi'), h.absPath)
          .replace(/\\/g, '/')
          .replace(/\.ts$/, '.js');
        if (!handlerImportPath.startsWith('.')) handlerImportPath = './' + handlerImportPath;
        const handlerVar = `__handler_${toSafeIdentifier(h.fileName)}`;
        if (h.mode === 'class') {
          doImportLines.push(`import ${handlerVar} from '${handlerImportPath}';`);
        } else {
          doImportLines.push(`import * as ${handlerVar} from '${handlerImportPath}';`);
        }
      }

      // Generate DO class
      doClassLines.push(`export class ${doEntry.className} extends __DO {`);
      doClassLines.push(`  constructor(ctx, env) {`);
      doClassLines.push(`    super(ctx, env);`);
      if (ormDb) {
        doClassLines.push(`    this.db = __initDO(ctx.storage.sql, __doSchema_${doEntry.binding});`);
      }
      for (const h of initHandlers) {
        const handlerVar = `__handler_${toSafeIdentifier(h.fileName)}`;
        doClassLines.push(`    __setDoContext(this);`);
        doClassLines.push(`    Promise.resolve(${handlerVar}.onInit.call(this)).catch((err) => console.error('[kuratchi] DO onInit failed:', err?.message || err));`);
      }
      doClassLines.push(`  }`);
      if (ormDb) {
        doClassLines.push(`  async __kuratchiLogActivity(payload) {`);
        doClassLines.push(`    const now = new Date().toISOString();`);
        doClassLines.push(`    try {`);
        doClassLines.push(`      await this.db.activityLog.insert({`);
        doClassLines.push(`        userId: payload?.userId ?? null,`);
        doClassLines.push(`        action: payload?.action,`);
        doClassLines.push(`        detail: payload?.detail ?? null,`);
        doClassLines.push(`        ip: payload?.ip ?? null,`);
        doClassLines.push(`        userAgent: payload?.userAgent ?? null,`);
        doClassLines.push(`        createdAt: now,`);
        doClassLines.push(`        updatedAt: now,`);
        doClassLines.push(`      });`);
        doClassLines.push(`    } catch (err) {`);
        doClassLines.push(`      const msg = String((err && err.message) || err || '');`);
        doClassLines.push(`      if (!msg.includes('userId')) throw err;`);
        doClassLines.push(`      // Backward-compat fallback for org DBs not yet migrated with userId column.`);
        doClassLines.push(`      await this.db.activityLog.insert({`);
        doClassLines.push(`        action: payload?.action,`);
        doClassLines.push(`        detail: payload?.detail ?? null,`);
        doClassLines.push(`        ip: payload?.ip ?? null,`);
        doClassLines.push(`        userAgent: payload?.userAgent ?? null,`);
        doClassLines.push(`        createdAt: now,`);
        doClassLines.push(`        updatedAt: now,`);
        doClassLines.push(`      });`);
        doClassLines.push(`    }`);
        doClassLines.push(`  }`);
        doClassLines.push(`  async __kuratchiGetActivity(options = {}) {`);
        doClassLines.push(`    let query = this.db.activityLog;`);
        doClassLines.push(`    if (options?.action) query = query.where({ action: options.action });`);
        doClassLines.push(`    const result = await query.orderBy({ createdAt: 'desc' }).many();`);
        doClassLines.push(`    const rows = Array.isArray(result?.data) ? result.data : [];`);
        doClassLines.push(`    const limit = Number(options?.limit);`);
        doClassLines.push(`    if (Number.isFinite(limit) && limit > 0) return rows.slice(0, Math.floor(limit));`);
        doClassLines.push(`    return rows;`);
        doClassLines.push(`  }`);
      }
      // Function-mode lifecycle dispatchers
      if (alarmHandlers.length > 0) {
        doClassLines.push(`  async alarm(...args) {`);
        doClassLines.push(`    __setDoContext(this);`);
        for (const h of alarmHandlers) {
          const handlerVar = `__handler_${toSafeIdentifier(h.fileName)}`;
          doClassLines.push(`    await ${handlerVar}.onAlarm.call(this, ...args);`);
        }
        doClassLines.push(`  }`);
      }
      if (messageHandlers.length > 0) {
        doClassLines.push(`  webSocketMessage(...args) {`);
        doClassLines.push(`    __setDoContext(this);`);
        for (const h of messageHandlers) {
          const handlerVar = `__handler_${toSafeIdentifier(h.fileName)}`;
          doClassLines.push(`    ${handlerVar}.onMessage.call(this, ...args);`);
        }
        doClassLines.push(`  }`);
      }
      doClassLines.push(`}`);

      // Apply handler methods to prototype (outside class body)
      for (const h of handlers) {
        const handlerVar = `__handler_${toSafeIdentifier(h.fileName)}`;
        if (h.mode === 'class') {
          doClassLines.push(`for (const __k of Object.getOwnPropertyNames(${handlerVar}.prototype)) { if (__k !== 'constructor') ${doEntry.className}.prototype[__k] = function(...__a){ __setDoContext(this); return ${handlerVar}.prototype[__k].apply(this, __a.map(__decodeDoArg)); }; }`);
          doResolverLines.push(`  __registerDoClassBinding(${handlerVar}, '${doEntry.binding}');`);
        } else {
          const lifecycle = new Set(['onInit', 'onAlarm', 'onMessage']);
          for (const fn of h.exportedFunctions) {
            if (lifecycle.has(fn)) continue;
            doClassLines.push(`${doEntry.className}.prototype[${JSON.stringify(fn)}] = function(...__a){ __setDoContext(this); return ${handlerVar}.${fn}.apply(this, __a.map(__decodeDoArg)); };`);
          }
        }
      }

      // Register stub resolver
      if (doEntry.stubId) {
        // Config-driven: e.g. stubId: 'user.orgId' �' __u.orgId
        const fieldPath = doEntry.stubId.startsWith('user.') ? `__u.${doEntry.stubId.slice(5)}` : doEntry.stubId;
        const checkField = doEntry.stubId.startsWith('user.') ? doEntry.stubId.slice(5) : doEntry.stubId;
        doResolverLines.push(`  __registerDoResolver('${doEntry.binding}', async () => {`);
        doResolverLines.push(`    const __u = await __getCU();`);
        doResolverLines.push(`    if (!__u?.${checkField}) return null;`);
        doResolverLines.push(`    return __getOSBN(${fieldPath});`);
        doResolverLines.push(`  });`);
      } else {
        // No stubId config �" stub must be obtained manually
        doResolverLines.push(`  // No 'stubId' config for ${doEntry.binding} �" stub must be obtained manually`);
      }
    }

    doImports = doImportLines.join('\n');
    doClassCode = `\n// �"��"� Durable Object Classes (generated) �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�\n\n` + doClassLines.join('\n') + '\n';
    doResolverInit = `\nfunction __initDoResolvers() {\n${doResolverLines.join('\n')}\n}\n`;
  }

  return `// Generated by KuratchiJS compiler �" do not edit.
${opts.isDev ? '\nglobalThis.__kuratchi_DEV__ = true;\n' : ''}
${workerImport}
${contextImport}
${runtimeImport ? runtimeImport + '\n' : ''}${migrationImports ? migrationImports + '\n' : ''}${authPluginImports ? authPluginImports + '\n' : ''}${doImports ? doImports + '\n' : ''}${opts.serverImports.join('\n')}

// �"��"� Assets �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const __assets = {
${opts.compiledAssets.map(a => `  ${JSON.stringify(a.name)}: { content: ${JSON.stringify(a.content)}, mime: ${JSON.stringify(a.mime)}, etag: ${JSON.stringify(a.etag)} }`).join(',\n')}
};

// �"��"� Router �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const __staticRoutes = new Map();  // exact path �' index (O(1) lookup)
const __dynamicRoutes = [];        // regex-based routes (params/wildcards)

function __addRoute(pattern, index) {
  if (!pattern.includes(':') && !pattern.includes('*')) {
    // Static route �" direct Map lookup, no regex needed
    __staticRoutes.set(pattern, index);
  } else {
    // Dynamic route �" build regex for param extraction
    const paramNames = [];
    let regexStr = pattern
      .replace(/\\*(\\w+)/g, (_, name) => { paramNames.push(name); return '(?<' + name + '>.+)'; })
      .replace(/:(\\w+)/g, (_, name) => { paramNames.push(name); return '(?<' + name + '>[^/]+)'; });
    __dynamicRoutes.push({ regex: new RegExp('^' + regexStr + '$'), paramNames, index });
  }
}

function __match(pathname) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\\/$/, '');
  // Fast path: static routes (most common)
  const staticIdx = __staticRoutes.get(normalized);
  if (staticIdx !== undefined) return { params: {}, index: staticIdx };
  // Slow path: dynamic routes with params
  for (const route of __dynamicRoutes) {
    const m = normalized.match(route.regex);
    if (m) {
      const params = {};
      for (const name of route.paramNames) params[name] = m.groups?.[name] ?? '';
      return { params, index: route.index };
    }
  }
  return null;
}

// �"��"� Layout �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

${layoutBlock}

${layoutActionsBlock}

// �"��"� Error pages �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const __errorMessages = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

// Built-in default error page �" clean, dark, minimal, centered
function __errorPage(status, detail) {
  const title = __errorMessages[status] || 'Error';
  const detailHtml = detail ? '<p style="font-family:ui-monospace,monospace;font-size:0.8rem;color:#555;background:#111;padding:0.5rem 1rem;border-radius:6px;max-width:480px;margin:1rem auto 0;word-break:break-word">' + __esc(detail) + '</p>' : '';
  return '<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:2rem">'
    + '<div>'
    + '<p style="font-size:5rem;font-weight:700;margin:0;color:#333;line-height:1">' + status + '</p>'
    + '<p style="font-size:1rem;color:#555;margin:0.5rem 0 0;letter-spacing:0.05em">' + __esc(title) + '</p>'
    + detailHtml
    + '</div>'
    + '</div>';
}

${customErrorFunctions ? '// Custom error page overrides (user-created NNN.html)\n' + customErrorFunctions + '\n' : ''}
// Dispatch: use custom override if it exists, otherwise built-in default
const __customErrors = {${Array.from(opts.compiledErrorPages.keys()).map(s => ` ${s}: __error_${s}`).join(',')} };

function __error(status, detail) {
  if (__customErrors[status]) return __customErrors[status](detail);
  return __errorPage(status, detail);
}

${opts.compiledComponents.length > 0 ? '// �"��"� Components �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�\n\n' + opts.compiledComponents.join('\n\n') + '\n' : ''}${migrationInit}${authInit}${authPluginInit}${doResolverInit}${doClassCode}
// �"��"� Route definitions �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const routes = [
${opts.compiledRoutes.join(',\n')}
];

for (let i = 0; i < routes.length; i++) __addRoute(routes[i].pattern, i);

// �"��"� Response helpers �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

const __defaultSecHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function __secHeaders(response) {
  for (const [k, v] of Object.entries(__defaultSecHeaders)) {
    if (!response.headers.has(k)) response.headers.set(k, v);
  }
  return response;
}

function __attachCookies(response) {
  const cookies = __getLocals().__setCookieHeaders;
  if (cookies && cookies.length > 0) {
    const newResponse = new Response(response.body, response);
    for (const h of cookies) newResponse.headers.append('Set-Cookie', h);
    return __secHeaders(newResponse);
  }
  return __secHeaders(response);
}

function __isSameOrigin(request, url) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') {
    return false;
  }
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === url.origin; } catch { return false; }
}

${opts.isLayoutAsync ? 'async ' : ''}function __render(route, data) {
  let html = route.render(data);
  const headMatch = html.match(/<head>([\\s\\S]*?)<\\/head>/);
  if (headMatch) {
    html = html.replace(headMatch[0], '');
    const layoutHtml = ${opts.isLayoutAsync ? 'await ' : ''}__layout(html);
    return __attachCookies(new Response(layoutHtml.replace('</head>', headMatch[1] + '</head>'), {
      headers: { 'content-type': 'text/html; charset=utf-8' }
    }));
  }
  return __attachCookies(new Response(${opts.isLayoutAsync ? 'await ' : ''}__layout(html), { headers: { 'content-type': 'text/html; charset=utf-8' } }));
}

const __runtimeDef = (typeof __kuratchiRuntime !== 'undefined' && __kuratchiRuntime && typeof __kuratchiRuntime === 'object') ? __kuratchiRuntime : {};
const __runtimeEntries = Object.entries(__runtimeDef).filter(([, step]) => step && typeof step === 'object');

async function __runRuntimeRequest(ctx, next) {
  let idx = -1;
  async function __dispatch(i) {
    if (i <= idx) throw new Error('[kuratchi runtime] next() called multiple times in request phase');
    idx = i;
    const entry = __runtimeEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.request !== 'function') return __dispatch(i + 1);
    return await step.request(ctx, () => __dispatch(i + 1));
  }
  return __dispatch(0);
}

async function __runRuntimeRoute(ctx, next) {
  let idx = -1;
  async function __dispatch(i) {
    if (i <= idx) throw new Error('[kuratchi runtime] next() called multiple times in route phase');
    idx = i;
    const entry = __runtimeEntries[i];
    if (!entry) return next();
    const [, step] = entry;
    if (typeof step.route !== 'function') return __dispatch(i + 1);
    return await step.route(ctx, () => __dispatch(i + 1));
  }
  return __dispatch(0);
}

async function __runRuntimeResponse(ctx, response) {
  let out = response;
  for (const [, step] of __runtimeEntries) {
    if (typeof step.response !== 'function') continue;
    out = await step.response(ctx, out);
    if (!(out instanceof Response)) {
      throw new Error('[kuratchi runtime] response handlers must return a Response');
    }
  }
  return out;
}

async function __runRuntimeError(ctx, error) {
  for (const [name, step] of __runtimeEntries) {
    if (typeof step.error !== 'function') continue;
    try {
      const handled = await step.error(ctx, error);
      if (handled instanceof Response) return handled;
    } catch (hookErr) {
      console.error('[kuratchi runtime] error handler failed in step', name, hookErr);
    }
  }
  return null;
}

// �"��"� Exported Worker entrypoint �"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"��"�

export default class extends WorkerEntrypoint {
  async fetch(request) {
    __setRequestContext(this.ctx, request, __env);
${migrationInit ? '    await __runMigrations();\n' : ''}${authInit ? '    __initAuth(request);\n' : ''}${authPluginInit ? '    __initAuthPlugins();\n' : ''}${doResolverInit ? '    __initDoResolvers();\n' : ''}
    const __runtimeCtx = {
      request,
      env: __env,
      ctx: this.ctx,
      url: new URL(request.url),
      params: {},
      locals: __getLocals(),
    };

    const __coreFetch = async () => {
      const request = __runtimeCtx.request;
      const url = __runtimeCtx.url;
${ac?.hasRateLimit ? '\n      // Rate limiting - check before route handlers\n      { const __rlRes = await __checkRL(); if (__rlRes) return __secHeaders(__rlRes); }\n' : ''}${ac?.hasTurnstile ? '      // Turnstile bot protection\n      { const __tsRes = await __checkTS(); if (__tsRes) return __secHeaders(__tsRes); }\n' : ''}${ac?.hasGuards ? '      // Route guards - redirect if not authenticated\n      { const __gRes = __checkGuard(); if (__gRes) return __secHeaders(__gRes); }\n' : ''}

      // Serve static assets from src/assets/
      if (url.pathname.startsWith('${opts.assetsPrefix}')) {
        const name = url.pathname.slice('${opts.assetsPrefix}'.length);
        const asset = __assets[name];
        if (asset) {
          if (request.headers.get('if-none-match') === asset.etag) {
            return new Response(null, { status: 304 });
          }
          return new Response(asset.content, {
            headers: { 'content-type': asset.mime, 'cache-control': 'public, max-age=31536000, immutable', 'etag': asset.etag }
          });
        }
        return __secHeaders(new Response('Not Found', { status: 404 }));
      }

      const match = __match(url.pathname);

      if (!match) {
        return __secHeaders(new Response(${opts.isLayoutAsync ? 'await ' : ''}__layout(__error(404)), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }));
      }

      __runtimeCtx.params = match.params;
      const route = routes[match.index];
      __setLocal('params', match.params);

      // API route: dispatch to method handler
      if (route.__api) {
        const method = request.method;
        if (method === 'OPTIONS') {
          const handler = route['OPTIONS'];
          if (typeof handler === 'function') return __secHeaders(await handler(__runtimeCtx));
          const allowed = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].filter(m => typeof route[m] === 'function').join(', ');
          return __secHeaders(new Response(null, { status: 204, headers: { 'Allow': allowed, 'Access-Control-Allow-Methods': allowed } }));
        }
        const handler = route[method];
        if (typeof handler !== 'function') {
          const allowed = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].filter(m => typeof route[m] === 'function').join(', ');
          return __secHeaders(new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'content-type': 'application/json', 'Allow': allowed } }));
        }
        return __secHeaders(await handler(__runtimeCtx));
      }

      const __qFn = request.headers.get('x-kuratchi-query-fn') || '';
      const __qArgsRaw = request.headers.get('x-kuratchi-query-args') || '[]';
      let __qArgs = [];
      try {
        const __parsed = JSON.parse(__qArgsRaw);
        __qArgs = Array.isArray(__parsed) ? __parsed : [];
      } catch {}
      __setLocal('__queryOverride', __qFn ? { fn: __qFn, args: __qArgs } : null);
      if (!__getLocals().__breadcrumbs) {
        __setLocal('breadcrumbs', __buildDefaultBreadcrumbs(url.pathname, match.params));
      }

      // RPC call: GET ?_rpc=fnName&_args=[...] -> JSON response
      const __rpcName = url.searchParams.get('_rpc');
      if (request.method === 'GET' && __rpcName && route.rpc && Object.hasOwn(route.rpc, __rpcName)) {
        if (request.headers.get('x-kuratchi-rpc') !== '1') {
          return __secHeaders(new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
            status: 403, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
          }));
        }
        try {
          const __rpcArgsStr = url.searchParams.get('_args');
          let __rpcArgs = [];
          if (__rpcArgsStr) {
            const __parsed = JSON.parse(__rpcArgsStr);
            __rpcArgs = Array.isArray(__parsed) ? __parsed : [];
          }
          const __rpcResult = await route.rpc[__rpcName](...__rpcArgs);
          return __secHeaders(new Response(JSON.stringify({ ok: true, data: __rpcResult }), {
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
          }));
        } catch (err) {
          console.error('[kuratchi] RPC error:', err);
          const __errMsg = typeof __kuratchi_DEV__ !== 'undefined' ? err.message : 'Internal Server Error';
          return __secHeaders(new Response(JSON.stringify({ ok: false, error: __errMsg }), {
            status: 500, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
          }));
        }
      }

      // Form action: POST with hidden _action field in form body
      if (request.method === 'POST') {
        if (!__isSameOrigin(request, url)) {
          return __secHeaders(new Response('Forbidden', { status: 403 }));
        }
        const formData = await request.formData();
        const actionName = formData.get('_action');
        const __actionFn = (actionName && route.actions && Object.hasOwn(route.actions, actionName) ? route.actions[actionName] : null)
          || (actionName && __layoutActions && Object.hasOwn(__layoutActions, actionName) ? __layoutActions[actionName] : null);
        if (actionName && __actionFn) {
          // Check if this is a fetch-based action call (onclick) with JSON args
          const argsStr = formData.get('_args');
          const isFetchAction = argsStr !== null;
          try {
            if (isFetchAction) {
              const __parsed = JSON.parse(argsStr);
              const args = Array.isArray(__parsed) ? __parsed : [];
              await __actionFn(...args);
            } else {
              await __actionFn(formData);
            }
          } catch (err) {
            if (err && err.isRedirectError) {
              const __redirectTo = err.location || url.pathname;
              const __redirectStatus = Number(err.status) || 303;
              if (isFetchAction) {
                return __attachCookies(__secHeaders(new Response(JSON.stringify({ ok: true, redirectTo: __redirectTo, redirectStatus: __redirectStatus }), {
                  headers: { 'content-type': 'application/json' }
                })));
              }
              return __attachCookies(new Response(null, { status: __redirectStatus, headers: { 'location': __redirectTo } }));
            }
            console.error('[kuratchi] Action error:', err);
            if (isFetchAction) {
              const __errMsg = typeof __kuratchi_DEV__ !== 'undefined' && err && err.message ? err.message : 'Internal Server Error';
              return __secHeaders(new Response(JSON.stringify({ ok: false, error: __errMsg }), {
                status: 500, headers: { 'content-type': 'application/json' }
              }));
            }
            const __loaded = route.load ? await route.load(match.params) : {};
            const data = (__loaded && typeof __loaded === 'object') ? __loaded : { value: __loaded };
            data.params = match.params;
            data.breadcrumbs = __getLocals().__breadcrumbs ?? [];
            const __allActions = Object.assign({}, route.actions, __layoutActions || {});
            Object.keys(__allActions).forEach(function(k) { if (!(k in data)) data[k] = { error: undefined, loading: false, success: false }; });
            const __errMsg = (err && err.isActionError) ? err.message : (typeof __kuratchi_DEV__ !== 'undefined' && err && err.message) ? err.message : 'Action failed';
            data[actionName] = { error: __errMsg, loading: false, success: false };
            return ${opts.isLayoutAsync ? 'await ' : ''}__render(route, data);
          }
          // Fetch-based actions return lightweight JSON (no page re-render)
          if (isFetchAction) {
            return __attachCookies(new Response(JSON.stringify({ ok: true }), {
              headers: { 'content-type': 'application/json' }
            }));
          }
          // POST-Redirect-GET: redirect to custom target or back to same URL
          const __locals = __getLocals();
          const redirectTo = __locals.__redirectTo || url.pathname;
          const redirectStatus = Number(__locals.__redirectStatus) || 303;
          return __attachCookies(new Response(null, { status: redirectStatus, headers: { 'location': redirectTo } }));
        }
      }

      // GET (or unmatched POST): load + render
      try {
        const __loaded = route.load ? await route.load(match.params) : {};
        const data = (__loaded && typeof __loaded === 'object') ? __loaded : { value: __loaded };
        data.params = match.params;
        data.breadcrumbs = __getLocals().__breadcrumbs ?? [];
        const __allActionsGet = Object.assign({}, route.actions, __layoutActions || {});
        Object.keys(__allActionsGet).forEach(function(k) { if (!(k in data)) data[k] = { error: undefined, loading: false, success: false }; });
        return ${opts.isLayoutAsync ? 'await ' : ''}__render(route, data);
      } catch (err) {
        if (err && err.isRedirectError) {
          const __redirectTo = err.location || url.pathname;
          const __redirectStatus = Number(err.status) || 303;
          return __attachCookies(new Response(null, { status: __redirectStatus, headers: { 'location': __redirectTo } }));
        }
        console.error('[kuratchi] Route load/render error:', err);
        const __pageErrStatus = (err && err.isPageError && err.status) ? err.status : 500;
        const __errDetail = (err && err.isPageError) ? err.message : (typeof __kuratchi_DEV__ !== 'undefined' && err && err.message) ? err.message : undefined;
        return __secHeaders(new Response(${opts.isLayoutAsync ? 'await ' : ''}__layout(__error(__pageErrStatus, __errDetail)), { status: __pageErrStatus, headers: { 'content-type': 'text/html; charset=utf-8' } }));
      }
    };

    try {
      const __requestResponse = await __runRuntimeRequest(__runtimeCtx, async () => {
        return __runRuntimeRoute(__runtimeCtx, __coreFetch);
      });
      return await __runRuntimeResponse(__runtimeCtx, __requestResponse);
    } catch (err) {
      const __handled = await __runRuntimeError(__runtimeCtx, err);
      if (__handled) return __secHeaders(__handled);
      throw err;
    }
  }
}
`;
}





function resolveRuntimeImportPath(projectDir: string): string | null {
  const candidates: Array<{ file: string; importPath: string }> = [
    { file: 'src/server/runtime.hook.ts', importPath: '../src/server/runtime.hook' },
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(projectDir, candidate.file))) {
      return candidate.importPath;
    }
  }
  return null;
}

function toWorkerImportPath(projectDir: string, outDir: string, filePath: string): string {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);
  let rel = path.relative(outDir, absPath).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.(ts|js|mjs|cjs)$/, '');
}


