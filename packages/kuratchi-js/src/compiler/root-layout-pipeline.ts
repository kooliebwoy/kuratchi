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
  var __refreshSeq = Object.create(null);
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
  function refreshRemoteReads(){
    var seen = Object.create(null);
    var tasks = [];
    by('[data-remote-read][data-get]').forEach(function(el){
      var fn = el.getAttribute('data-get');
      if(!fn) return;
      var args = String(el.getAttribute('data-get-args') || '[]');
      var key = String(fn) + '|' + args;
      if(seen[key]) return;
      seen[key] = true;
      tasks.push(replaceBlocksByDescriptor(fn, args));
    });
    return Promise.all(tasks).then(function(){});
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
    var csrfToken = (document.cookie.match(/(?:^|;\\s*)__kuratchi_csrf=([^;]*)/) || [])[1] || '';
    var fetchHeaders = {};
    if(csrfToken) fetchHeaders['x-kuratchi-csrf'] = csrfToken;
    fetch(location.pathname, { method: 'POST', body: fd, headers: fetchHeaders })
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
  ['click','change','input','focus','blur','submit'].forEach(function(ev){ document.addEventListener(ev, act, true); });
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
  window.addEventListener('kuratchi:invalidate-reads', function(){
    refreshRemoteReads().catch(function(err){ console.error('[kuratchi] remote read refresh error:', err); });
  });
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
    function parseInterval(str){
      if(!str) return 30000;
      var m = str.match(/^(\\d+(?:\\.\\d+)?)(ms|s|m)?$/i);
      if(!m) return 30000;
      var n = parseFloat(m[1]);
      var u = (m[2] || 's').toLowerCase();
      if(u === 'ms') return n;
      if(u === 'm') return n * 60000;
      return n * 1000;
    }
    function bindPollEl(el){
      if(!el || !el.getAttribute) return;
      if(el.getAttribute('data-kuratchi-poll-bound') === '1') return;
      var fn = el.getAttribute('data-poll');
      if(!fn) return;
      el.setAttribute('data-kuratchi-poll-bound', '1');
      var pollId = el.getAttribute('data-poll-id');
      if(!pollId) return;
      var baseIv = parseInterval(el.getAttribute('data-interval'));
      var maxIv = Math.min(baseIv * 10, 300000);
      var backoff = el.getAttribute('data-backoff') !== 'false';
      var prevHtml = el.innerHTML;
      var currentIv = baseIv;
      (function tick(){
        setTimeout(function(){
          fetch(location.pathname + location.search, { headers: { 'x-kuratchi-fragment': pollId } })
            .then(function(r){
              if(r.status === 404){
                el.remove();
                return null;
              }
              if(!r.ok) throw new Error('Poll fragment request failed: ' + r.status);
              return r.text();
            })
            .then(function(html){
              if(html === null) return;
              if(prevHtml !== html){
                el.innerHTML = html;
                prevHtml = html;
                currentIv = baseIv;
              } else if(backoff && currentIv < maxIv){
                currentIv = Math.min(currentIv * 1.5, maxIv);
              }
              tick();
            })
            .catch(function(){ currentIv = baseIv; tick(); });
        }, currentIv);
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
