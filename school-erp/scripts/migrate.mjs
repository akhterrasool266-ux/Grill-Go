#!/usr/bin/env node
// Applies supabase/migrations/*.sql to a Postgres database, once each, in order.
//   DATABASE_URL='postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres' node scripts/migrate.mjs [status|up] [--dry-run]
//   node scripts/migrate.mjs baseline      # DB was set up by pasting the SQL by hand: mark every file as applied WITHOUT running it
//
// · Every file runs in its own transaction: it either fully applies or leaves nothing behind.
// · Applied files are remembered (with a checksum) in schema erp_meta. If an already-applied file was edited
//   afterwards the run STOPS — fix it with a new migration file, never by editing an old one.
// · Safe to run again and again. Uses a database advisory lock so two runs can't collide.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith('--')) ?? 'up';
const dry = args.includes('--dry-run');
const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) { console.error('Set DATABASE_URL (Supabase → Project Settings → Database → Connection string, “Session pooler” or “Direct”).'); process.exit(1); }
if (!['status', 'up', 'baseline'].includes(cmd)) { console.error('Usage: migrate.mjs [status|up|baseline] [--dry-run]'); process.exit(1); }

const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const sum = (f) => createHash('sha256').update(readFileSync(join(dir, f))).digest('hex');
const local = url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('postgresql:///') || url.includes('host=/');
const client = new pg.Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('select pg_advisory_lock(727401)');
  await client.query('create schema if not exists erp_meta');
  await client.query('create table if not exists erp_meta.migrations (filename text primary key, checksum text not null, applied_at timestamptz not null default now())');
  const done = new Map((await client.query('select filename, checksum from erp_meta.migrations')).rows.map((r) => [r.filename, r.checksum]));

  const changed = files.filter((f) => done.has(f) && done.get(f) !== sum(f));
  if (changed.length) { console.error(`STOP: already-applied migration(s) were edited: ${changed.join(', ')}\nAdd a NEW migration file instead of editing an old one.`); process.exitCode = 2; }
  else {
    const missingLocally = [...done.keys()].filter((f) => !files.includes(f));
    if (missingLocally.length) console.warn(`warning: applied but not in this checkout: ${missingLocally.join(', ')} (is this repo older than the database?)`);
    const todo = files.filter((f) => !done.has(f));
    if (cmd === 'status') {
      for (const f of files) console.log(`${done.has(f) ? 'applied ' : 'PENDING '} ${f}`);
      console.log(`\n${done.size} applied, ${todo.length} pending`);
    } else if (cmd === 'baseline') {
      if (done.size) { console.error('baseline is only for a database with no recorded migrations.'); process.exitCode = 1; }
      else if (dry) console.log(`would mark ${files.length} files as applied (not run)`);
      else { for (const f of files) await client.query('insert into erp_meta.migrations (filename, checksum) values ($1, $2)', [f, sum(f)]); console.log(`marked ${files.length} files as applied (nothing was executed).`); }
    } else if (!todo.length) console.log('Database is up to date.');
    else {
      for (const f of todo) {
        if (dry) { console.log(`would apply ${f}`); continue; }
        process.stdout.write(`applying ${f} … `);
        try {
          await client.query('begin');
          await client.query(readFileSync(join(dir, f), 'utf8'));
          await client.query('insert into erp_meta.migrations (filename, checksum) values ($1, $2)', [f, sum(f)]);
          await client.query('commit');
          console.log('ok');
        } catch (e) {
          await client.query('rollback').catch(() => {});
          console.log('FAILED');
          console.error(`\n${f}: ${e.message}${e.position ? ` (at character ${e.position})` : ''}\nNothing from this file was applied. Fix the problem and run again.`);
          process.exitCode = 1; break;
        }
      }
      if (!process.exitCode && !dry) console.log(`\nDone: ${todo.length} migration(s) applied.`);
    }
  }
} finally {
  await client.query('select pg_advisory_unlock(727401)').catch(() => {});
  await client.end();
}
