'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import * as v from '@/lib/validation/common';

const person = {
  full_name: v.text('Applicant name', 120), gender: v.oneOf(['male', 'female', 'other'] as const, 'Gender'), dob: v.optDate(), b_form_no: v.optCnic(),
  father_name: v.optText(120), mother_name: v.optText(120), guardian_name: v.text("Guardian's name", 120), guardian_relation: z.preprocess((x) => x || 'father', z.enum(['father', 'mother', 'guardian', 'other'])),
  guardian_cnic: v.optCnic(), phone: v.phone('Phone'), whatsapp: v.optPhone(), email: v.optEmail(), address: v.optText(300), city: v.optText(80),
  previous_school: v.optText(160), previous_class: v.optText(60), transfer_certificate_no: v.optText(60), class_applied_id: v.uuid('Class applying for'),
};
const nul = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x === undefined ? null : x]));

export const createApplication = formAction({
  permission: 'admissions.create',
  schema: z.object({ ...person, type: v.oneOf(['new', 'transfer', 'readmission'] as const), campus_id: v.optUuid(), enquiry_id: v.optUuid() }),
}, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };
  const { campus_id: _c, ...rest } = input;
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
  const row = check(await sb.from('admissions').insert({ ...nul(rest), enquiry_id: rest.enquiry_id ?? null, campus_id: campus, academic_year_id: year?.id ?? null, stage: 'application' }).select('id').single());
  if (rest.enquiry_id) await sb.from('enquiries').update({ status: 'visited' }).eq('id', rest.enquiry_id).neq('status', 'converted');
  revalidatePath('/admissions');
  redirect(`/admissions/${row!.id}`);
});

export const updateApplicationDetails = formAction({
  permission: 'admissions.edit',
  schema: z.object({ id: v.uuid(), documents_verified: v.bool(), test_date: v.optDate(), test_score: v.optNum(0, 1000), test_max: v.optNum(0, 1000), interview_date: v.optText(30), interview_notes: v.optText(500), class_applied_id: v.optUuid() }),
}, async ({ sb, input }) => {
  const { id, interview_date, ...rest } = input;
  check(await sb.from('admissions').update({ ...nul(rest), interview_date: interview_date ? new Date(interview_date).toISOString() : null }).eq('id', id).select('id').single());
  revalidatePath(`/admissions/${id}`);
  return { message: 'Saved.' };
});

export const advanceAdmission = callAction({ permission: 'admissions.edit', schema: z.object({ id: v.uuid(), stage: z.enum(['application', 'document_verification', 'test_interview', 'approval', 'rejected', 'waitlisted', 'withdrawn']), notes: v.optText(300) }) }, async ({ sb, input }) => {
  check(await sb.rpc('advance_admission', { p_id: input.id, p_stage: input.stage, p_notes: input.notes ?? null }));
  revalidatePath(`/admissions/${input.id}`); revalidatePath('/admissions');
  return { message: 'Stage updated.' };
});

export const admitApplicant = callAction({ permission: 'admissions.approve', schema: z.object({ id: v.uuid(), section_id: v.uuid('Section') }) }, async ({ sb, input }) => {
  const r = check(await sb.rpc('admit_applicant', { p_admission: input.id, p_section: input.section_id })) as { student_id: string; student_code: string };
  revalidatePath('/admissions'); revalidatePath('/students');
  return { message: `Admitted — student ID ${r.student_code}.`, data: r };
});

export const convertEnquiry = callAction({ permission: 'admissions.create', schema: z.object({ id: v.uuid() }) }, async ({ sb, input }) => {
  const { data: e } = await sb.from('enquiries').select('*').eq('id', input.id).single();
  if (!e) throw { code: 'X', message: 'Enquiry not found.' };
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
  const row = check(await sb.from('admissions').insert({ campus_id: e.campus_id, enquiry_id: e.id, full_name: e.child_name, gender: e.gender ?? 'male', guardian_name: e.guardian_name, phone: e.phone, email: e.email, class_applied_id: e.class_sought_id, academic_year_id: year?.id ?? null, stage: 'application', source: 'staff' }).select('id').single());
  await sb.from('enquiries').update({ status: 'visited', converted_admission_id: row!.id }).eq('id', e.id);
  revalidatePath('/admissions');
  return { data: { id: row!.id }, message: 'Application created from the enquiry.' };
});
