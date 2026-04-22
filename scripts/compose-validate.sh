#!/usr/bin/env bash
# Optional Phase 9.4 check: validate compose file and (optionally) bring stack up, hit health, tear down.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== docker compose config =="
docker compose config >/dev/null
echo "OK: compose file is valid"

if [ "${1:-}" = "--smoke" ]; then
  echo "== smoke: up, wait for API health, down =="
  docker compose up -d --build
  trap 'docker compose down' EXIT
  for i in $(seq 1 60); do
    if curl -fsS "http://localhost/api/health" >/dev/null 2>&1; then
      echo "OK: GET /api/health on http://localhost"
      exit 0
    fi
    sleep 2
  done
  echo "FAIL: health check did not succeed in time" >&2
  exit 1
fi

echo "Tip: run with --smoke to start compose, curl /api/health, and exit (stops services on success)."
