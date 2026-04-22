# Brimble — One-Page Deployment Pipeline

A minimal, end-to-end deployment pipeline: submit a project (Git URL or upload), build a container with [Railpack](https://github.com/railwayapp/railpack), run it locally, and expose it through a single Caddy ingress — all with real-time log streaming in one UI. Designed for **single-node** operation via `docker compose up`.

## Stack (target)

- **Frontend:** Vite, React, TanStack (Query, Router)
- **Backend:** Node.js, TypeScript, Express
- **Data:** SQLite (file-backed, mounted in Compose) via **Prisma 7** with `prisma.config.ts` and `@prisma/adapter-better-sqlite3`
- **Build:** Railpack
- **Runtime / ingress:** Docker + Caddy
- **Pipeline (Phase 3):** In-process queue, validated status transitions (`pending` → `building` → `deploying` → `running` or `failed`), stub build/deploy/serve until Phases 4–7; optional `pipelineEvents` for tests; env `PIPELINE_STAGE_TIMEOUT_MS` for per-stage timeouts

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
| `POST` | `/deployments` | Create deployment (JSON: `name`, `sourceType` `git` \| `upload`, `source`) |
| `GET` | `/deployments/:id` | Get one deployment |
| `DELETE` | `/deployments/:id` | Delete deployment and logs (stopping containers is a later phase) |
| `GET` | `/deployments/:id/logs` | **SSE** log stream (events: `log`, `replay_done`, heartbeats) |

`sourceType: "upload"` is accepted and stored; **file uploads** are implemented in a later phase (same field is used for a placeholder path or label until then).

`sourceType: "git"` requires an `http(s)://` or `git@` URL in `source`.

### Pipeline (Phase 3)

After `POST /api/deployments`, the server enqueues a background run that (with current stubs) updates status through to `running` and sets placeholder `imageTag`, `port`, `url`. **Railpack, real Docker, and Caddy** replace the stubs in later phases.

| Variable | Default | Purpose |
|----------|---------|---------|
| `PIPELINE_STAGE_TIMEOUT_MS` | `120000` | Max time (ms) for each of build, deploy, and serve steps |

**Container health checks** (e.g. restart on crash) are **Phase 6**, not implemented in the Phase 3 orchestrator.

## Project layout

- `backend/` — TypeScript API and pipeline (future)
- `frontend/` — Vite + React app
- `caddy/` — Caddyfile and (later) shared config fragments for dynamic routes

## License

This repository is for interview / portfolio use unless otherwise stated.
