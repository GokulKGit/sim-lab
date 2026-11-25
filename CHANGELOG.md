# Changelog

## 1.0.0 (2026-11-25): first release

- **`simulate` skill:** research → facts file → pattern → topic file → check → build → one self-contained HTML page with Overview, Tour, Simulate and Check tabs.
- **Two sizes:** quick (default) and full (with a simulator).
- **Six patterns:** request-response, connection-lifecycle, redirect-flow, build-run, queue-pubsub, scaling.
- **Engine:**
  - animated SVG diagrams;
  - `flow` arrays for tour animations;
  - a simulator with controls, scenarios, metrics and a log;
  - an optional fake terminal;
  - a quiz;
  - progress saved in the browser;
  - Auto, Light and Dark themes.
- **`check.mjs`:** validates a topic without a browser. It:
  - checks diagrams, flows, label fit, overlaps, the quiz and sources;
  - runs every control, action, scenario and terminal command, and warns when one has no visible effect;
  - prints the metrics after each one with `--trace`.
- **`build.mjs`:** builds one HTML file. `--fragment` builds a version for Claude Artifacts.
- **Examples:** WebSocket (quick and full) and MCP (quick).
