export interface UiConfigValues {
  theme: string;
  radius: string;
}

const ROOT_HEAD_SLOT = '<!--__KURATCHI_ROOT_HEAD_SLOT__-->';
const ROOT_BODY_SLOT = '<!--__KURATCHI_ROOT_BODY_SLOT__-->';

function insertBeforeClosingTag(source: string, tagName: 'head' | 'body', marker: string): string {
  const lower = source.toLowerCase();
  const closingTag = `</${tagName}>`;
  const idx = lower.lastIndexOf(closingTag);
  if (idx === -1) {
    return tagName === 'head' ? `${marker}\n${source}` : `${source}\n${marker}`;
  }
  return source.slice(0, idx) + marker + '\n' + source.slice(idx);
}

function compactInlineJs(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*([{}();,:])\s*/g, '$1')
    .trim();
}

function patchHtmlTag(source: string, theme: string, radius: string): string {
  return source.replace(/(<html\b)([^>]*)(>)/i, (_match: string, open: string, attrs: string, close: string) => {
    if (theme === 'dark') {
      if (/\bclass\s*=\s*"([^"]*)"/i.test(attrs)) {
        attrs = attrs.replace(/class\s*=\s*"([^"]*)"/i, (_classMatch: string, cls: string) => {
          const classes = cls.split(/\s+/).filter(Boolean);
          if (!classes.includes('dark')) classes.unshift('dark');
          return `class="${classes.join(' ')}"`;
        });
      } else {
        attrs += ' class="dark"';
      }
      attrs = attrs.replace(/\s*data-theme\s*=\s*"[^"]*"/i, '');
    } else if (theme === 'light') {
      attrs = attrs.replace(/class\s*=\s*"([^"]*)"/i, (_classMatch: string, cls: string) => {
        const classes = cls.split(/\s+/).filter(Boolean).filter((className: string) => className !== 'dark');
        return classes.length ? `class="${classes.join(' ')}"` : '';
      });
      attrs = attrs.replace(/\s*data-theme\s*=\s*"[^"]*"/i, '');
    } else if (theme === 'system') {
      attrs = attrs.replace(/class\s*=\s*"([^"]*)"/i, (_classMatch: string, cls: string) => {
        const classes = cls.split(/\s+/).filter(Boolean).filter((className: string) => className !== 'dark');
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

