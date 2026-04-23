# Brimble — One-Page Deployment Pipeline

A minimal, end-to-end deployment pipeline: submit a project (Git URL or upload), build a container with [Railpack](https://github.com/railwayapp/railpack), run it locally, and expose it through a single Caddy ingress — all with real-time log streaming in one UI. Designed for **single-node** operation via `docker compose up`.

## Stack (target)

- **Frontend:** Vite, React, TanStack (Query, Router)
- **Backend:** Node.js, TypeScript, Express
- **Data:** SQLite (file-backed, mounted in Compose) via **Prisma 7** with `prisma.config.ts` and `@prisma/adapter-better-sqlite3`
- **Build:** Railpack (BuildKit)
- **Runtime / ingress:** Docker + Caddy
- **Pipeline (Phase 3+):** In-process queue, validated status transitions; **Phase 4** **Railpack**; **Phase 6** **dockerode** (host ports, runtime logs, health, teardown); **Phase 7** adds a Caddy vhost and writes `caddy/dynamic/<id>.caddy` so the stored **`url` is `http://<name>-<id>.<domain>`** on port **80** (e.g. `http://my-app-a1b2c3d4.localhost` when `CADDY_DYNAMIC_DIR` is set). If `CADDY_DYNAMIC_DIR` is missing, the pipeline falls back to `BRIMBLE_APP_PUBLIC_BASE:<port>`. Env `PIPELINE_BUILD_TIMEOUT_MS`, `PIPELINE_STAGE_TIMEOUT_MS`, and optional `pipelineEvents` for tests.

## Prerequisites

- Node.js 20+
- Docker Engine + Docker Compose v2
- Git

## Testing

- **Automated:** from `backend/`, run `npm test` (Vitest: pipeline transitions, request validation, HTTP API with a test SQLite DB and mocked pipeline queue / runtime teardown). No Docker required.
- **Manual / compose:** see [docs/TESTING.md](docs/TESTING.md) for optional `scripts/compose-validate.sh`, a manual E2E checklist, and notes on full-stack or Playwright-style checks.

## Local development (Docker)

From the repository root:

```bash
docker compose up --build
```

- App UI and API: **http://localhost** (Caddy on port 80; proxies `/api` to the API and other paths to the Vite dev server in development)
- Caddy admin API: **http://localhost:2019** (used by the backend in later phases for route updates; do not expose publicly)
- The API exposes `GET /api/health` for a quick health check

### BuildKit / Railpack (Docker)

Compose includes a **`buildkit`** service (`moby/buildkit`, **privileged**) with `container_name: buildkit`, listening on **TCP 1234** (for sibling containers like the backend) and the default **unix socket** (for `buildctl` defaults inside the BuildKit container). The backend sets **`BUILDKIT_HOST=tcp://buildkit:1234`** so Railpack can reach BuildKit (plain `docker-container://` from inside the backend often fails with “failed to get buildkit information”). If you change the backend base image (e.g. Alpine to Debian), you may still need to **recreate the `backend_node_modules` volume** so native modules match the new libc.

### Local registry (avoid `sending tarball`)

Some environments (notably WSL2 and small VMs) can hang during BuildKit’s **docker-load export** (`exporting… / sending tarball`). Compose includes a local Docker registry on **`127.0.0.1:5000`**. The pipeline pushes built images to the registry and then pulls by tag before starting the container. This avoids the tar-stream handoff.

Environment:

- `BRIMBLE_REGISTRY_PUSH_HOST` (default `registry:5000` inside Compose)
- `BRIMBLE_REGISTRY_PULL_HOST` (default `127.0.0.1:5000` for the Docker daemon)

## Local development (without Docker)

1. **Database (Phase 2):** From `backend/`, copy env and create the SQLite file:
   - `cp .env.example .env` (default `DATABASE_URL` is `file:./prisma/dev.db`)
   - Connection and migrations are configured in `prisma.config.ts` (Prisma 7).
   - `npx prisma generate && npx prisma migrate dev` (or `db:migrate` script; run after schema changes)
2. **API:** `cd backend && npm install && npm run dev` (listens on `http://127.0.0.1:3000` by default)
3. **UI:** `cd frontend && npm install && npm run dev` (Vite, typically `http://127.0.0.1:5173`)

In **Docker**, the backend uses a named volume at `/data` and `DATABASE_URL=file:/data/brimble.db`. The image entrypoint runs `prisma migrate deploy` before starting the dev server.

**Phase 7 check (manual):** With `docker compose up`, create a deployment; open the stored **`url`** in a browser (e.g. `http://my-app-xxxxxxxx.localhost` on port 80). The request should hit Caddy, which proxies to the app on the published host port. `GET /api/caddy/status` should show the admin ping. Deleting the deployment should remove the corresponding file under `caddy/dynamic/`.

## API (Phase 2)

Base path: `/api`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/deployments` | List deployments (optional `?limit=1-500`, default 100) |
| `POST` | `/deployments` | Create from **git** (JSON: `name`, `source` URL, optional `ref` branch/tag, default `main`) |
| `POST` | `/deployments/upload` | Create from **archive** (`multipart/form-data`: `name`, `file` — `.zip` or `.tar.gz` / `.tgz`, max 100MB) |
| `GET` | `/deployments/:id` | Get one deployment |
| `DELETE` | `/deployments/:id` | Stop log follow, remove Caddy snippet, stop/remove app container, release host port, delete deployment and logs |
| `GET` | `/deployments/:id/logs` | **SSE** log stream (events: `log`, `replay_done`, heartbeats) |

**Logs (SSE):** The server first replays the last **500** lines, or only lines **after** a known row with `GET /api/deployments/:id/logs?afterId=<cuid>` (use the `id` from a previous `log` event to avoid duplicating history on reconnect). `replay_done` includes `incremental: true` when `afterId` was used. Each `log` payload is a `LogEntry`-shaped object (`id`, `stage`, `level`, `message`, `timestamp` ISO string). Browsers’ `EventSource` reconnects automatically; if you do not pass `afterId`, you may see overlap—dedupe client-side on `id` or pass the last seen id as `afterId`. No server-side log retention or pruning: logs grow with usage; delete a deployment to remove its log rows (cascade).

**Git** `source` must be `https://` or `http://` or `git@…`. For private **HTTPS** repos, set `GIT_TOKEN` in the environment (e.g. GitHub PAT; the backend injects it for `x-access-token` style URLs). `git@` uses SSH on the host and is only as reliable as your agent/socket setup in Docker.

**Uploads** are only created via `POST /api/deployments/upload` (not the JSON create route).

### Pipeline (build + deploy + runtime)

After create, the server enqueues a run: **build** (Railpack + BuildKit) → **deploy** (container with published host port) → **serve** (writes a Caddy snippet: `host { reverse_proxy http://BRIMBLE_DOCKER_UPSTREAM_HOST:port }` and sets **`url`** to `http://<vhost>` when `CADDY_DYNAMIC_DIR` is set). **Runtime** logs use `stage: "runtime"`. A periodic **inspect** (`BRIMBLE_HEALTH_POLL_MS`) can mark a deployment **failed** if the container stops.

**Caddy** reaches the app via **`http://host.docker.internal:<hostPort>`** (default), because the app’s port is published on the **Docker host**, not on the Caddy network. Override with `BRIMBLE_DOCKER_UPSTREAM_HOST` if your setup differs. Without `CADDY_DYNAMIC_DIR`, **`url` falls back to** `BRIMBLE_APP_PUBLIC_BASE:<port>` (direct access, no vhost).

**Build timeouts:** A short per-stage cap breaks **first Railpack runs** (image pulls) and especially **`sending tarball`** (BuildKit → Docker), which on **WSL2 + Docker Desktop** can take **30+ minutes** with little log output. **`PIPELINE_BUILD_TIMEOUT_MS`** defaults to **60 minutes** in Compose and in code. Set it higher (e.g. `7200000` for 2h) if builds still time out. **`PIPELINE_STAGE_TIMEOUT_MS`** still applies to **deploy** and **serve** (2 minutes each). On build timeout, the server **sends SIGTERM to the `railpack` process**.

**Testing with Docker Desktop:** Ensure **Resources** (CPU/RAM/disk) are adequate and the disk is not full (`docker system df`). During a stuck `sending tarball`, run `docker stats` and confirm the **buildkit** container shows **block I/O** moving. To compare without Brimble, you can `docker compose exec backend sh` and in `/data/work/<id>/source` run `railpack build --name test:local .` (same slowness confirms I/O, not the app). For a fair speed test, use **Linux bare metal** or **Docker on Linux** without the WSL2 extra layer.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIPELINE_BUILD_TIMEOUT_MS` | `3600000` (60m) in Compose; `3600000` in code if unset | Max time (ms) for the **build** stage (clone, BuildKit, export/push) |
| `PIPELINE_STAGE_TIMEOUT_MS` | `120000` | Max time (ms) for each of **deploy** and **serve** |
| `BRIMBLE_WORKSPACE` | `/data/work` in Compose; `${TMP}/brimble-work` on Windows without env | Per-deployment clone/extract and Railpack `cwd` |
| `RAILPACK_BIN` | `railpack` | Path to Railpack if not on `PATH` |
| `BUILDKIT_HOST` | `tcp://buildkit:1234` in Compose | BuildKit gRPC (plain TCP) for Railpack; see BuildKit / Railpack above |
| `BRIMBLE_REGISTRY_PUSH_HOST` | `registry:5000` in Compose | Registry host used by the build (push) |
| `BRIMBLE_REGISTRY_PULL_HOST` | `127.0.0.1:5000` in Compose | Registry host used by the Docker daemon (pull) |
| `GIT_TOKEN` | (unset) | Optional token for private HTTPS git clones |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` (or Windows pipe) | API to Docker for deploy |
| `BRIMBLE_HOST_PORT_MIN` / `MAX` | `10000` / `11000` | Host port allocation range |
| `BRIMBLE_CONTAINER_PORT` | `3000` | In-container port the app listens on (map to a host port) |
| `BRIMBLE_HEALTH_POLL_MS` | `15000` | How often to `inspect` **running** containers |
| `BRIMBLE_APP_PUBLIC_BASE` | `http://localhost` | Fallback `url` when `CADDY_DYNAMIC_DIR` is unset (origin only; port appended) |
| `CADDY_DYNAMIC_DIR` / `CADDYFILE_PATH` | see `.env.example` | Required for Caddy vhosts; same paths in backend + Caddy containers |
| `BRIMBLE_APPS_BASE_DOMAIN` | `localhost` | Right-hand side of the app host (`<slug>-<id8>.<domain>`) |
| `BRIMBLE_DOCKER_UPSTREAM_HOST` | `host.docker.internal` | Where Caddy should send traffic (host-mapped app port) |

## Project layout

- `backend/` — TypeScript API and pipeline (future)
- `frontend/` — Vite + React app
- `caddy/` — Caddyfile and per-deployment `dynamic/*.caddy` snippets (written by the backend in Phase 7)

## License

This repository is for interview / portfolio use unless otherwise stated.
