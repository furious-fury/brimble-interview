#!/bin/sh
set -e
export DATABASE_URL="${DATABASE_URL:-file:/data/brimble.db}"
echo "[entrypoint] DATABASE_URL=$DATABASE_URL"
npx prisma generate
npx prisma migrate deploy
exec "$@"
