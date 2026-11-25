# Topic file format

A topic file is a plain script that calls `SimLab.topic({...})` once, wrapped in an IIFE.
- Strings that show as text may contain simple HTML (`<b>`, `<code>`, `<p>`, `<ul><li>`).
- The file must not touch the DOM when it loads. Only build things inside functions.
- Every section is optional; a tab appears only when its data exists.
  - **quick** = `overview` + `tour` + `quiz`
  - **full** = adds `sim`

```js
(function () {
  'use strict';
  const L = window.SimLab;
  // shared diagram pieces here (see "Diagrams")
  L.topic({ /* fields below */ });
})();
```

## Top-level fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | required, kebab-case, e.g. `websocket` |
| `name` | string | required, e.g. `WebSocket` |
| `abbr` | string | ≤ 4 letters, shown in the header hexagon |
| `color` | css | e.g. `'var(--c-blue)'` |
| `tagline` | html | one sentence under the title |
| `chips` | `[[text, tone]]` | tone: `acc` `ok` `warn` `bad` `evt` or `''` |
| `overview` | object | see below |
| `tour` | object | see below |
| `sim` | object | full size only |
| `quiz` | array | 5–8 questions |
| `learn` | `[html]` | 3–6 "can you explain…" lines; shown in the Tour sidebar and the Check tab |
| `related` | `[{name, abbr, how, color}]` | other technologies it works with |
| `sources` | `[{title, url, note}]` | **required**, 2–5 official sources |
| `simplified` | string | one line on what the model simplifies; shown in the footer |

## overview
`what` (html, 1–2 sentences) · `analogy` · `signals` (clues that point to this technology) · `signalsTitle` · `use` [html] · `avoid` [html] · `terms` [[term, meaning]] · `numbers` [[label, value]] (each value must come from a source) · `pricing` · `source` (a small note under the overview).

## Diagrams (`spec`)
The canvas is **820 × 430**. A node's `x`, `y` is its **centre**; a group's `x`, `y` is its top-left corner.
```js
{ groups: [{ id, x, y, w, h, label, tone }],        // dashed box; tone: 'acc' | 'bad'
  nodes:  [{ id, kind, x, y, label, sub, abbr, color, state, badge, w, h, dim, hl }],
  links:  [{ a, b, label, dash, tone }] }           // tone: 'acc' | 'bad' | 'evt'
```

| kind | size (w×h) | look | label / sub fit |
|---|---|---|---|
| `svc` | 184×60 | hexagon icon with `abbr` | ~16 / ~22 chars |
| `store` | 178×60 | same, for data stores | ~16 / ~22 chars |
| `actor` | 132×46 | person icon (user, browser) | ~10 / ~13 chars; set `w` for longer |
| `unit` | 80×44 | small card with a state stripe (instance, container, connection) | ~9 / ~11 chars |

- `state` works on every kind. For units it colours the top stripe; for every kind, `down` turns the box red, `busy` outlines it blue, `start` pulses it amber and `cold` dashes it. Values: `cold` `start` `ready` `busy` `idle` `down` `evt`.
- Other node options: `hl: true` outlines a node, `dim: true` fades it, `badge: '3'` adds a corner count.
- **Layout:** use 3–4 columns, at about x = 90, 330, 570 and 740, and rows at about y = 90, 215 and 340.
  - Keep nodes 30px or more from the edges.
  - Keep link labels short (≤ 14 chars).
- **Changing a diagram:** call `L.spec(base, { db: { state: 'down' } }, { nodes: [...], links: [...] })`. It copies the base and changes nodes, and adds any extra nodes and links. Setting a node to `null` removes it, along with its links. To restyle links, write a new spec, for example `{ nodes, links: closedLinks }`.
- **Layout helper:** `L.layoutGrid(n, box, unitW = 78, unitH = 42, gap = 10)` returns `[{x, y}]` centres for n units placed inside a group box `{x, y, w}`.
  - It leaves room for the group's label: the first row's centre is at `box.y + 34 + unitH/2`, and the first column's at `box.x + 10 + unitW/2`.
  - Columns = `floor((box.w - 20 + gap) / (unitW + gap))`. Check that the rows fit: 20 units in a 300px-wide box need 7 rows.
  - Draw a matching `group` with the same x, y, w.
- **Packets** move in a straight line between two node centres. To show a hop through a proxy, send two packets: a → proxy, then proxy → b.

## tour
```js
tour: { w: 820, h: 430, trapLabel: 'Common mistake', steps: [
  { title, kind, body, tip, trap, spec, flow | run, metrics, loop }
] }
```
- `kind`: `How it works`, `Common mistake` (warn colour), `Failure` (red), `Event` (purple) or any short label.
- `body`: 1–3 short `<p>`s.
  - `tip` is a green "Good to know" box.
  - `trap` is a yellow box labelled with `trapLabel`.
