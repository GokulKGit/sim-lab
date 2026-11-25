/* sim-lab: page shell for one topic. Header, theme toggle, tabs, sources footer. Runs last. */
(function () {
  'use strict';
  const L = window.SimLab, h = L.h;
  const app = document.getElementById('app');
  const t = L.current;
  if (!t) { app.textContent = 'No topic loaded. The topic file must call SimLab.topic({...}).'; return; }

  /* Theme: auto (follows the system) -> light -> dark. Remembered per browser. */
  const root = document.documentElement;
  const themeBtn = document.getElementById('theme');
  const THEMES = ['auto', 'light', 'dark'];
  let theme = 'auto';
  try { theme = localStorage.getItem('simlab_theme') || 'auto'; } catch (e) { /* ignore */ }
  function applyTheme() {
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    themeBtn.textContent = { auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' }[theme];
    themeBtn.setAttribute('aria-label', 'Colour theme: ' + theme + '. Click to change.');
  }
  themeBtn.addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    try { localStorage.setItem('simlab_theme', theme); } catch (e) { /* ignore */ }
    applyTheme();
  });
  applyTheme();

  document.title = t.name + ' · how it works';
  document.getElementById('brand-name').textContent = t.name;
  const topProg = document.getElementById('top-prog');

  const tabs = L.tabsOf(t);
  let cur = L.store.get('tab', tabs[0].id);
  if (!tabs.some(x => x.id === cur)) cur = tabs[0].id;
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', { role: 'tabpanel' });
  let viewCleanup = null;
  const ctx = { switchTab };

  function drawProgress() {
    const p = L.prog(t.id);
    const done = tabs.filter(x => p[x.id]).length;
    topProg.textContent = '';
    topProg.append(h('span', null, done + ' of ' + tabs.length + ' done'), h('span', { class: 'bar' }, h('i', { style: { width: (100 * done / tabs.length) + '%' } })));
  }
  function drawTabs() {
    tabBar.textContent = '';
    const p = L.prog(t.id);
    tabs.forEach(x => tabBar.append(h('button', { role: 'tab', 'aria-selected': x.id === cur ? 'true' : 'false', onclick: () => switchTab(x.id) }, h('span', { class: 'ok' + (p[x.id] ? ' d' : '') }), x.label)));
  }
  function switchTab(id) {
    cur = id;
    L.store.set('tab', id);
    if (viewCleanup) { viewCleanup(); viewCleanup = null; }
    body.textContent = '';
    const tab = tabs.find(x => x.id === id);
    const fn = tab.render || L.views[id];
    viewCleanup = fn(body, t, ctx) || null;
    drawTabs();
    window.scrollTo({ top: 0 });
  }
  document.addEventListener('simlab:progress', () => { drawTabs(); drawProgress(); });

  const sources = t.sources || [];
  const foot = h('footer', { class: 'foot' },
    sources.length > 0 && h('div', { class: 'sources' }, h('span', { class: 'lbl' }, 'Sources'),
      h('ol', null, sources.map(s => h('li', null, h('a', { href: s.url || s[1], target: '_blank', rel: 'noopener' }, s.title || s[0]), (s.note || s[2]) && h('span', null, ' · ' + (s.note || s[2])))))),
    h('div', { class: 'foot-row' },
      h('span', null, t.simplified || 'A teaching model, simplified on purpose: timing, scale and numbers are approximate. Check the sources for exact behaviour.'),
      h('span', null, 'Made with sim-lab · progress is saved in this browser only.')));

  app.append(
    h('div', { class: 'svc-head' },
      h('span', { class: 'hex lg', style: { '--c': t.color || 'var(--accent)' } }, (t.abbr || t.name).slice(0, 4)),
      h('div', { class: 't' }, h('h1', null, t.name), t.tagline && h('p', { html: t.tagline }),
        t.chips && h('div', { class: 'chips' }, t.chips.map(c => h('span', { class: 'chip ' + (c[1] || '') }, c[0]))))),
    tabBar, body, foot);
  switchTab(cur);
  drawProgress();
})();
