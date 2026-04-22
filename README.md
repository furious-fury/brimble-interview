# Brimble — One-Page Deployment Pipeline

A minimal, end-to-end deployment pipeline: submit a project (Git URL or upload), build a container with [Railpack](https://github.com/railwayapp/railpack), run it locally, and expose it through a single Caddy ingress — all with real-time log streaming in one UI. Designed for **single-node** operation via `docker compose up`.

## Stack (target)

- **Frontend:** Vite, React, TanStack (Query, Router)
- **Backend:** Node.js, TypeScript, Express
- **Data:** SQLite (file-backed, mounted in Compose) via **Prisma 7** with `prisma.config.ts` and `@prisma/adapter-better-sqlite3`
- **Build:** Railpack
- **Runtime / ingress:** Docker + Caddy
- **Pipeline (Phase 3+):** In-process queue, validated status transitions (`pending` → `building` → `deploying` → `running` or `failed`); **Phase 4** runs **Railpack**; **Phase 6** uses **dockerode** to start the built image with a host port in a configurable range, stream **runtime** logs to the same log API, poll `docker inspect` for unexpected exit, and remove the container on `DELETE` or failure. `url` is `BRIMBLE_APP_PUBLIC_BASE:port` (default `http://localhost:<port>`) until **Phase 7** Caddy. Env `PIPELINE_STAGE_TIMEOUT_MS` and optional `pipelineEvents` for tests.

## Prerequisites

- Node.js 20+
- Docker Engine + Docker Compose v2
- Git

## Local development (Docker)

From the repository root:

```bash
docker compose up --build
```

- App UI and API: **http://localhost** (Caddy on port 80; proxies `/api` to the API and other paths to the Vite dev server in development)
- Caddy admin API: **http://localhost:2019** (used by the backend in later phases for route updates; do not expose publicly)
- The API exposes `GET /api/health` for a quick health check

## Local development (without Docker)

1. **Database (Phase 2):** From `backend/`, copy env and create the SQLite file:
   - `cp .env.example .env` (default `DATABASE_URL` is `file:./prisma/dev.db`)
   - Connection and migrations are configured in `prisma.config.ts` (Prisma 7).
   - `npx prisma generate && npx prisma migrate dev` (or `db:migrate` script; run after schema changes)
2. **API:** `cd backend && npm install && npm run dev` (listens on `http://127.0.0.1:3000` by default)
3. **UI:** `cd frontend && npm install && npm run dev` (Vite, typically `http://127.0.0.1:5173`)

In **Docker**, the backend uses a named volume at `/data` and `DATABASE_URL=file:/data/brimble.db`. The image entrypoint runs `prisma migrate deploy` before starting the dev server.

## API (Phase 2)

Base path: `/api`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/deployments` | List deployments (optional `?limit=1-500`, default 100) |
| `POST` | `/deployments` | Create from **git** (JSON: `name`, `source` URL, optional `ref` branch/tag, default `main`) |
| `POST` | `/deployments/upload` | Create from **archive** (`multipart/form-data`: `name`, `file` — `.zip` or `.tar.gz` / `.tgz`, max 100MB) |
| `GET` | `/deployments/:id` | Get one deployment |
| `DELETE` | `/deployments/:id` | Stop log follow, stop/remove app container, release host port, delete deployment and logs |
| `GET` | `/deployments/:id/logs` | **SSE** log stream (events: `log`, `replay_done`, heartbeats) |

**Logs (SSE):** The server first replays the last **500** lines, or only lines **after** a known row with `GET /api/deployments/:id/logs?afterId=<cuid>` (use the `id` from a previous `log` event to avoid duplicating history on reconnect). `replay_done` includes `incremental: true` when `afterId` was used. Each `log` payload is a `LogEntry`-shaped object (`id`, `stage`, `level`, `message`, `timestamp` ISO string). Browsers’ `EventSource` reconnects automatically; if you do not pass `afterId`, you may see overlap—dedupe client-side on `id` or pass the last seen id as `afterId`. No server-side log retention or pruning: logs grow with usage; delete a deployment to remove its log rows (cascade).

**Git** `source` must be `https://` or `http://` or `git@…`. For private **HTTPS** repos, set `GIT_TOKEN` in the environment (e.g. GitHub PAT; the backend injects it for `x-access-token` style URLs). `git@` uses SSH on the host and is only as reliable as your agent/socket setup in Docker.

**Uploads** are only created via `POST /api/deployments/upload` (not the JSON create route).

### Pipeline (build + deploy + runtime)

After create, the server enqueues a run: **build** uses **Railpack** (needs [BuildKit](https://docs.docker.com/build/buildkit/) via the mounted Docker socket), then **deploy** runs the image with **dockerode**, publishes **one** container port (default app port **3000** in the image, override `BRIMBLE_CONTAINER_PORT` if your stack listens elsewhere) to a free host port in **BRIMBLE_HOST_PORT_MIN**–**MAX** (default 10000–11000, reconciled from running labeled containers on startup), then **serve** sets `url` and status **`running`**. **Runtime** stdout/stderr is appended with `stage: "runtime"`. A periodic **inspect** (default `BRIMBLE_HEALTH_POLL_MS` 15000) marks the deployment **failed** if the container stops or disappears.

**From the backend container**, the host-published port is reachable as **`http://host.docker.internal:<port>`** on Docker Desktop, not as `127.0.0.1` inside the same container. The stored `url` is for browsers on the **host** (`http://localhost:<port>` by default via `BRIMBLE_APP_PUBLIC_BASE`).

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIPELINE_STAGE_TIMEOUT_MS` | `120000` | Max time (ms) for each of build, deploy, and serve steps |
| `BRIMBLE_WORKSPACE` | `/data/work` in Compose; `${TMP}/brimble-work` on Windows without env | Per-deployment clone/extract and Railpack `cwd` |
| `RAILPACK_BIN` | `railpack` | Path to Railpack if not on `PATH` |
| `GIT_TOKEN` | (unset) | Optional token for private HTTPS git clones |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` (or Windows pipe) | API to Docker for deploy |
| `BRIMBLE_HOST_PORT_MIN` / `MAX` | `10000` / `11000` | Host port allocation range |
| `BRIMBLE_CONTAINER_PORT` | `3000` | In-container port the app listens on (map to a host port) |
| `BRIMBLE_HEALTH_POLL_MS` | `15000` | How often to `inspect` **running** containers |
| `BRIMBLE_APP_PUBLIC_BASE` | `http://localhost` | Origin in stored `url` (no path; port appended) |

## Project layout

- `backend/` — TypeScript API and pipeline (future)
- `frontend/` — Vite + React app
- `caddy/` — Caddyfile and (later) shared config fragments for dynamic routes

## License

This repository is for interview / portfolio use unless otherwise stated.
