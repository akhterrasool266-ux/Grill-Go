import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { can, getCtx } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { csvResponse } from '@/lib/csv';

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!can(ctx, 'attendance.export')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = req.nextUrl.searchParams, campus = (await cookies()).get('erp_campus')?.value;
  const sb = await createClient();
  const { data, error } = await sb.rpc('attendance_summary', { p_campus: campus && ctx.campuses.some((c) => c.id === campus) ? campus : null, p_from: sp.get('from'), p_to: sp.get('to'), p_class: sp.get('class') || null, p_section: sp.get('section') || null });
  if (error) return NextResponse.json({ error: 'Could not export' }, { status: 500 });
  const rows: (string | number | null)[][] = [['Student ID', 'Name', 'Class', 'Section', 'Present', 'Absent', 'Late', 'Leave', 'Half day', 'Marked days', 'Attendance %']];
  for (const r of (data ?? []) as any[]) rows.push([r.student_code, r.student_name, r.class_name, r.section_name, r.present, r.absent, r.late, r.leave, r.half_day, r.marked_days, r.percentage]);
  return csvResponse(`attendance-${sp.get('from')}-${sp.get('to')}.csv`, rows);
}
