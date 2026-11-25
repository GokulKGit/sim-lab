/* Test fixture: the smallest "quick" topic (Overview, Tour, Check; no simulator). */
(function () {
  'use strict';
  const L = window.SimLab;
  const nodes = [
    { id: 'you', kind: 'actor', x: 90, y: 215, label: 'Browser', sub: 'example.com?' },
    { id: 'res', kind: 'svc', x: 330, y: 215, label: 'Resolver', sub: 'your ISP or 8.8.8.8', abbr: 'DNS', color: 'var(--c-blue)' },
    { id: 'root', kind: 'store', x: 640, y: 90, label: 'Root server', sub: 'knows .com servers', abbr: '.', color: 'var(--c-gray)' },
    { id: 'tld', kind: 'store', x: 640, y: 215, label: '.com server', sub: 'points to ns1', abbr: 'TLD', color: 'var(--c-purple)' },
    { id: 'auth', kind: 'store', x: 640, y: 340, label: 'Authoritative', sub: 'has the A record', abbr: 'NS', color: 'var(--c-green)' }
  ];
  const links = [{ a: 'you', b: 'res' }, { a: 'res', b: 'root', dash: true }, { a: 'res', b: 'tld', dash: true }, { a: 'res', b: 'auth', dash: true }];

  L.topic({
    id: 'mini-dns', name: 'DNS lookup', abbr: 'DNS', color: 'var(--c-blue)',
    tagline: 'How a name like <code>example.com</code> becomes an IP address.',
    chips: [['Networking', 'acc'], ['Test fixture']],
    overview: {
      what: 'DNS turns names into IP addresses. A <b>resolver</b> asks a chain of servers on your behalf and caches the answer.',
      analogy: 'Asking a librarian, who checks the index, then the right shelf, then the right book.',
      use: ['Every time a browser opens a site by name'],
      terms: [['Resolver', 'Does the lookups for you and caches results.'], ['TTL', 'How long an answer may be cached, in seconds.']]
    },
    tour: {
      w: 820, h: 430,
      steps: [
        { title: 'The browser asks a resolver', kind: 'How it works', body: '<p>The browser only asks one question: "what is the IP of example.com?"</p>',
          spec: { nodes, links }, flow: [['you', 'res', 'req', 'example.com?'], { wait: 700 }] },
        { title: 'The resolver walks the chain', kind: 'How it works', body: '<p>Root → .com → the domain\'s own name server. Each one points to the next.</p>',
          spec: { nodes, links }, flow: [['res', 'root'], ['root', 'res', 'res', 'ask .com'], ['res', 'tld'], ['tld', 'res', 'res', 'ask ns1'], ['res', 'auth'], ['auth', 'res', 'res', '93.184.215.14']] },
        { title: 'The answer is cached', kind: 'How it works', body: '<p>The resolver returns the IP and keeps it for the record\'s <b>TTL</b>.</p>', trap: 'Changing a DNS record is not instant: old answers live until their TTL runs out.',
          spec: L.spec({ nodes, links }, { res: { badge: 'TTL' } }), flow: [['res', 'you', 'res', '93.184.215.14'], { wait: 500 }, { set: L.spec({ nodes, links }, { root: { dim: true }, tld: { dim: true }, auth: { dim: true } }) }, ['you', 'res', 'req', 'again?'], ['res', 'you', 'res', 'cached'], { wait: 600 }] }
      ]
    },
    quiz: [
      { q: 'Who does the step-by-step lookup?', o: ['The browser', 'The resolver', 'The root server', 'The website'], a: 1, y: 'The resolver asks root, TLD and authoritative servers for you.' },
      { q: 'Why can a DNS change take time to show up?', o: ['Root servers are slow', 'Cached answers live until their TTL ends', 'Browsers ignore DNS', 'IP addresses expire'], a: 1, y: 'Resolvers cache answers for the TTL.' }
    ],
    learn: ['Explain what a resolver does', 'Explain why TTL matters when you change a record'],
    sources: [{ title: 'RFC 1034: Domain names, concepts and facilities', url: 'https://www.rfc-editor.org/rfc/rfc1034' }, { title: 'RFC 1035: Domain names, implementation and specification', url: 'https://www.rfc-editor.org/rfc/rfc1035' }]
  });
})();
