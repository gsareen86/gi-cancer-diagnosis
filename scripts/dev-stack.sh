#!/usr/bin/env bash
# The whole local stack, up or down in one command.
#
#   ./scripts/dev-stack.sh up       npm run dev
#   ./scripts/dev-stack.sh down     npm run dev:down
#   ./scripts/dev-stack.sh status   npm run dev:status
#
# Five things have to be running for a case to reach a doctor with an AI analysis attached:
# PostgreSQL, Mailpit, llama-server, the Python AI service, and the web app. Starting them by hand
# means five terminals and an order to remember, and the failure when one is missing surfaces much
# later as an unexplained error on a review screen. `status` is the answer to "which one is it".
#
# Everything is started detached and then *waited on* — a component that is listening but not yet
# answering is indistinguishable from a broken one, and "sleep and hope" turns a slow machine into
# a mysterious failure.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${TMPDIR:-/tmp}/gi-compass"
mkdir -p "$LOG_DIR"

WEB_PORT=${GI_WEB_PORT:-3000}
AI_PORT=${GI_AI_PORT:-8000}
LLAMA_PORT=${GI_LLAMA_PORT:-8080}

# Ports the stack owns. 8099 is the e2e stub: never started here, always stopped, because one left
# running on the model's port is what made every case come back with the same canned summary.
STACK_PORTS=("$WEB_PORT" "$AI_PORT" "$LLAMA_PORT" 8099)

# Log paths are printed constantly, and `/tmp/gi-compass` means nothing to the PowerShell window
# this was very likely launched from. cygpath is part of Git Bash, so it is there whenever this is.
native_path() {
  if command -v cygpath > /dev/null 2>&1; then
    cygpath -w "$1" 2>/dev/null || printf '%s' "$1"
  else
    printf '%s' "$1"
  fi
}

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m+\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31mx\033[0m %s\n' "$*"; }

# --- environment ------------------------------------------------------------------------------
# Read as data, never sourced: a Windows path is full of backslashes and must not be interpreted
# by the shell.
env_value() {
  local file=$1 key=$2 line
  [ -f "$file" ] || return 0
  line=$(grep -E "^[[:space:]]*${key}=" "$file" | tail -1) || return 0
  printf '%s' "${line#*=}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//'
}

LLAMA_BIN=${LLAMA_SERVER_BIN:-$(env_value "$ROOT/.env" LLAMA_SERVER_BIN)}
LLAMA_MODEL=${LLAMA_MODEL:-$(env_value "$ROOT/.env" LLAMA_MODEL)}
LLAMA_CONTEXT=${LLAMA_CONTEXT:-$(env_value "$ROOT/services/ai/.env" LOCAL_MODEL_CONTEXT)}
LLAMA_CONTEXT=${LLAMA_CONTEXT:-8192}

# --- process control --------------------------------------------------------------------------
listener_pids() {
  netstat -ano 2>/dev/null | grep -E "[:.]$1[[:space:]]" | grep -i LISTENING \
    | awk '{print $NF}' | sort -u
}

port_is_up() { [ -n "$(listener_pids "$1")" ]; }

free_port() {
  local port=$1 pid
  for pid in $(listener_pids "$port"); do
    if command -v taskkill > /dev/null 2>&1; then
      # From Git Bash, pkill does not reach a native Windows process; an old server keeps the port
      # and quietly serves a stale build.
      taskkill //F //T //PID "$pid" > /dev/null 2>&1
    else
      kill -9 "$pid" > /dev/null 2>&1
    fi
  done
}

# Waits for a URL to answer, rather than for a number of seconds to pass.
wait_for() {
  local url=$1 seconds=$2 code
  for _ in $(seq 1 "$seconds"); do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null)
    [ "$code" = "200" ] && return 0
    sleep 1
  done
  return 1
}

served_model() {
  curl -s --max-time 3 "http://127.0.0.1:$LLAMA_PORT/v1/models" 2>/dev/null \
    | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1
}

# --- components -------------------------------------------------------------------------------
start_containers() {
  bold 'PostgreSQL, object storage, Mailpit'
  if ! docker compose -f "$ROOT/docker-compose.yml" up -d > "$LOG_DIR/compose.log" 2>&1; then
    bad "docker compose failed - see $(native_path "$LOG_DIR/compose.log")"
    return 1
  fi
  for _ in $(seq 1 40); do
    if docker compose -f "$ROOT/docker-compose.yml" exec -T postgres \
         pg_isready -U postgres -d gi_compass > /dev/null 2>&1; then
      ok 'postgres ready on 5432'
      ok 'mailpit inbox at http://localhost:8025'
      return 0
    fi
    sleep 1
  done
  bad 'postgres never became ready'
  return 1
}

