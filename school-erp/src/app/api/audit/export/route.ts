import { type NextRequest, NextResponse } from 'next/server';
import { can, getCtx } from '@/lib/auth/session';
import { csvResponse } from '@/lib/csv';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!can(ctx, 'audit.export')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = req.nextUrl.searchParams, sb = await createClient();
  let q = sb.from('audit_logs').select('created_at,user_id,action,table_name,record_id,old_data,new_data,ip').order('id', { ascending: false }).limit(10000);
  if (sp.get('table')) q = q.eq('table_name', sp.get('table')!);
  if (sp.get('action')) q = q.eq('action', sp.get('action')!);
  if (sp.get('from')) q = q.gte('created_at', `${sp.get('from')}T00:00:00+05:00`);
  if (sp.get('to')) q = q.lte('created_at', `${sp.get('to')}T23:59:59+05:00`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: 'Could not export' }, { status: 500 });
  await sb.rpc('log_audit', { p_action: 'export', p_table: 'audit_logs', p_record: null, p_new: { rows: data?.length ?? 0 } });
  return csvResponse('audit-log.csv', [['When', 'User id', 'Action', 'Record type', 'Record id', 'Old', 'New', 'IP'], ...((data ?? []) as any[]).map((r) => [r.created_at, r.user_id, r.action, r.table_name, r.record_id, r.old_data ? JSON.stringify(r.old_data) : '', r.new_data ? JSON.stringify(r.new_data) : '', r.ip])]);
}