const BRIDGE_SOURCE = `(function(){
  function by(sel, root){ return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var __clientHandlers = Object.create(null);
  window.__kuratchiClient = window.__kuratchiClient || {
    register: function(routeId, handlers){
      if(!routeId || !handlers) return;
      // Validate routeId format (alphanumeric, underscores, hyphens only)
      if(!/^[a-zA-Z0-9_-]+$/.test(String(routeId))) return;
      __clientHandlers[String(routeId)] = Object.assign(__clientHandlers[String(routeId)] || {}, handlers);
    },
    invoke: function(routeId, handlerId, args, event, element){
      // Validate inputs to prevent prototype pollution and injection
      if(!routeId || !handlerId) return;
      var safeRouteId = String(routeId);
      var safeHandlerId = String(handlerId);
      // Block prototype pollution attempts
      if(safeRouteId === '__proto__' || safeRouteId === 'constructor' || safeRouteId === 'prototype') return;
      if(safeHandlerId === '__proto__' || safeHandlerId === 'constructor' || safeHandlerId === 'prototype') return;
      // Validate handler ID format (alphanumeric, underscores only - matches JS identifier rules)
      if(!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(safeHandlerId)) return;
      var routeHandlers = __clientHandlers[safeRouteId] || null;
      if(!routeHandlers || !Object.prototype.hasOwnProperty.call(routeHandlers, safeHandlerId)) return;
      var handler = routeHandlers[safeHandlerId];
      if(typeof handler !== 'function') return;
      return handler(Array.isArray(args) ? args : [], event, element);
    }
  };
  function syncGroup(group){
    var items = by('[data-select-item]').filter(function(el){ return el.getAttribute('data-select-item') === group; });
    var masters = by('[data-select-all]').filter(function(el){ return el.getAttribute('data-select-all') === group; });
    if(!items.length || !masters.length) return;
    var all = items.every(function(i){ return !!i.checked; });
    var any = items.some(function(i){ return !!i.checked; });
    masters.forEach(function(m){ m.checked = all; m.indeterminate = any && !all; });
  }
  function act(e){
    var clientSel = '[data-client-event="' + e.type + '"]';
    var clientEl = e.target && e.target.closest ? e.target.closest(clientSel) : null;
    if(clientEl){
      var routeId = clientEl.getAttribute('data-client-route') || '';
      var handlerId = clientEl.getAttribute('data-client-handler') || '';
      var argsRaw = clientEl.getAttribute('data-client-args') || '[]';
      var args = [];
      try {
        var parsedArgs = JSON.parse(argsRaw);
        args = Array.isArray(parsedArgs) ? parsedArgs : [];
      } catch(_err) {}
      try {
        var result = window.__kuratchiClient && typeof window.__kuratchiClient.invoke === 'function'
          ? window.__kuratchiClient.invoke(routeId, handlerId, args, e, clientEl)
          : undefined;
        if(result === false){
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      } catch(err) {
        console.error('[kuratchi] client handler error:', err);
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
    fetch(location.pathname, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function(r){
        if(!r.ok){
          return r.json().then(function(j){ throw new Error((j && j.error) || ('HTTP ' + r.status)); }).catch(function(){ throw new Error('HTTP ' + r.status); });
        }
        return r.json();
      })
      .then(function(j){
        if(j && j.redirectTo){ location.assign(j.redirectTo); return; }
      })
      .catch(function(err){ console.error('[kuratchi] client action error:', err); });
  }
  ['click','change','input','focus','blur','submit'].forEach(function(ev){ document.addEventListener(ev, act, true); });
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
  (function initWorkflowPoll(){
    // Driven by <script type="application/json" id="__kuratchi_poll"> injected by
    // the server when a route called workflowStatus(..., { poll }). Each tick, we
    // re-fetch the current URL and swap <body> contents so every { status.* } in
    // the template re-renders against fresh data. The server sets the
    // x-kuratchi-poll-done header when the 'until' predicate reports terminal.
    function parseInterval(v){
      if(typeof v === 'number') return v > 0 ? v : 30000;
      if(!v) return 30000;
      var m = String(v).match(/^(\\d+(?:\\.\\d+)?)(ms|s|m)?$/i);
      if(!m) return 30000;
      var n = parseFloat(m[1]);
      var u = (m[2] || 's').toLowerCase();
      if(u === 'ms') return n;
      if(u === 'm') return n * 60000;
      return n * 1000;
    }
    function readConfig(){
      var el = document.getElementById('__kuratchi_poll');
      if(!el) return null;
      try { return JSON.parse(el.textContent || '{}'); } catch(_e) { return null; }
    }
    var timer = null;
    var stopped = false;
    function stop(){ stopped = true; if(timer){ clearTimeout(timer); timer = null; } }
    function tick(interval){
      if(stopped) return;
      timer = setTimeout(function(){
        if(stopped) return;
        if(document.hidden){ tick(interval); return; }
        fetch(location.pathname + location.search, {
          headers: { 'x-kuratchi-poll': '1' },
          credentials: 'same-origin',
        })
          .then(function(r){
            var done = r.headers.get('x-kuratchi-poll-done') === '1';
            return r.text().then(function(html){ return { html: html, done: done, ok: r.ok }; });
          })
          .then(function(res){
            if(stopped) return;
            if(!res.ok){ tick(interval); return; }
            if(typeof DOMParser === 'undefined'){ location.reload(); return; }
            var doc = new DOMParser().parseFromString(res.html, 'text/html');
            if(doc && doc.body){
              document.body.innerHTML = doc.body.innerHTML;
            }
            if(res.done){ stop(); return; }
            var next = readConfig();
            tick(next ? parseInterval(next.interval) : interval);
          })
          .catch(function(){ if(!stopped) tick(interval); });
      }, interval);
    }
    function start(){
      var cfg = readConfig();
      if(!cfg) return;
      tick(parseInterval(cfg.interval));
    }
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
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

const REACTIVE_RUNTIME_SOURCE = `(function(g){
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

export function prepareRootLayoutSource(opts: {
  source: string;
  isDev: boolean;
  themeCss: string | null;
  uiConfigValues: UiConfigValues | null;
}): string {
  let source = opts.source;
  const headInjections: string[] = [];
  const bodyInjections: string[] = [];

  if (opts.uiConfigValues) {
    source = patchHtmlTag(source, opts.uiConfigValues.theme, opts.uiConfigValues.radius);
  }

  if (opts.uiConfigValues) {
    const themeInitScript = `<script>(function(){try{var d=document.documentElement;var s=localStorage.getItem('kui-theme');var fallback=d.getAttribute('data-theme')==='system'?'system':(d.classList.contains('dark')?'dark':'light');var p=(s==='light'||s==='dark'||s==='system')?s:fallback;d.classList.remove('dark');d.removeAttribute('data-theme');if(p==='dark'){d.classList.add('dark');}else if(p==='system'){d.setAttribute('data-theme','system');}}catch(e){}})()</script>`;
    headInjections.push(themeInitScript);
  }

  if (opts.themeCss) {
    headInjections.push(`<style>${opts.themeCss}</style>`);
  }

  headInjections.push(`<style>@view-transition { navigation: auto; }</style>`);

  const actionScript = `<script>${opts.isDev ? BRIDGE_SOURCE : compactInlineJs(BRIDGE_SOURCE)}</script>`;
  const reactiveRuntimeScript = `<script>${opts.isDev ? REACTIVE_RUNTIME_SOURCE : compactInlineJs(REACTIVE_RUNTIME_SOURCE)}</script>`;
  headInjections.push(reactiveRuntimeScript);
  bodyInjections.push(actionScript);

  source = insertBeforeClosingTag(source, 'head', ROOT_HEAD_SLOT);
  source = insertBeforeClosingTag(source, 'body', ROOT_BODY_SLOT);
  source = source.replace(ROOT_HEAD_SLOT, headInjections.join('\n'));
  source = source.replace(ROOT_BODY_SLOT, bodyInjections.join('\n'));

  return source;
}
