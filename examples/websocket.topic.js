/* WebSocket: quick size (Overview, Tour, Check). Facts: websocket.facts.md */
(function () {
  'use strict';
  const L = window.SimLab;

  const nodes = [
    { id: 'browser', kind: 'actor', x: 110, y: 215, label: 'Browser', sub: 'your web app' },
    { id: 'proxy', kind: 'svc', x: 370, y: 215, label: 'Proxy', sub: 'nginx / LB', abbr: 'LB', color: 'var(--c-orange)' },
    { id: 'server', kind: 'svc', x: 650, y: 215, label: 'Server', sub: 'WebSocket app', abbr: 'WS', color: 'var(--c-green)' }
  ];
  const http = { nodes, links: [{ a: 'browser', b: 'proxy', label: 'HTTP' }, { a: 'proxy', b: 'server', label: 'HTTP' }] };
  const open = { nodes, links: [{ a: 'browser', b: 'proxy', label: 'WebSocket', tone: 'acc' }, { a: 'proxy', b: 'server', label: 'WebSocket', tone: 'acc' }] };
  const broken = L.spec({ nodes, links: [{ a: 'browser', b: 'proxy', label: 'closed', tone: 'bad', dash: true }, { a: 'proxy', b: 'server', label: 'closed', tone: 'bad', dash: true }] }, { proxy: { state: 'down' } });
  const closed = { nodes, links: [{ a: 'browser', b: 'proxy', dash: true }, { a: 'proxy', b: 'server', dash: true }] };

  /* Step 7: six clients and a server that restarts */
  const ys = [60, 122, 184, 246, 308, 370];
  const clients = ys.map((y, i) => ({ id: 'c' + (i + 1), kind: 'unit', x: 110, y, label: 'tab ' + (i + 1), state: 'ready' }));
  const crowd = st => ({ nodes: clients.map(c => Object.assign({}, c, { state: st })).concat([nodes[1], Object.assign({}, nodes[2], { state: st === 'down' ? 'down' : 'ready' })]) });
  const all = (from, to, tone) => ({ all: clients.map(c => from === 'c' ? [c.id, to, tone] : [from, c.id, tone]) });

  L.topic({
    id: 'websocket', name: 'WebSocket', abbr: 'WS', color: 'var(--c-blue)',
    tagline: 'One connection that stays open, so the server and the browser can both send messages at any time.',
    chips: [['Networking', 'acc'], ['RFC 6455'], ['Quick size']],

    overview: {
      what: 'WebSocket starts as a normal HTTP request, then <b>upgrades</b> it into a two-way connection that stays open. After that, either side can send a message whenever it wants.',
      analogy: 'HTTP is sending letters: you write, then wait for a reply. WebSocket is a phone call: once connected, both people can talk at any time.',
      signals: ['The <b>server must push</b> updates without being asked (chat, live scores, notifications)', 'Many small messages, <b>both ways</b>, with low delay', 'Multiplayer games, collaborative editing, live dashboards'],
      use: ['Chat and notifications', 'Live dashboards, prices and scores', 'Multiplayer and collaborative apps'],
      avoid: ['Data only changes now and then: plain HTTP requests are simpler to cache, scale and debug', 'The browser must slow down a very fast sender: the browser WebSocket API has <b>no backpressure</b> [MDN]'],
      terms: [
        ['Handshake', 'The first HTTP request with <code>Upgrade: websocket</code>, answered by <code>101 Switching Protocols</code>.'],
        ['Frame', 'One piece of data on the open connection. Its <b>opcode</b> says what it is.'],
        ['Opcode', '<code>0x1</code> text, <code>0x2</code> binary, <code>0x8</code> close, <code>0x9</code> ping, <code>0xA</code> pong.'],
        ['Ping / Pong', 'A small check that the other side is still there. A Ping gets a Pong back.'],
        ['Close code', 'Why it closed: <code>1000</code> normal, <code>1001</code> going away. <code>1006</code> means it closed with no Close frame at all.'],
        ['ws:// and wss://', 'Plain WebSocket on port 80, and WebSocket over TLS on port 443.']
      ],
      numbers: [
        ['<code>Sec-WebSocket-Version</code>', '13'],
        ['Default ports', 'ws:// 80 · wss:// 443'],
        ['nginx idle limit (default)', '60 s with no data from the server'],
        ['Close codes you will meet', '1000 · 1001 · 1006']
      ],
      source: 'Facts from RFC 6455, the nginx WebSocket proxying guide and MDN. Proxy timeouts differ by product.'
    },

    tour: {
      w: 820, h: 430,
      steps: [
        {
          title: 'Plain HTTP: the server can only answer', kind: 'Why it exists',
          body: '<p>With plain HTTP the browser asks and the server answers. Then the exchange is over.</p><p>If something new happens on the server, it has no way to tell the browser. The browser has to keep asking.</p>',
          spec: http,
          flow: [['browser', 'proxy'], ['proxy', 'server', 'req', 'any news?'], ['server', 'proxy', 'res'], ['proxy', 'browser', 'res', 'nothing yet'], { wait: 500 }, { say: 'server', text: 'new message!', tone: 'warn' }, { wait: 900 }, { say: 'server', text: 'but I cannot speak first', tone: 'bad' }, { wait: 900 }]
        },
        {
          title: 'The handshake: asking to upgrade', kind: 'How it works',
          body: '<p>The browser sends a normal HTTP request with extra headers:</p><p><code>GET /chat HTTP/1.1</code><br><code>Upgrade: websocket</code><br><code>Connection: Upgrade</code><br><code>Sec-WebSocket-Key: …</code><br><code>Sec-WebSocket-Version: 13</code></p><p>The server agrees with <code>101 Switching Protocols</code>. From now on, this connection speaks WebSocket.</p>',
          tip: 'The server proves it understood by sending <code>Sec-WebSocket-Accept</code>: the key plus a fixed GUID, hashed with SHA-1 and base64-encoded.',
          spec: http,
          flow: [['browser', 'proxy', 'req', 'Upgrade: websocket'], ['proxy', 'server', 'req'], ['server', 'proxy', 'res', '101'], ['proxy', 'browser', 'res', '101 Switching Protocols'], { wait: 300 }, { set: open }, { say: 'browser', text: 'connection open', tone: 'ok' }, { wait: 1200 }]
        },
        {
          title: 'Messages both ways, any time', kind: 'How it works',
          body: '<p>Data now travels as <b>frames</b>. A text frame has opcode <code>0x1</code>, a binary frame <code>0x2</code>.</p><p>The server can push without being asked, and the browser can send while the server is pushing.</p>',
          tip: 'Frames from the browser to the server are <b>masked</b>; frames from the server are not.',
          spec: open,
          flow: [['server', 'proxy', 'evt'], ['proxy', 'browser', 'evt', 'new message'], { all: [['browser', 'proxy', 'req'], ['server', 'proxy', 'evt']] }, { all: [['proxy', 'server', 'req', 'typing…'], ['proxy', 'browser', 'evt', 'score 2-1']] }, { wait: 500 }]
        },
        {
          title: 'Ping and Pong: are you still there?', kind: 'How it works',
          body: '<p>Either side can send a <b>Ping</b> frame (<code>0x9</code>). The other side answers with a <b>Pong</b> (<code>0xA</code>) as soon as it can.</p><p>This keeps a quiet connection alive and shows that the other side is still there.</p>',
          spec: open,
          flow: [['server', 'proxy', 'warn'], ['proxy', 'browser', 'warn', 'Ping'], ['browser', 'proxy', 'res'], ['proxy', 'server', 'res', 'Pong'], { wait: 1200 }]
        },
        {
          title: 'A quiet connection gets cut by the proxy', kind: 'Common mistake',
          body: '<p>Proxies don\'t like idle connections. By default <b>nginx closes a proxied connection if the server sends nothing for 60 seconds</b>.</p><p>No Close frame is sent, so the browser just sees the connection die with code <code>1006</code>.</p>',
          trap: 'The fix is on the server side: send Pings regularly (they count as data), or raise <code>proxy_read_timeout</code>. Messages from the browser alone do not reset nginx\'s timer.',
          spec: open,
          flow: [{ wait: 700 }, { say: 'proxy', text: '60 s with no data from server…', tone: 'warn', ms: 1600 }, { wait: 1700 }, { set: broken }, { say: 'browser', text: 'closed: 1006', tone: 'bad', ms: 2000 }, { wait: 2000 }]
        },
        {
          title: 'Closing properly', kind: 'How it works',
          body: '<p>A clean close is a small handshake: one side sends a <b>Close</b> frame (<code>0x8</code>) with a code, and the other side answers with its own Close frame.</p><p><code>1000</code> means a normal close. <code>1001</code> means "going away", for example a server shutting down or a tab closing.</p>',
          tip: '<code>1006</code> is never sent in a frame. It is what you see when the connection ended <b>without</b> a Close frame.',
          spec: open,
          flow: [['browser', 'proxy', 'evt'], ['proxy', 'server', 'evt', 'Close 1000'], ['server', 'proxy', 'evt'], ['proxy', 'browser', 'evt', 'Close 1000'], { set: closed }, { say: 'browser', text: 'closed cleanly', tone: 'ok' }, { wait: 1400 }]
        },
        {
          title: 'Reconnecting without a stampede', kind: 'Common mistake',
          body: '<p>When a server restarts, every open connection drops. The browser API does not reconnect by itself, so your app does.</p><p>If every client reconnects <b>at once</b>, the server is flooded just as it comes back. RFC 6455 says to wait a <b>random delay</b> first, then back off longer after each failure.</p>',
          spec: crowd('ready'),
          flow: [{ set: crowd('down') }, { say: 'server', text: 'restarting', tone: 'bad', ms: 1200 }, { wait: 1300 }, { set: crowd('ready') }, { say: 'server', text: 'all at once!', tone: 'bad', ms: 1200 }, all('c', 'server', 'bad'), { wait: 900 }, { set: crowd('down') }, { wait: 900 }, { set: crowd('ready') }, { say: 'server', text: 'random delays: calm', tone: 'ok', ms: 2600 }, ['c3', 'server'], { wait: 200 }, ['c1', 'server'], { wait: 350 }, ['c6', 'server'], ['c2', 'server'], { wait: 300 }, ['c5', 'server'], ['c4', 'server'], { wait: 900 }]
        }
      ]
    },

    quiz: [
      { q: 'A chat app behind nginx drops users after about a minute when nobody is talking. The browser sees close code 1006. What is the best fix?', o: ['Have the server send Ping frames regularly, or raise <code>proxy_read_timeout</code>', 'Switch from <code>wss://</code> to <code>ws://</code>', 'Make the browser send a message every 2 minutes', 'Return <code>200 OK</code> instead of <code>101</code>'], a: 0, y: 'nginx closes the connection when the <b>server</b> sends nothing for 60 s by default. Server Pings count as data. Browser messages don\'t reset that timer, and 2 minutes is too slow anyway.' },
      { q: 'Your WebSocket request gets a normal HTTP response instead of <code>101 Switching Protocols</code>, but only behind the proxy. What is the likely cause?', o: ['The server ran out of memory', 'The proxy did not forward the <code>Upgrade</code> and <code>Connection</code> headers', 'The browser sent text frames instead of binary', 'The close code was 1001'], a: 1, y: '<code>Upgrade</code> and <code>Connection</code> are hop-by-hop headers. A proxy drops them unless it is set up to forward them, so the server never sees the upgrade request.' },
      { q: 'Users\' connections end with code 1006. What does that tell you?', o: ['The server closed normally', 'The user closed the tab cleanly', 'The connection ended without any Close frame: a network drop, a crash or a proxy cut', 'The handshake used the wrong version'], a: 2, y: '1006 is never sent on the wire. It means the connection ended without the closing handshake.' },
      { q: 'A server restarts and 10,000 browsers reconnect in the same second. It falls over again. What should the clients do?', o: ['Reconnect immediately, but twice', 'Never reconnect', 'Switch to HTTP polling every 100 ms', 'Wait a random delay, then back off longer after each failure'], a: 3, y: 'RFC 6455 suggests a random first delay, then increasing back-off, so reconnects spread out instead of arriving together.' },
      { q: 'Why should a WebSocket server check the <code>Origin</code> header?', o: ['To pick between text and binary frames', 'To stop scripts on other websites from using the server through a visitor\'s browser', 'To choose the port number', 'To decide when to send Pings'], a: 1, y: 'RFC 6455: the Origin header protects against unauthorized cross-origin use of a WebSocket server by scripts.' }
    ],
    learn: [
      'Explain why plain HTTP can\'t let the server speak first',
      'Name the headers in the upgrade request and the status code that accepts it',
      'Explain what Ping/Pong is for, and why a proxy can cut a quiet connection',
      'Tell the difference between close codes 1000, 1001 and 1006',
      'Explain why reconnecting clients should use a random delay'
    ],
    sources: [
      { title: 'RFC 6455: The WebSocket Protocol', url: 'https://www.rfc-editor.org/rfc/rfc6455', note: 'handshake, frames, Ping/Pong, closing, reconnecting' },
      { title: 'nginx: WebSocket proxying', url: 'https://nginx.org/en/docs/http/websocket.html', note: 'hop-by-hop headers, 60 s default timeout' },
      { title: 'MDN: WebSocket', url: 'https://developer.mozilla.org/en-US/docs/Web/API/WebSocket', note: 'browser API, no backpressure' }
    ],
    simplified: 'A teaching model: one message is one frame, TCP and TLS details are hidden, and time is sped up (the 60-second timeout plays in about 2 seconds).'
  });
})();
