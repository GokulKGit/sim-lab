---
name: simulate
description: Build an interactive simulation page that shows how a technology or protocol works (for example WebSocket, OAuth, Docker, DNS, TLS, Kafka, load balancing). The page has an animated step-by-step tour, a simulator the user can change and break, and a quiz, researched from official sources. Use when the user asks how something technical works and wants to see or simulate it, or runs /simulate. Do not use for code the user wants to run, or for questions a short text answer settles.
---

# Simulate: interactive "how it works" pages

Turn one technical topic into **one self-contained HTML page** with these tabs:
- **Overview:** what it is, when to use it, when not to, key terms and numbers.
- **Tour:** an animated diagram, one idea per step.
- **Simulate** (full size only): controls the user changes, failures they trigger, and optionally a fake terminal.
- **Check:** a quiz with explanations.

The page is a **model**. Never write runnable server, Docker or auth code for the user. The only code you write is the topic file that drives the page.

`<skill>` below means this skill's folder (the folder holding this SKILL.md); other paths like `patterns/` are relative to it. Write the user's files to `./sims/` in their working folder.

## Keep token use low
- **Never** read or copy anything in `engine/`. The build script inlines it.
- Read `reference/topic-format.md` once, and only **one** file from `patterns/`.
- Research with at most ~5 fetches. For a long spec (RFCs run to 150k+ characters), fetch the sections you need, or ask the fetch for specific facts, instead of reading it end to end. Write the facts down once, then build from that note.
- Run `scripts/check.mjs` instead of screenshots. Use screenshots only to confirm the final page, if a browser tool exists.

## Size
- **quick** (default): Overview, Tour (5–7 steps), Check (5 questions). No simulator.
- **full**: Overview, Tour (6–9 steps), Simulate (4–7 controls, 3–5 scenarios), Check (6–8 questions). Use it only when the user asks to play, experiment, try settings, break things, or says "full" or "simulator". Running `/simulate` by itself does **not** mean full.
- **Terminal:** add a fake terminal only if the topic has an official or standard CLI (`docker`, `kubectl`, `gcloud`, `curl`, `git`). Skip third-party tools.

If the topic is broad (for example "Kubernetes"), pick the one mechanism the user most likely means (for example "how a Deployment rolls out"), and say so in one line.

## Steps

### 1. Research
- Find 2–5 sources. Prefer the spec or RFC and the official docs over blogs.
- Write `sims/<id>.facts.md` (≤ 30 lines), listing:
  - the actors;
  - the steps in order, with the real message and field names;
  - defaults and limits, with numbers;
  - 3–5 common failures or mistakes;
  - a `[n]` source number after every fact.
- No number goes on the page without a source. If sources disagree or a value is product-specific, say so on the page.
- A fetch result can mix the page's text with the fetch model's own knowledge. Count a fact only when the result quotes or clearly attributes it to the page. Leave out anything marked as not on the page.

### 2. Plan the model
Pick the closest pattern and read only that file:

| Pattern | For |
|---|---|
| `patterns/request-response.md` | HTTP, REST, DNS, gRPC unary, CDN, cache |
| `patterns/connection-lifecycle.md` | WebSocket, TCP, TLS, streams, SSE, connection pools |
| `patterns/redirect-flow.md` | OAuth, OIDC, SSO/SAML, payment redirects |
| `patterns/build-run.md` | Docker, CI/CD, compilers, deploys |
| `patterns/queue-pubsub.md` | Kafka, RabbitMQ, Pub/Sub, SQS, job queues |
| `patterns/scaling.md` | load balancers, autoscaling, rate limits, circuit breakers |

Adapt the pattern's diagram, tour outline and model to the topic. Drop what doesn't apply.

### 3. Write the topic file
- Read `reference/topic-format.md`, then write `sims/<id>.topic.js`.
- Prefer `flow` arrays over `run` functions for tour animations.
- Build each changed diagram with `L.spec(base, changes)`.
- Text: short plain sentences, one idea per tour step. Use the protocol's real names in `<code>`.
- Spread quiz answers across A–D, and ask about situations, not definitions.
- Put the sources in `sources`, and one line on what the model simplifies in `simplified`.

### 4. Check and build
```
node <skill>/scripts/check.mjs sims/<id>.topic.js [--trace]
node <skill>/scripts/build.mjs sims/<id>.topic.js -o sims/<id>.html
```
- check runs the simulator, every control value, action, scenario and command. It warns when one changes nothing the user can see. `--trace` prints the metrics after each one: read them to confirm the model behaves as the facts say (for example, backoff gives a lower peak than instant reconnect).
- Fix every ✖ error.
- Fix ⚠ warnings about labels, overlaps and missing parts unless there's a reason not to.
- Re-run until check is clean, then build.

If a browser tool is available, open the page once:
- click through the tour;
- move one control;
- run one scenario;
- check the console for errors.

### 5. Deliver
- If you can publish a Claude Artifact, build with `--fragment` to `sims/<id>.artifact.html`, publish that and give the link. Otherwise give the path to `sims/<id>.html`; it opens with a double-click and needs no server.
- In 2–4 lines, tell the user:
  - what the page covers;
  - which size it is;
  - what the model simplifies;
  - that `sims/<id>.topic.js` can be edited and rebuilt.
- Offer the other size in one line.

## Quality bar
- Every control and scenario changes something visible: a metric, a node, a log line or the explain text.
- Every tour step's animation shows the idea its text describes.
- Mistakes and failures get their own steps. They're what people remember.
- Nothing is invented. When unsure, leave it out or say "varies by provider".
