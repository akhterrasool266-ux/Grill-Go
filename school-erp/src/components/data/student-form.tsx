'use client';
import { useMemo, useState } from 'react';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { LinkButton } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/primitives';
import { createStudent, updateStudent } from '@/app/actions/students';

type Opt = { value: string; label: string };
export interface StudentFormValues { [k: string]: string | boolean | null | undefined }

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card><CardBody>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {hint && <p className="mb-3 text-sm text-muted">{hint}</p>}
      <div className={`grid gap-4 sm:grid-cols-2 ${hint ? '' : 'mt-3'}`}>{children}</div>
    </CardBody></Card>
  );
}

export function StudentForm({ mode, studentId, values = {}, classes, sections, houses, campuses, backHref }: {
  mode: 'create' | 'edit'; studentId?: string; values?: StudentFormValues;
  classes: Opt[]; sections: (Opt & { class_id: string })[]; houses: Opt[]; campuses?: Opt[]; backHref: string;
}) {
  const [cls, setCls] = useState<string>((values.class_id as string) ?? '');
  const secOpts = useMemo(() => sections.filter((s) => s.class_id === cls), [sections, cls]);
  const v = (k: string) => (values[k] as string | undefined) ?? '';
  return (
    <ActionForm action={mode === 'create' ? createStudent : updateStudent} className="space-y-4">
      {studentId && <input type="hidden" name="id" value={studentId} />}
      <Group title="Student">
        {campuses && <Field label="Campus" name="campus_id" required className="sm:col-span-2"><Select name="campus_id" options={campuses} placeholder="Select campus…" /></Field>}
        <Field label="Full name" name="full_name" required className="sm:col-span-2"><Input name="full_name" defaultValue={v('full_name')} autoComplete="off" /></Field>
        <Field label="Gender" name="gender" required><Select name="gender" defaultValue={v('gender')} placeholder="Select…" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} /></Field>
        <Field label="Date of birth" name="dob"><Input name="dob" type="date" defaultValue={v('dob')} /></Field>
        <Field label="B-Form / CNIC no." name="b_form_no" hint="13 digits, e.g. 35202-1234567-1"><Input name="b_form_no" inputMode="numeric" defaultValue={v('b_form_no')} /></Field>
        <Field label="Blood group" name="blood_group"><Select name="blood_group" defaultValue={v('blood_group')} placeholder="—" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => ({ value: b, label: b }))} /></Field>
        <Field label="Father's name" name="father_name"><Input name="father_name" defaultValue={v('father_name')} /></Field>
        <Field label="Mother's name" name="mother_name"><Input name="mother_name" defaultValue={v('mother_name')} /></Field>
      </Group>

      <Group title="Class">
        <Field label="Class" name="class_id" required><Select name="class_id" value={cls} onChange={(e) => setCls(e.target.value)} placeholder="Select class…" options={classes} /></Field>
        <Field label="Section" name="section_id" hint={cls && secOpts.length === 0 ? 'This class has no sections yet — add them under Academics.' : undefined}>
          <Select name="section_id" key={cls} defaultValue={secOpts.some((s) => s.value === v('section_id')) ? v('section_id') : ''} placeholder="—" options={secOpts} />
        </Field>
        <Field label="Roll number" name="roll_no"><Input name="roll_no" defaultValue={v('roll_no')} /></Field>
        <Field label="House" name="house_id"><Select name="house_id" defaultValue={v('house_id')} placeholder="—" options={houses} /></Field>
        {mode === 'create' && <Field label="Admission no." name="admission_no" hint="Leave blank to generate automatically"><Input name="admission_no" defaultValue="" /></Field>}
        <Field label="Admission date" name="admission_date"><Input name="admission_date" type="date" defaultValue={v('admission_date')} /></Field>
        <Field label="Previous school" name="previous_school" className="sm:col-span-2"><Input name="previous_school" defaultValue={v('previous_school')} /></Field>
      </Group>

      {mode === 'create' && (
        <Group title="Parent / guardian" hint="If this phone number already belongs to a family, the child is linked as a sibling automatically.">
          <Field label="Existing family ID (optional)" name="family_code" hint="e.g. FAM-0007 — for adding a sibling when the phone differs" className="sm:col-span-2"><Input name="family_code" className="uppercase" defaultValue="" /></Field>
          <Field label="Guardian name" name="g_name"><Input name="g_name" defaultValue="" autoComplete="off" /></Field>
          <Field label="Relation" name="g_relation"><Select name="g_relation" defaultValue="father" options={[{ value: 'father', label: 'Father' }, { value: 'mother', label: 'Mother' }, { value: 'guardian', label: 'Guardian' }, { value: 'other', label: 'Other' }]} /></Field>
          <Field label="Mobile (for messages)" name="g_phone" hint="e.g. 0300-1234567"><Input name="g_phone" type="tel" inputMode="tel" defaultValue="" /></Field>
          <Field label="WhatsApp (if different)" name="g_whatsapp"><Input name="g_whatsapp" type="tel" inputMode="tel" defaultValue="" /></Field>
          <Field label="Guardian CNIC" name="g_cnic"><Input name="g_cnic" inputMode="numeric" defaultValue="" /></Field>
          <Field label="Occupation" name="g_occupation"><Input name="g_occupation" defaultValue="" /></Field>
          <Field label="Email" name="g_email" className="sm:col-span-2"><Input name="g_email" type="email" inputMode="email" defaultValue="" /></Field>
        </Group>
      )}

      <Group title="Contact & health">
        <Field label="Address" name="address" className="sm:col-span-2"><Input name="address" defaultValue={v('address')} /></Field>
        <Field label="City" name="city"><Input name="city" defaultValue={v('city')} /></Field>
        <Field label="Province" name="province"><Select name="province" defaultValue={v('province')} placeholder="—" options={['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Kashmir'].map((p) => ({ value: p, label: p }))} /></Field>
        <Field label="Emergency contact name" name="emergency_contact_name"><Input name="emergency_contact_name" defaultValue={v('emergency_contact_name')} /></Field>
        <Field label="Emergency contact phone" name="emergency_contact_phone"><Input name="emergency_contact_phone" type="tel" inputMode="tel" defaultValue={v('emergency_contact_phone')} /></Field>
        <Field label="Medical notes" name="medical_notes" className="sm:col-span-2" hint="Allergies, conditions, medication"><Textarea name="medical_notes" rows={2} defaultValue={v('medical_notes')} /></Field>
        <Checkbox name="hostel_status" label="Boarder (uses hostel)" defaultChecked={Boolean(values.hostel_status)} />
      </Group>

      <div className="sticky bottom-16 z-10 -mx-4 flex gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-0">
        <SubmitButton size="lg">{mode === 'create' ? 'Add student' : 'Save changes'}</SubmitButton>
        <LinkButton href={backHref} variant="secondary" size="lg">Cancel</LinkButton>
      </div>
    </ActionForm>
  );
}
