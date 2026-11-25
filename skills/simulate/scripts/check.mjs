#!/usr/bin/env node
/* Check a topic file without a browser.
   node check.mjs <topic.js>
   Loads the topic, validates every diagram, flow, quiz and source, runs the simulator,
   every control, scenario and cookbook command. Exit code 1 if there are errors. */
import { resolve } from 'node:path';
import { loadTopic } from './load.mjs';

const file = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!file || process.argv.includes('--help')) { console.log('usage: node check.mjs <topic.js> [--trace]\n  --trace  print the metrics after every control value, action and scenario'); process.exit(file ? 0 : 1); }

const errors = [], warns = [];
/* The same problem often repeats (every tour step, every sim frame): report it once with a count. */
const seen = new Map();
const add = (list, where, msg) => {
  const node = (/ node "[^"]*"/.exec(where) || [''])[0];
  const key = (list === errors ? 'e' : 'w') + node + '|' + msg;
  if (seen.has(key)) { seen.get(key).n++; return; }
  const item = { text: where + ': ' + msg, n: 1 };
  seen.set(key, item); list.push(item);
};
const err = (where, msg) => add(errors, where, msg);
const warn = (where, msg) => add(warns, where, msg);

const TRACE = process.argv.includes('--trace');
const trace = [];
const cover = { diagrams: 0, flows: 0, changes: 0, visible: 0, commands: 0 };
let T, L, reseed;
try { ({ topic: T, L, reseed } = loadTopic(resolve(file))); }
catch (e) { console.error('✖ ' + e.message); process.exit(1); }

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const isFn = v => typeof v === 'function';
const textLen = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, 'x').length;
/* Rough rendered width in px for the diagram font (Inter), calibrated against the browser (±5%). */
const textPx = (s, font) => {
  let em = 0;
  for (const ch of String(s || '')) {
    if (/[ijlI.,:;!|'` ]/.test(ch)) em += 0.28;
    else if (/[frt()\[\]\/-]/.test(ch)) em += 0.36;
    else if (/[mwMW@%]/.test(ch)) em += 0.8;
    else if (/[A-Z#&]/.test(ch)) em += 0.66;
    else em += 0.55;
  }
  return em * font * 1.04;
};

/* ---------- top level ---------- */
if (!/^[a-z0-9][a-z0-9-]*$/.test(T.id)) err('topic', 'id should be kebab-case, got "' + T.id + '"');
if (!T.overview && !T.tour) err('topic', 'needs at least overview or tour');
if (!Array.isArray(T.sources) || !T.sources.length) err('sources', 'add 2–5 official sources: [{title, url}]');
else {
  T.sources.forEach((s, i) => {
    const url = s.url || s[1], title = s.title || s[0];
    if (!isStr(title)) err('sources[' + i + ']', 'missing title');
    if (!/^https?:\/\/\S+$/.test(url || '')) err('sources[' + i + ']', 'url must start with http(s)://');
  });
  if (T.sources.length < 2) warn('sources', 'only one source; use 2–5');
}
if (!T.learn) warn('learn', 'add 3–6 "can you explain…" lines');

/* ---------- diagrams ---------- */
const SIZE = { svc: [184, 60], store: [178, 60], actor: [132, 46], unit: [80, 44] };
const FIT = { // [title font, sub font, text start offset from left edge]
  svc: [14, 11.5, 46], store: [14, 11.5, 46], actor: [14, 11.5, 40], unit: [12, 10.5, 4]
};
const STATES = new Set(['cold', 'start', 'ready', 'busy', 'idle', 'down', 'evt']);

function checkSpec(spec, where, W, H) {
  const ids = new Set();
  if (!spec || typeof spec !== 'object') { err(where, 'diagram spec is missing'); return ids; }
  cover.diagrams++;
  const boxes = [];
  (spec.nodes || []).forEach((n, i) => {
    const w0 = where + ' node "' + (n.id || i) + '"';
    if (!isStr(n.id)) { err(w0, 'missing id'); return; }
    if (ids.has(n.id)) err(w0, 'duplicate id');
    ids.add(n.id);
    const kind = n.kind || 'svc';
    if (!SIZE[kind]) { err(w0, 'unknown kind "' + kind + '" (svc, store, actor, unit)'); return; }
    if (typeof n.x !== 'number' || typeof n.y !== 'number' || isNaN(n.x) || isNaN(n.y)) { err(w0, 'x and y must be numbers'); return; }
    if (n.state && !STATES.has(n.state)) warn(w0, 'unknown state "' + n.state + '"');
    const w = n.w || SIZE[kind][0], h = n.h || SIZE[kind][1];
    if (n.x - w / 2 < 0 || n.x + w / 2 > W || n.y - h / 2 < 0 || n.y + h / 2 > H) warn(w0, 'sticks out of the ' + W + '×' + H + ' canvas');
    const [tf, sf, off] = FIT[kind];
    const room = kind === 'unit' ? w - 4 : w - off - 2; // text start to the box edge
    if (textPx(n.label, tf) > room) warn(w0, 'label "' + n.label + '" is too long for its box (widen it with w, or shorten)');
    if (textPx(n.sub, sf) > room) warn(w0, 'sub "' + n.sub + '" is too long for its box');
    boxes.push({ id: n.id, x1: n.x - w / 2, x2: n.x + w / 2, y1: n.y - h / 2, y2: n.y + h / 2 });
  });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.x1 < b.x2 - 4 && b.x1 < a.x2 - 4 && a.y1 < b.y2 - 4 && b.y1 < a.y2 - 4) warn(where, 'nodes "' + a.id + '" and "' + b.id + '" overlap');
  }
  (spec.links || []).forEach((l, i) => {
    if (!ids.has(l.a) || !ids.has(l.b)) err(where + ' link ' + i, 'connects "' + l.a + '" → "' + l.b + '" but one of them is not in the diagram');
    if (l.label && textLen(l.label) > 18) warn(where + ' link ' + i, 'label "' + l.label + '" is long; keep link labels ≤ 14 chars');
  });
  (spec.groups || []).forEach((g, i) => {
    if (['x', 'y', 'w', 'h'].some(k => typeof g[k] !== 'number')) err(where + ' group ' + (g.id || i), 'needs numeric x, y, w, h');
  });
  return ids;
}

function checkFlow(flow, ids, where, W, H) {
  if (!Array.isArray(flow)) { err(where, 'flow must be an array'); return; }
  cover.flows += flow.length;
  let cur = ids;
  const walk = (it, k) => {
    const w0 = where + ' flow[' + k + ']';
    if (Array.isArray(it)) {
      const [a, b, tone] = it;
      if (!cur.has(a) || !cur.has(b)) err(w0, 'packet "' + a + '" → "' + b + '" uses a node that is not in the diagram');
      if (tone && !['req', 'res', 'evt', 'bad', 'warn'].includes(tone)) warn(w0, 'unknown tone "' + tone + '"');
    } else if (it && it.all) it.all.forEach((x, j) => walk(x, k + '.' + j));
    else if (it && it.say) { if (!cur.has(it.say)) err(w0, 'say on "' + it.say + '", which is not in the diagram'); }
    else if (it && it.set) cur = checkSpec(it.set, w0, W, H);
    else if (it && it.flash) { if (!cur.has(it.flash)) err(w0, 'flash on missing node "' + it.flash + '"'); }
    else if (!(it && ('wait' in it || 'metrics' in it))) err(w0, 'unknown flow item ' + JSON.stringify(it));
  };
  flow.forEach(walk);
}

/* ---------- tour ---------- */
if (T.tour) {
  const tr = T.tour, W = tr.w || 820, H = tr.h || 430;
  if (!Array.isArray(tr.steps) || !tr.steps.length) err('tour', 'steps must be a non-empty array');
  else {
    if (tr.steps.length < 3) warn('tour', 'only ' + tr.steps.length + ' steps; aim for 5–10');
    if (tr.steps.length > 12) warn('tour', tr.steps.length + ' steps; more than 12 gets long');
    tr.steps.forEach((st, i) => {
      const where = 'tour step ' + (i + 1) + ' (' + (st.title || '?') + ')';
      if (!isStr(st.title)) err(where, 'missing title');
      if (!isStr(st.body)) err(where, 'missing body');
      else if (textLen(st.body) > 650) warn(where, 'body is long (' + textLen(st.body) + ' chars); keep one idea per step');
      let spec;
      try { spec = isFn(st.spec) ? st.spec() : (st.spec || tr.spec); } catch (e) { err(where, 'spec() threw: ' + e.message); }
      const ids = checkSpec(spec, where, W, H);
      if (st.flow) checkFlow(st.flow, ids, where, W, H);
      if (st.flow && st.run) warn(where, 'has both flow and run; run wins');
      if (!st.flow && !st.run) warn(where, 'no animation (flow or run)');
    });
  }
}

/* ---------- quiz ---------- */
if (T.quiz) {
  if (!Array.isArray(T.quiz)) err('quiz', 'must be an array');
  else {
    T.quiz.forEach((q, i) => {
      const w0 = 'quiz ' + (i + 1);
      if (!isStr(q.q)) err(w0, 'missing question text q');
      if (!Array.isArray(q.o) || q.o.length < 2 || q.o.length > 4) err(w0, 'o must have 2–4 options');
      else if (!Number.isInteger(q.a) || q.a < 0 || q.a >= q.o.length) err(w0, 'a must be the index of the right option (0–' + (q.o.length - 1) + ')');
      if (!isStr(q.y)) err(w0, 'missing explanation y');
    });
    const counts = [0, 0, 0, 0];
    T.quiz.forEach(q => { if (Number.isInteger(q.a)) counts[q.a]++; });
    if (T.quiz.length >= 4 && Math.max(...counts) > Math.ceil(T.quiz.length / 2)) warn('quiz', 'right answers are bunched (A–D counts ' + counts.join('/') + '); spread them');
    if (T.quiz.length < 4) warn('quiz', 'only ' + T.quiz.length + ' questions; aim for 5–8');
  }
} else warn('quiz', 'no quiz; the Check tab will only show the learn list');

/* ---------- simulator ---------- */
if (T.sim) {
  const D = T.sim, W = D.w || 820, H = D.h || 430;
  ['init', 'tick', 'view', 'metrics'].forEach(k => { if (!isFn(D[k])) err('sim', k + ' must be a function'); });
  if (errors.length === 0 || ['init', 'tick', 'view', 'metrics'].every(k => isFn(D[k]))) {
    const mkApi = () => {
      let t = 0; const pending = [];
      const api = {
        scene: { set() {}, packet() { return Promise.resolve(); }, say() {}, flash() {}, has: () => true, node: () => null, clearFx() {} },
        logs: [],
        log(m, tone) { api.logs.push(String(m)); },
        packet() { return Promise.resolve(); }, say() {}, flash() {}, refresh() {},
        now: () => t, after(sec, fn) { pending.push({ at: t + sec, fn }); },
        _advance(s, dt) { t += dt; const due = pending.filter(p => p.at <= t); due.forEach(p => { pending.splice(pending.indexOf(p), 1); p.fn(s, api); }); }
      };
      return api;
    };
    const runFor = (s, api, secs, where) => {
      for (let k = 0; k < secs * 10; k++) {
        api._advance(s, 0.1);
        D.tick(s, 0.1, api);
        if (k % 20 === 0) {
          const m = D.metrics(s);
          if (!Array.isArray(m) || m.some(r => !Array.isArray(r))) { err(where, 'metrics() must return [[label, value, tone]]'); return false; }
          if (m.some(r => /NaN|undefined/.test(String(r[1])))) { err(where, 'a metric shows NaN or undefined: ' + JSON.stringify(m)); return false; }
          checkSpec(D.view(s, api), where + ' view()', W, H);
        }
      }
      return true;
    };
    const fresh = where => { const s = D.init(); if (!s || typeof s !== 'object') err(where, 'init() must return an object'); return s; };
    const guard = (where, fn) => { try { fn(); } catch (e) { err(where, 'threw: ' + e.message); } };

    /* Effect test: run the same seeded simulation with and without a change and compare
       what the user would see (metrics, diagram, explain text, log). */
    const visible = (s, api) => JSON.stringify([D.metrics(s), D.view(s, api), D.explain ? D.explain(s) : '', api.logs]);
    const metricLine = s => D.metrics(s).map(m => m[0] + ' ' + m[1]).join(' · ');
    const play = (change, where) => {
      reseed(7);
      const s = fresh(where), api = mkApi();
      if (D.onStart) D.onStart(s, api);
      runFor(s, api, 2, where);
      if (change) change(s, api);
      runFor(s, api, 25, where);
      return { sig: visible(s, api), s };
    };
    let baseline = null;
    guard('sim start', () => {
      const s = fresh('sim'), api = mkApi();
      if (D.onStart) D.onStart(s, api);
      checkSpec(D.view(s, api), 'sim view() at start', W, H);
      runFor(s, api, 20, 'sim after 20 s');
      if (D.explain && typeof D.explain(s) !== 'string') err('sim', 'explain() must return a string');
      baseline = play(null, 'sim baseline');
      if (TRACE) trace.push('baseline after 27 s: ' + metricLine(baseline.s));
    });
    const effect = (label, runs) => {
      if (!baseline) return;
      cover.changes++;
      const results = runs.map(r => { const out = play(r.change, label); if (TRACE) trace.push(label + (r.label ? ' = ' + r.label : '') + ': ' + metricLine(out.s)); return out.sig; });
      if (results.every(x => x === baseline.sig)) warn(label, 'changes nothing the user can see within 25 s (metrics, diagram, explain text and log are identical to doing nothing)');
      else cover.visible++;
    };
    (D.controls || []).forEach((c, i) => {
      const where = 'control ' + (c.label || c.id || i);
      if (c.type === 'heading') return;
      if (c.type === 'actions') {
        (c.items || []).forEach(a => guard(where + ' → ' + a.label, () => effect('action "' + a.label + '"', [{ change: (s2, api2) => a.run(s2, api2) }])));
        return;
      }
      if (!['range', 'toggle', 'select'].includes(c.type)) { err(where, 'unknown type "' + c.type + '"'); return; }
      if (!c.id) err(where, 'needs an id');
      if (!isFn(c.get) || !isFn(c.set)) { err(where, 'needs get and set functions'); return; }
      guard(where, () => {
        const s = fresh(where);
        const vals = c.type === 'range' ? [c.min, c.max] : c.type === 'toggle' ? [true, false] : (c.options || []).map(o => o[0]);
        if (c.type === 'range' && !(c.min < c.max)) err(where, 'min must be below max');
        if (c.type === 'select' && !vals.length) err(where, 'select needs options [[value, label]]');
        if (c.get(s) === undefined) err(where, 'get() returns undefined at start');
        effect(where, vals.map(v => ({ label: String(v), change: (s2, api2) => c.set(s2, v, api2) })));
      });
    });
    (D.scenarios || []).forEach(sc => guard('scenario "' + sc.title + '"', () => {
      if (!isStr(sc.title) || !isFn(sc.run)) { err('scenario', 'needs title and run'); return; }
      effect('scenario "' + sc.title + '"', [{ change: (s2, api2) => sc.run(s2, api2) }]);
    }));
    if (D.scenarios && D.scenarios.length < 3) warn('sim', 'only ' + D.scenarios.length + ' scenarios; aim for 3–5');
    if (D.cli) {
      if (!isFn(D.cli.run)) err('cli', 'run must be a function');
      else {
        const s = fresh('cli'), api = mkApi();
        (D.cli.cookbook || []).forEach(cmd => guard('cli "' + cmd + '"', () => {
          const res = D.cli.run(L.parseCmd(cmd, D.cli.boolFlags), s, api);
          if (res == null) err('cli "' + cmd + '"', 'returns null (not supported) but is in the cookbook');
          cover.commands++;
          runFor(s, api, 1, 'cli "' + cmd + '"');
        }));
        if (!D.cli.cookbook || !D.cli.cookbook.length) warn('cli', 'add a cookbook of commands that work');
      }
    }
  }
}

/* ---------- report ---------- */
const size = (T.tour ? 'tour ' + (T.tour.steps || []).length + ' steps' : 'no tour') + ' · ' + (T.sim ? 'simulator' : 'no simulator') + ' · ' + (T.quiz ? T.quiz.length + ' questions' : 'no quiz') + ' · ' + ((T.sources || []).length) + ' sources';
console.log(T.name + ' (' + size + ')');
const fmt = i => i.text + (i.n > 1 ? '  (×' + i.n + ')' : '');
console.log('  checked ' + cover.diagrams + ' diagram states (ids, links, label fit, overlaps), ' + cover.flows + ' flow actions' + (T.sim ? ', ' + cover.changes + ' controls/actions/scenarios (' + cover.visible + ' with a visible effect), ' + cover.commands + ' terminal commands' : '') + ', quiz answers and source links');
trace.forEach(t => console.log('  · ' + t));
errors.forEach(e => console.log('  ✖ ' + fmt(e)));
warns.forEach(w => console.log('  ⚠ ' + fmt(w)));
console.log(errors.length ? '✖ ' + errors.length + ' error(s), ' + warns.length + ' warning(s). Fix the errors before building.' : '✔ no errors' + (warns.length ? ', ' + warns.length + ' warning(s)' : ''));
process.exit(errors.length ? 1 : 0);
