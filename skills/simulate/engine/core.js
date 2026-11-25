/* sim-lab: core registry and helpers. Topic files call SimLab.topic({...}). */
(function () {
  'use strict';
  const L = (window.SimLab = window.SimLab || {});

  /* One topic per page. */
  L.current = null;
  L.topic = function (t) {
    if (!t || !t.id || !t.name) throw new Error('SimLab.topic needs at least id and name');
    L.current = t;
  };
  /* Older lab files used addService; treat it the same. */
  L.services = {};
  L.addService = function (s) { L.services[s.id] = s; if (!L.current) L.topic(s); };

  /* Storage: wrapped, because it can be missing or throw. Keys are per topic. */
  const pre = () => 'simlab_' + (L.current ? L.current.id : 'x') + '_';
  L.store = {
    get(k, d) { try { const v = localStorage.getItem(pre() + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(pre() + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* Progress: one flag per tab. */
  L.prog = id => L.store.get('p_' + id, {});
  L.mark = (id, phase, val) => {
    const v = val === undefined ? true : val;
    const p = L.prog(id);
    if (p[phase] === v) return;
    p[phase] = v;
    L.store.set('p_' + id, p);
    document.dispatchEvent(new CustomEvent('simlab:progress'));
  };

  /* DOM helper: h('div', {class:'x', onclick:fn}, child, 'text') */
  L.h = function (tag, props) {
    const el = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
      else el.setAttribute(k, v === true ? '' : v);
    }
    const kids = Array.prototype.slice.call(arguments, 2).flat(Infinity);
    kids.forEach(c => { if (c == null || c === false) return; el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  };
  L.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  L.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  L.rnd = (a, b) => a + Math.random() * (b - a);
  L.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  L.hexId = n => Math.random().toString(16).slice(2, 2 + (n || 5));

  /* Command-line parser for the simulated terminal.
     'docker run -d -p 8080:80 nginx' -> {words:['docker','run','nginx'], flags:{d:true, p:'8080:80'}}
     Boolean long flags: list them in cli.boolFlags; no-*, allow-* are boolean by default. */
  L.parseCmd = function (line, boolFlags) {
    const toks = [];
    let cur = '', q = null;
    for (const ch of line.trim()) {
      if (q) { if (ch === q) q = null; else cur += ch; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (/\s/.test(ch)) { if (cur) { toks.push(cur); cur = ''; } }
      else cur += ch;
    }
    if (cur) toks.push(cur);
    const bools = new Set(['async', 'quiet', 'wait', 'help'].concat(boolFlags || []));
    const isBool = name => bools.has(name) || /^(no-|allow-)/.test(name);
    const words = [], flags = {};
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.startsWith('--')) {
        const eq = t.indexOf('=');
        const name = eq > -1 ? t.slice(2, eq) : t.slice(2);
        if (eq > -1) flags[name] = t.slice(eq + 1);
        else if (toks[i + 1] && !toks[i + 1].startsWith('-') && !isBool(name)) flags[name] = toks[++i];
        else flags[name] = true;
      } else if (t.startsWith('-') && t.length === 2) {
        const name = t.slice(1);
        flags[name] = toks[i + 1] && !toks[i + 1].startsWith('-') && !bools.has(name) ? toks[++i] : true;
      } else words.push(t);
    }
    return { words, flags, raw: line.trim() };
  };

  /* Fixed-width table for terminal output. rows: array of arrays. */
  L.table = function (head, rows) {
    const all = [head].concat(rows).map(r => r.map(c => String(c)));
    const w = head.map((_, i) => Math.max.apply(null, all.map(r => (r[i] || '').length)));
    return all.map(r => r.map((c, i) => c.padEnd(w[i])).join('  ').trimEnd()).join('\n');
  };

  /* Copy a diagram spec and change some nodes: L.spec(base, {db: {state: 'down'}}, {nodes: [...extra], links: [...extra]}).
     A node set to null is removed. */
  L.spec = function (base, changes, extra) {
    changes = changes || {}; extra = extra || {};
    const nodes = (base.nodes || []).filter(n => changes[n.id] !== null).map(n => Object.assign({}, n, changes[n.id] || {}));
    const ids = new Set(nodes.map(n => n.id));
    return {
      groups: (base.groups || []).concat(extra.groups || []),
      nodes: nodes.concat(extra.nodes || []),
      links: (base.links || []).filter(l => ids.has(l.a) && ids.has(l.b)).concat(extra.links || [])
    };
  };

  /* Cancellable sleep for tour animations. */
  L.Cancel = function () {
    const t = { dead: false };
    t.sleep = ms => new Promise((res, rej) => setTimeout(() => (t.dead ? rej(L.CANCELLED) : res()), ms));
    t.stop = () => { t.dead = true; };
    return t;
  };
  L.CANCELLED = { cancelled: true };

  /* Compatibility: lab files written for the GCP Service Lab use window.GCPLab. */
  window.GCPLab = L;
})();
