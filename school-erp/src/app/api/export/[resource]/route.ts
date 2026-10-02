import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCtx } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { csvResponse } from '@/lib/csv';
import { getResource } from '@/lib/resources/registry';
import { getPath, needs } from '@/lib/resources/engine';
import { likePattern } from '@/lib/format';

export async function GET(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const def = getResource((await params).resource);
  const ctx = await getCtx();
  if (!def || !ctx) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const canExport = ctx.permissions.includes(def.exportPerm ?? `${def.perm}.export`) || ctx.permissions.includes('reports.export');
  if (!needs(ctx, def, 'view') || !canExport) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = await createClient();
  let q = sb.from(def.table).select(def.select ?? '*').limit(5000);
  const campus = (await cookies()).get('erp_campus')?.value;
  if (def.campusScoped && campus && ctx.campuses.some((c) => c.id === campus)) q = q.eq('campus_id', campus);
  const term = req.nextUrl.searchParams.get('q');
  if (term && def.searchCols?.length) q = q.or(def.searchCols.map((c) => `${c}.ilike.${likePattern(term)}`).join(','));
  const [oc, asc] = def.order ?? ['id', true];
  const { data, error } = await q.order(oc, { ascending: asc });
  if (error) return NextResponse.json({ error: 'Could not export' }, { status: 500 });
  await sb.rpc('log_audit', { p_action: 'export', p_table: def.table, p_record: null, p_new: { rows: data?.length ?? 0, resource: def.key } });
  const rows = [def.columns.map((c) => c.label), ...((data ?? []) as any[]).map((r) => def.columns.map((c) => { const v = getPath(r, c.key); return typeof v === 'object' && v !== null ? JSON.stringify(v) : (v as string | number | null); }))];
  return csvResponse(`${def.key}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
