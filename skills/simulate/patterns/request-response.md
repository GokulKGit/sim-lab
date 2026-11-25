# Pattern: request → response

**Use for:** HTTP, REST APIs, DNS lookups, gRPC unary calls, API gateways, CDNs, caching layers. One question goes in and one answer comes back, possibly through several hops.

## Diagram (820×430)
| id | kind | x, y | note |
|---|---|---|---|
| `client` | actor | 90, 215 | browser, app or curl |
| `edge` | svc | 300, 215 | CDN, gateway or proxy (optional hop) |
| `server` | svc | 520, 215 | the app server |
| `db` | store | 730, 120 | the database (optional) |
| `cache` | store | 730, 310 | the cache (optional) |

Keep at most 5 nodes. Hops are what make the latency story visible.

## Tour outline (5–8 steps)
1. **The request:** method, path, the key headers and the body. Show the real request line in `body` with `<code>`.
2. **Each hop:** what each hop adds or checks (TLS, auth header, routing). One step per hop that matters.
3. **Server work:** a server → db round trip. Use `{ metrics: [['Latency', '...']] }` to add up the time.
4. **The response:** the status code families (2xx/3xx/4xx/5xx), with one real example each, plus the headers that matter (`Cache-Control`, `Content-Type`).
5. **Caching:** the second request is served by the edge or cache. Use `{ set: L.spec(base, { server: { dim: true } }) }`.
6. **Failure:** a timeout or 5xx, where the client retries, and when retrying is unsafe (non-idempotent methods).
7. **Common mistake:** something specific to the topic, such as caching a private response or retrying a POST.

## Simulator model (full size)
```js
init: () => ({ rps: 20, serverMs: 80, dbMs: 40, capacity: 50, timeout: 2000, retries: 0, cacheHit: 0, inflight: [], stats: {...} })
tick(s, dt, api):
  arrivals = s.rps * dt (carry the fraction); each request: cached? (Math.random() < cacheHit) → fast path
  in flight > capacity → requests queue; latency = serverMs + dbMs + queueWait
  latency > timeout → error (tone 'bad'); retries re-send, which raises the load (a retry storm)
  keep rolling 10 s windows for p50/p95, errors/s and throughput
view(s): nodes with badges for in-flight counts; server state busy/down by load; packets limited to ~3 per tick
```
- **Controls:** requests/s, server time, DB time, server capacity (concurrent), client timeout, retries (0–3), cache hit % (0–95). Actions: "DB slows to 2 s", "Server returns 500s".
- **Scenarios:**
  - **Normal day.**
  - **Slow database:** latency climbs, then timeouts start.
  - **Retries make it worse:** a retry storm.
  - **Turn the cache on.**
- **Metrics:** p50 and p95 latency, errors/s, throughput, queue length, cache hits.
- **CLI (HTTP topics):** `curl -i URL`, `curl -X POST -H 'Content-Type: application/json' -d '{}' URL`, `curl -I URL` (headers only). Print realistic status lines and headers from the current state.

## Quiz angles
- Which status code fits the situation (401 vs 403, 404 vs 410, 429, 503)?
- Why can't you safely retry a POST, and what makes it safe (idempotency keys)?
- Where should caching happen, and which header controls it?
- p95 latency jumps while p50 stays flat. What does that suggest?

## Check in sources (don't guess)
- The status code meanings (RFC 9110).
- Header semantics.
- The default timeouts of any product you name.
- Which methods are idempotent.