- `spec`: the diagram for this step, or a function that returns one. If it's missing, the step uses `tour.spec`.
- `metrics`: `[[label, value, tone]]` tiles above the diagram.
- **`flow` (preferred):** a list of animation actions. The list replays in a loop until the step changes (`loop: false` plays it once).
```js
flow: [
  ['browser', 'server'],                          // a dot from → to (tone 'req')
  ['server', 'browser', 'res', '101 Switching'],  // tone + a bubble at the receiver
  { say: 'server', text: 'auth ok', tone: 'ok' }, // a bubble on any node
  { wait: 600 },
  { all: [['srv', 'c1', 'evt'], ['srv', 'c2', 'evt']] },  // at the same time
  { set: L.spec(base, { srv: { state: 'down' } }) },      // change the diagram mid-step
  { flash: 'srv' },
  { metrics: [['Open connections', '2', 'ok']] }
]
```
- Packet tones: `req` (blue), `res` (green), `evt` (purple), `bad` (red), `warn` (amber).
- Flows show time **compressed**: a 60-second timeout plays in a second or two. Say so in the step text or in `simplified`.
- `run: async (S, t, setMetrics) => {}` is the escape hatch for animations that need logic. Use `await S.packet(a, b, {tone})`, `S.say(id, text, tone)`, `S.set(spec)` and `await t.sleep(ms)`.

## sim (full size)
```js
sim: {
  w: 820, h: 430,
  init: () => ({ /* plain state object */ }),
  tick: (s, dt, api) => {},      // dt = simulated seconds (about 0.1 × speed)
  view: (s, api) => spec,        // diagram from the state; same node ids slide. api.now() = sim seconds
  metrics: (s) => [[label, value, tone]],   // tone: 'ok' | 'warn' | 'bad' | 'acc' | '' (plain)
  explain: (s) => 'html',        // one sentence: what is happening now
  legend: [['req', 'request'], ['res', 'response']],  // optional
  controls: [
    { type: 'heading', label: 'Network' },
    { type: 'range', id, label, min, max, step, fmt: v => v + ' ms', get: s => s.x, set: (s, v, api) => { s.x = v; }, help },
    { type: 'toggle', id, label, get, set, help },
    { type: 'select', id, label, options: [[value, label]], get, set },
    { type: 'actions', items: [{ label, tone: 'bad', run: (s, api) => {} }] }
  ],
  scenarios: [{ title, desc, run: (s, api) => {} }],   // 3–5 "try this" presets that change the state
  cli: {                                               // only if the topic has real commands
    title: 'Terminal', prompt: 'you@laptop:~$', intro: ['Type help'],
    boolFlags: ['d', 'rm'],                            // flags that take no value
    cookbook: ['docker ps', 'docker run -d nginx'],    // every line here must work
    run: ({ words, flags, raw }, s, api) => [['output line', 'ok' | 'bad' | 'warn' | 'mut']] // or null = not supported
  },
  onStart: (s, api) => {}
}
```
- `api` has these functions:
  - `log(msg, tone)`
  - `packet(a, b, tone)`
  - `say(id, text, tone)`
  - `flash(id)`
  - `now()` (simulated seconds)
  - `after(seconds, (s, api) => {})`
  - `refresh()`
- **Time:** `tick` gets `dt` in simulated seconds. At 1× the simulator runs in real time; the user can choose 2× or 4×. Make long product timeouts (60 s and more) a control, or shorten them in a scenario and say so in its `desc`.
- `api.log(msg)` accepts simple HTML such as `<code>` and `<b>`.
- **Keep the state small**, for example a list of connections with `{id, state, since}`. `tick` changes the state and `view` draws it.
- **Show changes visibly:** call `api.packet` for traffic and `api.log` for anything the user should notice. Limit packets to about 3 per tick.
- **Every control and scenario must change something visible:** a metric, a node state, a log line or the explain text.

## quiz
`[{ q, o: [4 options], a: index, y: 'why the answer is right' }]`. Quick size: 5 questions. Full size: 6–8.
- Spread the right answers across A–D.
- Ask about situations ("A chat app drops users after 60 s idle. Why?"), not definitions.

## Checklist before building
- [ ] Every number in `numbers`, `tip` or a quiz answer appears in `sources`.
- [ ] Every flow and link node id exists in that step's diagram.
- [ ] The labels fit their boxes, per the table above.
- [ ] `node scripts/check.mjs <file>` passes.
