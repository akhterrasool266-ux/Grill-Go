import { parseCsv } from '@/lib/csv';

export interface ColSpec { key: string; label: string; required?: boolean; example: string; aliases?: string[] }
export type RowStatus = 'valid' | 'invalid' | 'duplicate';
export interface RowResult<T = Record<string, unknown>> { line: number; raw: Record<string, string>; data?: T; errors: string[]; status: RowStatus }
export interface Report<T = Record<string, unknown>> {
  headerErrors: string[]; unknownHeaders: string[]; rows: RowResult<T>[];
  counts: { total: number; valid: number; invalid: number; duplicate: number };
}

export const MAX_ROWS = 2000;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Parse CSV text and map its header row onto the expected columns (case/space/underscore-insensitive, with aliases). */
export function readTable(csv: string, cols: ColSpec[]): { rows: { line: number; raw: Record<string, string> }[]; headerErrors: string[]; unknownHeaders: string[] } {
  const table = parseCsv(csv);
  if (table.length === 0) return { rows: [], headerErrors: ['The file is empty.'], unknownHeaders: [] };
  const header = table[0]!.map((h) => norm(h));
  const idx: Record<string, number> = {};
  const used = new Set<number>();
  for (const c of cols) {
    const names = [c.key, c.label, ...(c.aliases ?? [])].map(norm);
    const i = header.findIndex((h, n) => names.includes(h) && !used.has(n));
    if (i >= 0) { idx[c.key] = i; used.add(i); }
  }
  const headerErrors = cols.filter((c) => c.required && idx[c.key] === undefined).map((c) => `Missing required column "${c.label}".`);
  const unknownHeaders = table[0]!.filter((_, i) => !used.has(i) && table[0]![i]!.trim() !== '');
  if (table.length - 1 > MAX_ROWS) headerErrors.push(`Too many rows (${table.length - 1}). Split the file into batches of ${MAX_ROWS}.`);
  const rows = table.slice(1, MAX_ROWS + 1).map((r, n) => ({
    line: n + 2,
    raw: Object.fromEntries(cols.map((c) => [c.key, (idx[c.key] !== undefined ? r[idx[c.key]!] ?? '' : '').trim()])),
  }));
  return { rows, headerErrors, unknownHeaders };
}

export function summarise<T>(rows: RowResult<T>[]): Report<T>['counts'] {
  return { total: rows.length, valid: rows.filter((r) => r.status === 'valid').length, invalid: rows.filter((r) => r.status === 'invalid').length, duplicate: rows.filter((r) => r.status === 'duplicate').length };
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY. Returns ISO date or null. */
export function parseDate(s: string): string | null {
  if (!s) return null;
  let y: number, m: number, d: number;
  let mt = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (mt) { y = +mt[1]!; m = +mt[2]!; d = +mt[3]!; }
  else if ((mt = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) { d = +mt[1]!; m = +mt[2]!; y = +mt[3]!; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function templateCsv(cols: ColSpec[], examples: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '﻿' + [cols.map((c) => c.label + (c.required ? ' *' : '')), ...examples].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}
