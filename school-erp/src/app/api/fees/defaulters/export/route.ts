import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { can, getCtx } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { csvResponse } from '@/lib/csv';

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!can(ctx, 'fees.export')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const campus = (await cookies()).get('erp_campus')?.value;
  const sb = await createClient();
  const { data, error } = await sb.rpc('fee_defaulters', { p_campus: campus && ctx.campuses.some((c) => c.id === campus) ? campus : null, p_class: sp.get('class') || null, p_section: sp.get('section') || null, p_from: sp.get('from') ? `${sp.get('from')}-01` : null, p_to: sp.get('to') ? `${sp.get('to')}-01` : null, p_invoice_type: sp.get('type') || null, p_family: null });
  if (error) return NextResponse.json({ error: 'Could not export' }, { status: 500 });
  await sb.rpc('log_audit', { p_action: 'export', p_table: 'fee_defaulters', p_record: null, p_new: { rows: (data ?? []).length } });
  const rows: (string | number | null)[][] = [['Student ID', 'Student', 'Class', 'Section', 'Family', 'Parent', 'Phone', 'Outstanding (PKR)', 'Overdue vouchers', 'Max days overdue', 'Last payment']];
  for (const r of (data ?? []) as any[]) rows.push([r.student_code, r.student_name, r.class_name, r.section_name, r.family_name, r.guardian_name, r.guardian_phone, r.outstanding, r.overdue_invoices, r.max_days_overdue, r.last_payment_date]);
  return csvResponse(`defaulters-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
