#!/usr/bin/env bash
# Starts a local PostgreSQL 16 with pgvector for development and tests.
#
# Production runs Postgres in an India cloud region with the restricted `gi_compass_app` role
# (see migrations/0001). This script is the local stand-in: same major version, same extension,
# same migrations — so a behaviour that depends on the database behaves the same way here.
set -euo pipefail

PGBIN=/usr/lib/postgresql/16/bin
PGROOT=${GI_PGROOT:-/var/tmp/gipg}
PGPORT=${GI_PGPORT:-55432}
PGDATABASE=${GI_PGDATABASE:-gi_compass}

if [ "$(id -u)" = "0" ]; then
  RUN_AS="su postgres -c"
else
  RUN_AS="bash -c"
fi

if "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1; then
  echo "postgres already running on $PGPORT"
else
  if [ ! -d "$PGROOT/data" ]; then
    mkdir -p "$PGROOT/data" "$PGROOT/run"
    [ "$(id -u)" = "0" ] && chown -R postgres:postgres "$PGROOT"
    $RUN_AS "$PGBIN/initdb -D $PGROOT/data -U postgres --auth=trust" >/dev/null
  fi
  $RUN_AS "$PGBIN/pg_ctl -D $PGROOT/data -o '-p $PGPORT -k $PGROOT/run -c listen_addresses=127.0.0.1' -l $PGROOT/data/server.log start"
  for _ in $(seq 1 30); do
    "$PGBIN/pg_isready" -h 127.0.0.1 -p "$PGPORT" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

psql -h 127.0.0.1 -p "$PGPORT" -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='$PGDATABASE'" | grep -q 1 \
  || psql -h 127.0.0.1 -p "$PGPORT" -U postgres -c "CREATE DATABASE $PGDATABASE" >/dev/null

psql -h 127.0.0.1 -p "$PGPORT" -U postgres -d "$PGDATABASE" \
  -c "CREATE EXTENSION IF NOT EXISTS vector" >/dev/null

echo "postgres ready: postgres://postgres@127.0.0.1:$PGPORT/$PGDATABASE"
