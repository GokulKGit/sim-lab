# Pattern: build → artifact → run

**Use for:** Docker images and containers, CI/CD pipelines, compilers and bundlers, Kubernetes deployments, serverless deploys. Source becomes a **built artifact**, gets stored, and then runs as one or more **instances**.

## Diagram (820×430)
| id | kind | x, y | note |
|---|---|---|---|
| `dev` | actor | 90, 120 | developer or CI trigger |
| `build` | svc | 300, 120 | builder (docker build, CI runner) |
| `reg` | store | 520, 120 | registry/artifact store |
| `host` | svc | 300, 320 | machine or cluster that runs it |
| `r1`…`rN` | unit | `L.layoutGrid(n, {x: 440, y: 250, w: 360})` | running instances or containers |
| layers | unit | a column of units at x 300, y 60–200 | only in the layer-cache steps |

## Tour outline (7–10 steps)
1. **The recipe:** each instruction in the build file (for example, each `Dockerfile` line) and what it produces. Show 4–6 lines in `<code>`.
2. **Layers and cache:** each step is a layer, cached until something above it changes. Show layer units with states `ready` (cached) vs `start` (rebuilding).
3. **Common mistake:** `COPY . .` before installing dependencies means every code change reinstalls everything. Fix it by copying the manifest first.
4. **Tag vs digest:** a tag (`:latest`, `:v2`) can move; a digest (`@sha256:…`) can't. Push to the registry.
5. **Run:** the host pulls the image and starts an instance with its own writable layer. Unit states go `cold`, `start`, `ready`.
6. **Ports and networking:** the app listens inside, and must be published or mapped to be reachable.
7. **Data:** a container's writable layer disappears with it; volumes keep data.
8. **Lifecycle:** the main process exits, so the container stops; restart policies; health checks.
9. **Rolling out a new version:** instances are replaced one by one (optional; links to the scaling pattern).

## Simulator model (full size)
```js
init: () => ({ files: { 'package.json': 1, 'src/app.js': 1 }, dockerfile: 'good'|'bad', layers: [...], images: [{ tag: 'v1', digest }], containers: [], volume: false, data: 0 })
// layers: [{ cmd: 'FROM node:20', key }, { cmd: 'COPY package.json .', key }, { cmd: 'RUN npm ci', key }, { cmd: 'COPY . .', key }]
// build: a layer is rebuilt if its input changed or any layer above it was rebuilt; the log says "CACHED" or "RUN … 38s"
// containers: [{ id, image, state: 'running'|'exited', port, data }]; tick: running containers serve; an exited one restarts if policy allows
```
- **Controls:** Dockerfile order (good/bad), restart policy (`no`, `on-failure`, `always`), volume on/off, publish port on/off. Actions: "Edit src/app.js", "Edit package.json", "Build", "Run", "Crash the process", "Remove container".
- **Scenarios:**
  - **A one-line code change, bad order:** slow rebuild.
  - **The same change, good order:** cached.
  - **Container crashes with restart: no**, then **with restart: always.**
  - **Data lost without a volume.**
- **Metrics:** build time, cached layers, image size (approx), running containers, restarts.
- **CLI:** `docker build -t app:v2 .`, `docker images`, `docker run -d -p 8080:3000 --name web app:v2`, `docker ps`, `docker ps -a`, `docker logs web`, `docker stop web`, `docker rm web`, `docker run -d -v data:/data app:v2`.
  - Set `boolFlags: ['d', 'a', 'rm', 'it']`.
  - Print realistic tables with `L.table`.

## Quiz angles
- Why did a one-line change rebuild everything?
- Why did the data disappear?
- The container exits immediately. Why?
- The page can't be reached on localhost even though the app listens on 3000. Why?
- Why deploy by digest and not by tag?

## Check in sources (don't guess)
- Cache rules (Docker build cache docs).
- Flag names.
- Restart policy names.
- Which instructions create layers.
- Exact default behaviours of the tool you name.
