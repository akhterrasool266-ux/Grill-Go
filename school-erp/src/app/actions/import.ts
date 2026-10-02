'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callAction } from '@/lib/actions';
import { currentCampus, type Ctx } from '@/lib/auth/session';
import { friendlyError } from '@/lib/errors';
import type { Report } from '@/lib/import/engine';
import { validateFees, validateMarks, validateStaff, validateStudents } from '@/lib/import/kinds';
import * as v from '@/lib/validation/common';

const KINDS = ['students', 'staff', 'marks', 'fees'] as const;
const PERM: Record<(typeof KINDS)[number], string> = { students: 'students.create', staff: 'staff.create', marks: 'marks.create', fees: 'fees.create' };

export interface ImportOutcome { report: Pick<Report, 'headerErrors' | 'unknownHeaders' | 'counts'> & { rows: { line: number; status: string; errors: string[]; preview: string }[] }; committed?: { created: number; failed: { line: number; error: string }[] } }

const schema = z.object({
  kind: z.enum(KINDS), csv: z.string().min(1, 'Choose a file first.').max(1_500_000, 'That file is too large (max 1.5 MB).'), commit: z.boolean(),
  campus_id: v.optUuid(), exam_subject_id: v.optUuid(),
});

async function campusFor(ctx: Ctx, picked?: string) {
  const c = (await currentCampus(ctx)) ?? picked;
  if (!c || !ctx.campuses.some((x) => x.id === c)) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };
  return c;
}

async function build(sb: SupabaseClient, ctx: Ctx, kind: (typeof KINDS)[number], csv: string, picked: { campus?: string; examSubject?: string }) {
  if (kind === 'marks') {
    if (!picked.examSubject) throw { code: 'X', message: 'Choose the exam and subject these marks belong to.' };
    const { data: es } = await sb.from('exam_subjects').select('id,campus_id,class_id,max_marks').eq('id', picked.examSubject).single();
    if (!es) throw { code: 'X', message: 'Exam subject not found.' };
    const { data: studs } = await sb.from('students').select('id,student_code').eq('class_id', es.class_id).eq('status', 'active');
    return { campus: es.campus_id as string, es, report: validateMarks(csv, { max: Number(es.max_marks), students: new Map((studs ?? []).map((s: any) => [String(s.student_code).toUpperCase(), s.id as string])) }) };
  }
  const campus = await campusFor(ctx, picked.campus);
  if (kind === 'students') {
    const [{ data: classes }, { data: sections }] = await Promise.all([sb.from('classes').select('id,name').eq('campus_id', campus), sb.from('sections').select('id,name,class_id').eq('campus_id', campus)]);
    const { data: adm } = await sb.from('students').select('admission_no,b_form_no').eq('campus_id', campus).limit(20000);
    const { data: adm2 } = await sb.from('students').select('admission_no,b_form_no').neq('campus_id', campus).limit(20000);
    const all = [...(adm ?? []), ...(adm2 ?? [])] as { admission_no: string; b_form_no: string | null }[];
    return { campus, report: validateStudents(csv, {
      classes: new Map((classes ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id as string])),
      sections: new Map((sections ?? []).map((s: any) => [`${s.class_id}|${String(s.name).toLowerCase()}`, s.id as string])),
      existingAdmissionNos: new Set(all.map((s) => s.admission_no.toLowerCase())), existingBForms: new Set(all.map((s) => s.b_form_no).filter(Boolean) as string[]),
    }) };
  }
  if (kind === 'staff') {
    const { data } = await sb.from('staff').select('employee_code,cnic').limit(20000);
    return { campus, report: validateStaff(csv, { codes: new Set((data ?? []).map((s: any) => String(s.employee_code).toUpperCase())), cnics: new Set((data ?? []).map((s: any) => s.cnic).filter(Boolean)) }) };
  }
  const [{ data: classes }, { data: cats }] = await Promise.all([sb.from('classes').select('id,name').eq('campus_id', campus), sb.from('fee_categories').select('id,code').eq('is_active', true)]);
  return { campus, report: validateFees(csv, { classes: new Map((classes ?? []).map((c: any) => [String(c.name).toLowerCase(), c.id as string])), categories: new Map((cats ?? []).map((c: any) => [String(c.code).toLowerCase(), c.id as string])) }) };
}

export const runImport = callAction<z.infer<typeof schema>, ImportOutcome>({
  permission: (raw) => [PERM[(raw?.kind as keyof typeof PERM)] ?? '__none__'], schema,
}, async ({ ctx, sb, input }) => {
  const built = await build(sb, ctx, input.kind, input.csv, { campus: input.campus_id, examSubject: input.exam_subject_id });
  const { report } = built;
  const show = report.rows.slice(0, 400).map((r) => ({ line: r.line, status: r.status, errors: r.errors, preview: Object.values(r.raw).filter(Boolean).slice(0, 3).join(' · ') }));
  const outcome: ImportOutcome = { report: { headerErrors: report.headerErrors, unknownHeaders: report.unknownHeaders, counts: report.counts, rows: show } };
  if (!input.commit) return { data: outcome };
  if (report.headerErrors.length) throw { code: 'X', message: report.headerErrors[0] };

  // Re-validated server-side above; only rows that passed are written, and each row reports its own failure.
  const failed: { line: number; error: string }[] = [];
  let created = 0;
  const ok = report.rows.filter((r) => r.status === 'valid' && r.data);
  if (input.kind === 'marks') {
    const rows = ok.map((r) => ({ student_id: (r.data as any).student_id, marks: (r.data as any).marks ?? '', absent: (r.data as any).absent, remarks: (r.data as any).remarks }));
    const { error } = await sb.rpc('save_marks', { p_exam_subject: input.exam_subject_id, p_rows: rows });
    if (error) throw error;
    created = rows.length;
  } else if (input.kind === 'fees') {
    const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
    if (!year) throw { code: 'X', message: 'no_current_academic_year' };
    for (const r of ok) {
      const d = r.data as any;
      let q = sb.from('fee_structures').select('id').eq('campus_id', built.campus).eq('academic_year_id', year.id).eq('fee_category_id', d.fee_category_id);
      q = d.class_id ? q.eq('class_id', d.class_id) : q.is('class_id', null);
      const { data: ex } = await q.maybeSingle();
      const res = ex ? await sb.from('fee_structures').update({ amount: d.amount, frequency: d.frequency }).eq('id', ex.id)
                     : await sb.from('fee_structures').insert({ campus_id: built.campus, academic_year_id: year.id, class_id: d.class_id, fee_category_id: d.fee_category_id, amount: d.amount, frequency: d.frequency });
      if (res.error) failed.push({ line: r.line, error: friendlyError(res.error) }); else created++;
    }
  } else {
    const fn = input.kind === 'students' ? 'create_student' : 'create_staff';
    for (const r of ok) {
      const { error } = await sb.rpc(fn, { p_campus: built.campus, p: r.data });
      if (error) failed.push({ line: r.line, error: friendlyError(error) }); else created++;
    }
  }
  await sb.rpc('log_audit', { p_action: `import_${input.kind}`, p_table: input.kind, p_record: null, p_new: { created, failed: failed.length, skipped_invalid: report.counts.invalid + report.counts.duplicate } });
  revalidatePath('/students'); revalidatePath('/staff');
  return { data: { ...outcome, committed: { created, failed } }, message: `Imported ${created} row${created === 1 ? '' : 's'}.` };
});
