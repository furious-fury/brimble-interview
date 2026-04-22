# Brimble — One-Page Deployment Pipeline

A minimal, end-to-end deployment pipeline: submit a project (Git URL or upload), build a container with [Railpack](https://github.com/railwayapp/railpack), run it locally, and expose it through a single Caddy ingress — all with real-time log streaming in one UI. Designed for **single-node** operation via `docker compose up` (see [PRD.md](PRD.md)).

## Stack (target)

- **Frontend:** Vite, React, TanStack (Query, Router)
- **Backend:** Node.js, TypeScript, Express
- **Data:** SQLite (file-backed, mounted in Compose)
- **Build:** Railpack
- **Runtime / ingress:** Docker + Caddy

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

- **API:** `cd backend && npm install && npm run dev` (listens on `http://127.0.0.1:3000` by default)
- **UI:** `cd frontend && npm install && npm run dev` (Vite, typically `http://127.0.0.1:5173`)

## Project layout

- `backend/` — TypeScript API and pipeline (future)
- `frontend/` — Vite + React app
- `caddy/` — Caddyfile and (later) shared config fragments for dynamic routes

## License

This repository is for interview / portfolio use unless otherwise stated.
