import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCtx, can } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { csvResponse } from '@/lib/csv';
import { likePattern } from '@/lib/format';

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!can(ctx, 'students.export')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const sb = await createClient();
  let q = sb.from('students').select('student_code,admission_no,roll_no,full_name,gender,dob,b_form_no,father_name,mother_name,status,admission_date,address,city,classes(name),sections(name),campuses(name),student_guardians(is_primary,guardians(full_name,phone,whatsapp))').limit(10000);
  const campus = (await cookies()).get('erp_campus')?.value;
  if (campus && ctx.campuses.some((c) => c.id === campus)) q = q.eq('campus_id', campus);
  const status = sp.get('status') ?? 'active';
  if (status !== 'all') q = q.eq('status', status);
  if (sp.get('class')) q = q.eq('class_id', sp.get('class')!);
  if (sp.get('section')) q = q.eq('section_id', sp.get('section')!);
  if (sp.get('q')) { const p = likePattern(sp.get('q')!); q = q.or(`full_name.ilike.${p},student_code.ilike.${p},admission_no.ilike.${p},father_name.ilike.${p}`); }
  const { data, error } = await q.order('full_name');
  if (error) return NextResponse.json({ error: 'Could not export' }, { status: 500 });
  await sb.rpc('log_audit', { p_action: 'export', p_table: 'students', p_record: null, p_new: { rows: data?.length ?? 0 } });
  const rows: (string | number | null)[][] = [['Student ID', 'Admission no.', 'Roll no.', 'Name', 'Gender', 'Date of birth', 'B-Form', 'Father', 'Mother', 'Class', 'Section', 'Campus', 'Status', 'Admission date', 'Guardian', 'Guardian phone', 'WhatsApp', 'Address', 'City']];
  for (const s of (data ?? []) as any[]) {
    const g = (s.student_guardians ?? []).sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))[0]?.guardians;
    rows.push([s.student_code, s.admission_no, s.roll_no, s.full_name, s.gender, s.dob, s.b_form_no, s.father_name, s.mother_name, s.classes?.name, s.sections?.name, s.campuses?.name, s.status, s.admission_date, g?.full_name, g?.phone, g?.whatsapp, s.address, s.city]);
  }
  return csvResponse(`students-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
