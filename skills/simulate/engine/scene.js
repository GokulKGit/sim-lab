/* sim-lab: SVG scene engine.
   A scene is a set of groups (dashed boxes), nodes (cards) and links (lines).
   Call scene.set(spec) as often as you like: nodes are matched by id, so they
   slide to new positions, fade in, or fade out.

   spec = {
     groups: [{id, x, y, w, h, label, tone}],             // x,y = top-left
     nodes:  [{id, kind:'svc'|'actor'|'unit'|'store', x, y, label, sub, abbr, color, state, badge, w, h, dim, hl}],
     links:  [{a, b, label, dash, tone}]                    // a/b = node ids
   }
   kind 'svc' and 'store' draw a hexagon icon with abbr (up to 4 letters); 'unit' is a small
   instance/pod/VM card whose top stripe shows state:
   cold | start | ready | busy | idle | down | evt
*/
(function () {
  'use strict';
  const L = window.SimLab;
  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); return e; };
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const SIZE = { svc: [184, 60], store: [178, 60], actor: [132, 46], unit: [80, 44] };
  const HEX = r => { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; p.push((r * Math.cos(a)).toFixed(1) + ',' + (r * Math.sin(a)).toFixed(1)); } return p.join(' '); };

  L.Scene = function (host, opt) {
    opt = opt || {};
    const W = opt.w || 820, H = opt.h || 430;
    const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'scene-svg', role: 'img', 'aria-label': opt.label || 'Diagram' });
    const pid = 'grid' + L.hexId(6);
    const defs = S('defs');
    const pat = S('pattern', { id: pid, width: 22, height: 22, patternUnits: 'userSpaceOnUse' });
    pat.append(S('path', { d: 'M22 0H0V22', fill: 'none', class: 'grid-line' }));
    defs.append(pat);
    svg.append(defs, S('rect', { width: W, height: H, class: 'bgrect' }), S('rect', { width: W, height: H, fill: `url(#${pid})` }));
    const gGroups = S('g'), gLinks = S('g'), gPk = S('g'), gNodes = S('g'), gSay = S('g');
    svg.append(gGroups, gLinks, gPk, gNodes, gSay);
    host.append(svg);

    const nodes = new Map(), groups = new Map();
    let speed = 1;

    function buildNode(n) {
      const g = S('g', { class: 'nd' });
      const r = { g, n: {}, box: S('rect', { class: 'box' }), stripe: S('rect', { class: 'stripe' }), hx: S('polygon', { class: 'hx', points: HEX(15) }), hxt: S('text', { class: 'hxt', 'text-anchor': 'middle', 'dominant-baseline': 'central' }), ttl: S('text', { class: 'ttl' }), sub: S('text', { class: 'sub' }), bdg: S('g'), person: S('g') };
      r.bdg.append(S('circle', { class: 'bdg', r: 11 }), S('text', { class: 'bdgt', 'text-anchor': 'middle', 'dominant-baseline': 'central' }));
      r.person.append(S('circle', { cx: 0, cy: -5, r: 5, class: 'hx' }), S('path', { d: 'M-9 10 a9 8 0 0 1 18 0 z', class: 'hx' }));
      g.append(r.box, r.stripe, r.hx, r.hxt, r.person, r.ttl, r.sub, r.bdg);
      g.style.opacity = '0';
      gNodes.append(g);
      setTimeout(() => { g.style.opacity = ''; }, 40);
      return r;
    }

    function paint(r, n) {
      const kind = n.kind || 'svc';
      const sz = SIZE[kind] || SIZE.svc;
      const w = n.w || sz[0], h = n.h || sz[1];
      r.w = w; r.h = h; r.x = n.x; r.y = n.y;
      r.g.style.transform = `translate(${n.x}px, ${n.y}px)`;
      r.g.setAttribute('class', ['nd', kind, n.state ? 's-' + n.state : '', n.hl ? 'hl' : '', n.dim ? 'dim' : '', n.tone ? 't-' + n.tone : ''].join(' ').trim());
      if (n.color) r.g.style.setProperty('--nc', n.color); else r.g.style.removeProperty('--nc');
      const rx = kind === 'actor' ? h / 2 : kind === 'unit' ? 8 : 12;
      Object.entries({ x: -w / 2, y: -h / 2, width: w, height: h, rx }).forEach(([k, v]) => r.box.setAttribute(k, v));
      const isUnit = kind === 'unit';
      r.stripe.style.display = isUnit ? '' : 'none';
      if (isUnit) Object.entries({ x: -w / 2 + 6, y: -h / 2 + 4, width: w - 12, height: 4, rx: 2 }).forEach(([k, v]) => r.stripe.setAttribute(k, v));
      const hasHex = kind === 'svc' || kind === 'store';
      r.hx.style.display = hasHex ? '' : 'none';
      r.hxt.style.display = hasHex ? '' : 'none';
      r.person.style.display = kind === 'actor' ? '' : 'none';
      const iconX = -w / 2 + 24;
      if (hasHex) { r.hx.setAttribute('transform', `translate(${iconX},0)`); r.hxt.setAttribute('x', iconX); r.hxt.setAttribute('y', 0); r.hxt.textContent = (n.abbr || '').slice(0, 4); }
      if (kind === 'actor') r.person.setAttribute('transform', `translate(${-w / 2 + 22},0)`);
      const textX = isUnit ? 0 : -w / 2 + (hasHex ? 46 : 40);
      const anchor = isUnit ? 'middle' : 'start';
      r.ttl.setAttribute('text-anchor', anchor); r.sub.setAttribute('text-anchor', anchor);
      r.ttl.setAttribute('x', textX); r.sub.setAttribute('x', textX);
      const hasSub = !!n.sub;
      r.ttl.setAttribute('y', isUnit ? (hasSub ? 0 : 5) : (hasSub ? -3 : 5));
      r.sub.setAttribute('y', isUnit ? 13 : 13);
      r.ttl.textContent = n.label || '';
      r.sub.textContent = n.sub || '';
      const showB = n.badge != null && n.badge !== '';
      r.bdg.style.display = showB ? '' : 'none';
      if (showB) { r.bdg.setAttribute('transform', `translate(${w / 2 - 4},${-h / 2 + 2})`); r.bdg.lastChild.textContent = n.badge; }
      r.n = n;
    }

    function setGroups(list) {
      const keep = new Set();
      (list || []).forEach(gd => {
        keep.add(gd.id);
        let r = groups.get(gd.id);
        if (!r) { r = { g: S('g', { class: 'grp' }), rect: S('rect', { rx: 14 }), t: S('text') }; r.g.append(r.rect, r.t); gGroups.append(r.g); groups.set(gd.id, r); }
        r.g.setAttribute('class', 'grp' + (gd.tone ? ' ' + gd.tone : ''));
        Object.entries({ x: gd.x, y: gd.y, width: gd.w, height: gd.h }).forEach(([k, v]) => r.rect.setAttribute(k, v));
        r.t.setAttribute('x', gd.x + 12); r.t.setAttribute('y', gd.y + 18); r.t.textContent = gd.label || '';
      });
      for (const [id, r] of groups) if (!keep.has(id)) { r.g.remove(); groups.delete(id); }
    }

    function setLinks(list) {
      gLinks.textContent = '';
      (list || []).forEach(lk => {
        const A = nodes.get(lk.a), B = nodes.get(lk.b);
        if (!A || !B) return;
        gLinks.append(S('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'lk' + (lk.dash ? ' dash' : '') + (lk.tone ? ' ' + lk.tone : '') }));
        if (lk.label) {
          const mx = (A.x + B.x) / 2 + (lk.dx || 0), my = (A.y + B.y) / 2 + (lk.dy || 0);
          const t = S('text', { x: mx, y: my + 3.5, class: 'lk-l', 'text-anchor': 'middle' });
          t.textContent = lk.label;
          const bw = lk.label.length * 6.4 + 10;
          gLinks.append(S('rect', { x: mx - bw / 2, y: my - 8, width: bw, height: 16, rx: 4, class: 'lk-lb' }), t);
        }
      });
    }

    const api = {
      svg, W, H,
      set(spec) {
        spec = spec || {};
        setGroups(spec.groups);
        const keep = new Set();
        (spec.nodes || []).forEach(n => {
          keep.add(n.id);
          let r = nodes.get(n.id);
          if (!r) { r = buildNode(n); nodes.set(n.id, r); }
          paint(r, n);
        });
        for (const [id, r] of nodes) if (!keep.has(id)) {
          nodes.delete(id);
          r.g.style.opacity = '0';
          setTimeout(() => r.g.remove(), 380);
        }
        setLinks(spec.links);
      },
      node: id => nodes.get(id),
      has: id => nodes.has(id),
      speed(v) { speed = v; },
      /* Move a dot from node a to node b. tone: req | res | evt | bad | warn */
      packet(a, b, o) {
        o = o || {};
        const A = nodes.get(a), B = nodes.get(b);
        if (!A || !B || gPk.childElementCount > 80 || document.hidden) return Promise.resolve();
        const c = S('circle', { r: o.r || 5.5, class: 'pk ' + (o.tone || 'req'), cx: A.x, cy: A.y });
        gPk.append(c);
        const dur = (o.dur || 750) / speed;
        if (reduceMotion()) { c.setAttribute('cx', B.x); c.setAttribute('cy', B.y); return new Promise(res => setTimeout(() => { c.remove(); res(); }, Math.min(dur, 300))); }
        return new Promise(res => {
          const t0 = performance.now();
          const x1 = A.x, y1 = A.y, x2 = B.x, y2 = B.y;
          (function f(t) {
            const k = Math.min(1, (t - t0) / dur);
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            c.setAttribute('cx', x1 + (x2 - x1) * e);
            c.setAttribute('cy', y1 + (y2 - y1) * e);
            if (k < 1 && c.isConnected) requestAnimationFrame(f); else { c.remove(); res(); }
          })(t0);
          setTimeout(() => { if (c.isConnected) { c.remove(); res(); } }, dur + 600); // safety when rAF is paused
        });
      },
      /* Speech bubble above a node for a moment. */
      say(id, text, tone, ms) {
        const r = nodes.get(id);
        if (!r) return;
        const g = S('g', { class: 'say' + (tone ? ' ' + tone : '') });
        const w = String(text).length * 6.7 + 16, y = r.y - r.h / 2 - 24;
        g.append(S('rect', { x: r.x - w / 2, y: y - 11, width: w, height: 22, rx: 6 }));
        const t = S('text', { x: r.x, y: y + 4, 'text-anchor': 'middle' });
        t.textContent = text;
        g.append(t);
        gSay.append(g);
        setTimeout(() => { g.style.opacity = '0'; setTimeout(() => g.remove(), 320); }, (ms || 1600) / speed);
      },
      flash(id) {
        const r = nodes.get(id);
        if (!r) return;
        r.g.classList.remove('flash'); void r.g.getBBox(); r.g.classList.add('flash');
      },
      clearFx() { gPk.textContent = ''; gSay.textContent = ''; },
      destroy() { svg.remove(); nodes.clear(); groups.clear(); }
    };
    return api;
  };

  /* Lay out n units in a grid inside a box. Returns [{x,y}] centres. */
  L.layoutGrid = function (n, box, unitW, unitH, gap) {
    unitW = unitW || 78; unitH = unitH || 42; gap = gap || 10;
    const cols = Math.max(1, Math.floor((box.w - 20 + gap) / (unitW + gap)));
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      out.push({ x: box.x + 10 + unitW / 2 + c * (unitW + gap), y: box.y + 34 + unitH / 2 + r * (unitH + gap) });
    }
    return out;
  };
})();
