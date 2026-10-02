'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import * as v from '@/lib/validation/common';

export const createExam = formAction({
  permission: 'exams.create',
  schema: z.object({ name: v.text('Exam name', 100), kind: v.oneOf(['monthly', 'test', 'midterm', 'term', 'final'] as const, 'Type'), start_date: v.optDate(), end_date: v.optDate(), grading_system_id: v.optUuid(), position_scope: v.oneOf(['none', 'section', 'class'] as const), campus_id: v.optUuid() }),
}, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
  if (!year) throw { code: 'X', message: 'no_current_academic_year' };
  const { campus_id: _c, ...rest } = input;
  const row = check(await sb.from('exams').insert({ ...rest, grading_system_id: rest.grading_system_id ?? null, start_date: rest.start_date ?? null, end_date: rest.end_date ?? null, campus_id: campus, academic_year_id: year.id, status: 'draft' }).select('id').single());
  redirect(`/exams/${row!.id}`);
});

/** Adds one paper (subject) for one or all classes of the exam's campus. */
export const addExamSubjects = formAction({
  permission: 'exams.edit',
  schema: z.object({ exam_id: v.uuid(), class_id: v.optUuid(), subject_id: v.uuid('Subject'), exam_date: v.optDate(), start_time: v.optTime(), end_time: v.optTime(), max_marks: v.num('Max marks', 1, 1000), passing_marks: v.num('Passing marks', 0, 1000) }),
}, async ({ sb, input }) => {
  if (input.passing_marks > input.max_marks) throw { code: 'X', message: 'Passing marks cannot be more than the maximum marks.' };
  const { data: ex } = await sb.from('exams').select('campus_id').eq('id', input.exam_id).single();
  const { data: classes } = input.class_id ? { data: [{ id: input.class_id }] } : await sb.from('classes').select('id').eq('campus_id', ex!.campus_id).eq('is_active', true);
  const rows = (classes ?? []).map((c: any) => ({ exam_id: input.exam_id, campus_id: ex!.campus_id, class_id: c.id, subject_id: input.subject_id, exam_date: input.exam_date ?? null, start_time: input.start_time ?? null, end_time: input.end_time ?? null, max_marks: input.max_marks, passing_marks: input.passing_marks }));
  check(await sb.from('exam_subjects').upsert(rows, { onConflict: 'exam_id,class_id,subject_id' }).select('id'));
  revalidatePath(`/exams/${input.exam_id}`);
  return { message: `Scheduled for ${rows.length} class${rows.length === 1 ? '' : 'es'}.` };
});

export const removeExamSubject = callAction({ permission: 'exams.edit', schema: z.object({ id: v.uuid(), exam_id: v.uuid() }) }, async ({ sb, input }) => {
  check(await sb.from('exam_subjects').delete().eq('id', input.id).select('id').single());
  revalidatePath(`/exams/${input.exam_id}`);
  return { message: 'Removed.' };
});

export const setExamStatus = callAction({ schema: z.object({ exam_id: v.uuid(), status: z.enum(['draft', 'scheduled', 'marks_entry', 'locked']), reason: v.optText(300) }) }, async ({ sb, input }) => {
  check(await sb.rpc('set_exam_status', { p_exam: input.exam_id, p_status: input.status, p_reason: input.reason ?? null }));
  revalidatePath(`/exams/${input.exam_id}`);
  return { message: 'Exam updated.' };
});

export const saveMarks = callAction({
  permission: 'marks.create',
  schema: z.object({ exam_subject_id: v.uuid(), rows: z.array(z.object({ student_id: v.uuid(), marks: z.union([z.string(), z.number()]).optional(), absent: z.boolean().optional(), remarks: v.optText(200) })).min(1).max(300) }),
}, async ({ sb, input }) => {
  const r = check(await sb.rpc('save_marks', { p_exam_subject: input.exam_subject_id, p_rows: input.rows.map((x) => ({ student_id: x.student_id, marks: x.absent ? '' : String(x.marks ?? ''), absent: !!x.absent, remarks: x.remarks })) })) as { saved: number };
  revalidatePath('/exams');
  return { message: `${r.saved} mark${r.saved === 1 ? '' : 's'} saved.` };
});

export const generateResults = callAction({ permission: 'results.create', schema: z.object({ exam_id: v.uuid(), class_id: v.optUuid() }) }, async ({ sb, input }) => {
  const r = check(await sb.rpc('generate_results', { p_exam: input.exam_id, p_class: input.class_id ?? null })) as { generated: number };
  revalidatePath(`/exams/${input.exam_id}`);
  return { message: `Results generated for ${r.generated} students.` };
});

export const publishResults = callAction({ permission: ['exams.publish'], schema: z.object({ exam_id: v.uuid() }) }, async ({ sb, input }) => {
  const r = check(await sb.rpc('publish_results', { p_exam: input.exam_id })) as { published: number };
  revalidatePath(`/exams/${input.exam_id}`);
  return { message: `Published ${r.published} result cards. Parents will be notified through the outbox.` };
});

export const saveRemarks = callAction({ permission: 'results.create', schema: z.object({ id: v.uuid(), teacher_remarks: v.optText(300), principal_remarks: v.optText(300) }) }, async ({ ctx, sb, input }) => {
  const patch: Record<string, string | null> = {};
  if (input.teacher_remarks !== undefined) patch.teacher_remarks = input.teacher_remarks;
  if (input.principal_remarks !== undefined && ctx.permissions.includes('results.publish')) patch.principal_remarks = input.principal_remarks;
  check(await sb.from('result_cards').update(patch).eq('id', input.id).select('id').single());
  revalidatePath(`/results/${input.id}`);
  return { message: 'Remarks saved.' };
});

export const promoteStudents = callAction({
  permission: 'promotion.create',
  schema: z.object({ to_year: v.uuid('Target academic year'), rows: z.array(z.object({ student_id: v.uuid(), outcome: z.enum(['promoted', 'promoted_conditional', 'retained', 'transferred', 'graduated', 'left']), to_section_id: v.optUuid(), conditions: v.optText(300), remarks: v.optText(300) })).min(1).max(500) }),
}, async ({ sb, input }) => {
  const r = check(await sb.rpc('promote_students', { p_rows: input.rows, p_to_year: input.to_year })) as { processed: number };
  revalidatePath('/promotion'); revalidatePath('/students');
  return { message: `${r.processed} student${r.processed === 1 ? '' : 's'} processed. History is preserved.` };
});
