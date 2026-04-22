#!/bin/sh
set -e
export DATABASE_URL="${DATABASE_URL:-file:/data/brimble.db}"
export BRIMBLE_WORKSPACE="${BRIMBLE_WORKSPACE:-/data/work}"
mkdir -p "$BRIMBLE_WORKSPACE" 2>/dev/null || true
echo "[entrypoint] DATABASE_URL=$DATABASE_URL"
echo "[entrypoint] BRIMBLE_WORKSPACE=$BRIMBLE_WORKSPACE"
npx prisma generate
npx prisma migrate deploy
exec "$@"
