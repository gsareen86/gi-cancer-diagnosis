#!/usr/bin/env bash
# Starts the web app in the background and waits until it actually answers.
#
# Detached with setsid so it survives the shell that launched it, and polled rather than
# slept on — "sleep 8 and hope" produces confusing failures when the machine is busy.
set -euo pipefail

PORT=${GI_PORT:-3000}
LOG=${GI_LOG:-/var/tmp/gi-web.log}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Next renames its process to `next-server`, so that is what has to be matched to stop it.
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "next start" 2>/dev/null || true
sleep 2

: > "$LOG"
cd "$ROOT/apps/web"
setsid env \
  DATABASE_URL="${DATABASE_URL:-postgres://postgres@127.0.0.1:55432/gi_compass}" \
  SESSION_SECRET="${SESSION_SECRET:-local-dev-secret-at-least-32-characters}" \
  FIELD_ENCRYPTION_KEY="${FIELD_ENCRYPTION_KEY:-local-dev-key-at-least-32-characters-abc}" \
  APP_BASE_URL="${APP_BASE_URL:-http://localhost:$PORT}" \
  NODE_ENV=production \
  npx next start --port "$PORT" >> "$LOG" 2>&1 < /dev/null &

for _ in $(seq 1 40); do
  sleep 1
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null)" = "200" ]; then
    echo "web ready on http://localhost:$PORT"
    exit 0
  fi
done

echo "web failed to start; last log lines:" >&2
tail -20 "$LOG" >&2
exit 1
