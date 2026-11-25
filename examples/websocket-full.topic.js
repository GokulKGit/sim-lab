(function () {
  'use strict';
  const L = window.SimLab;

  /* ---------- Tour diagram ---------- */
  const LINKS = [
    { a: 'client', b: 'proxy', label: 'TCP' },
    { a: 'proxy', b: 'server', label: 'TCP' }
  ];
  const base = {
    groups: [],
    nodes: [
      { id: 'client', kind: 'actor', x: 90, y: 215, label: 'Browser', sub: 'new WebSocket', w: 150 },
      { id: 'proxy', kind: 'svc', x: 340, y: 215, label: 'Reverse proxy', sub: 'nginx: idle 60 s', abbr: 'PX' },
      { id: 'server', kind: 'svc', x: 610, y: 215, label: 'App server', sub: 'WebSocket endpoint', abbr: 'WS' },
      { id: 'conn', kind: 'unit', x: 340, y: 340, label: 'socket', sub: 'CLOSED', state: 'cold' }
    ],
    links: LINKS
  };
  const sock = (state, sub, more) => L.spec(base, Object.assign({ conn: { state, sub } }, more || {}));
  const noSock = L.spec(base, { conn: null });
  const SOCK_CONNECTING = sock('start', 'CONNECTING');
  const SOCK_OPEN = sock('ready', 'OPEN');
  const cut = (spec) => Object.assign({}, spec, {
    links: [{ a: 'client', b: 'proxy', label: 'cable cut', dash: true, tone: 'bad' }, { a: 'proxy', b: 'server', label: 'TCP' }]
  });

  /* Reconnect step: six browser tabs instead of one browser */
  const TABS = ['t1', 't2', 't3', 't4', 't5', 't6'];
  const tabsSpec = (state, serverState) => {
    const nodes = TABS.map((id, i) => ({ id, kind: 'unit', x: 90, y: 60 + i * 62, label: 'tab ' + (i + 1), sub: state === 'ready' ? 'OPEN' : state === 'down' ? 'CLOSED' : 'retry', state }));
    return L.spec(base, { client: null, conn: null, server: { state: serverState } }, {
      nodes,
      links: TABS.map(id => ({ a: id, b: 'proxy' }))
    });
  };

  /* ---------- Simulator model ---------- */
  const mkConn = (i) => ({ id: 'c' + (i + 1), n: i + 1, state: 'start', t: 0, idle: 0, hbIn: 0, retryIn: 0, tries: 0, code: '', busy: 0 });
  const resize = (s) => {
    while (s.conns.length < s.clients) s.conns.push(mkConn(s.conns.length));
    s.conns.length = s.clients;
  };
  const retryDelay = (s, c) => {
    if (s.reconnect === 'none') return Infinity;
    if (s.reconnect === 'now') return 0.2;
    return Math.random() * Math.min(30, 5 * Math.pow(2, c.tries)); // first try: random 0-5 s, then doubles (cap 30 s)
  };
  const goDown = (s, c, code) => {
    c.state = 'down'; c.code = code; c.idle = 0; c.busy = 0;
    c.retryIn = retryDelay(s, c); c.tries++;
  };
  const startHandshake = (s, c, now) => {
    c.state = 'start'; c.t = 0; c.code = '';
    s.hs.push(now);
  };
  const serverDown = (s, now) => now < s.serverUpAt;
  const netDown = (s, now) => now < s.netUpAt;

  const restartServer = (s, api) => {
    const now = api.now();
    let n = 0;
    s.conns.forEach(c => {
      if (c.state === 'open') {
        if (n < 3) api.packet('server', c.id, 'bad');
        goDown(s, c, '1001'); n++;
      } else if (c.state === 'start') goDown(s, c, '1006');
    });
    s.serverUpAt = now + 4; s.peakHs = 0; s.hs = []; s._down = true;
    api.log('Server restarting: sent Close <code>1001</code> (Going Away) to ' + n + ' connections. Back in 4 s.', 'bad');
    api.flash('server');
  };
  const dropNetwork = (s, api) => {
    s.netUpAt = api.now() + 8; s._net = true;
    api.log('Network dropped for 8 s. No Close frame is sent, so nobody is told.', 'bad');
    api.flash('proxy');
  };
  const closeAll = (s, api) => {
    let n = 0;
    s.conns.forEach(c => {
      if (c.state === 'open' || c.state === 'start') {
        if (n < 3) api.packet(c.id, 'server', 'req');
        c.state = 'closed'; c.code = '1000'; n++;
      }
    });
    api.log(n + ' clients sent Close <code>1000</code>; the server echoed Close and the TCP connections ended cleanly. No reconnects.', 'ok');
  };
  const openAll = (s, api) => {
    const now = api.now();
    s.conns.forEach(c => { if (c.state === 'closed' || c.state === 'down') { c.tries = 0; startHandshake(s, c, now); } });
    api.log('All clients call <code>new WebSocket(url)</code> again.', '');
  };

  const fresh = (s, api) => {
    s.conns = []; resize(s);
    s.stats = { msgs: 0, reconnects: 0, lost: 0, idleKills: 0 };
    s.hs = []; s.msgT = []; s.peakHs = 0; s.serverUpAt = 0; s.netUpAt = 0; s._down = false; s._net = false;
    const now = api ? api.now() : 0;
    s.conns.forEach(c => s.hs.push(now));
  };

  /* Scenario helper: start with every connection already open (no startup handshakes counted). */
  const allOpen = (s, hb) => { s.conns.forEach(c => { c.state = 'open'; c.hbIn = hb(); }); s.hs = []; s.peakHs = 0; };
  const recent = (arr, now, win) => arr.filter(t => now - t <= win).length;

  /* ---------- Topic ---------- */
  L.topic({
    id: 'websocket-full',
    name: 'WebSocket',
    abbr: 'WS',
    color: 'var(--c-blue)',
    tagline: 'One HTTP request upgrades into a long-lived, two-way connection, so the server can push messages without being asked.',
    chips: [['RFC 6455', 'acc'], ['Full-duplex', 'ok'], ['Long-lived', 'evt'], ['Breaks behind proxies', 'warn']],

    overview: {
      what: 'WebSocket starts as an HTTP <code>GET</code> with <code>Upgrade: websocket</code>. If the server answers <code>101 Switching Protocols</code>, the same TCP connection stays open and both sides send small <b>frames</b> whenever they like.',
      analogy: 'HTTP is sending letters: each question gets one reply. WebSocket is a phone call: you dial once, then either side can talk at any time until someone hangs up.',
      signalsTitle: 'Clues you want WebSocket',
      signals: [
        'The server must tell the browser something without being asked (chat, notifications, live prices).',
        'Many small messages flow both ways (multiplayer games, shared cursors, collaborative editing).',
        'You are polling an endpoint every few seconds and most answers are "nothing new".'
      ],
      use: [
        'Low-latency, two-way messaging between a browser and your server.',
        'Server push where opening a new HTTP request per update is too slow or too costly.'
      ],
      avoid: [
        'Plain request/response (load a page, submit a form): ordinary HTTP is simpler and caches.',
        'When the browser must slow down a fast sender: the classic <code>WebSocket</code> API has no backpressure (MDN points to <code>WebSocketStream</code>).',
        'When you cannot configure the proxies and load balancers in the path: they must forward the upgrade and tolerate long-lived connections.'
      ],
      terms: [
        ['Upgrade', 'The HTTP/1.1 mechanism the handshake uses: <code>Upgrade: websocket</code> + <code>Connection: Upgrade</code>.'],
        ['Frame', 'The unit on the wire: an opcode, a length and a payload.'],
        ['Opcode', '<code>0x1</code> text, <code>0x2</code> binary, <code>0x8</code> Close, <code>0x9</code> Ping, <code>0xA</code> Pong.'],
        ['Ping / Pong', 'Control frames. A Ping must be answered with a Pong carrying the same payload.'],
        ['Close code', 'Two bytes in the Close frame, e.g. <code>1000</code> normal, <code>1001</code> going away.'],
        ['Masking', 'Every client-to-server frame is XOR-masked with a fresh key; server frames are not.']
      ],
      numbers: [
        ['Sec-WebSocket-Version', '13'],
        ['Success status', '101 Switching Protocols'],
        ['Control frame payload', '≤ 125 bytes'],
        ['nginx idle timeout (default)', '60 s'],
        ['Suggested first reconnect delay', 'random 0–5 s'],
        ['Normal close code', '1000']
      ],
      source: 'Protocol facts from RFC 6455; browser API from MDN; proxy timeout from the nginx docs. Other proxies and load balancers use different timeouts.'
    },

    tour: {
      w: 820, h: 430, trapLabel: 'Common mistake', spec: base,
      steps: [
        {
          title: 'Why WebSocket exists',
          kind: 'How it works',
          spec: noSock,
          body: '<p>With plain HTTP the browser asks and the server answers. Then the exchange is over.</p><p>When something new happens on the server, it has no way to tell the browser. The browser has to ask again (polling).</p>',
          flow: [
            ['client', 'proxy', 'req', 'GET /inbox'],
            ['proxy', 'server', 'req'],
            ['server', 'proxy', 'res'],
            ['proxy', 'client', 'res', '200 OK'],
            { wait: 700 },
            { say: 'server', text: 'new message! no way to send it', tone: 'warn' },
            { wait: 1400 }
          ]
        },
        {
          title: 'The opening handshake',
          kind: 'How it works',
          body: '<p>The browser sends an HTTP <code>GET</code> with <code>Upgrade: websocket</code>, <code>Connection: Upgrade</code>, a random <code>Sec-WebSocket-Key</code> and <code>Sec-WebSocket-Version: 13</code>.</p><p>The server agrees with <code>101 Switching Protocols</code> and a <code>Sec-WebSocket-Accept</code> header. From now on the connection speaks WebSocket, not HTTP.</p>',
          tip: '<code>Sec-WebSocket-Accept</code> is base64(SHA-1(key + a fixed GUID)). It proves the server really understood the WebSocket request.',
          metrics: [['readyState', 'CONNECTING', 'warn'], ['Status', 'waiting', '']],
          flow: [
            { set: SOCK_CONNECTING },
            { metrics: [['readyState', 'CONNECTING', 'warn'], ['Status', 'waiting', '']] },
            ['client', 'proxy', 'req', 'GET Upgrade'],
            ['proxy', 'server', 'req', 'Key, Version 13'],
            { say: 'server', text: 'compute Accept', tone: 'ok' },
            ['server', 'proxy', 'res', '101'],
            ['proxy', 'client', 'res', '101 Switching'],
            { set: SOCK_OPEN },
            { metrics: [['readyState', 'OPEN', 'ok'], ['Status', '101', 'ok']] },
            { say: 'client', text: 'onopen', tone: 'ok' },
            { wait: 1500 }
          ]
        },
        {
          title: 'Messages in both directions',
          kind: 'How it works',
          spec: SOCK_OPEN,
          body: '<p>The connection stays open. Either side sends a <b>frame</b> whenever it wants: <code>0x1</code> for text, <code>0x2</code> for binary.</p><p>The server can now push without a request. One connection carries thousands of messages, with no new handshake each time.</p>',
          tip: 'Frames from the client are always masked; frames from the server never are. Masking stops a web page from crafting bytes that a proxy might mistake for an HTTP request and cache.',
          flow: [
            { all: [['client', 'proxy', 'req'], ['server', 'proxy', 'evt']] },
            { all: [['proxy', 'server', 'req', 'text 0x1'], ['proxy', 'client', 'evt', 'push']] },
            { wait: 300 },
            ['server', 'proxy', 'evt'],
            ['proxy', 'client', 'evt', 'push'],
            { say: 'client', text: 'onmessage', tone: 'ok' },
            { wait: 900 }
          ]
        },
        {
          title: 'Keep-alive with Ping and Pong',
          kind: 'How it works',
          spec: SOCK_OPEN,
          body: '<p>When nothing is happening, a quiet connection looks dead to proxies and load balancers in between.</p><p>So one side sends a <code>Ping</code> frame (<code>0x9</code>) every so often. The other side must answer with a <code>Pong</code> (<code>0xA</code>) carrying the same payload. The traffic resets idle timers and proves the peer is still there.</p>',
          tip: 'Ping and Pong are control frames: at most 125 bytes of payload, never split into fragments.',
          metrics: [['Proxy idle timer', '40 s', 'warn']],
          flow: [
            { metrics: [['Proxy idle timer', '40 s', 'warn']] },
            { wait: 700 },
            ['server', 'proxy', 'evt', 'Ping 0x9'],
            { metrics: [['Proxy idle timer', '0 s', 'ok']] },
            ['proxy', 'client', 'evt'],
            ['client', 'proxy', 'res', 'Pong 0xA'],
            ['proxy', 'server', 'res'],
            { say: 'server', text: 'peer alive', tone: 'ok' },
            { wait: 1200 }
          ]
        },
        {
          title: 'The proxy closes a quiet connection',
          kind: 'Common mistake',
          spec: SOCK_OPEN,
          body: '<p>nginx closes a proxied WebSocket if the server sends <b>no data for 60 seconds</b> (its default <code>proxy_read_timeout</code>).</p><p>A quiet chat room with no pings hits this. The browser gets <code>onclose</code> with code <code>1006</code>: closed without a Close frame.</p>',
          trap: 'In nginx only data from the server resets this timer. Fix it with server-side Pings, or raise <code>proxy_read_timeout</code>. Other load balancers have their own idle timeouts.',
          metrics: [['Server silent for', '0 s', 'ok']],
          flow: [
            { set: SOCK_OPEN },
            { metrics: [['Server silent for', '0 s', 'ok']] },
            { wait: 700 },
            { metrics: [['Server silent for', '30 s', 'warn']] },
            { wait: 700 },
            { metrics: [['Server silent for', '60 s', 'bad']] },
            { flash: 'proxy' },
            { say: 'proxy', text: 'timeout: close', tone: 'bad' },
            { set: sock('down', 'CLOSED', { proxy: { state: 'down' } }) },
            { all: [['proxy', 'client', 'bad'], ['proxy', 'server', 'bad']] },
            { say: 'client', text: 'onclose 1006', tone: 'bad' },
            { wait: 1600 }
          ]
        },
        {
          title: 'The proxy drops the Upgrade header',
          kind: 'Common mistake',
          spec: SOCK_CONNECTING,
          body: '<p><code>Upgrade</code> and <code>Connection</code> are hop-by-hop headers. nginx does not pass them to the backend unless you set them explicitly.</p><p>The server then sees an ordinary <code>GET</code> and never answers <code>101</code>. Any other status means the handshake failed.</p>',
          trap: 'In nginx add <code>proxy_set_header Upgrade $http_upgrade;</code> and <code>proxy_set_header Connection "upgrade";</code> (plus <code>proxy_http_version 1.1</code> on versions before 1.29.7).',
          flow: [
            { set: SOCK_CONNECTING },
            ['client', 'proxy', 'req', 'GET Upgrade'],
            { say: 'proxy', text: 'Upgrade dropped', tone: 'warn' },
            ['proxy', 'server', 'req', 'plain GET'],
            ['server', 'proxy', 'bad', 'not 101'],
            ['proxy', 'client', 'bad', 'not 101'],
            { set: sock('down', 'CLOSED') },
            { say: 'client', text: 'onerror, onclose', tone: 'bad' },
            { wait: 1600 }
          ]
        },
        {
          title: 'Closing cleanly',
          kind: 'How it works',
          spec: SOCK_OPEN,
          body: '<p>Either side sends a <code>Close</code> frame (<code>0x8</code>) with a two-byte code, such as <code>1000</code> (normal) or <code>1001</code> (going away).</p><p>The other side answers with its own <code>Close</code>. After that nobody sends data, and the TCP connection is closed.</p>',
          flow: [
            { set: SOCK_OPEN },
            ['client', 'proxy', 'req', 'Close 1000'],
            ['proxy', 'server', 'req'],
            { set: sock('start', 'CLOSING') },
            ['server', 'proxy', 'res', 'Close 1000'],
            ['proxy', 'client', 'res'],
            { set: sock('cold', 'CLOSED 1000') },
            { say: 'client', text: 'clean close', tone: 'ok' },
            { wait: 1600 }
          ]
        },
        {
          title: 'The cable is pulled',
          kind: 'Failure',
          spec: cut(SOCK_OPEN),
          body: '<p>If the network just disappears, no <code>Close</code> frame is sent. Both sides still think the connection is <code>OPEN</code>.</p><p>They only find out when the next write fails or a <code>Ping</code> gets no <code>Pong</code>. The close code is then <code>1006</code>, which is never sent on the wire: it means "closed without a Close frame".</p>',
          tip: 'Without heartbeats, a dead connection can look open for a long time, and the server keeps sending into the void.',
          flow: [
            { set: cut(SOCK_OPEN) },
            { say: 'client', text: 'still OPEN?', tone: 'warn' },
            { wait: 900 },
            ['server', 'proxy', 'evt', 'Ping 0x9'],
            ['proxy', 'client', 'bad', 'lost'],
            { wait: 700 },
            { say: 'server', text: 'no Pong', tone: 'bad' },
            { set: cut(sock('down', 'CLOSED 1006')) },
            { say: 'client', text: 'onclose 1006', tone: 'bad' },
            { wait: 1600 }
          ]
        },
        {
          title: 'Reconnecting without a stampede',
          kind: 'Failure',
          spec: tabsSpec('ready', 'ready'),
          body: '<p>When a server restarts, every client loses its connection at the same moment. If they all reconnect instantly, the server gets a burst of handshakes the second it comes back.</p><p>RFC 6455 says clients <b>should</b> wait a random time first (0–5 s is suggested) and back off further after each failure.</p>',
          trap: 'Reconnecting in a tight loop with no delay. A restart turns into a flood of handshakes, which can knock the server over again.',
          metrics: [['Strategy', 'instant', 'bad']],
          flow: [
            { set: tabsSpec('ready', 'ready') },
            { metrics: [['Strategy', 'instant', 'bad']] },
            { say: 'server', text: 'restart: Close 1001', tone: 'bad' },
            { set: tabsSpec('down', 'down') },
            { wait: 600 },
            { set: tabsSpec('start', 'busy') },
            { all: TABS.map(id => [id, 'proxy', 'bad']) },
            { say: 'server', text: '6 handshakes at once', tone: 'bad' },
            { wait: 1000 },
            { metrics: [['Strategy', 'random delay + backoff', 'ok']] },
            { set: tabsSpec('down', 'ready') },
            { wait: 400 },
            ['t3', 'proxy', 'req'], { wait: 300 },
            ['t1', 'proxy', 'req'], { wait: 500 },
            ['t6', 'proxy', 'req'], { wait: 200 },
            ['t2', 'proxy', 'req'], { wait: 600 },
            ['t5', 'proxy', 'req'], { wait: 300 },
            ['t4', 'proxy', 'req'],
            { set: tabsSpec('ready', 'ready') },
            { say: 'server', text: 'load spread out', tone: 'ok' },
            { wait: 1400 }
          ]
        }
      ]
    },

    sim: {
      w: 820, h: 430,
      init: () => {
        const s = { clients: 8, heartbeat: 25, proxyIdle: 60, rate: 2, reconnect: 'backoff', upgradeOk: true };
        fresh(s);
        return s;
      },
      tick: (s, dt, api) => {
        const now = api.now();
        let budget = 3;
        const pkt = (a, b, tone) => { if (budget > 0) { api.packet(a, b, tone); budget--; } };
        const p = s.rate / 60 * dt;
        const srvDown = serverDown(s, now), net = netDown(s, now);
        s.now = now; s._down = srvDown; s._net = net;
        let opened = 0, failed = 0;

        s.conns.forEach(c => {
          c.busy = Math.max(0, c.busy - dt);
          if (c.state === 'start') {
            if (c.t === 0) pkt(c.id, 'proxy', 'req');
            c.t += dt;
            if (c.t < 0.3) return;
            if (net) { goDown(s, c, '1006'); failed++; return; }
            if (!s.upgradeOk) { pkt('proxy', c.id, 'bad'); goDown(s, c, 'no 101'); failed++; return; }
            if (srvDown) { goDown(s, c, '1006'); failed++; return; }
            c.state = 'open'; c.tries = 0; c.idle = 0; c.hbIn = s.heartbeat; opened++;
            pkt('server', c.id, 'res');
          } else if (c.state === 'open') {
            c.idle += dt;
            // server push
            if (Math.random() < p) {
              if (net) { s.stats.lost++; goDown(s, c, '1006'); api.log(c.id + ': server write failed (network gone) → close <code>1006</code>', 'bad'); return; }
              s.stats.msgs++; s.msgT.push(now); c.idle = 0; c.busy = 0.5; pkt('server', c.id, 'evt');
            }
            // client send: does NOT reset nginx's timer (it only counts data from the server)
            if (Math.random() < p) {
              if (net) { goDown(s, c, '1006'); api.log(c.id + ': client write failed (network gone) → close <code>1006</code>', 'bad'); return; }
              s.stats.msgs++; s.msgT.push(now); c.busy = 0.5; pkt(c.id, 'server', 'req');
            }
            if (s.heartbeat > 0) {
              c.hbIn -= dt;
              if (c.hbIn <= 0) {
                c.hbIn = s.heartbeat;
                if (net) { goDown(s, c, '1006'); api.log(c.id + ': Ping got no Pong → close <code>1006</code>', 'bad'); return; }
                c.idle = 0; pkt('server', c.id, 'evt');
              }
            }
            if (c.idle >= s.proxyIdle) {
              s.stats.idleKills++;
              goDown(s, c, '1006');
              api.log(c.id + ': proxy closed it after ' + s.proxyIdle + ' s with no data from the server → browser sees <code>1006</code>', 'bad');
              api.flash('proxy');
            }
          } else if (c.state === 'down') {
            if (Math.random() < p) s.stats.lost++; // server had a message for a disconnected client
            c.retryIn -= dt;
            if (c.retryIn <= 0) { s.stats.reconnects++; startHandshake(s, c, now); }
          }
        });

        if (opened) api.log(opened + ' handshake' + (opened > 1 ? 's' : '') + ' → <code>101 Switching Protocols</code>, OPEN', 'ok');
        if (failed && !s.upgradeOk) api.log(failed + ' handshake(s) failed: proxy did not forward <code>Upgrade</code>, server answered without <code>101</code>', 'bad');
        else if (failed && srvDown && now - (s.lastRefused || -9) >= 1) { s.lastRefused = now; api.log(failed + ' handshake(s) refused in this instant: server is restarting', 'warn'); }

        s.hs = s.hs.filter(t => now - t <= 5);
        s.msgT = s.msgT.filter(t => now - t <= 5);
        s.peakHs = Math.max(s.peakHs, recent(s.hs, now, 1));
      },
      view: (s) => {
        const burst = recent(s.hs, s.now || 0, 1);
        const srvState = s._down ? 'down' : null;
        const pos = L.layoutGrid(s.conns.length, { x: 40, y: 250, w: 740 }, 80, 44, 10);
        const nodes = [
          { id: 'client', kind: 'actor', x: 90, y: 100, label: 'Browsers', sub: s.clients + ' tabs', badge: String(s.clients) },
          { id: 'proxy', kind: 'svc', x: 380, y: 100, label: 'Reverse proxy', sub: 'idle timeout ' + s.proxyIdle + ' s', abbr: 'PX', state: s._net ? 'down' : undefined, hl: !s.upgradeOk },
          { id: 'server', kind: 'svc', x: 670, y: 100, label: 'App server', sub: s._down ? 'restarting' : (burst >= 8 ? 'handshake burst' : 'ping every ' + (s.heartbeat || 'off') + (s.heartbeat ? ' s' : '')), abbr: 'WS', state: srvState || (burst >= 8 ? 'busy' : 'ready') }
        ];
        s.conns.forEach((c, i) => {
          let state, sub;
          if (c.state === 'start') { state = 'start'; sub = 'handshake'; }
          else if (c.state === 'open') { state = c.busy > 0 ? 'busy' : (c.idle > 5 ? 'idle' : 'ready'); sub = 'quiet ' + Math.floor(c.idle) + 's'; }
          else if (c.state === 'down') { state = 'down'; sub = isFinite(c.retryIn) ? 'retry ' + Math.max(0, c.retryIn).toFixed(1) + 's' : 'CLOSED ' + c.code; }
          else { state = 'cold'; sub = 'CLOSED ' + c.code; }
          nodes.push({ id: c.id, kind: 'unit', x: pos[i].x, y: pos[i].y, label: 'conn ' + c.n, sub, state });
        });
        return {
          groups: [{ id: 'g', x: 30, y: 215, w: 760, h: 195, label: 'WebSocket connections (one per tab)' }],
          nodes,
          links: [
            { a: 'client', b: 'proxy', label: s._net ? 'network down' : 'wss://', dash: !!s._net, tone: s._net ? 'bad' : undefined },
            { a: 'proxy', b: 'server', label: s.upgradeOk ? 'Upgrade ok' : 'no Upgrade', tone: s.upgradeOk ? undefined : 'bad', dash: !s.upgradeOk }
          ]
        };
      },
      metrics: (s) => {
        const open = s.conns.filter(c => c.state === 'open').length;
        const n = s.conns.length;
        return [
          ['Open', open + '/' + n, open === n ? 'ok' : open === 0 ? 'bad' : 'warn'],
          ['Messages/s', (s.msgT.length / 5).toFixed(1), ''],
          ['Reconnect tries', String(s.stats.reconnects), s.stats.reconnects ? 'warn' : ''],
          ['Idle kills', String(s.stats.idleKills), s.stats.idleKills ? 'bad' : 'ok'],
          ['Messages lost', String(s.stats.lost), s.stats.lost ? 'bad' : 'ok'],
          ['Peak handshakes/s', String(s.peakHs), s.peakHs >= 8 ? 'bad' : '']
        ];
      },
      explain: (s) => {
        const open = s.conns.filter(c => c.state === 'open');
        const down = s.conns.filter(c => c.state === 'down');
        if (s._down) return 'The server is restarting. ' + (s.reconnect === 'now' ? 'Clients retry every 0.2 s, so each one hammers it with handshakes.' : 'Clients wait a random, growing delay before retrying.');
        if (!s.upgradeOk) return 'The proxy strips <code>Upgrade</code>/<code>Connection</code>, so the server never sends <code>101</code> and every handshake fails.';
        if (s._net) return open.length + ' connections still say <code>OPEN</code>, but the network is gone. Each finds out only on its next write or missed <code>Pong</code>.';
        if (s.heartbeat === 0 && open.length && s.rate < 60 / s.proxyIdle * 3) return 'No heartbeat and a quiet server: any connection with no server data for ' + s.proxyIdle + ' s will be cut by the proxy.';
        if (s.heartbeat >= s.proxyIdle) return 'The Ping interval (' + s.heartbeat + ' s) is not shorter than the proxy timeout (' + s.proxyIdle + ' s), so quiet connections still get cut.';
        if (down.length && s.reconnect === 'none') return down.length + ' connections are closed and the app never reconnects them.';
        if (down.length) return down.length + ' connections are waiting to reconnect (' + (s.reconnect === 'now' ? 'instantly' : 'random delay + backoff') + ').';
        return open.length + ' connections are open. Server Pings every ' + (s.heartbeat || '—') + ' s keep the proxy from timing them out.';
      },
      legend: [['req', 'client → server frame'], ['evt', 'server push / Ping'], ['res', '101 / reply'], ['bad', 'Close / failure']],
      controls: [
        { type: 'heading', label: 'Clients' },
        { type: 'range', id: 'clients', label: 'Browser tabs', min: 1, max: 16, step: 1, fmt: v => v + ' tabs', get: s => s.clients,
          set: (s, v, api) => { const before = s.conns.length; s.clients = v; resize(s); for (let i = before; i < s.conns.length; i++) s.hs.push(api.now()); api.log('Now ' + v + ' tabs, one WebSocket each.', ''); },
          help: 'Each tab holds one long-lived connection.' },
        { type: 'range', id: 'rate', label: 'Messages per minute (each side)', min: 0, max: 30, step: 1, fmt: v => v + '/min', get: s => s.rate,
          set: (s, v) => { s.rate = v; }, help: 'How chatty the app is. Only server messages reset nginx\'s idle timer.' },
        { type: 'select', id: 'reconnect', label: 'Reconnect strategy', options: [['backoff', 'Random delay + backoff'], ['now', 'Instantly (0.2 s)'], ['none', 'Never']], get: s => s.reconnect,
          set: (s, v, api) => { s.reconnect = v; api.log('Reconnect strategy: ' + v, ''); },
          help: 'Backoff: first wait random 0–5 s, then the range doubles per failure. The 30 s cap is this model\'s choice.' },
        { type: 'heading', label: 'Keep-alive and proxy' },
        { type: 'range', id: 'heartbeat', label: 'Server Ping interval', min: 0, max: 60, step: 5, fmt: v => v ? v + ' s' : 'off', get: s => s.heartbeat,
          set: (s, v) => { s.heartbeat = v; s.conns.forEach(c => { c.hbIn = Math.min(c.hbIn, v); }); },
          help: 'A Ping from the server counts as data, so it resets the proxy timer.' },
        { type: 'range', id: 'proxyIdle', label: 'Proxy idle timeout', min: 10, max: 120, step: 5, fmt: v => v + ' s', get: s => s.proxyIdle,
          set: (s, v) => { s.proxyIdle = v; }, help: 'nginx default: 60 s (proxy_read_timeout). Other load balancers differ.' },
        { type: 'toggle', id: 'upgradeOk', label: 'Proxy forwards Upgrade headers', get: s => s.upgradeOk,
          set: (s, v, api) => { s.upgradeOk = v; api.log(v ? 'Proxy now sets Upgrade and Connection headers.' : 'Proxy config lost the Upgrade/Connection headers. New handshakes will fail.', v ? 'ok' : 'bad'); },
          help: 'Without proxy_set_header Upgrade/Connection, nginx sends a plain GET.' },
        { type: 'actions', items: [
          { label: 'Restart server', tone: 'bad', run: (s, api) => restartServer(s, api) },
          { label: 'Pull the cable (8 s)', tone: 'bad', run: (s, api) => dropNetwork(s, api) },
          { label: 'Close all cleanly', run: (s, api) => closeAll(s, api) },
          { label: 'Open all again', run: (s, api) => openAll(s, api) }
        ] }
      ],
      scenarios: [
        { title: 'Quiet app, no heartbeat', desc: 'Pings off, few messages, proxy timeout shortened to 20 s (nginx default is 60 s) so you don\'t wait. Watch connections die and reconnect.',
          run: (s, api) => { s.heartbeat = 0; s.proxyIdle = 20; s.rate = 1; s.reconnect = 'backoff'; s.upgradeOk = true; fresh(s, api); api.log('Scenario: heartbeat off behind a 20 s proxy.', 'warn'); } },
        { title: 'Same app with 10 s Pings', desc: 'Server Pings every 10 s, under the 20 s proxy timeout. Idle kills stop.',
          run: (s, api) => { s.heartbeat = 10; s.proxyIdle = 20; s.rate = 1; s.reconnect = 'backoff'; s.upgradeOk = true; fresh(s, api); api.log('Scenario: Ping every 10 s behind a 20 s proxy.', 'ok'); } },
        { title: 'Restart + instant reconnect', desc: '16 tabs reconnect every 0.2 s while the server restarts. Watch peak handshakes/s.',
          run: (s, api) => { s.clients = 16; s.heartbeat = 25; s.proxyIdle = 60; s.rate = 2; s.reconnect = 'now'; s.upgradeOk = true; fresh(s, api); allOpen(s, () => 25); restartServer(s, api); } },
        { title: 'Restart + random delay and backoff', desc: 'The same restart, but each tab waits a random 0–5 s first. Handshakes spread out.',
          run: (s, api) => { s.clients = 16; s.heartbeat = 25; s.proxyIdle = 60; s.rate = 2; s.reconnect = 'backoff'; s.upgradeOk = true; fresh(s, api); allOpen(s, () => 25); restartServer(s, api); } },
        { title: 'Cable pulled', desc: 'The network vanishes for 8 s. Connections still say OPEN until a Ping or a write fails. Compare with "Close all cleanly".',
          run: (s, api) => { s.heartbeat = 5; s.proxyIdle = 60; s.rate = 4; s.reconnect = 'backoff'; s.upgradeOk = true; fresh(s, api); allOpen(s, () => 2 + Math.random() * 5); dropNetwork(s, api); } }
      ],
      onStart: (s, api) => { api.log('8 tabs open WebSockets through the proxy. Try the scenarios, or pull the cable.', ''); }
    },

    quiz: [
      { q: 'A notification service runs behind nginx with default settings. Browsers send a heartbeat message every 20 s, but connections still drop after about 60 s when no notifications arrive. What fixes it?',
        o: ['Send the client heartbeat more often', 'Have the server send Ping frames (or raise proxy_read_timeout)', 'Switch from text to binary frames', 'Raise the maximum frame size'],
        a: 1, y: 'nginx closes the connection if the <b>proxied server</b> sends nothing for 60 s. Client traffic does not reset that timer; server Pings do.' },
      { q: 'Right after you put nginx in front of your app, every WebSocket fails. The server logs show an ordinary GET with no Upgrade header. What is wrong?',
        o: ['The client forgot Sec-WebSocket-Version', 'The server must reply 200 instead of 101', 'The client frames are not masked', 'nginx is not forwarding the hop-by-hop Upgrade and Connection headers'],
        a: 3, y: 'Upgrade and Connection are hop-by-hop. nginx only passes them on if you set them with <code>proxy_set_header</code>.' },
      { q: 'After a deploy, 50,000 clients reconnect in the same second and the server falls over again. What does RFC 6455 recommend?',
        o: ['Wait a random time before the first retry (0–5 s suggested), then back off further', 'Retry immediately so clients miss as little as possible', 'Keep the old connection object and keep sending until it works', 'Send Close 1000 before reconnecting'],
        a: 0, y: 'The spec says clients SHOULD delay the first reconnect by a random amount and use backoff (for example truncated binary exponential) after that.' },
      { q: 'Your onclose handler logs code 1006. What happened?',
        o: ['The server sent a Close frame with code 1006', 'The page navigated away normally', 'The connection ended without any Close frame, e.g. the network or a proxy cut it', 'The message was too big'],
        a: 2, y: '1006 is never sent on the wire. It is reported locally when the connection closed without a Close frame.' },
      { q: 'Your hand-written test client connects fine, but the server closes the connection with 1002 as soon as the client sends its first message. Most likely cause?',
        o: ['The server should mask its frames', 'The client is not masking its frames', 'The client sent a Ping', 'The handshake used Version 13'],
        a: 1, y: 'Clients MUST mask every frame. A server that receives an unmasked frame must close the connection and may use 1002 (protocol error).' },
      { q: 'A server answers the upgrade request with 200 OK and all the right WebSocket headers. Is the connection open?',
        o: ['Yes, any 2xx status works', 'Yes, if Sec-WebSocket-Accept is correct', 'Only if the client sends a Ping first', 'No, only 101 Switching Protocols completes the handshake'],
        a: 3, y: 'Any status other than 101 means the WebSocket handshake has not completed.' },
      { q: 'A laptop loses Wi-Fi for 30 s. The app is quiet and has no heartbeat. Why does the server still list the connection as OPEN?',
        o: ['No Close frame was sent and nothing tried to write, so nothing has failed yet', 'The browser sent Close 1001 and the server ignored it', 'The proxy keeps the connection alive for the client', 'WebSocket connections cannot break once open'],
        a: 0, y: 'A dead link is only noticed when a write fails or a Ping gets no Pong. Heartbeats exist to find these quickly.' }
    ],

    learn: [
      'Can you name the headers in the opening handshake and the status that confirms it?',
      'Can you explain why a quiet connection behind a proxy dies, and two ways to fix it?',
      'Can you explain the difference between close code 1000 and 1006?',
      'Can you explain why clients should wait a random time before reconnecting?'
    ],

    related: [
      { name: 'HTTP/1.1', abbr: 'HTTP', how: 'The handshake is an HTTP GET with an Upgrade header.', color: 'var(--c-blue)' },
      { name: 'TCP', abbr: 'TCP', how: 'Every frame travels on the one long-lived TCP connection.', color: 'var(--c-blue)' },
      { name: 'TLS', abbr: 'TLS', how: '<code>wss://</code> runs WebSocket over TLS.', color: 'var(--c-blue)' }
    ],

    sources: [
      { title: 'RFC 6455: The WebSocket Protocol', url: 'https://www.rfc-editor.org/rfc/rfc6455', note: 'Handshake, frames, opcodes, masking, Ping/Pong, close codes, reconnect backoff (§7.2.3)' },
      { title: 'MDN: WebSocket API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket', note: 'Browser API: events, send(), close(), bufferedAmount; no backpressure' },
      { title: 'nginx: WebSocket proxying', url: 'https://nginx.org/en/docs/http/websocket.html', note: 'Upgrade/Connection headers, 60 s default idle close, Pings to keep alive' }
    ],

    simplified: 'One frame per message, no TCP or TLS details; a dead network is noticed on the next write or Ping instead of after TCP timeouts; scenarios shorten the 60 s nginx timeout so you don\'t wait.'
  });
})();
