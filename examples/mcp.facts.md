# MCP (Model Context Protocol): facts (quick size)

Spec revision: 2026-07-28 (the /specification/latest pages resolve to it).
Sources: [1] spec overview · [2] architecture · [3] tools · [4] stdio transport · [5] authorization · [6] security best practices · [7] lifecycle/versioning

## Actors
- **Host:** the AI application. It creates clients [2]
- **Client:** "communicates with exactly one server", so one client per server [2]
- **Server:** provides "specialized context and capabilities"; it can be a local process or a remote service [2]

## Steps, with real names
1. Messages are JSON-RPC 2.0 [1]
2. Transports: stdio ("a client-launched subprocess") or Streamable HTTP ("each message is an HTTP POST to a single MCP endpoint"). HTTP+SSE is deprecated [4][transports]
3. Current revision: "There is no negotiation handshake". Legacy versions (2025-11-25 and earlier) used an `initialize` handshake [7]
4. Discover tools: `tools/list` → each tool has a `name` and an `inputSchema` (JSON Schema) [3]
5. Tools are "model-controlled": the model picks one [3]
6. "Hosts must obtain explicit user consent before invoking any tool" [1]
7. Run it: `tools/call` with `name` + `arguments` → result `content` [3]
8. A failing tool returns `isError: true` in the result [3]
9. How the server reaches the other app (its API, files, etc.) is up to the server; MCP doesn't define it (inference from [2]: servers "provide context")

## Defaults and limits
- Server features: Resources, Prompts, Tools [2]. Client feature: Elicitation [1]. Sampling and roots are deprecated as of 2026-07-28 [1]
- Authorization is OPTIONAL. HTTP transports base it on OAuth 2.1; stdio servers take credentials "from the environment" [5]
- Tool list changes: servers SHOULD notify clients that subscribed (`toolsListChanged`) [3]

## Common mistakes
- A stdio server writing logs to stdout: it "MUST NOT write anything to its stdout that is not a valid MCP message"; logs go to stderr [4]
- Trusting tool descriptions: annotations are "untrusted unless they come from trusted servers" [3][6]
- No human in the loop: there SHOULD always be a way to deny tool calls [3]
- Expecting the old `initialize` handshake on a current-revision server [7]
