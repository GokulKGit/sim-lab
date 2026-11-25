/* sim-lab: the four standard views every topic gets.
   Overview (facts), Tour (step-by-step animation), Simulate (sandbox + terminal), Check (quiz + checklist).
   Every field is optional; a tab appears only when its data exists. */
(function () {
  'use strict';
  const L = window.SimLab, h = L.h;
  L.views = {};

  /* Which tabs a service has, in order. */
  L.tabsOf = function (svc) {
    const t = [];
    if (svc.overview) t.push({ id: 'overview', label: 'Overview' });
    if (svc.tour) t.push({ id: 'tour', label: 'Tour' });
    if (svc.sim) t.push({ id: 'sim', label: 'Simulate' });
    (svc.extraTabs || []).forEach(x => t.push(x));
    if (svc.quiz || svc.learn) t.push({ id: 'check', label: 'Check' });
    return t;
  };

  const metricEl = m => h('div', { class: 'metric' + (m[2] ? ' ' + m[2] : '') }, h('span', { class: 'lbl' }, m[0]), h('b', null, m[1]));
  const legendEl = items => h('div', { class: 'legend' }, (items || [['req', 'request'], ['res', 'response'], ['evt', 'event'], ['bad', 'error']]).map(([t, l]) => h('span', null, h('i', { style: { background: `var(--${({ req: 'accent', res: 'ok', evt: 'evt', bad: 'bad', warn: 'warn' })[t] || 'accent'})` } }), l)));

  /* ---------- Overview ---------- */
  const list = (items, cls) => h('ul', { class: 'tick' + (cls ? ' ' + cls : '') }, items.map(x => h('li', { html: x })));
  L.views.overview = function (el, svc) {
    const o = svc.overview;
    L.mark(svc.id, 'overview');
    const hero = [
      h('div', { class: 'card' }, h('span', { class: 'lbl' }, 'What it is'), h('p', { class: 'what', html: o.what || '' }), o.analogy && h('p', { class: 'analogy', html: '<b>Think of it as:</b> ' + o.analogy })),
      (o.signals && o.signals.length) ? h('div', { class: 'card' }, h('span', { class: 'lbl' }, o.signalsTitle || 'Clues that point here'), h('div', { style: { height: '8px' } }), list(o.signals, 'sig')) : null
    ].filter(Boolean);
    const pair = [
      o.use && h('div', { class: 'card' }, h('h3', null, 'Use it when'), list(o.use)),
      o.avoid && h('div', { class: 'card' }, h('h3', null, 'Pick something else when'), list(o.avoid, 'no'))
    ].filter(Boolean);
    const nums = (o.numbers || o.pricing) ? h('div', { class: 'card' }, h('h3', null, 'Numbers and limits'),
      o.numbers && h('div', { class: 'tbl-wrap' }, h('table', { class: 'kv' }, h('tbody', null, o.numbers.map(([k, v]) => h('tr', null, h('td', { html: k }), h('td', { html: v })))))),
      o.pricing && h('p', { style: { marginTop: '10px', fontSize: '.88rem' }, html: '<b>Cost:</b> ' + o.pricing })) : null;
    const rel = (svc.related && svc.related.length) ? h('div', { class: 'card' }, h('h3', null, 'Works with'),
      h('div', { class: 'conn' }, svc.related.map(c => h('div', null, h('span', { class: 'hex sm', style: { '--c': c.color || 'var(--accent)' } }, (c.abbr || c.name || '').slice(0, 3)), h('span', null, h('b', null, c.name), ' ', h('span', { class: 'arrow' }, c.dir || '→')), h('span', { class: 'how-txt', html: c.how || '' }))))) : null;
    const bottom = [nums, rel].filter(Boolean);
    el.append(...[
      h('div', { class: hero.length > 1 ? 'ov-hero' : '', style: { marginBottom: '14px' } }, hero),
      pair.length ? h('div', { class: pair.length > 1 ? 'grid2' : '', style: { marginBottom: '14px' } }, pair) : null,
      o.terms && h('div', { class: 'card', style: { marginBottom: '14px' } }, h('h3', null, 'Key terms'), h('div', { class: 'terms' }, o.terms.map(([t, d]) => h('div', { class: 'term' }, h('b', null, t), h('span', { html: d }))))),
      bottom.length ? h('div', { class: bottom.length > 1 ? 'grid2' : '' }, bottom) : null,
      o.source && h('p', { class: 'note-src', html: o.source })
    ].filter(Boolean)); // native append would print "undefined" for missing parts
  };

  /* ---------- Flow: a short way to write tour animations ----------
     flow: [
       ['client', 'server'],                  // dot from client to server (tone 'req')
       ['server', 'client', 'res', '200 OK'], // tone, then a bubble at the receiver
       { say: 'server', text: 'thinking', tone: 'warn' },
       { wait: 600 },
       { all: [['a', 'b'], ['a', 'c']] },     // at the same time
       { set: spec },                         // swap the diagram (e.g. a node goes down)
       { flash: 'server' },
       { metrics: [['Latency', '120 ms', 'ok']] }
     ] */
  const SAY_TONE = { res: 'ok', bad: 'bad', evt: 'evt', warn: 'warn' };
  L.playFlow = async function (S, t, flow, setMetrics) {
    const one = async it => {
      if (t.dead) throw L.CANCELLED;
      if (Array.isArray(it)) {
        const [a, b, tone, text] = it;
        await S.packet(a, b, { tone: tone || 'req' });
        if (text) S.say(b, text, SAY_TONE[tone]);
      } else if (it.all) await Promise.all(it.all.map(one));
      else if (it.wait) await t.sleep(it.wait);
      else if (it.say) S.say(it.say, it.text, it.tone, it.ms);
      else if (it.set) S.set(it.set);
      else if (it.flash) S.flash(it.flash);
      else if (it.metrics && setMetrics) setMetrics(it.metrics);
      if (Array.isArray(it) || it.say) await t.sleep(it.gap || 250);
    };
    for (const it of flow) await one(it);
  };

  /* ---------- Tour ---------- */
  L.views.tour = function (el, svc, ctx) {
    const T = svc.tour, steps = T.steps;
    const seenKey = 'tour_' + svc.id;
    const seen = new Set(L.store.get(seenKey, []));
    let i = L.clamp(L.store.get('tourAt_' + svc.id, 0), 0, steps.length - 1);
    let tok = null;

    const metrics = h('div', { class: 'stage-top' });
    const sceneBox = h('div', { class: 'scene-box' });
    const strip = h('div', { class: 'steps-strip' });
    const stage = h('div', { class: 'stage' }, metrics, sceneBox, legendEl(T.legend), strip);
    const kick = h('span', { class: 'chip acc' }), count = h('span', { class: 'lbl' });
    const title = h('h2', { class: 'step-title' }), body = h('div', { class: 'step-body' }), tipBox = h('div');
    const back = h('button', { class: 'btn', onclick: () => go(i - 1) }, '← Back');
    const next = h('button', { class: 'btn pri', onclick: () => go(i + 1) });
    const replay = h('button', { class: 'btn sm', onclick: () => go(i), title: 'Replay this step' }, '↻ Replay');
    const panel = h('div', { class: 'card' }, h('div', { class: 'step-k' }, count, kick), title, body, tipBox, h('div', { class: 'nav-row' }, back, next), h('div', { class: 'keys', html: '<kbd>←</kbd> <kbd>→</kbd> step · <kbd>R</kbd> replay' }));
    const learn = svc.learn && h('div', { class: 'card' }, h('span', { class: 'lbl' }, 'This tour covers'), h('ul', { class: 'tick', style: { marginTop: '8px' } }, svc.learn.map(s => h('li', { html: s }))));
    el.append(h('div', { class: 'stage-grid' }, stage, h('div', { class: 'side' }, panel, learn, h('div', { style: { display: 'flex', gap: '8px' } }, replay))));

    const S = L.Scene(sceneBox, { w: T.w, h: T.h, label: svc.name + ' tour diagram' });

    function drawStrip() {
      strip.textContent = '';
      steps.forEach((st, k) => strip.append(h('button', { class: (k === i ? 'cur ' : '') + (seen.has(k) ? 'seen' : ''), onclick: () => go(k), 'aria-label': 'Step ' + (k + 1) + ': ' + st.title }, k + 1)));
      strip.append(h('span', { class: 'now' }, steps[i].title));
    }
    function go(k) {
      if (k < 0) return;
      if (k >= steps.length) { ctx.switchTab(L.tabsOf(svc).find(t => t.id === 'sim') ? 'sim' : 'check'); return; }
      i = k;
      seen.add(i);
      L.store.set(seenKey, Array.from(seen));
      L.store.set('tourAt_' + svc.id, i);
      if (i === steps.length - 1) L.mark(svc.id, 'tour');
      const st = steps[i];
      if (tok) tok.stop();
      S.clearFx();
      tok = L.Cancel();
      count.textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
      kick.textContent = st.kind || 'Concept';
      kick.className = 'chip ' + ({ 'Exam trap': 'warn', 'Common mistake': 'warn', 'Failure': 'bad', 'Event': 'evt' }[st.kind] || 'acc');
      title.textContent = st.title;
      body.innerHTML = st.body;
      tipBox.textContent = '';
      if (st.tip) tipBox.append(h('div', { class: 'tip' }, h('span', { class: 'lbl' }, 'Good to know'), h('span', { html: st.tip })));
      if (st.trap) tipBox.append(h('div', { class: 'tip trap' }, h('span', { class: 'lbl' }, T.trapLabel || 'Common mistake'), h('span', { html: st.trap })));
      back.disabled = i === 0;
      const nextName = steps[i + 1] ? steps[i + 1].title : (svc.sim ? 'Try the simulator' : 'Check yourself');
      next.textContent = 'Next: ' + nextName + ' →';
      metrics.textContent = '';
      (st.metrics || T.metrics || []).forEach(m => metrics.append(metricEl(m)));
      metrics.hidden = !metrics.childElementCount;
      const spec = typeof st.spec === 'function' ? st.spec() : (st.spec || T.spec);
      S.set(spec);
      drawStrip();
      const run = st.run || (st.flow && ((S2, t2, m2) => { S2.set(spec); return L.playFlow(S2, t2, st.flow, m2); }));
      if (run) {
        const t = tok;
        (async () => {
          try {
            await t.sleep(450);
            do { await run(S, t, m => { metrics.textContent = ''; m.forEach(x => metrics.append(metricEl(x))); metrics.hidden = !m.length; }); await t.sleep(1400); } while (!t.dead && st.loop !== false);
          } catch (e) { if (e !== L.CANCELLED) console.error(e); }
        })();
      }
    }
    const onKey = e => {
      if (e.target.closest('input,textarea,select')) return;
      if (e.key === 'ArrowRight') go(i + 1); else if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'r' || e.key === 'R') go(i);
    };
    document.addEventListener('keydown', onKey);
    go(i);
    return () => { if (tok) tok.stop(); document.removeEventListener('keydown', onKey); };
  };

  /* ---------- Simulate ---------- */
  L.views.sim = function (el, svc) {
    const D = svc.sim;
    let st = D.init();
    let running = true, speed = 1, simT = 0, last = performance.now();
    const logBox = h('div', { class: 'log', 'aria-live': 'polite' });
    const metrics = h('div', { class: 'stage-top' });
    const sceneBox = h('div', { class: 'scene-box' });
    const explain = h('div', { class: 'explain' });
    const clock = h('span', { class: 'clock' });
    const playBtn = h('button', { class: 'btn sm', onclick: () => { running = !running; playBtn.textContent = running ? '❚❚ Pause' : '▶ Run'; } }, '❚❚ Pause');
    const speeds = h('div', { class: 'seg', role: 'group', 'aria-label': 'Speed' }, [1, 2, 4].map(v => h('button', { 'aria-pressed': v === 1 ? 'true' : 'false', onclick: e => { speed = v; S.speed(v); speeds.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false')); } }, v + '×')));
    let pending = []; // [{at, fn}] scheduled with api.after(seconds, fn)
    const resetBtn = h('button', { class: 'btn sm', onclick: () => { st = D.init(); simT = 0; pending = []; logBox.textContent = ''; S.clearFx(); api.log('Reset to the starting setup.', 'acc'); render(true); } }, '↺ Reset');
    const stage = h('div', { class: 'stage' }, metrics, sceneBox, legendEl(D.legend), explain, logBox);

    const ctlBox = h('div', { class: 'card' }, h('span', { class: 'lbl' }, 'Settings'));
    const syncers = [];
    (D.controls || []).forEach(c => {
      if (c.type === 'heading') { ctlBox.append(h('div', { class: 'lbl', style: { marginTop: '12px' } }, c.label)); return; }
      if (c.type === 'actions') {
        ctlBox.append(h('div', { class: 'ctl-actions' }, c.items.map(a => h('button', { class: 'btn sm' + (a.tone === 'bad' ? ' danger' : ''), onclick: () => { a.run(st, api); L.mark(svc.id, 'sim'); render(true); } }, a.label))));
        return;
      }
      const id = 'c-' + svc.id + '-' + c.id;
      let input, out = h('output', { for: id });
      if (c.type === 'range') {
        input = h('input', { type: 'range', id, min: c.min, max: c.max, step: c.step || 1 });
        input.addEventListener('input', () => { c.set(st, +input.value, api); out.textContent = (c.fmt || String)(+input.value); L.mark(svc.id, 'sim'); render(true); });
        ctlBox.append(h('div', { class: 'ctl' }, h('label', { for: id }, h('span', null, c.label), out), input, c.help && h('small', { html: c.help })));
        syncers.push(() => { const v = c.get(st); if (document.activeElement !== input) input.value = v; out.textContent = (c.fmt || String)(v); });
      } else if (c.type === 'toggle') {
        input = h('input', { type: 'checkbox', id });
        input.addEventListener('change', () => { c.set(st, input.checked, api); L.mark(svc.id, 'sim'); render(true); });
        ctlBox.append(h('div', { class: 'ctl' }, h('label', { class: 'switch', for: id }, input, h('span', null, c.label)), c.help && h('small', { html: c.help })));
        syncers.push(() => { input.checked = !!c.get(st); });
      } else if (c.type === 'select') {
        input = h('select', { id }, c.options.map(([v, l]) => h('option', { value: v }, l)));
        input.addEventListener('change', () => { c.set(st, input.value, api); L.mark(svc.id, 'sim'); render(true); });
        ctlBox.append(h('div', { class: 'ctl' }, h('label', { for: id }, c.label), input, c.help && h('small', { html: c.help })));
        syncers.push(() => { if (document.activeElement !== input) input.value = c.get(st); });
      }
    });

    const scen = D.scenarios && h('div', { class: 'card' }, h('span', { class: 'lbl' }, 'Try these'), h('div', { class: 'scen', style: { marginTop: '8px' } }, D.scenarios.map(sc => h('button', { onclick: () => { api.log('▶ ' + sc.title, 'acc'); sc.run(st, api); L.mark(svc.id, 'sim'); render(true); } }, h('b', null, sc.title), h('span', null, sc.desc)))));

    // Terminal
    let termBox = null;
    if (D.cli) {
      const out = h('div', { class: 'term-out', 'aria-live': 'polite' });
      const inp = h('input', { id: 'term-' + svc.id, autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Command', placeholder: 'type help' });
      const hist = []; let hi = 0;
      const print = (txt, cls) => { out.append(h('div', { class: cls || '' }, txt)); out.scrollTop = out.scrollHeight; };
      const runLine = line => {
        line = line.trim(); if (!line) return;
        hist.push(line); hi = hist.length;
        print(D.cli.prompt + ' ' + line, 'p');
        if (line === 'clear') { out.textContent = ''; return; }
        if (line === 'help') { print('Commands this simulator understands:', 'mut'); D.cli.cookbook.forEach(c => print('  ' + c)); print('Flags can be written --flag=value or --flag value.', 'mut'); return; }
        const res = D.cli.run(L.parseCmd(line, D.cli.boolFlags), st, api);
        L.mark(svc.id, 'sim');
        if (res == null) print('Not supported in this simulator. Type help to see the commands it knows.', 'warn');
        else (Array.isArray(res) ? res : [[res]]).forEach(r => Array.isArray(r) ? print(r[0], r[1]) : print(r));
        render(true);
      };
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { runLine(inp.value); inp.value = ''; }
        else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; inp.value = hist[hi]; } e.preventDefault(); }
        else if (e.key === 'ArrowDown') { if (hi < hist.length - 1) { hi++; inp.value = hist[hi]; } else { hi = hist.length; inp.value = ''; } e.preventDefault(); }
      });
      (D.cli.intro || []).forEach(l => print(l, 'mut'));
      termBox = h('div', null,
        h('div', { class: 'term-box' }, h('div', { class: 'term-head' }, h('i'), h('i'), h('i'), h('span', null, (D.cli.title || 'Terminal') + ' (simulated)')), out, h('div', { class: 'term-in' }, h('span', null, '$'), inp)),
        h('div', { class: 'cook' }, D.cli.cookbook.map(c => h('button', { title: 'Put this command in the terminal', onclick: () => { inp.value = c; inp.focus(); } }, c))));
    }

    el.append(
      h('div', { class: 'sim-bar' }, playBtn, speeds, resetBtn, clock, h('span', { class: 'chip' }, 'Time runs faster than real life')),
      h('div', { class: 'stage-grid' }, h('div', { class: 'side' }, stage, termBox), h('div', { class: 'side' }, scen, ctlBox))
    );
    const S = L.Scene(sceneBox, { w: D.w, h: D.h, label: svc.name + ' simulation' });

    const api = {
      scene: S,
      log(msg, tone) {
        const m = Math.floor(simT / 60), s = Math.floor(simT % 60);
        logBox.prepend(h('div', null, h('time', null, String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')), h('span', { class: tone || '', html: String(msg) })));
        while (logBox.childElementCount > 80) logBox.lastChild.remove();
      },
      packet: (a, b, tone, dur) => S.packet(a, b, { tone, dur }),
      say: (id, t, tone, ms) => S.say(id, t, tone, ms),
      flash: id => S.flash(id),
      now: () => simT,
      after: (sec, fn) => { pending.push({ at: simT + sec, fn }); },
      refresh: () => render(true)
    };

    let lastDraw = 0;
    function render(force) {
      const now = performance.now();
      if (!force && now - lastDraw < 240) return;
      lastDraw = now;
      S.set(D.view(st, api));
      metrics.textContent = '';
      D.metrics(st).forEach(m => metrics.append(metricEl(m)));
      const ex = D.explain ? D.explain(st) : '';
      explain.hidden = !ex;
      explain.innerHTML = ex ? '<b>What is happening:</b><span>' + ex + '</span>' : '';
      syncers.forEach(f => f());
      const m = Math.floor(simT / 60), s = Math.floor(simT % 60);
      clock.textContent = 'sim time ' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    const timer = setInterval(() => {
      const now = performance.now();
      const realDt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!running || document.hidden) return;
      const dt = realDt * speed;
      simT += dt;
      if (pending.length) {
        const due = pending.filter(p => p.at <= simT);
        pending = pending.filter(p => p.at > simT);
        due.forEach(p => p.fn(st, api));
      }
      D.tick(st, dt, api);
      render(false);
    }, 100);
    if (D.onStart) D.onStart(st, api);
    render(true);
    return () => clearInterval(timer);
  };

  /* ---------- Check ---------- */
  L.views.check = function (el, svc) {
    const Q = svc.quiz || [];
    const key = 'quiz_' + svc.id;
    const saved = L.store.get(key, {});
    const scoreB = h('b'), scoreT = h('span', { style: { color: 'var(--muted)', fontSize: '.88rem' } });
    const update = () => {
      const answered = Object.keys(saved).length, right = Object.values(saved).filter(Boolean).length;
      scoreB.textContent = right + ' / ' + Q.length;
      scoreT.textContent = answered < Q.length ? (Q.length - answered) + ' left. Your first click on each question counts.' : (right / Q.length >= 0.75 ? 'Passed. Nice work.' : 'Below 75%. Read the explanations, replay the tour, then reset and try again.');
      if (answered === Q.length && right / Q.length >= 0.75) L.mark(svc.id, 'check');
    };
    const quiz = h('div', { class: 'quiz' }, Q.map((q, qi) => {
      const why = h('p', { class: 'why', hidden: true, html: q.y });
      const opts = h('div', { class: 'opts' });
      const reveal = pick => {
        opts.querySelectorAll('.opt').forEach((b, k) => { b.disabled = true; if (k === q.a) b.classList.add('right'); else if (k === pick) b.classList.add('wrong'); });
        why.hidden = false;
      };
      q.o.forEach((o, k) => opts.append(h('button', { class: 'opt', onclick: () => {
        if (!(qi in saved)) { saved[qi] = k === q.a; L.store.set(key, saved); update(); }
        reveal(k);
      } }, h('b', null, 'ABCD'[k]), h('span', { html: o }))));
      if (qi in saved) reveal(saved[qi] ? q.a : -1);
      return h('div', { class: 'q' }, h('p', { html: (qi + 1) + '. ' + q.q }), opts, why);
    }));
    const learnBox = svc.learn && h('div', { class: 'card' }, h('h3', null, 'Can you explain these out loud?'), h('div', { class: 'learn' }, svc.learn.map((s, k) => {
      const lk = 'learn_' + svc.id;
      const got = L.store.get(lk, {});
      const id = 'lrn-' + svc.id + '-' + k;
      const cb = h('input', { type: 'checkbox', id });
      cb.checked = !!got[k];
      cb.addEventListener('change', () => { const g = L.store.get(lk, {}); g[k] = cb.checked; L.store.set(lk, g); });
      return h('label', { for: id }, cb, h('span', { html: s }));
    })));
    const phases = h('div', { class: 'card' }, h('h3', null, 'Your progress on ' + svc.name), h('div', { class: 'learn' }, L.tabsOf(svc).map(t => h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '.9rem' } }, h('span', { class: 'chip' + (L.prog(svc.id)[t.id] ? ' on' : '') }, L.prog(svc.id)[t.id] ? 'done' : 'to do'), t.label))));
    const resetBtn = h('button', { class: 'btn sm', onclick: () => { L.store.set(key, {}); L.mark(svc.id, 'check', false); el.textContent = ''; L.views.check(el, svc); } }, 'Reset answers');
    el.append(h('div', { class: 'check-grid' },
      h('div', { class: 'side' }, h('div', { class: 'card score' }, h('div', null, h('span', { class: 'lbl' }, 'Score'), h('br'), scoreB), scoreT, h('span', { style: { flex: 1 } }), resetBtn), quiz),
      h('div', { class: 'side' }, phases, learnBox)));
    update();
  };
})();
