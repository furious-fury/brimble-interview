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
│   │   │   ├── extractArchive.ts # ZIP/tar.gz extraction
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
1. Clone git repo or use uploaded archive
2. Run `railpack build` via BuildKit
3. Push to local registry (avoids "sending tarball" issues)
4. Store image tag in deployment

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

**Persistence** (`services/logService.ts`):
- SQLite storage via Prisma
- Functions: `appendLog`, `listRecentLogs`, `listLogsAfterId`, `clearLogs`

**SSE Endpoint** (`GET /api/deployments/:id/logs`):
- Server-Sent Events stream
- Replay last 500 logs on connect
- Supports `?afterId=` for reconnection
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
  2. Clear logs (fresh start)
  3. Reset DB fields (status: pending, url: null, etc.)
  4. Re-enqueue to pipeline
  5. Return updated deployment

Pipeline:
  - Same flow as create, but uses existing envVars
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

**For IP 13.50.5.50**:
```bash
CORS_ORIGIN=http://13.50.5.50,http://localhost
BRIMBLE_APPS_BASE_DOMAIN=13.50.5.50.nip.io
BRIMBLE_APP_PUBLIC_BASE=http://13.50.5.50
```

**Resulting URLs**:
- UI: `http://13.50.5.50`
- Apps: `http://{name}-{id8}.13.50.5.50.nip.io`
- Example: `http://my-api-abc123de.13.50.5.50.nip.io`

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
