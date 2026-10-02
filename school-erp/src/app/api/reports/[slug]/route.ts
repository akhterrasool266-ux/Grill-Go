import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { can, getCtx } from '@/lib/auth/session';
import { csvResponse } from '@/lib/csv';
import { findReport, reportsFor } from '@/lib/reports';
import { todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const ctx = await getCtx();
  const def = findReport((await params).slug);
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!def || !reportsFor(ctx).some((r) => r.slug === def.slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!can(ctx, 'reports.export')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = req.nextUrl.searchParams, today = todayISO(), campus = (await cookies()).get('erp_campus')?.value;
  const sb = await createClient();
  const res = await def.run(sb, { campus: campus && ctx.campuses.some((c) => c.id === campus) ? campus : null, from: sp.get('from') ?? today.slice(0, 8) + '01', to: sp.get('to') ?? today, month: sp.get('month') ?? today.slice(0, 7), exam: sp.get('exam') ?? undefined, date: sp.get('date') ?? today }, ctx);
  await sb.rpc('log_audit', { p_action: 'export', p_table: `report:${def.slug}`, p_record: null, p_new: { rows: res.rows.length } });
  return csvResponse(`${def.slug}-${today}.csv`, [res.columns, ...res.rows]);
}
