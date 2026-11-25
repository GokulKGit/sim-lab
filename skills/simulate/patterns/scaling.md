# Pattern: scaling under load

**Use for:** load balancers, autoscaling groups, Kubernetes HPA, serverless scale-out, caches and CDNs under load, rate limiting, circuit breakers, connection pools. Traffic changes, and the system adds, removes, protects or routes around capacity.

## Diagram (820×430)
| id | kind | x, y | note |
|---|---|---|---|
| `users` | actor | 80, 215 | badge = requests/s |
| `lb` | svc | 270, 215 | load balancer, gateway or limiter |
| `pool` | group | x 380, y 40, w 260, h 350 | "instances" |
| `i1`…`iN` | unit | `L.layoutGrid(n, {x: 380, y: 40, w: 260})` | instances, pods or VMs (state = health/load) |
| `db` | store | 730, 215 | the shared backend that can become the bottleneck |

## Tour outline (7–10 steps)
1. **One instance:** capacity = concurrency ÷ time per request (Little's law). Show the numbers with `metrics`.
2. **Spreading load:** round robin vs least connections. Show it with `{ all: [...] }` packets to different units.
3. **Health checks:** an instance fails its check, turns `down` and is taken out of rotation.
4. **Autoscaling:** a metric (CPU, requests, queue length) crosses its target → new instances go `cold`, `start`, then `ready`. Startup takes time.
5. **Cooldown and flapping:** why scale-in waits.
6. **Limits:** max instances, or the database connection limit. Scaling the front end can overload the backend.
7. **Protection:** rate limiting (429) or a circuit breaker (fail fast) keeps a failure from spreading.
8. **Common mistake:** scaling on the wrong metric, sticky sessions blocking scale-in, or a cold-start spike.

## Simulator model (full size)
```js
init: () => ({ rps: 50, reqMs: 200, perInstance: 10, min: 1, max: 10, target: 0.6, startup: 8, algo: 'rr', dbLimit: 100, inst: [], stats: {...} })
// instance: { id, state: 'start'|'ready'|'down', inflight: 0, readyAt }
tick(s, dt, api):
  load = rps * reqMs/1000 (Little's law: concurrent requests); spread over ready instances (rr or least-conn)
  utilisation = load / (ready * perInstance); above target → add instances (respect max; each takes `startup` s)
  below target/2 for 30 s → remove one (respect min)
  load beyond capacity → queueing latency, then 503/429; db connections = instances * pool size > dbLimit → db errors
view(s): unit state ready/busy by utilisation; down for failed; start while booting; users badge = rps
```
- **Controls:** requests/s, time per request, concurrency per instance, min, max, target utilisation, startup time, LB algorithm. Actions: "Kill an instance", "Traffic spike ×5", "Slow down the DB".
- **Scenarios:**
  - **Morning ramp-up.**
  - **Sudden spike:** scaling lags behind, so errors appear.
  - **Raise min to absorb spikes.**
  - **Max too high → the database becomes the bottleneck.**
  - **An instance dies → health check → replaced.**
- **Metrics:** instances (ready/starting), utilisation %, p95 latency, errors/s, DB connections.

## Quiz angles
- Errors appear for 30 s at the start of a spike, then stop. Why, and how do you fix it?
- Adding instances made things worse. Why (shared database)?
- Which metric should you scale a queue worker on?
- What does a health check change, and what does it not change?

## Check in sources (don't guess)
Default concurrency, scaling metrics, cooldowns, health check intervals and instance limits are **product-specific**. Name the product and use its own docs.
