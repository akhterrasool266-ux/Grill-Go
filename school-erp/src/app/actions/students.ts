'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import { studentCreateSchema, studentEditSchema } from '@/lib/validation/student';
import * as v from '@/lib/validation/common';

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined && x !== ''));

export const createStudent = formAction({ permission: 'students.create', schema: studentCreateSchema }, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus || !ctx.campuses.some((c) => c.id === campus)) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };
  const { campus_id: _c, ...payload } = input;
  const res = check(await sb.rpc('create_student', { p_campus: campus, p: clean(payload) })) as { id: string; student_code: string; linked_existing_family: boolean };
  revalidatePath('/students');
  redirect(`/students/${res.id}?created=${res.student_code}${res.linked_existing_family ? '&sibling=1' : ''}`);
});

export const updateStudent = formAction({ permission: 'students.edit', schema: studentEditSchema }, async ({ sb, input }) => {
  const { id, class_id, section_id, roll_no, ...rest } = input;
  const patch = { ...rest, dob: rest.dob ?? null, b_form_no: rest.b_form_no ?? null, house_id: rest.house_id ?? null, blood_group: rest.blood_group ?? null,
    father_name: rest.father_name ?? null, mother_name: rest.mother_name ?? null, medical_notes: rest.medical_notes ?? null, address: rest.address ?? null, city: rest.city ?? null,
    province: rest.province ?? null, previous_school: rest.previous_school ?? null, emergency_contact_name: rest.emergency_contact_name ?? null,
    emergency_contact_phone: rest.emergency_contact_phone ?? null, admission_date: rest.admission_date ?? undefined };
  check(await sb.rpc('update_student_placement', { p_student: id, p_class: class_id, p_section: section_id ?? null, p_roll: roll_no ?? null }));
  check(await sb.from('students').update(patch).eq('id', id).select('id').single());
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}?saved=1`);
});

export const addDiscipline = formAction({
  permission: 'students.edit',
  schema: z.object({ student_id: v.uuid(), kind: v.oneOf(['incident', 'warning', 'suspension', 'commendation'] as const), incident_date: v.date('Date'), description: v.text('Description', 1000), action_taken: v.optText(500) }),
}, async ({ sb, input }) => {
  const { data: s } = await sb.from('students').select('campus_id').eq('id', input.student_id).single();
  check(await sb.from('student_discipline').insert({ ...input, action_taken: input.action_taken ?? null, campus_id: s!.campus_id }).select('id').single());
  revalidatePath(`/students/${input.student_id}`);
  return { message: 'Recorded.' };
});

export const setStudentStatus = callAction({
  permission: 'students.edit',
  schema: z.object({ id: v.uuid(), status: v.oneOf(['active', 'left', 'suspended', 'transferred', 'graduated'] as const), reason: v.optText(300) }),
}, async ({ sb, input }) => {
  check(await sb.from('students').update({ status: input.status, left_date: input.status === 'active' ? null : new Date().toISOString().slice(0, 10), left_reason: input.reason ?? null }).eq('id', input.id).select('id').single());
  revalidatePath(`/students/${input.id}`);
  return { message: 'Status updated.' };
});

export const deleteStudent = callAction({ permission: 'students.delete', schema: z.object({ id: v.uuid(), reason: v.text('Reason', 300) }) }, async ({ sb, input }) => {
  // Deleting a student with fee history is blocked by foreign keys on purpose: mark them as left instead.
  await sb.rpc('log_audit', { p_action: 'delete_student_requested', p_table: 'students', p_record: input.id, p_new: { reason: input.reason } });
  check(await sb.from('students').delete().eq('id', input.id).select('id').single());
  revalidatePath('/students');
  return { message: 'Student deleted.' };
});

export const changePlacement = formAction({
  permission: 'students.edit',
  schema: z.object({ id: v.uuid(), class_id: v.uuid('Class'), section_id: v.optUuid(), roll_no: v.optText(20) }),
}, async ({ sb, input }) => {
  check(await sb.rpc('update_student_placement', { p_student: input.id, p_class: input.class_id, p_section: input.section_id ?? null, p_roll: input.roll_no ?? null }));
  revalidatePath(`/students/${input.id}`);
  return { message: 'Class updated.' };
});
