# Pattern: connection lifecycle

**Use for:** WebSocket, TCP, TLS sessions, gRPC streams, Server-Sent Events, MQTT, database connection pools. Anything that **opens**, **stays open**, sends messages both ways, and then **closes or breaks**.

## Diagram (820×430)
**Tour** (one connection):

| id | kind | x, y | note |
|---|---|---|---|
| `client` | actor | 110, 215 | browser or app |
| `proxy` | svc | 370, 215 | load balancer / reverse proxy, which has its own idle timeout (optional) |
| `server` | svc | 650, 215 | the server process |

**Many connections** (the reconnect step, and the simulator): move the three nodes to the top row (y ≈ 70) and put the connections in a group below. Use group `{ id: 'conns', x: 40, y: 140, w: 740, h: 270, label: 'connections' }` and `L.layoutGrid(n, {x: 40, y: 140, w: 740}, 80, 44, 10)`. That gives 8 per row, so 16 connections take 2 rows and 24 take 3. Or, for up to 6 connections, a single column at x = 110.

Unit states for a connection: `start` = handshaking, `ready` = open, `busy` = sending a message, `idle` = open but quiet, `down` = closed or broken.

## Tour outline (6–9 steps)
1. **Why it exists:** what plain request/response can't do (for WebSocket: the server pushing without being asked). A flow with one request and one response, then silence.
2. **Opening handshake:** the exact first messages, with the protocol's real names (WebSocket: an HTTP `GET` with `Upgrade: websocket` and `Sec-WebSocket-Key`, answered by `101 Switching Protocols`).
3. **Open connection:** the connection unit turns `ready`. Show that one connection carries many messages.
4. **Messages both ways:** use `{ all: [...] }` to show the server pushing while the client sends.
5. **Keep-alive:** ping/pong or heartbeat messages. Explain why they exist: proxies and NATs drop connections that look idle.
6. **Common mistake:** a proxy idle timeout silently kills a quiet connection. Use `{ set: L.spec(base, { proxy: { state: 'down' } }) }`.
7. **Closing:** the clean close handshake vs a broken network, which the other side notices only on the next write or a missed heartbeat.
8. **Reconnecting:** reconnect with exponential backoff plus jitter, and why reconnecting immediately causes a thundering herd after a server restart.
9. **Scaling:** connections are long-lived and pinned to one server, so load balancing and deploys behave differently (sticky routing, draining).

## Simulator model (full size)
```js
init: () => ({ clients: 6, heartbeat: 20, proxyIdle: 60, backoff: 'backoff', conns: [], stats: { msgs: 0, reconnects: 0, lost: 0 }, serverUp: true })
// each conn: { id, state: 'start'|'open'|'down', idleFor: 0, retryIn: 0, tries: 0 }
tick(s, dt, api):
  for each conn:
    start → open after ~1 RTT (api.log the handshake)
    open: idleFor += dt
          which traffic resets idleFor is PRODUCT-SPECIFIC: nginx resets it only when the SERVER sends data
          (its proxy_read_timeout), so a server Ping resets it and client messages don't. Check the proxy you name.
          heartbeat: if heartbeat > 0, the server Pings every `heartbeat` s (api.packet tone 'warn'), which resets idleFor
          if idleFor > proxyIdle → down ('proxy closed idle connection', tone 'bad')
    down: retryIn -= dt; at 0 → start (stats.reconnects++)
          'now': retryIn = 0.2
          'backoff' (RFC 6455 §7.2.3): first try after a random delay (the RFC suggests 0–5 s), then a truncated
          exponential backoff: retryIn = min(cap, base * 2 ** tries) * (0.5 + Math.random()); label the cap as this model's choice
    track handshakes per second in the state (store s.now in tick) so view and metrics can show the reconnect peak
view(s): client, proxy and server nodes, plus one unit per conn (state → unit state; sub = 'idle 12s')
```
- **Controls:** clients (1–24), server Ping interval (0 = off, up to 60 s), proxy idle timeout (10–120 s), and reconnect strategy (`none`, `now`, `backoff`). Actions: "Drop network", "Restart server" (all conns down at once) and "Close cleanly".
- **Scenarios:**
  - **Heartbeat off behind a 60 s proxy:** connections die quietly.
  - **Server restart with instant reconnect:** a spike of handshakes.
  - **The same restart with backoff and jitter:** handshakes spread out.
  - **Clean close vs cable pulled.**
- **Metrics:** open connections, messages/s, reconnects, messages lost while down.

## Quiz angles
- An idle chat drops after N seconds behind a load balancer. What's the cause, and what's the fix?
- Why add jitter to reconnects?
- Which status code or handshake message confirms the upgrade?
- Why don't long-lived connections spread evenly after you add a server?

## Check in sources (don't guess)
- The exact handshake headers and status code.
- The ping/pong frame names.
- The close codes, if you mention any.
- Default timeouts of any proxy you name, and **which direction of traffic** resets them.
- The reconnect advice (RFC 6455 §7.2.3).
- Message size limits.
