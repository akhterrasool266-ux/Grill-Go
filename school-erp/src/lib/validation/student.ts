import { z } from 'zod';
import * as v from './common';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const personal = {
  full_name: v.text('Student name', 120),
  gender: v.oneOf(['male', 'female', 'other'] as const, 'Gender'),
  dob: v.optDate(),
  b_form_no: v.optCnic(),
  father_name: v.optText(120),
  mother_name: v.optText(120),
  class_id: v.uuid('Class'),
  section_id: v.optUuid(),
  house_id: v.optUuid(),
  roll_no: v.optText(20),
  blood_group: z.preprocess((x) => (x === '' ? undefined : x), z.enum(BLOOD).optional()),
  medical_notes: v.optText(1000),
  address: v.optText(300), city: v.optText(80), province: v.optText(80),
  previous_school: v.optText(160),
  emergency_contact_name: v.optText(120),
  emergency_contact_phone: v.optPhone(),
  hostel_status: v.bool(),
};

export const studentEditSchema = z.object({ id: v.uuid('Student'), ...personal, admission_date: v.optDate() });

export const studentCreateSchema = z.object({
  ...personal,
  admission_no: v.optText(30),
  admission_date: v.optDate(),
  campus_id: v.optUuid(),
  family_code: v.optText(30),
  g_name: v.optText(120),
  g_relation: z.preprocess((x) => (x === '' ? undefined : x), z.enum(['father', 'mother', 'guardian', 'other']).optional()),
  g_cnic: v.optCnic(),
  g_phone: v.optPhone(),
  g_whatsapp: v.optPhone(),
  g_email: v.optEmail(),
  g_occupation: v.optText(80),
}).superRefine((d, ctx) => {
  if (!d.family_code) {
    if (!d.g_name) ctx.addIssue({ code: 'custom', path: ['g_name'], message: "Parent / guardian's name is required." });
    if (!d.g_phone) ctx.addIssue({ code: 'custom', path: ['g_phone'], message: 'A phone number is required — it is used for fee and absence messages.' });
  }
});
export type StudentCreate = z.infer<typeof studentCreateSchema>;
