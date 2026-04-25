# Brimble — One-Page Deployment Pipeline

A minimal, end-to-end deployment pipeline: submit a project (Git URL or upload), build a container with [Railpack](https://github.com/railwayapp/railpack), run it locally, and expose it through a single Caddy ingress — all with real-time log streaming in one UI. Designed for **single-node** operation via `docker compose up`.

## Overview

This is a minimal, single-node deployment platform inspired by modern PaaS architecture.

It accepts a Git repository or uploaded project, builds it into a container using Railpack (auto-detects languages without Dockerfiles), runs it locally via Docker, and exposes it through Caddy — all orchestrated through a single UI with real-time log streaming.

The system is intentionally designed to be **simple, observable, and reliable**, prioritizing clear pipeline stages and real-time feedback over horizontal scalability.

## Quick Start

```bash
docker compose up --build
```

Access the UI at **http://localhost** (Caddy on port 80; proxies `/api` to the API and other paths to the Vite dev server).

## Architecture

```
User → Caddy (:80) → Frontend (Vite) + Backend API (Express)
                            ↓
                      Pipeline Queue (in-memory)
                            ↓
            ┌───────────────┼───────────────┐
            ↓               ↓               ↓
        BuildKit      Local Registry    Docker Runtime
        (Railpack)    (push/pull)       (containers)
                            ↓
                        SQLite (Prisma)
```

**Key Flow:**
1. User submits project → Backend queues job
2. Pipeline clones/extracts source → BuildKit builds image → Push to local registry
3. Docker pulls and runs container → Caddy routes traffic via dynamic vhost
4. Real-time logs stream via SSE throughout

## Tradeoffs & Design Decisions

| Decision | Chosen Approach | Rationale | Tradeoff |
|----------|----------------|-----------|----------|
| **Architecture** | Single-node | Reduced complexity, fully observable, debuggable; matches JD constraint | Not horizontally scalable |
| **Job Queue** | In-memory (`async` library) | Zero infrastructure; `async` provides backpressure | Limited to one worker process |
| **Database** | SQLite file-backed | Zero setup, easy backups; no distributed deps | No concurrent write scaling |
| **Routing** | Caddy file-based vhosts | Simple, debuggable; backend writes files, no API calls | Doesn't scale to 1000s of apps |
| **Build Output** | Local registry push/pull | Avoids BuildKit tarball hangs (see Challenges) | Requires registry container |
| **Log Streaming** | SSE over WebSockets | Native reconnect with `Last-Event-ID`, HTTP-compatible, no handshake overhead | Not ideal for bi-directional |
| **Builder** | Railpack + BuildKit | Auto-detects languages (Node/Python/Go), no Dockerfiles | Adds complexity over simple Docker builds |
| **DNS** | nip.io wildcard | `*.IP.nip.io` resolves to IP; zero DNS config for any IP | Dependency on external service |

## Notable Challenges

### BuildKit Image Export Bottleneck

**Problem:** BuildKit's default `docker-export` (sending tarball to Docker daemon) caused **30+ minute hangs** on both WSL2 and EC2 environments, with no visible progress or error messages.

**Investigation:**
- Confirmed via `docker stats` that the buildkit container had active block I/O
- Docker daemon showed no data reception
- Issue reproduced consistently across Windows WSL2 and Ubuntu EC2
- Isolated to BuildKit's tar-stream export, not network or disk speed

**Resolution:** Replaced direct export with **push-to-registry pattern**:
1. BuildKit pushes to local registry (`registry:5000`)
2. Docker daemon pulls from host loopback (`127.0.0.1:5001`)
3. Eliminates tar-stream bottleneck entirely

**Result:** Build stage now completes reliably in 2-5 minutes vs. indefinite hangs.

**Why this matters:** This was the difference between a working demo and a broken pipeline. The fix required understanding BuildKit's internals and Docker's registry protocol.

### Build Robustness: Framework-Aware Auto-Detection & Validation

**Problem:** Frameworks have different build modes (static vs server). Projects configured for static hosting (Netlify/Vercel) crash in containers because they produce HTML files instead of server runtimes.

**Solution: Two-layer robustness for multiple frameworks**

1. **Pre-build Auto-Fix** (Framework-aware):
   - **Next.js**: Detects `output: 'export'`, auto-removes to enable server mode
   - **SvelteKit**: Detects `@sveltejs/adapter-static`, warns to use `adapter-node`
   - **Nuxt**: Detects `nitro: { preset: 'static' }`, warns about container incompatibility
   - All fixes create backups and revert after build

2. **Post-build Validation** (Framework-specific):
   - **Next.js**: Verifies `.next/` directory with server files
   - **SvelteKit**: Checks `.svelte-kit/output` or `build/` exists
   - **Nuxt**: Confirms `.output/` directory present
   - Fails fast with clear framework-specific error messages

**Result:** Users get actionable errors immediately instead of mysterious runtime crashes. No wasted build time on configurations that can't work in containers.

**Examples:**
```
⚠️ Detected Next.js 'output: "export"' mode. This creates static HTML files
incompatible with containerized deployment.
🔧 Auto-fixing next.config.js: temporarily removing 'output: "export"' for
containerized build

⚠️ Detected SvelteKit with static adapter. This creates static HTML files.
Use '@sveltejs/adapter-node' for containerized server deployment.
```

## Stack

- **Frontend:** Vite, React, TanStack (Query, Router)
- **Backend:** Node.js, TypeScript, Express, **Pino** (structured logging)
- **Data:** SQLite (file-backed, mounted in Compose) via **Prisma 7** with `prisma.config.ts` and `@prisma/adapter-better-sqlite3`
- **Build:** Railpack (BuildKit)
- **Runtime / ingress:** Docker + Caddy
- **Pipeline:** In-process queue with validated status transitions; builds with Railpack + BuildKit; deploys containers with dockerode (host port allocation, runtime log streaming, health polling, teardown); writes Caddy vhost snippets to `caddy/dynamic/<id>.caddy` so deployed apps get URLs like `http://<name>-<id>.<domain>` on port **80** (e.g., `http://my-app-a1b2c3d4.localhost`). Configurable via `PIPELINE_BUILD_TIMEOUT_MS` (default 60m for Railpack image pulls), `PIPELINE_STAGE_TIMEOUT_MS` (2m for deploy/serve), and optional `pipelineEvents` for testing.

### Code Organization Patterns

**Backend:**
- **Structured Logging:** All code uses Pino via `src/config/logger.ts` - no `console.*` calls
- **Constants:** Non-configurable values (timeouts, limits, buffer sizes) in `src/config/constants.ts`
- **Pipeline Extraction:** Framework detection (`frameworkCheckers.ts`) and build validation (`buildValidation.ts`) are separate modules
- **Function Size:** All functions under 50 lines through extraction and composition

**Frontend:**
- **Custom Hooks:** SSE log streaming encapsulated in `useLogStream.ts`
- **Component Extraction:** LogViewer broken into `LogFilterButtons`, `ConnectionStatusBadge`, `LogEntryRow`, `LogTerminal`, `BuildTimer`
- **Form Components:** Branch selection extracted to `BranchCombobox` with git auto-detection
- **Modal Components:** Confirmation modals are standalone (`DeleteDeploymentModal`, `RedeployModal`)
- **Component Size:** All components under 50 lines through single-responsibility extraction

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

**Pipeline Stages:** `pending` → `building` (clone, Railpack, BuildKit) → `deploying` (allocate port, start container) → `running` (Caddy vhost active, health polling). On failure: `failed`. Runtime logs stream with `stage: "runtime"`. Health checks every `BRIMBLE_HEALTH_POLL_MS` (15s) auto-mark stopped containers as failed.

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

**nip.io wildcard DNS:** Using `<YOUR_PUBLIC_IP>.nip.io` gives you automatic subdomains without DNS setup (e.g., `my-app-12345678.203.0.113.45.nip.io` resolves to `203.0.113.45`).

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
- ✅ ~~Structured logging (JSON) with correlation IDs across pipeline stages~~ **DONE (Phase 10)**
- Prometheus metrics: build duration, deploy success rate, queue depth
- Distributed tracing: OpenTelemetry spans from API → pipeline → Docker

**Production readiness**
- HTTPS with Let's Encrypt (Caddy handles this, but needs public DNS)
- Database backups: Automated SQLite → S3 snapshots or Postgres WAL archiving
- Graceful shutdown: Drain queue, finish in-progress builds before restart

## Testing

- **Automated:** from `backend/`, run `npm test` (Vitest: pipeline transitions, request validation, HTTP API with a test SQLite DB and mocked pipeline queue / runtime teardown). No Docker required.
- **Manual / compose:** see [docs/TESTING.md](docs/TESTING.md) for optional `scripts/compose-validate.sh`, a manual E2E checklist, and notes on full-stack or Playwright-style checks.

## Project Layout

- `backend/` — Node.js/Express API, pipeline orchestration, Prisma database layer
- `frontend/` — Vite + React + TanStack (Query, Router) single-page UI
- `caddy/` — Reverse proxy configuration and per-deployment route snippets (`dynamic/*.caddy`)
- `buildkit/` — BuildKit daemon configuration (`.toml` for build settings)

## License

This repository is for interview / portfolio use unless otherwise stated.
