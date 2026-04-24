# Brimble Technical Walkthrough

## Project Overview

Brimble is a minimal, single-node deployment pipeline that allows users to:
- Submit projects via Git URL or file upload
- Build container images using Railpack + BuildKit
- Run containers locally via Docker
- Expose deployments through Caddy reverse proxy
- Stream real-time logs via Server-Sent Events (SSE)

**Architecture:** Single-node, Docker Compose orchestrated
**Key Design Principle:** Simplicity over scalability

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Request                          │
│                    (Browser/API Client)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Caddy (Port 80)                          │
│              - Static UI (Vite dev server)                  │
│              - API proxy (/api/* → backend:3000)           │
│              - Dynamic vhosts for deployed apps             │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│   Frontend   │      │     Backend      │
│  (Vite+React)│      │   (Node/Express) │
│              │      │                  │
│  - React UI  │      │  - REST API      │
│  - TanStack  │      │  - Pipeline      │
│    (Query,   │      │  - Docker mgmt   │
│     Router)  │      │  - Caddy routes  │
└──────────────┘      └────────┬─────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   SQLite    │      │  BuildKit   │      │    Docker   │
│  (Prisma 7) │      │   (Railpack)│      │  (Runtime)  │
│             │      │             │      │             │
│ Deployments │      │ - Clone git │      │ - Run       │
│ Logs        │      │ - Build     │      │ - Port      │
│             │      │   images    │      │   mapping   │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## Backend Architecture (Node.js/Express)

### Directory Structure

```
backend/
├── src/
│   ├── app.ts                    # Express app factory (no listen)
│   ├── index.ts                  # Entry point with server start
│   ├── db/
│   │   └── prisma.ts             # Prisma client singleton
│   ├── generated/
│   │   └── prisma/               # Generated Prisma client (v7)
│   ├── lib/
│   │   ├── gitSourceNormalize.ts # Git URL parsing (tree/blob links)
│   │   └── deploymentStatus.ts   # Status helpers, polling logic
│   ├── middleware/
│   │   ├── asyncHandler.ts       # Express async wrapper
│   │   └── errorHandler.ts       # Central error handling
│   ├── pipeline/
│   │   ├── queue.ts              # In-memory job queue
│   │   ├── workspace/
│   │   │   ├── cleanup.ts        # Post-deployment cleanup
│   │   │   ├── extractArchive.ts # ZIP/tar.gz extraction + nested folder auto-detection
│   │   │   └── paths.ts          # Workspace path helpers
│   │   └── stages/
│   │       ├── buildStage.ts     # Railpack + BuildKit build
│   │       ├── deployStage.ts    # Docker container creation
│   │       └── resultTypes.ts    # Stage return types
│   ├── routes/
│   │   ├── caddy.ts              # Caddy admin proxy routes
│   │   ├── deployments.ts        # Core deployment CRUD + logs
│   │   ├── health.ts             # Health check endpoint
│   │   └── repos.ts              # Git repo introspection
│   ├── services/
│   │   ├── deploymentRuntime.ts  # Docker runtime management
│   │   ├── deploymentService.ts  # Deployment CRUD operations
│   │   ├── dockerClient.ts       # Dockerode singleton
│   │   ├── caddyClient.ts        # Caddy API client
│   │   ├── logBus.ts             # Log event pub/sub
│   │   ├── logService.ts         # Log persistence
│   │   └── portAllocator.ts      # Host port range management
│   ├── types/
│   │   └── logEntry.ts           # Shared log type definitions
│   └── validation/
│       └── deployments.ts        # Zod validation schemas
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── config.ts                 # Prisma 7 configuration
│   └── migrations/               # Database migrations
└── .env.example                  # Environment template
```

### Key Components

#### 1. Database Layer (Prisma 7 + SQLite)

**Schema** (`prisma/schema.prisma`):
```prisma
model Deployment {
  id          String   @id @default(cuid())
  name        String
  sourceType  SourceType        // git | upload
  source      String            // Git URL or extracted path
  sourceRef   String?           // Git branch/tag
  status      DeploymentStatus // pending → building → deploying → running | failed
  imageTag    String?           // Built image reference
  containerId String?           // Docker container ID
  url         String?           // Public access URL
  port        Int?              // Host port mapping
  envVars     String?           // JSON: Record<string,string>
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  logs        Log[]
}

model Log {
  id           String   @id @default(cuid())
  deploymentId String
  deployment   Deployment @relation(fields: [deploymentId], references: [id], onDelete: Cascade)
  stage        LogStage   // build | deploy | runtime
  level        LogLevel   // info | warn | error | debug
  message      String
  timestamp    DateTime @default(now())
}
```

**Prisma 7 Configuration** (`prisma/config.ts`):
- Uses `prisma-client` generator (not `@prisma/client`)
- Custom output path: `../src/generated/prisma`
- Requires `DATABASE_URL` environment variable
- Supports both local file paths and Docker volume paths

#### 2. Pipeline System

**Queue** (`pipeline/queue.ts`):
- In-memory queue using `async` library
- Sequential processing (one deployment at a time)
- Job status tracked via database

**Build Stage** (`pipeline/stages/buildStage.ts`):
1. Clone git repo or extract uploaded archive (ZIP/tar.gz)
2. Auto-detect single top-level folder in archives (handles folder-zipping on macOS/Windows)
3. Run `railpack build` via BuildKit
4. Push to local registry (avoids "sending tarball" issues)
5. Store image tag in deployment

**Deploy Stage** (`pipeline/stages/deployStage.ts`):
1. Allocate host port (10000-11000 range)
2. Pull image from registry
3. Create Docker container with:
   - Port binding (host:container)
   - Environment variables from `envVars` JSON
   - Labels for management
4. Start container
5. Write Caddy route snippet
6. Update deployment with `url` and `containerId`

#### 3. Runtime Management

**Port Allocator** (`services/portAllocator.ts`):
- Range: 10000-11000 (configurable)
- Tracks allocated ports in-memory
- Released on container stop/delete

**Docker Client** (`services/dockerClient.ts`):
- Dockerode singleton
- Connects to host Docker socket
- Used for container lifecycle

**Health Polling**:
- Background interval: `BRIMBLE_HEALTH_POLL_MS` (15s default)
- Inspects running containers
- Marks deployment `failed` if container stops unexpectedly

---

### BuildKit Image Export Challenge

**Problem Discovery**

During early testing, builds consistently hung at the "exporting to docker image format" stage with message `sending tarball`. The hang duration:
- WSL2 (Windows 11): 30+ minutes (effectively indefinite)
- Ubuntu EC2 (t3.medium): 30+ minutes
- Native Linux: 2-5 minutes

**Root Cause Analysis**

BuildKit supports multiple image export modes:
1. **Docker exporter** (default): Streams tarball to Docker daemon
2. **OCI exporter**: Writes to local directory
3. **Registry exporter**: Pushes to remote registry

The Docker exporter uses a Unix socket or named pipe to stream the built image as a tar archive to the Docker daemon. On some environments (notably WSL2 and certain EC2 configurations), this tar stream blocks indefinitely, possibly due to:
- Pipe buffer size limitations
- Docker daemon socket handling differences
- WSL2 filesystem translation overhead

**Solution: Registry-Based Export**

Instead of the default Docker exporter, the pipeline uses:

```typescript
// Build command in buildStage.ts
const buildArgs = [
  "build",
  "--name", imageTag,
  "--push", // Push to registry instead of local Docker
  "-c", buildkitHost,
  ".",
];
```

Flow:
1. **Build**: Railpack + BuildKit build image
2. **Push**: BuildKit pushes directly to local registry (`registry:5000`)
3. **Pull**: Docker daemon pulls from registry (`127.0.0.1:5001`)

**Tradeoffs of This Approach**

| Aspect | Before (Docker export) | After (Registry push/pull) |
|--------|------------------------|---------------------------|
| Time | 30+ min hang | 2-5 min reliable |
| Complexity | Simple, one step | Requires registry container |
| Port usage | None extra | Uses 5001 on host |
| Reliability | Environment-dependent | Consistent across all tested platforms |

**Verification**

To confirm this was the issue (not general slowness), I ran BuildKit builds directly:

```bash
docker compose exec buildkit buildctl build \
  --frontend dockerfile.v0 \
  --local context=. \
  --local dockerfile=. \
  --output type=docker
# ^ Hangs on WSL2

docker compose exec buildkit buildctl build \
  --frontend dockerfile.v0 \
  --local context=. \
  --local dockerfile=. \
  --output type=image,name=test:latest,push=true \
  --export-cache type=inline
# ^ Works reliably
```

This isolated the issue to the `type=docker` export specifically, confirming the registry workaround.

#### 4. Caddy Integration

**Caddy Client** (`services/caddyClient.ts`):
- Admin API client (port 2019)
- Writes per-deployment route snippets
- Snippet location: `caddy/dynamic/{deploymentId}.caddy`

**Route Snippet Format**:
```caddy
http://{app-name}-{8chars}.{domain} {
    reverse_proxy http://host.docker.internal:{hostPort}
}
```

**Shared Volume**:
- `caddy/dynamic/` mounted in both Caddy and backend containers
- Backend writes `.caddy` files
- Caddy watches and auto-reloads

#### 5. Log Streaming

**Log Bus** (`services/logBus.ts`):
- Event emitter for real-time log events
- SSE endpoint subscribes to deployment-specific events
- Control events for out-of-band notifications (e.g., `logs_cleared` on redeploy)

**Persistence** (`services/logService.ts`):
- SQLite storage via Prisma
- Functions: `appendLog`, `listRecentLogs`, `listLogsAfterId`, `clearLogs`

**SSE Endpoint** (`GET /api/deployments/:id/logs`):
- Server-Sent Events stream
- Replay last 500 logs on connect
- Supports `?afterId=` for reconnection
- Events: `log` (payload), `replay_done`, `logs_cleared` (redeploy), heartbeats
- Heartbeat every 20 seconds

---

## Frontend Architecture (Vite + React)

### Directory Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts             # HTTP client (fetch wrapper)
│   │   ├── deploymentsApi.ts   # Deployment CRUD
│   │   ├── queryKeys.ts          # TanStack Query keys
│   │   ├── reposApi.ts           # Git repo API
│   │   └── types.ts              # Shared TypeScript types
│   ├── components/
│   │   ├── AppShell.tsx          # Layout shell (minimal header)
│   │   ├── CreateGitForm.tsx     # Git deployment form
│   │   ├── CreateUploadForm.tsx  # File upload form
│   │   ├── DeploymentDetailPage.tsx # Detail + logs + actions
│   │   ├── DeploymentList.tsx    # Deployment list view
│   │   ├── EnvVarInput.tsx       # Environment variable editor
│   │   ├── HubPage.tsx           # Main hub (new/list tabs)
│   │   ├── LogViewer.tsx         # Real-time log display
│   │   └── StatusBadge.tsx       # Status indicator component
│   ├── lib/
│   │   ├── deploymentStatus.ts   # Status helpers
│   │   └── gitSourceNormalize.ts # Client-side URL parsing
│   └── main.tsx                  # Entry point
├── index.html
└── vite.config.ts
```

### Key Components

#### 1. Routing (TanStack Router)

**Routes**:
- `/` - Hub (create deployment or list)
- `/deployments/$deploymentId` - Detail view with logs

#### 2. State Management (TanStack Query)

**Query Keys** (`api/queryKeys.ts`):
```typescript
queryKeys.deployments()     // ["deployments"]
queryKeys.deployment(id)      // ["deployments", id]
queryKeys.repoBranches(url) // ["repos", "branches", url]
```

**Polling**:
- Deployments list: Polls every 3s if any deployment is in-flight
- Single deployment: Polls every 3s if not terminal state

#### 3. Forms

**CreateGitForm**:
- Git URL input with auto-normalization
- Branch/tag selector with:
  - `git ls-remote` auto-detection
  - Tree/blob URL parsing (extracts branch from GitHub/GitLab links)
  - Combobox: dropdown + manual entry
- Environment variables (EnvVarInput component)

**CreateUploadForm**:
- Drag & drop file upload
- ZIP/tar.gz support
- Environment variables

**EnvVarInput**:
- Key-value pairs with add/remove
- Masked by default (password input)
- Toggle visibility button
- Bulk paste mode (`.env` format)

#### 4. LogViewer

**Features**:
- Dark terminal theme (`bg-slate-700`)
- Syntax highlighting:
  - Error: `text-red-400 font-medium`
  - Warn: `text-amber-400`
  - Info: `text-slate-300`
  - Debug: `text-slate-500`
- Stage filtering (all/build/deploy/runtime)
- Auto-scroll to bottom
- Height: `max-h-[min(70vh,600px)]`

---

## Docker Compose Architecture

### Services

```yaml
services:
  registry:
    image: registry:2
    ports: ["127.0.0.1:5001:5000"]  # Local only
    
  buildkit:
    image: moby/buildkit:v0.29.0
    privileged: true
    command: ["--config", "/etc/buildkit/buildkitd.toml",
              "--addr", "unix:///run/buildkit/buildkitd.sock",
              "--addr", "tcp://0.0.0.0:1234"]
    
  caddy:
    image: caddy:2.8-alpine
    ports: ["80:80", "2019:2019"]
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - ./caddy/dynamic:/etc/caddy/dynamic  # Shared with backend
    
  backend:
    build: {context: ./backend, target: dev}
    environment:
      # Core config from .env file
      HOST: 0.0.0.0
      PORT: 3000
      DATABASE_URL: file:/data/brimble.db
      # ... see backend/.env.example
    volumes:
      - ./backend:/app                    # Dev hot-reload
      - backend_node_modules:/app/node_modules  # Named volume
      - brimble_data:/data                # SQLite + workspace
      - /var/run/docker.sock:/var/run/docker.sock  # Docker access
      - ./caddy/dynamic:/etc/caddy/dynamic  # Write Caddy routes
    
  frontend:
    build: {context: ./frontend, target: dev}
    volumes:
      - ./frontend:/app                  # Dev hot-reload
      - frontend_node_modules:/app/node_modules
```

### Networking

**Container-to-Host**:
- Backend → Docker: Via mounted socket
- Caddy → App containers: Via `host.docker.internal:{hostPort}`
- Backend → Caddy admin: `http://caddy:2019`

**Port Allocation**:
- Caddy: 80 (ingress), 2019 (admin)
- Registry: 5001 (localhost only)
- BuildKit: 1234 (internal TCP)
- App containers: 10000-11000 (host range)

---

## Data Flow Examples

### 1. Create Git Deployment

```
User → POST /api/deployments
  Body: {name, source, ref, envVars}
  
Backend:
  1. Validate (Zod)
  2. Normalize source URL
  3. Create DB record (status: pending)
  4. Enqueue job
  5. Return deployment
  
Pipeline (async):
  1. Update status → building
  2. Clone repo
  3. railpack build (via BuildKit)
  4. Push to registry
  5. Update status → deploying
  6. Allocate port, create container
  7. Write Caddy route
  8. Update status → running, set url
  
Frontend:
  - Polls deployment status
  - Streams logs via SSE
  - Shows URL when running
```

### 2. Redeploy Existing Deployment

```
User → POST /api/deployments/:id/redeploy

Backend:
  1. Destroy existing container
  2. Clear logs from database (fresh start)
  3. Emit `logs_cleared` control event to connected SSE clients
  4. Reset DB fields (status: pending, url: null, etc.)
  5. Re-enqueue to pipeline
  6. Return updated deployment

Pipeline:
  - Same flow as create, but uses existing envVars

Frontend:
  - Receives `logs_cleared` event → clears local log state
  - Shows fresh logs from new build immediately (no page refresh needed)
```

### 3. Log Streaming

```
User → GET /api/deployments/:id/logs (SSE)

Backend:
  1. Query last 500 logs from DB
  2. Send as SSE events (replay)
  3. Subscribe to logBus
  4. Stream new logs in real-time
  5. Send heartbeat every 20s

Frontend:
  1. Open EventSource
  2. Display logs with syntax highlighting
  3. Auto-scroll to bottom
  4. Filter by stage (optional)
```

---

## Configuration Reference

### Required Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite database path |
| `CORS_ORIGIN` | `http://localhost` | Allowed origins (comma-separated) |
| `BRIMBLE_APPS_BASE_DOMAIN` | `localhost` | Domain for deployed apps |
| `BRIMBLE_APP_PUBLIC_BASE` | `http://localhost` | Base URL for app access |

### Cloud Deployment Config

**Replace `<YOUR_PUBLIC_IP>` with your actual server IP** (e.g., EC2 public IP):
```bash
CORS_ORIGIN=http://<YOUR_PUBLIC_IP>,http://localhost
BRIMBLE_APPS_BASE_DOMAIN=<YOUR_PUBLIC_IP>.nip.io
BRIMBLE_APP_PUBLIC_BASE=http://<YOUR_PUBLIC_IP>
```

**Resulting URLs**:
- UI: `http://<YOUR_PUBLIC_IP>`
- Apps: `http://{name}-{id8}.<YOUR_PUBLIC_IP>.nip.io`
- Example: `http://my-api-abc123de.203.0.113.45.nip.io` (with IP 203.0.113.45)

### Optional/Advanced Variables

See `backend/.env.example` for:
- Build timeouts (`PIPELINE_BUILD_TIMEOUT_MS`)
- Port ranges (`BRIMBLE_HOST_PORT_MIN/MAX`)
- BuildKit config (`BUILDKIT_HOST`)
- Registry config (`BRIMBLE_REGISTRY_*`)
- Private git (`GIT_TOKEN`)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/deployments` | List deployments (`?limit=`) |
| POST | `/api/deployments` | Create from git |
| POST | `/api/deployments/upload` | Create from file |
| GET | `/api/deployments/:id` | Get deployment |
| DELETE | `/api/deployments/:id` | Delete deployment |
| POST | `/api/deployments/:id/redeploy` | Redeploy |
| GET | `/api/deployments/:id/logs` | SSE log stream |
| GET | `/api/repos/branches?url=` | List git branches |

---

## Development Notes

### Hot Reload

- **Backend**: Uses `tsx watch` - auto-restarts on file change
- **Frontend**: Vite dev server - HMR for instant updates
- **Caddy**: `--watch` flag - auto-reloads config changes

### Database Migrations

Local dev:
```bash
cd backend
npx prisma migrate dev  # Interactive
```

Docker (first run):
```bash
# Entrypoint runs: npx prisma migrate deploy
```

### Testing

Unit tests (no Docker):
```bash
cd backend
npm test  # Vitest
```

### Common Issues

1. **"sending tarball" hang**: Use registry mode (default in Compose)
2. **CORS errors**: Check `CORS_ORIGIN` includes your IP
3. **Port conflicts**: Check `BRIMBLE_HOST_PORT_MIN/MAX` range
4. **Docker permission**: Ensure user in docker group

---

## Security Considerations

This is a **development/POC tool**, not production-ready:

- No authentication/authorization
- SQLite file on disk (no encryption)
- Local registry bound to localhost only
- Environment variables stored in plain text
- No HTTPS (Caddy has `auto_https off`)
- No resource limits on containers

For production use:
- Add authentication
- Use PostgreSQL with TLS
- Enable HTTPS with real certificates
- Add container resource limits
- Move secrets to proper vault

---

## Extension Points

Potential areas for enhancement:

1. **Multi-node**: Replace in-memory queue with Redis + separate workers
2. **Kubernetes**: Replace Docker runtime with K8s API
3. **Monitoring**: Add Prometheus metrics, structured logging
4. **Storage**: Add S3-compatible artifact storage
5. **Caching**: Add layer caching for faster builds
6. **Webhooks**: Add GitHub/GitLab webhook support for auto-deploy

---

## Development Guide

### Local Development (Docker)

The entire stack runs via Docker Compose:

```bash
docker compose up --build
```

Services:
- **Caddy** (port 80): Reverse proxy to frontend (:5173) and backend (:3000)
- **Backend** (:3000): API + pipeline, hot-reload with `tsx watch`
- **Frontend** (:5173): Vite dev server with HMR
- **BuildKit** (port 1234): Build daemon, privileged container
- **Registry** (port 5001): Local Docker registry for image storage

### Database Changes

Prisma schema changes:

```bash
cd backend
# Edit prisma/schema.prisma
npx prisma migrate dev --name add_feature
npx prisma generate
```

Migrations run automatically on Docker startup via entrypoint script.

### Testing Strategy

**Unit/Integration Tests** (`npm test`):
- Pipeline status transitions
- Request validation (Zod schemas)
- HTTP API with mocked dependencies
- No Docker required

**Manual E2E Testing**:
1. Create deployment from Git repo
2. Verify pipeline stages: pending → building → deploying → running
3. Check logs stream in real-time
4. Open deployed app URL
5. Delete deployment, verify cleanup

**Cloud Deployment Test**:
1. Configure `backend/.env` with public IP
2. `docker compose up -d`
3. Create deployment from public Git repo
4. Verify accessible at `http://your-ip`
5. Verify deployed app accessible at `http://<name>-<id>.your-ip.nip.io`

---

## Troubleshooting Guide

### Build Hangs at "sending tarball"

**Symptom**: Build stage hangs indefinitely, no progress logs.
**Cause**: BuildKit's tar export to Docker daemon is blocked.
**Solution**: Registry mode is already enabled by default (`BRIMBLE_REGISTRY_*` vars). Ensure registry container is running:

```bash
docker compose ps registry
docker compose logs registry
```

### CORS Errors in Browser

**Symptom**: API requests fail with CORS errors.
**Cause**: `CORS_ORIGIN` doesn't include your origin.
**Solution**: Edit `backend/.env`:

```bash
CORS_ORIGIN=http://localhost,http://your-public-ip
```

Restart: `docker compose restart backend`

### Native Module Errors (better-sqlite3)

**Symptom**: `NODE_MODULE_VERSION` mismatch error.
**Cause**: Node version changed but old native modules cached in volume.
**Solution**:

```bash
docker compose down -v  # Remove backend_node_modules volume
docker compose up --build
```

### Port Already in Use

**Symptom**: `docker compose up` fails with port binding error.
**Cause**: Port 80, 2019, or 5001 already used.
**Solution**: Find and stop conflicting process, or edit `docker-compose.yml` ports section.

### App Returns 502 from Caddy

**Symptom**: Deployed app shows Caddy 502 error.
**Cause**: 
1. App container not running: `docker ps | grep <deployment-id>`
2. Wrong upstream host: Check `BRIMBLE_DOCKER_UPSTREAM_HOST` is `host.docker.internal` (Linux) or `host.docker.internal` (Docker Desktop Mac/Win)
3. Missing `extra_hosts` in Caddy service for Linux

**Debug**:

```bash
# Check container is running
docker ps --filter "label=brimble.deployment.id=<id>"

# Check Caddy config
docker compose exec caddy caddy list-modules

# Test direct access
curl http://host.docker.internal:<assigned-port>
```

---

## Performance Characteristics

Measured on t3.medium AWS EC2 (2 vCPU, 4GB RAM):

| Operation | Typical Time | Notes |
|-----------|---------------|-------|
| **Git clone** | 5-30s | Depends on repo size |
| **Railpack build (Node)** | 2-5 min | Includes base image pull on first run |
| **Image push to registry** | 5-15s | Local network, very fast |
| **Image pull + container start** | 3-10s | Depends on image size |
| **Total pipeline (warm)** | 30-60s | After base images cached |
| **Total pipeline (cold)** | 3-5 min | First build pulls everything |
| **Health poll interval** | 15s | Configurable via env |
| **Log SSE latency** | <100ms | In-memory bus, very fast |
| **Caddy config reload** | <1s | File watch, automatic |

**Resource Usage**:
- BuildKit: 1-2GB RAM during builds (spikes with large images)
- Backend: ~100MB idle, ~200MB during active builds
- Caddy: ~20MB
- Registry: ~50MB + stored image layers

---

## Code Patterns & Conventions

### Error Handling

All async route handlers use `asyncHandler` wrapper:

```typescript
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

Central `errorHandler` middleware formats errors consistently:
- Validation errors (Zod): 400 with field details
- Not found: 404
- Unexpected: 500 with safe message

### Validation

Zod schemas in `validation/` directory:
- `createDeploymentBodySchema` - Git URL, name, branch, env vars
- `redeployBodySchema` - Optional env var updates
- `listDeploymentsQuerySchema` - Pagination/limit

### Type Safety

- Shared types in `types/` directory
- Prisma client generates types from schema
- Frontend types mirror backend via shared definitions

### Database Access

Prisma singleton pattern in `db/prisma.ts`:

```typescript
export const prisma = new PrismaClient({
  adapter: new PrismaBetterSQLite3Adapter(db),
});
```

---

## Implementation Summary

### Core Features

| Category | Features |
|----------|----------|
| **Deployment Sources** | Git repositories (HTTPS/SSH), ZIP/tar.gz uploads, branch auto-detection |
| **Build System** | Railpack auto-detection (Node/Python/Go/etc.), BuildKit, local registry |
| **Runtime** | Docker container management, dynamic port allocation (10000-11000), health polling |
| **Networking** | Caddy reverse proxy, nip.io wildcard DNS, automatic vhost routing |
| **Observability** | Real-time SSE log streaming, persistent SQLite logs, deployment status tracking |
| **Operations** | Redeploy with log reset, deployment deletion with full cleanup, env var injection |

### Notable Implementation Decisions

1. **Registry-based builds**: Worked around BuildKit tar-stream hangs by pushing to local registry instead of direct Docker export
2. **In-memory queue**: Chose `async` library over Redis for zero-infrastructure simplicity
3. **File-based Caddy config**: Writes route snippets to shared volume instead of API calls—simpler, more debuggable
4. **Nested archive detection**: Auto-detects and flattens single top-level folders in uploaded archives
5. **SSE control events**: `logs_cleared` event enables instant UI updates on redeploy without page refresh

### Tested Platforms

- ✅ WSL2 (Windows 11)
- ✅ Ubuntu 22.04 EC2 (t3.medium)
- ✅ macOS (Docker Desktop)
