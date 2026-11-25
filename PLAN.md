# sim-lab build plan

> **v1.0.0 released as Phase 1** (2026-11-25): Phases 0–4 core done; remaining Phase 4 items (OAuth/Docker examples, desktop chat test) move to the next release.

**Goal:** a shareable Claude plugin. Ask "how does WebSocket work?" (or `/sim-lab:simulate websocket`) and get an interactive simulation page. The page has four tabs: Overview, Tour, Simulate and Check.

**Rules we agreed on:**
- Simulation only. The page is a model of how the thing works. It never contains runnable server, Docker or auth code for the user.
- Research first. Use official specs and docs, and list the sources on the page.
- Low token use. Claude never reads or rewrites the engine; it only writes one small topic file.
- One self-contained HTML file per topic. It opens with a double-click, with no server.
- Built from the GCP Service Lab engine (`gcp-developer/gcp-lab/`), made general.

**Placeholder names, to confirm before we push:**
- plugin name: `sim-lab`
- skill name: `simulate`
- GitHub user: `GokulKGit`
- license: MIT

---

## Phase 0: Scaffold (done)
- [x] Folder layout, `plugin.json`, `marketplace.json`
- [x] Draft `SKILL.md`, `README.md`, `LICENSE`
- [x] `claude plugin validate` passes

## Phase 1: Engine (done)
Copied from the GCP lab into `skills/simulate/engine/` and made general.
- [x] `core.js`, `scene.js`, `views.js`, `lab.css`: GCP-only parts removed (families, catalog, router, "Choose compute" styles). The namespace is `window.SimLab`, with `GCPLab` kept as an alias so old lab files still build.
- [x] `page.js` + `shell.html`: a one-topic page with a header, tabs, a progress bar and a sources footer.
- [x] `scripts/build.mjs`: inlines the CSS, engine, topic and page into **one** HTML file. Node 18+, no npm packages.
  - It loads the topic in a sandbox first and stops with a clear error if the file is broken or missing `id`/`name`.
  - `--fragment` leaves out the document wrapper, for Claude Artifacts.
- [x] Theme toggle: Auto (follows the system), Light and Dark, remembered per browser.
- [x] Generic node colours for topics: `var(--c-blue|green|orange|purple|teal|pink|amber|gray)`.
- [x] Tested in the browser:
  - `tests/fixtures/mini.topic.js` (quick topic) and the Cloud Run lab file (full topic with simulator and terminal) both build and run with no console errors.
  - No horizontal scroll at 375px width.
  - Not tested: opening the file by double-click from Finder.

## Phase 2: Topic format and patterns (done)
- [x] `reference/topic-format.md` (140 lines): every field, diagram sizes and how many characters fit, layout grid, flow actions, sim/cli API, quiz rules, checklist.
- [x] Engine additions that make topic files shorter:
  - `flow` arrays for tour animations, so most steps need no code;
  - `L.spec(base, changes)` to change a diagram without copying it.
- [x] Six patterns in `patterns/`, 51–59 lines each: request-response, connection-lifecycle, redirect-flow, build-run, queue-pubsub, scaling. Each one has:
  - a diagram layout;
  - a tour outline;
  - a simulator model;
  - controls and scenarios;
  - quiz angles;
  - a "check in sources" list.

## Phase 3: Recipe and checker (done)
- [x] `SKILL.md` (92 lines): research → facts file → pick one pattern → topic file → check → build → deliver.
  - Two sizes: quick (default) and full.
  - Token rules: never read `engine/`, read one pattern only, about 5 fetches at most.
- [x] `scripts/check.mjs`, which runs without a browser. It:
  - validates ids, sources, every diagram, link and flow node, and the quiz answers;
  - runs the simulator for 20 s and tries every control value, action, scenario and cookbook command;
  - warns about labels that don't fit their boxes (calibrated against real browser text widths), overlapping nodes, and quiz answers bunched on one letter.
- [x] Tested:
  - the checker caught all 10 mistakes planted in a broken topic;
  - on the Cloud Run lab it flagged only real issues (no sources; a label that overflows by 6px);
  - flow animations, `set` and badges were verified in the browser.

## Phase 4: Test locally (in progress)
- [x] First real topic: WebSocket. A fresh helper with no context built the full size from the recipe alone: 9 tour steps, a simulator, 7 questions. That took about 113k tokens and 6.7 minutes, including about 4 fetches of RFC 6455. The quick size was also built through `/simulate` in the main session.
- [x] Fixed from the test feedback:
  - the size trigger (`/simulate` alone no longer means full);
  - the full size's tour length and question count;
  - the official-CLI-only rule;
  - fetch advice for long specs and mixed-in model knowledge;
  - layoutGrid and the many-connections layout documented;
  - `view(s, api)`, state on any node, straight-line packets, metric tones, time/speed, HTML in the log;
  - the pattern's nginx timer direction and the RFC 6455 §7.2.3 backoff.
- [x] check.mjs now:
  - runs each control, action and scenario against a seeded baseline and warns if it changes nothing visible;
  - prints a coverage line;
  - `--trace` prints the metrics after each change.
- [x] Engine: the simulator log renders simple HTML.
- [x] Install path tested: `claude plugin marketplace add <folder>` and `claude plugin install sim-lab@sim-lab` both work.
- [ ] Build OAuth (redirect-flow) and Docker (build-run) examples to test the other patterns.
- [ ] Test in a truly fresh Claude Code session outside this one, with the plugin installed.
- [ ] Measure the quick size's token use on its own.
- [ ] Try it in the Claude desktop app's chat (Customize → Plugins → Upload).
- [ ] Copy the finished examples into `examples/` (decide whether the Cloud Run fixture stays public).

## Phase 5: Publish
- [ ] Confirm the name, GitHub user and author name in `plugin.json`, `marketplace.json` and `README.md`.
- [ ] Run `claude plugin validate --strict ./`.
- [ ] **Bump `version` in `plugin.json` for every release.** `claude plugin update` only installs a new copy when the version changes. Users run `claude plugin marketplace update sim-lab`, then `claude plugin update sim-lab@sim-lab`.
- [ ] The user creates the GitHub repo and pushes it from their own account.
- [ ] README: a GIF or screenshots, the install commands and links to the examples.
- [ ] Medium post: the problem, a demo, how to install, how it works.
- [ ] Optional: submit to the Anthropic directory (claude.ai/directory/manage; needs a paid plan, reviewed before listing).

## Install commands (once pushed)
```
/plugin marketplace add GokulKGit/sim-lab
/plugin install sim-lab@sim-lab
```
