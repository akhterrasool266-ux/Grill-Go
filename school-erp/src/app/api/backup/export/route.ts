import { type NextRequest, NextResponse } from 'next/server';
import { can, getCtx } from '@/lib/auth/session';
import { csvResponse } from '@/lib/csv';
import { createClient } from '@/lib/supabase/server';

const ALLOWED = new Set(['students', 'guardians', 'staff', 'fee_invoices', 'payments', 'student_attendance', 'marks', 'result_cards', 'expenses', 'admissions']);
// Columns that must never leave through a bulk export.
const STRIP = new Set(['photo_path']);

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!can(ctx, 'settings.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const table = req.nextUrl.searchParams.get('table') ?? '';
  if (!ALLOWED.has(table)) return NextResponse.json({ error: 'Unknown table' }, { status: 404 });
  const sb = await createClient();
  const { data, error } = await sb.from(table).select('*').limit(100000);   // row-level security still applies
  if (error) return NextResponse.json({ error: 'Could not export' }, { status: 500 });
  await sb.rpc('log_audit', { p_action: 'backup_export', p_table: table, p_record: null, p_new: { rows: data?.length ?? 0 } });
  const rows = (data ?? []) as Record<string, unknown>[];
  const cols = rows.length ? Object.keys(rows[0]!).filter((c) => !STRIP.has(c)) : [];
  return csvResponse(`${table}-${new Date().toISOString().slice(0, 10)}.csv`, [cols, ...rows.map((r) => cols.map((c) => { const v = r[c]; return v !== null && typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean | null); }))]);
}