migrate() {
  bold 'Schema and clinical content'
  if npm --prefix "$ROOT" run db:migrate > "$LOG_DIR/migrate.log" 2>&1; then
    ok 'migrations applied'
  else
    bad "migrations failed - see $(native_path "$LOG_DIR/migrate.log")"
    return 1
  fi
  if npm --prefix "$ROOT" run db:seed > "$LOG_DIR/seed.log" 2>&1; then
    ok 'seed content present'
  else
    bad "seed failed - see $(native_path "$LOG_DIR/seed.log")"
    return 1
  fi
}

start_llama() {
  bold 'Local model (llama-server)'
  if [ -z "$LLAMA_BIN" ] || [ -z "$LLAMA_MODEL" ]; then
    warn 'skipped: set LLAMA_SERVER_BIN and LLAMA_MODEL in .env to start it'
    warn 'without it the AI analysis button reports model_unavailable; nothing else is affected'
    return 0
  fi
  if [ ! -f "$LLAMA_BIN" ]; then
    bad "LLAMA_SERVER_BIN does not exist: $LLAMA_BIN"
    return 1
  fi

  free_port "$LLAMA_PORT"
  # llama-server reports whatever -m was given as the model id, and that id is what gets
  # stored against a case and shown to the doctor as a version pin. Unaliased that is an
  # absolute Windows path. The alias is derived from the file, so it still describes what
  # is actually loaded.
  local alias
  alias=$(basename "$LLAMA_MODEL"); alias=${alias%.gguf}
  # The AMD APU settings that make a 27B model usable here: Vulkan with unified memory, so the
  # model lives in shared RAM rather than a separate VRAM budget.
  (
    HIP_VISIBLE_DEVICES=0 \
    GGML_VULKAN_UNIFIED_MEMORY=1 \
    ROCBLAS_USE_HIPBLASLT=1 \
    "$LLAMA_BIN" -m "$LLAMA_MODEL" \
      --host 127.0.0.1 --port "$LLAMA_PORT" --alias "$alias" \
      -c "$LLAMA_CONTEXT" -ngl 99 --no-mmap --flash-attn on \
      -b 512 -ub 64 -t 4 -tb 12 -ctk q8_0 -ctv q8_0 \
      > "$LOG_DIR/llama.log" 2>&1 < /dev/null &
  )

  printf '  loading the model (a quantised 27B takes a while)...\n'
  # The one component worth waiting minutes for.
  if wait_for "http://127.0.0.1:$LLAMA_PORT/v1/models" 420; then
    ok "serving $(served_model)"
  else
    bad "llama-server did not come up - see $(native_path "$LOG_DIR/llama.log")"
    return 1
  fi
}

start_ai() {
  bold 'AI service'
  local python="$ROOT/services/ai/.venv/Scripts/python.exe"
  [ -f "$python" ] || python="$ROOT/services/ai/.venv/bin/python"
  if [ ! -f "$python" ]; then
    bad 'no virtualenv at services/ai/.venv - create it and pip install -e ".[dev]"'
    return 1
  fi

  free_port "$AI_PORT"
  (
    cd "$ROOT/services/ai" || exit 1
    "$python" -m uvicorn gi_ai.app:app --host 127.0.0.1 --port "$AI_PORT" --env-file .env \
      > "$LOG_DIR/ai.log" 2>&1 < /dev/null &
  )

  if wait_for "http://127.0.0.1:$AI_PORT/health" 60; then
    ok "answering on $AI_PORT"
    local health
    health=$(curl -s --max-time 3 "http://127.0.0.1:$AI_PORT/health")
    # The health endpoint asks the model endpoint what it is rather than reciting configuration,
    # so this line is evidence rather than a restatement of .env.
    case "$health" in
      *'"reachable":true'*)
        ok "model endpoint reachable: $(printf '%s' "$health" \
          | sed -n 's/.*"servedModel"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
        ;;
      *)
        warn 'model endpoint not reachable - AI analysis will report model_unavailable'
        ;;
    esac
  else
    bad "AI service did not come up - see $(native_path "$LOG_DIR/ai.log")"
    return 1
  fi
}

