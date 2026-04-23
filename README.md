# Brimble — One-Page Deployment Pipeline

A minimal, end-to-end deployment pipeline: submit a project (Git URL or upload), build a container with [Railpack](https://github.com/railwayapp/railpack), run it locally, and expose it through a single Caddy ingress — all with real-time log streaming in one UI. Designed for **single-node** operation via `docker compose up`.

## Stack (target)

- **Frontend:** Vite, React, TanStack (Query, Router)
- **Backend:** Node.js, TypeScript, Express
- **Data:** SQLite (file-backed, mounted in Compose) via **Prisma 7** with `prisma.config.ts` and `@prisma/adapter-better-sqlite3`
- **Build:** Railpack (BuildKit)
- **Runtime / ingress:** Docker + Caddy
- **Pipeline:** In-process queue with validated status transitions; builds with Railpack + BuildKit; deploys containers with dockerode (host port allocation, runtime log streaming, health polling, teardown); writes Caddy vhost snippets to `caddy/dynamic/<id>.caddy` so deployed apps get URLs like `http://<name>-<id>.<domain>` on port **80** (e.g., `http://my-app-a1b2c3d4.localhost`). Configurable via `PIPELINE_BUILD_TIMEOUT_MS` (default 60m for Railpack image pulls), `PIPELINE_STAGE_TIMEOUT_MS` (2m for deploy/serve), and optional `pipelineEvents` for testing.

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
- Caddy admin API: **http://localhost:2019** (used by the backend for dynamic route updates; do not expose publicly)
- The API exposes `GET /api/health` for a quick health check

### BuildKit / Railpack (Docker)

Compose includes a **`buildkit`** service (`moby/buildkit`, **privileged**) with `container_name: buildkit`, listening on **TCP 1234** (for sibling containers like the backend) and the default **unix socket** (for `buildctl` defaults inside the BuildKit container). The backend sets **`BUILDKIT_HOST=tcp://buildkit:1234`** so Railpack can reach BuildKit (plain `docker-container://` from inside the backend often fails with “failed to get buildkit information”). If you change the backend base image (e.g. Alpine to Debian), you may still need to **recreate the `backend_node_modules` volume** so native modules match the new libc.

### Local registry (avoid `sending tarball`)

Some environments (notably WSL2 and small VMs) can hang during BuildKit’s **docker-load export** (`exporting… / sending tarball`). Compose includes a local Docker registry on **`127.0.0.1:5001`** (avoids conflicts with WSL2/Windows services on port 5000). The pipeline pushes built images to the registry and then pulls by tag before starting the container. This avoids the tar-stream handoff.

Environment:

- `BRIMBLE_REGISTRY_PUSH_HOST` (default `registry:5000` inside Compose)
- `BRIMBLE_REGISTRY_PULL_HOST` (default `127.0.0.1:5001` for the Docker daemon)

## Testing deployment routing

With `docker compose up`, create a deployment; open the stored **`url`** in a browser (e.g. `http://my-app-xxxxxxxx.localhost` on port 80). The request should hit Caddy, which proxies to the app on the published host port. `GET /api/caddy/status` should show the admin ping. Deleting the deployment should remove the corresponding file under `caddy/dynamic/`.

## API

Base path: `/api`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/deployments` | List deployments (`?limit=1-500`, default 100) |
| `POST` | `/deployments` | Create from git (JSON: `name`, `source`, `ref?`, `envVars?`) |
| `POST` | `/deployments/upload` | Create from ZIP/tar.gz archive (`multipart/form-data`, max 100MB) |
| `GET` | `/deployments/:id` | Get deployment details |
| `POST` | `/deployments/:id/redeploy` | Destroy runtime, clear logs, rebuild & redeploy |
| `DELETE` | `/deployments/:id` | Stop container, remove Caddy route, delete logs & record |
| `GET` | `/deployments/:id/logs` | **SSE** log stream (replay last 500, then live) |
| `GET` | `/repos/branches?url=` | List git branches for a repository |

**Log Streaming (SSE):** `GET /api/deployments/:id/logs` opens an EventSource. The server replays the last 500 logs, then streams new ones. Use `?afterId=<cuid>` to resume without duplicates. Events: `log` (payload: `{id, stage, level, message, timestamp}`), `replay_done`, `logs_cleared` (on redeploy), and heartbeats. No server-side log pruning—delete the deployment to clear logs.

**Pipeline Stages:** `pending` → `building` (clone, Railpack, BuildKit) → `deploying` (allocate port, start container) → `running` (Caddy vhost active, health polling). On failure: `failed`. Runtime logs stream with `stage: "runtime"`. Health checks every `BRIMBLE_HEALTH_POLL_MS` (15s) auto-mark stopped containers as failed.

**Git Sources:** HTTPS (`https://`), HTTP (`http://`), or SSH (`git@`). For private HTTPS repos, set `GIT_TOKEN` (GitHub PAT) for `x-access-token` style auth. SSH depends on host agent/socket setup in Docker.

**URLs:** Deployed apps get `http://<slug>-<id8>.<domain>` (e.g., `my-app-a1b2c3d4.localhost`) on port 80. Caddy proxies to `host.docker.internal:<hostPort>` (the published host port). Without `CADDY_DYNAMIC_DIR`, falls back to `BRIMBLE_APP_PUBLIC_BASE:<port>`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIPELINE_BUILD_TIMEOUT_MS` | `3600000` (60m) | Build stage timeout (ms) — Railpack image pulls can be slow |
| `PIPELINE_STAGE_TIMEOUT_MS` | `120000` (2m) | Deploy/serve stage timeout (ms) |
| `BRIMBLE_WORKSPACE` | `/data/work` | Clone/extract directory and Railpack working dir |
| `BUILDKIT_HOST` | `tcp://buildkit:1234` | BuildKit gRPC endpoint |
| `BRIMBLE_REGISTRY_PUSH_HOST` | `registry:5000` | Registry for image push (internal Docker network) |
| `BRIMBLE_REGISTRY_PULL_HOST` | `127.0.0.1:5001` | Registry for image pull (host loopback) |
| `BRIMBLE_HOST_PORT_MIN/MAX` | `10000/11000` | Host port range for deployed app containers |
| `BRIMBLE_HEALTH_POLL_MS` | `15000` | Container health check interval (ms) |
| `CADDY_DYNAMIC_DIR` | `/etc/caddy/dynamic` | Where Caddy vhost snippets are written |
| `BRIMBLE_APPS_BASE_DOMAIN` | `localhost` | Domain for deployed apps (`*.domain`) |
| `CORS_ORIGIN` | `http://localhost` | Allowed API origins (comma-separated) |
| `GIT_TOKEN` | — | GitHub PAT for private HTTPS repos |

## Cloud Deployment

To deploy on a cloud server:

```bash
# 1. Configure backend environment
cd backend
cp .env.example .env

# 2. Edit .env and set your public IP (replace <YOUR_PUBLIC_IP> with your actual IP):
#   CORS_ORIGIN=http://<YOUR_PUBLIC_IP>,http://localhost
#   BRIMBLE_APPS_BASE_DOMAIN=<YOUR_PUBLIC_IP>.nip.io
#   BRIMBLE_APP_PUBLIC_BASE=http://<YOUR_PUBLIC_IP>

# 3. Start services
cd ..
docker compose up -d --build
```

Access the UI at `http://your-public-ip`. All other configuration variables use sensible defaults from `backend/.env.example`.

## Design Decisions

Why I built it this way:

**Server-Sent Events (SSE) instead of WebSockets**
- Logs are a one-way stream (server → client)
- SSE auto-reconnects with `Last-Event-ID`, making resume seamless
- No WebSocket handshake overhead; works through standard HTTP proxies
- Browser's `EventSource` handles reconnects and buffering natively

**BuildKit + Railpack for container builds**
- Railpack auto-detects languages (Node, Python, Go, etc.) without Dockerfiles
- BuildKit builds run in isolated, privileged containers—not the host
- TCP connection (`tcp://buildkit:1234`) avoids socket permission issues inside containers

**Local registry to avoid "sending tarball" hang**
- BuildKit can export directly to Docker daemon, but on WSL2/Docker Desktop this stalls for 30+ minutes
- I push to a local registry (`127.0.0.1:5001`) and pull by tag instead
- Eliminates the tar-stream bottleneck completely

**SQLite + Prisma 7 for persistence**
- Single-node constraint means no need for distributed PostgreSQL
- File-backed database simplifies backups and local development

**Caddy dynamic vhosts + nip.io for zero-config DNS**
- **nip.io** is a wildcard DNS service: `*.<YOUR_PUBLIC_IP>.nip.io` resolves to `<YOUR_PUBLIC_IP>`
- No DNS setup needed—any IP works immediately (e.g., `app-123.<YOUR_PUBLIC_IP>.nip.io` → `<YOUR_PUBLIC_IP>`)
- Caddy watches `caddy/dynamic/*.caddy` files and reloads automatically
- Backend writes vhost snippets to shared volume, no API calls needed

**In-memory job queue (not Redis)**
- Single-node deployment: one worker process is sufficient
- `async` library queue provides backpressure and sequential processing
- Zero additional infrastructure (no Redis container)

## Future Improvements

Given another weekend, I would add:

**Multi-node scaling**
- Replace in-memory queue with Redis + worker pool for horizontal scaling
- Registry migration: ECR/Docker Hub for multi-node image access
- SQLite → PostgreSQL with connection pooling for concurrent workers

**Security hardening**
- Per-deployment network isolation (Docker networks instead of default bridge)
- Resource quotas: CPU/memory limits and container OOM handling
- Secret management: encrypted env var storage with at-rest encryption (never log secrets to build output)

**Developer experience**
- Webhook auto-deploy: GitHub/GitLab → trigger redeploy on push
- Build caching: Persistent layer cache volumes to speed up repeat builds
- Preview environments: Branch-based deployments with automatic cleanup
- Deployment rollbacks: Keep last N images, instant revert to previous version

**Observability**
- Structured logging (JSON) with correlation IDs across pipeline stages
- Prometheus metrics: build duration, deploy success rate, queue depth
- Distributed tracing: OpenTelemetry spans from API → pipeline → Docker

**Production readiness**
- HTTPS with Let's Encrypt (Caddy handles this, but needs public DNS)
- Database backups: Automated SQLite → S3 snapshots or Postgres WAL archiving
- Graceful shutdown: Drain queue, finish in-progress builds before restart

## Project layout

- `backend/` — Node.js/Express API, pipeline orchestration, Prisma database layer
- `frontend/` — Vite + React + TanStack (Query, Router) single-page UI
- `caddy/` — Reverse proxy configuration and per-deployment route snippets (`dynamic/*.caddy`)
- `buildkit/` — BuildKit daemon configuration (`.toml` for build settings) 

## License

This repository is for interview / portfolio use unless otherwise stated.
