# sim-lab

**Ask Claude how a technology works, and get a page you can play with instead of a wall of text.**

```
/sim-lab:simulate how does WebSocket work
```

sim-lab is a [Claude Code](https://code.claude.com) plugin. Claude researches the topic from official sources (specs, RFCs, vendor docs), then builds **one self-contained HTML page** with:

| Tab | What you do |
|---|---|
| **Overview** | What it is, when to use it, when not to, key terms and numbers |
| **Tour** | Click through an animated diagram, one idea per step, including the common mistakes |
| **Simulate** *(full size)* | Move sliders, break things on purpose, watch what happens; type into a fake terminal where the tool has an official CLI |
| **Check** | Scenario questions with explanations |

Every page lists its sources. It's a **simulation**: nothing real runs, nothing to install, nothing to break.

> **Live examples:** [WebSocket (quick)](https://GokulKGit.github.io/sim-lab/examples/websocket.html) · [WebSocket (full, with simulator)](https://GokulKGit.github.io/sim-lab/examples/websocket-full.html) · [MCP (quick)](https://GokulKGit.github.io/sim-lab/examples/mcp.html)
> *(These links work once GitHub Pages is on. See [Publishing the examples](#publishing-the-examples).)*

---

## Contents
- [Requirements](#requirements)
- [Install](#install): Claude Code plugin · desktop app · plain skill · per project · other agents
- [Use it](#use-it)
- [What you get](#what-you-get)
- [How it works](#how-it-works)
- [Build pages by hand](#build-pages-by-hand-no-ai)
- [Update and uninstall](#update-and-uninstall)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Contributing](#contributing)

## Requirements
- **Claude Code** (CLI, desktop app or IDE extension). Other agents that support [Agent Skills](https://agentskills.io/) can use the skill folder; see below.
- **Node.js 18 or newer**, to check and build pages. Check it with `node --version`.
- **Web access** for Claude (web search and fetch), for the research step.

## Install

### Option 1: Claude Code plugin (recommended)
Run these in a terminal:

```bash
claude plugin marketplace add GokulKGit/sim-lab
```
```bash
claude plugin install sim-lab@sim-lab
```

Or inside a Claude Code session:

```
/plugin marketplace add GokulKGit/sim-lab
/plugin install sim-lab@sim-lab
```

Then **start a new session**; plugins load when a session starts.

### Option 2: Claude Code desktop app
The desktop app's Code tab uses the same plugins as the CLI. Run the two commands from Option 1 in any terminal, or in the app's own terminal panel, then open a new session.

### Option 3: Plain skill, without the plugin system
Clone the repo and link the skill folder into your personal skills:

```bash
git clone https://github.com/GokulKGit/sim-lab.git
```
```bash
mkdir -p ~/.claude/skills && ln -s "$PWD/sim-lab/skills/simulate" ~/.claude/skills/simulate
```

Use it as `/simulate …` (no `sim-lab:` prefix). Because it's a link, `git pull` updates it.

> Use **either** the plugin **or** the plain skill, not both. Otherwise Claude sees two copies.

### Option 4: For one project or team
Copy the skill into a project so everyone who opens that repo in Claude Code gets it:

```bash
mkdir -p .claude/skills && cp -R /path/to/sim-lab/skills/simulate .claude/skills/simulate
```

Commit `.claude/skills/simulate`.

### Option 5: Other AI agents (Agent Skills format)
`skills/simulate/` follows the open [Agent Skills](https://agentskills.io/) format: a folder with a `SKILL.md`. Copy it into your agent's skills folder. The agent needs to be able to run `node` and fetch web pages.

## Use it

Run the command, or just ask in plain words:

```
/sim-lab:simulate how does OAuth login work
/sim-lab:simulate DNS lookup
How does Docker layer caching work? Simulate it so I can play with it.
```

**Two sizes:**

| Size | You get | How to ask |
|---|---|---|
| **quick** (default) | Overview, a 5–7 step tour, a 5-question quiz | Any normal question |
| **full** | Adds a simulator (4–7 controls, 3–5 scenarios), a longer tour and 6–8 questions | Say "let me play with it", "simulator", "full", or "break things" |

**Broad topics** (for example "Kubernetes") are narrowed to one mechanism, such as how a Deployment rolls out. Claude tells you which one it picked.

**Where the files go:** a `sims/` folder in your current directory:

```
sims/
  websocket.facts.md    research notes, with a source number on every fact
  websocket.topic.js    the topic file (edit it and rebuild)
  websocket.html        the page: double-click to open, no server needed
```

In apps that support Claude Artifacts, Claude can also publish the page and give you a link.

## What you get

**WebSocket, quick size:** the tour walks through
1. why plain HTTP can't push;
2. the `Upgrade: websocket` → `101 Switching Protocols` handshake;
3. frames both ways;
4. Ping/Pong;
5. a proxy cutting a quiet connection (`1006`);
6. a clean close (`1000`);
7. a reconnect stampede after a restart.

**WebSocket, full size:** adds a simulator with sliders for clients, server Ping interval, proxy idle timeout and reconnect strategy. It has buttons to restart the server or pull the cable, and live metrics such as idle kills and peak handshakes per second.

**MCP (Model Context Protocol):** host → one client per server → `tools/list` → user consent → `tools/call` → the server calls the other app's API → result. Plus two mistakes: logging to stdout on a stdio server, and trusting tool descriptions. It follows the current spec (revision 2026-07-28).

See [`examples/`](examples) for the source of each page: `*.facts.md` and `*.topic.js`.

## How it works

1. **Research:** Claude reads 2–5 official sources and writes a short facts file. No number goes on the page without a source.
2. **Plan:** it picks the closest of six **patterns** and adapts it:

   | Pattern | For |
   |---|---|
   | request-response | HTTP, REST, DNS, gRPC, CDN, caching |
   | connection-lifecycle | WebSocket, TCP, TLS, streams, connection pools |
   | redirect-flow | OAuth, OIDC, SSO/SAML, payment redirects |
   | build-run | Docker, CI/CD, compilers, deploys |
   | queue-pubsub | Kafka, RabbitMQ, Pub/Sub, SQS, job queues |
   | scaling | load balancers, autoscaling, rate limits, circuit breakers |

3. **Write:** Claude writes one small **topic file**: diagram, tour steps, simulator model and quiz. The diagram engine is reused, never rewritten, which keeps token use low.
4. **Check:** `check.mjs` tests the topic without a browser. It checks:
   - every diagram, arrow and animation step;
   - the quiz answers and the source links;
   - whether labels fit their boxes;
   - the simulator, by running every slider value, button, scenario and terminal command and **warning when one changes nothing visible**.
5. **Build:** `build.mjs` puts everything into one HTML file.

```
skills/simulate/
  SKILL.md                 the recipe Claude follows
  reference/topic-format.md  every field a topic file can use
  patterns/*.md            the six patterns
  engine/                  diagram engine, tabs, styles (never read by Claude)
  scripts/check.mjs        validate a topic (no browser)
  scripts/build.mjs        build one self-contained HTML page
```

## Build pages by hand (no AI)
You can write or edit a topic file yourself:

```bash
node skills/simulate/scripts/check.mjs examples/websocket.topic.js --trace
```
```bash
node skills/simulate/scripts/build.mjs examples/websocket.topic.js -o websocket.html
```

- `--trace` prints the simulator's metrics after every control, action and scenario, so you can see that the model behaves sensibly.
- `--fragment` builds a version without the `<html>` wrapper, for hosts like Claude Artifacts.
- The field reference is in [`skills/simulate/reference/topic-format.md`](skills/simulate/reference/topic-format.md).

## Update and uninstall

```bash
claude plugin marketplace update sim-lab
```
```bash
claude plugin update sim-lab@sim-lab
```

Start a new session afterwards. To remove it:

```bash
claude plugin uninstall sim-lab@sim-lab
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `/sim-lab:simulate` isn't listed | Start a **new** session after installing. Check that `claude plugin list` shows `sim-lab`. |
| Update says "already at the latest version" | Run `claude plugin marketplace update sim-lab` first, then update again. |
| `node: command not found` | Install Node.js 18+ from [nodejs.org](https://nodejs.org). |
| Two simulate skills show up | You installed the plugin **and** linked the plain skill. Remove one (`rm ~/.claude/skills/simulate`). |
| The page is blank or a tab is missing | Run `check.mjs` on the topic file and fix the errors, then rebuild. |
| A fact looks wrong | Each page lists its sources. Tell Claude which fact, or edit `sims/<id>.topic.js` and rebuild. |

## Limitations
- **It's a model, not the real system.** Time is sped up, scale is small and some details are left out. Each page says what it simplifies.
- **Facts come from the sources Claude read.** Specs and products change, so check the linked sources for anything important.
- **Token use:** a quick page is a modest job. A full page with a simulator is a bigger one: in testing, about 110k tokens and 7 minutes, mostly spent reading a long RFC.
- **Claude desktop and claude.ai chat** (outside Claude Code) haven't been tested yet.

## Publishing the examples
To make the example links at the top work: in the repo on GitHub, open **Settings → Pages**, set **Source: Deploy from a branch**, choose **Branch: `main`, folder `/ (root)`**, and save. The pages appear at `https://GokulKGit.github.io/sim-lab/examples/`.

## Contributing
Issues and pull requests are welcome, especially new **patterns** and **example topics**. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
[MIT](LICENSE)
