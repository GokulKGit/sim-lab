# Contributing to sim-lab

Thanks for helping. The most useful contributions are **example topics**, **new patterns** and **fixes to facts**.

## Ground rules
- **Simulation only.** Pages are teaching models. Never add runnable server, Docker or auth code for the reader.
- **Every fact has a source.** Numbers, defaults and limits must come from official specs or docs, and be listed in the topic's `sources`.
- **Keep it token-light.** `SKILL.md` stays short (under ~150 lines). Detail goes in `reference/` or `patterns/`, which Claude reads only when needed. Claude must never need to read `engine/`.

## Set up
You only need Node.js 18+. There are no packages to install.

```bash
git clone https://github.com/GokulKGit/sim-lab.git && cd sim-lab
```
```bash
node tests/run.mjs
```

`tests/run.mjs` checks and builds every topic in `examples/` and `tests/fixtures/`. CI runs the same thing on every push and pull request.

To try your local copy in Claude Code:

```bash
claude --plugin-dir .
```

## Add an example topic
1. Run `/sim-lab:simulate <topic>` in Claude Code, or write `examples/<id>.topic.js` by hand. See [`skills/simulate/reference/topic-format.md`](skills/simulate/reference/topic-format.md).
2. Keep the research notes next to it as `examples/<id>.facts.md`.
3. Run `node skills/simulate/scripts/check.mjs examples/<id>.topic.js --trace`. Fix every error, and read the trace to confirm the simulator behaves the way the facts say.
4. Build it with `node skills/simulate/scripts/build.mjs examples/<id>.topic.js -o examples/<id>.html`.
5. Open the page and click through every tab.

## Add a pattern
A pattern is a short guide (about 50–60 lines) in `skills/simulate/patterns/`. Copy the structure of an existing one:
- **Use for:** which topics it covers;
- **Diagram:** a node table with ids, kinds and x/y on the 820×430 canvas;
- **Tour outline:** the steps, including the common mistakes;
- **Simulator model:** state, tick, view, controls, scenarios and metrics;
- **Quiz angles;**
- **Check in sources:** what must never be guessed.

Then add it to the pattern table in `SKILL.md` and `README.md`, and add one example topic that uses it.

## Change the engine
The engine is in `skills/simulate/engine/`.
- Keep the topic format backward compatible, so existing topic files keep working.
- Rebuild the examples and run `node tests/run.mjs`.
- Check one page in light mode, dark mode and at phone width (375px).

## Release
1. Bump `version` in `.claude-plugin/plugin.json`. Users only get an update when it changes.
2. Add an entry to `CHANGELOG.md`.
3. Run `claude plugin validate .` and `node tests/run.mjs`.
4. Tag the release, for example `git tag v1.1.0`.
