#!/usr/bin/env bash
# Rebuild the local test database (migrations + demo seed + demo logins) for the e2e stack.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PGOPTIONS="-c search_path=public,extensions -c client_min_messages=warning"
DB="${TEST_DB:-erp_seed}"
psql -q -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='$DB'" >/dev/null || true
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/seed.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f test/e2e/users.sql
echo "test database ready: $DB"
