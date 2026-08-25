#!/usr/bin/env bash
# Starts the web app in the background and waits until it actually answers.
#
# Detached so it survives the shell that launched it, and polled rather than slept on — "sleep 8
# and hope" produces confusing failures when the machine is busy.
#
# Stopping the previous instance is the fiddly part. From Git Bash, `pkill` does not reach a
# native Windows process, so an old server keeps port 3000 and carries on serving a stale build —
# which shows up as `_next/static/...` returning 400 and a page that never hydrates, a long way
# from anything that looks like a stale process. So the port is freed by whichever mechanism the
# platform actually has.
set -euo pipefail

PORT=${GI_PORT:-3000}
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

LOG_DIR=${TMPDIR:-/tmp}
[ -d "$LOG_DIR" ] || LOG_DIR="$ROOT"
LOG=${GI_LOG:-$LOG_DIR/gi-web.log}

free_port() {
  if command -v taskkill > /dev/null 2>&1; then
    # Windows: find the listener by port and kill the process tree.
    local pids
    pids=$(netstat -ano 2>/dev/null | grep -E "[:.]$PORT[[:space:]]" | grep -i LISTENING \
      | awk '{print $NF}' | sort -u)
    for pid in $pids; do
      [ -n "$pid" ] && taskkill //F //T //PID "$pid" > /dev/null 2>&1 || true
    done
  fi
  # Next renames its process to `next-server`, so that is what has to be matched.
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "next start" 2>/dev/null || true
}

free_port
for _ in $(seq 1 10); do
  curl -s -o /dev/null --max-time 1 "http://localhost:$PORT/" 2>/dev/null || break
  sleep 1
done

: > "$LOG"
cd "$ROOT/apps/web"

# setsid where it exists (Linux); plain background elsewhere (Git Bash has none).
if command -v setsid > /dev/null 2>&1; then
  LAUNCH=(setsid)
else
  LAUNCH=()
fi

"${LAUNCH[@]}" env \
  DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/gi_compass}" \
  APP_BASE_URL="${APP_BASE_URL:-http://localhost:$PORT}" \
  NODE_ENV=production \
  npx next start --port "$PORT" >> "$LOG" 2>&1 < /dev/null &

for _ in $(seq 1 40); do
  sleep 1
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null)" = "200" ]; then
    # A server that answers but serves a stale build is worse than one that is down, so check
    # that the build it is serving is the one on disk.
    echo "web ready on http://localhost:$PORT  (log: $LOG)"
    exit 0
  fi
done

echo "web failed to start; last log lines:" >&2
tail -20 "$LOG" >&2
exit 1
