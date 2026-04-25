#!/bin/sh
set -e

# Auto-install dependencies if package.json changed (for dev with named volumes)
# Store a hash of package.json to detect changes
PACKAGE_JSON_HASH_FILE="/app/node_modules/.package.json.hash"
if [ -f /app/package.json ]; then
  CURRENT_HASH=$(md5sum /app/package.json | awk '{ print $1 }')
  if [ ! -f "$PACKAGE_JSON_HASH_FILE" ] || [ "$(cat "$PACKAGE_JSON_HASH_FILE" 2>/dev/null)" != "$CURRENT_HASH" ]; then
    echo "[entrypoint] package.json changed, running npm install..."
    npm install
    echo "$CURRENT_HASH" > "$PACKAGE_JSON_HASH_FILE"
    echo "[entrypoint] Dependencies updated"
  fi
fi

exec "$@"
