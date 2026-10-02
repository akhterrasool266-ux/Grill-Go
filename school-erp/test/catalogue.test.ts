import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS } from '@/lib/auth/catalogue';

/** The permission list exists twice (SQL seed + TypeScript). If they drift, a page can ask for a permission nobody can ever hold. */
describe('permission catalogue parity', () => {
  const sql = readFileSync('supabase/migrations/0009_permissions_bootstrap.sql', 'utf8');
  const block = sql.slice(sql.indexOf('values'), sql.indexOf('on conflict'));
  const fromSql = new Set<string>();
  for (const m of block.matchAll(/\('([a-z_]+)',\s*array\[([^\]]*)\]\)/g)) for (const a of m[2]!.matchAll(/'([a-z_]+)'/g)) fromSql.add(`${m[1]}.${a[1]}`);
  const fromTs = new Set<string>(ALL_PERMISSIONS);

  it('parses the SQL seed', () => expect(fromSql.size).toBeGreaterThan(100));
  it('has no permission only in TypeScript', () => expect([...fromTs].filter((p) => !fromSql.has(p))).toEqual([]));
  it('has no permission only in SQL', () => expect([...fromSql].filter((p) => !fromTs.has(p))).toEqual([]));
  it('uses module.action naming', () => expect([...fromTs].every((p) => /^[a-z_]+\.[a-z_]+$/.test(p))).toBe(true));
});
