#!/usr/bin/env bash
# Rebuild a throw-away Postgres database from the migrations and run the SQL
# test-suite. Needs a Postgres server reachable via the standard PG* variables
# (PGHOST/PGPORT/PGUSER). Never point this at a real project.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-erp_test}"
export PGOPTIONS="-c search_path=public,extensions -c client_min_messages=warning"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do echo "migrate $(basename "$f")"; run "$f"; done
if [ "${1:-}" = "--test" ]; then
  for f in supabase/tests/[1-9]*.sql; do echo "test $(basename "$f")"; run "$f"; done
  echo "ALL SQL TESTS PASSED"
fi
