# Testing (Phase 9)

## Automated (no Docker required)

From `backend/`:

```bash
npm install
npm test
```

- Uses `DATABASE_URL=file:./prisma/test.db` (gitignored as `*.db`).
- `vitest` runs `prisma migrate deploy` once in global setup, then unit and API tests.
- API tests use **supertest** against [`buildApp()`](../backend/src/app.ts) with the pipeline **queue** and **destroyDeploymentRuntime** mocked so Railpack, Docker, and Caddy are not required.

## Optional: Docker Compose validation (9.4)

From the repository root (Git Bash, WSL, or macOS/Linux):

```bash
bash scripts/compose-validate.sh
```

Validates `docker compose config`. For a full smoke (build, up, `GET /api/health` on port 80, then `down`):

```bash
bash scripts/compose-validate.sh --smoke
```

**Expectations**

- Caddy and the API should start; `http://localhost/api/health` returns JSON with `ok: true` once services are ready.
- **Service order:** the API may log Docker warnings until the socket is available; the health endpoint should still respond when the process is up.
- **Volumes:** the backend mounts `brimble-data` (see `docker-compose.yml`); a second `up` after `down` should show persisted DB only if the volume is retained (default named volume is retained until removed).

## Manual E2E checklist (9.3)

Use a full `docker compose up` (or local backend + frontend) and work through this list.

**UI Feedback (Toast Notifications):**
- Delete deployment → Should show "Deleting..." loading toast, then navigate to hub when complete
- Redeploy → Should show success/error toast
- Create deployment → Should handle validation errors with toast notifications

**Resource Cleanup Verification:**
- After deleting a deployment: `docker images | grep brimble/d-` should show the image is removed
- After redeploying: Only the current image should exist (old images cleaned up)
- Check disk space: `df -h` should not grow indefinitely with each build

1. **Create from Git** — A small public repo (e.g. static or minimal Node) completes build → deploy → `running` (or `failed` with a clear log line).
2. **Create from upload** — A valid `.zip` of a tiny app; pipeline starts and logs appear.
3. **List** — Hub table shows the deployment, status, URL when available, timestamps; refresh or polling updates status while the pipeline is active.
4. **Detail + logs** — Open the deployment, SSE log stream shows build/deploy/runtime (as applicable); filters by stage work; new lines auto-scroll.
5. **App URL** — If Caddy is configured (`CADDY_DYNAMIC_DIR`), the stored vhost `http://<host>` opens the app; without Caddy, direct `BRIMBLE_APP_PUBLIC_BASE:port` works.
   - **Commit ID** — For git deployments, the UI should display the short commit hash (7 chars) under the branch/tag reference in the Source section.
6. **Delete** — Removes deployment, `destroy` runs (no stray container on host), **Docker image is removed**, Caddy snippet is removed, and UI navigates to hub without 404 flash. Verify with `docker images | grep <deployment-image>`.
7. **Sample app types (manual)** — Repeat 1 with: a static site, a small Node app, a small Python app (per project constraints), as time allows; not required for `npm test`.

## Optional: browser E2E

A Playwright (or similar) spec against `http://localhost` after `compose up` can assert the hub loads and the health API is reachable. This is not part of the default `npm test` in CI (requires Docker and a longer job); add a dedicated workflow or run locally if needed.