start_web() {
  bold 'Web app'
  local build_id="$ROOT/apps/web/.next/BUILD_ID" newest=''
  # Rebuild when any source is newer than the build. A server that answers while serving a stale
  # build is worse than one that is down, because it looks like it is working.
  if [ -f "$build_id" ]; then
    newest=$(find "$ROOT/apps/web/src" "$ROOT/apps/web/messages" "$ROOT/packages" \
      -type f -newer "$build_id" -not -path '*/node_modules/*' -not -path '*/dist/*' \
      2>/dev/null | head -1)
  fi
  if [ ! -f "$build_id" ] || [ -n "$newest" ] || [ "${GI_BUILD:-}" = "1" ]; then
    printf '  building (this takes a minute)...\n'
    if ! npm --prefix "$ROOT" run build -w @gi-compass/web > "$LOG_DIR/build.log" 2>&1; then
      bad "build failed - see $(native_path "$LOG_DIR/build.log")"
      return 1
    fi
    ok 'built'
  else
    ok 'build is current'
  fi

  GI_PORT="$WEB_PORT" GI_LOG="$LOG_DIR/web.log" bash "$ROOT/scripts/dev-server.sh" > /dev/null 2>&1
  if port_is_up "$WEB_PORT"; then
    ok "http://localhost:$WEB_PORT"
  else
    bad "web did not come up - see $(native_path "$LOG_DIR/web.log")"
    return 1
  fi
}

# --- commands ---------------------------------------------------------------------------------
cmd_up() {
  start_containers || return 1
  migrate          || return 1
  start_llama      || return 1
  start_ai         || return 1
  start_web        || return 1
  echo
  bold 'Ready'
  echo "  patient   http://localhost:$WEB_PORT"
  echo "  doctor    http://localhost:$WEB_PORT/doctor/queue"
  echo "  mail      http://localhost:8025"
  echo "  logs      $(native_path "$LOG_DIR")"
}

cmd_down() {
  bold 'Stopping'
  local port
  for port in "${STACK_PORTS[@]}"; do
    if port_is_up "$port"; then
      free_port "$port"
      ok "freed port $port"
    fi
  done
  # Next renames its process, so the port is the only reliable handle - but catch strays too.
  pkill -f "next-server" 2>/dev/null
  pkill -f "[s]tub-llama-server" 2>/dev/null
  if docker compose -f "$ROOT/docker-compose.yml" stop > "$LOG_DIR/compose-stop.log" 2>&1; then
    ok 'containers stopped (data volumes kept)'
  else
    warn "docker compose stop reported a problem - see $LOG_DIR/compose-stop.log"
  fi
  echo
  ok 'everything stopped'
}

cmd_status() {
  bold 'Stack'
  local rows row name rest port url
  rows=(
    "web|$WEB_PORT|http://localhost:$WEB_PORT/"
    "ai|$AI_PORT|http://127.0.0.1:$AI_PORT/health"
    "llama|$LLAMA_PORT|http://127.0.0.1:$LLAMA_PORT/v1/models"
    "mail|8025|http://localhost:8025/"
  )
  for row in "${rows[@]}"; do
    name=${row%%|*}; rest=${row#*|}; port=${rest%%|*}; url=${rest#*|}
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null)" = "200" ]; then
      ok "$(printf '%-8s' "$name") answering on $port"
    elif port_is_up "$port"; then
      warn "$(printf '%-8s' "$name") listening on $port but not answering"
    else
      bad "$(printf '%-8s' "$name") not running"
    fi
  done

  if port_is_up 5432; then
    ok "$(printf '%-8s' postgres) listening on 5432"
  else
    bad "$(printf '%-8s' postgres) not running"
  fi

  if port_is_up "$LLAMA_PORT"; then
    ok "$(printf '%-8s' model) $(served_model)"
  fi
  if port_is_up 8099; then
    warn 'the e2e stub is running on 8099 - only an AI service pointed at it is affected'
  fi
}

case "${1:-up}" in
  up)     cmd_up ;;
  down)   cmd_down ;;
  status) cmd_status ;;
  *)
    echo "usage: $(basename "$0") [up|down|status]" >&2
    exit 1
    ;;
esac
