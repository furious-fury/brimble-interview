# Brimble — One-Page Deployment Pipeline

A minimal, end-to-end deployment pipeline: submit a project (Git URL or upload), build a container with [Railpack](https://github.com/railwayapp/railpack), run it locally, and expose it through a single Caddy ingress — all with real-time log streaming in one UI. Designed for **single-node** operation via `docker compose up`.

## Stack (target)

- **Frontend:** Vite, React, TanStack (Query, Router)
- **Backend:** Node.js, TypeScript, Express
- **Data:** SQLite (file-backed, mounted in Compose) via **Prisma 7** with `prisma.config.ts` and `@prisma/adapter-better-sqlite3`
- **Build:** Railpack
- **Runtime / ingress:** Docker + Caddy
- **Pipeline (Phase 3+):** In-process queue, validated status transitions (`pending` → `building` → `deploying` → `running` or `failed`); **Phase 4** runs **Railpack** against a per-deployment workspace (git clone or upload extract), streams build logs, tags `brimble/d-<id>:v1` on the host Docker, then cleans the workspace. Deploy and serve are still stubbed until later phases. Env `PIPELINE_STAGE_TIMEOUT_MS` and optional `pipelineEvents` for tests.

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
| `DELETE` | `/deployments/:id` | Delete deployment and logs (stopping containers is a later phase) |
| `GET` | `/deployments/:id/logs` | **SSE** log stream (events: `log`, `replay_done`, heartbeats) |

**Git** `source` must be `https://` or `http://` or `git@…`. For private **HTTPS** repos, set `GIT_TOKEN` in the environment (e.g. GitHub PAT; the backend injects it for `x-access-token` style URLs). `git@` uses SSH on the host and is only as reliable as your agent/socket setup in Docker.

**Uploads** are only created via `POST /api/deployments/upload` (not the JSON create route).

### Pipeline (build + deploy)

After create, the server enqueues a run: **build** uses **Railpack** (needs [BuildKit](https://docs.docker.com/build/buildkit/) via the mounted Docker socket), then **deploy** and **serve** are still **stubs** (placeholder `port` / `url`) until Phases 6–7.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIPELINE_STAGE_TIMEOUT_MS` | `120000` | Max time (ms) for each of build, deploy, and serve steps |
| `BRIMBLE_WORKSPACE` | `/data/work` in Compose; `${TMP}/brimble-work` on Windows without env | Per-deployment clone/extract and Railpack `cwd` |
| `RAILPACK_BIN` | `railpack` | Path to Railpack if not on `PATH` |
| `GIT_TOKEN` | (unset) | Optional token for private HTTPS git clones |

**Container health checks** (e.g. restart on crash) are **Phase 6**, not implemented in the pipeline orchestrator yet.

## Project layout

- `backend/` — TypeScript API and pipeline (future)
- `frontend/` — Vite + React app
- `caddy/` — Caddyfile and (later) shared config fragments for dynamic routes

## License

This repository is for interview / portfolio use unless otherwise stated.
