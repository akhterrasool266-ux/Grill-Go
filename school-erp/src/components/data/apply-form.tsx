'use client';
import { useState } from 'react';
import { submitAdmission } from '@/app/actions/public';
import { ActionForm, SubmitButton, TextAreaField, TextField, SelectField } from '@/components/ui/action-form';
import { Alert } from '@/components/ui/primitives';

type Opt = { value: string; label: string };
export function ApplyForm({ slug, campuses, classes }: { slug: string; campuses: Opt[]; classes: (Opt & { campus: string })[] }) {
  const [campus, setCampus] = useState(campuses[0]?.value ?? '');
  const [done, setDone] = useState<string | null>(null);
  if (done) return <Alert tone="ok" title="Application received">Your application number is <b>{done}</b>. Please keep it. The school office will contact you on the mobile number you gave.</Alert>;
  return (
    <ActionForm action={submitAdmission} className="space-y-4" onDone={(r) => { if (r.ok) setDone((r.data as { no: string }).no); }}>
      <input type="hidden" name="slug" value={slug} />
      <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="full_name" label="Child's full name" required />
        <SelectField name="gender" label="Gender" required options={[{ value: 'male', label: 'Boy' }, { value: 'female', label: 'Girl' }, { value: 'other', label: 'Other' }]} placeholder="Select" />
        <TextField name="dob" type="date" label="Date of birth" />
        <TextField name="b_form_no" label="B-Form number" />
        {campuses.length > 1 && <SelectField name="campus_id" label="Campus" options={campuses} value={campus} onChange={(e) => setCampus(e.target.value)} />}
        <SelectField name="class_id" label="Class applying for" options={classes.filter((c) => campuses.length < 2 || c.campus === campus)} placeholder="Select" />
        <TextField name="previous_school" label="Previous school" />
        <TextField name="previous_class" label="Previous class" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="guardian_name" label="Parent / guardian name" required />
        <SelectField name="guardian_relation" label="Relation" options={[{ value: 'father', label: 'Father' }, { value: 'mother', label: 'Mother' }, { value: 'guardian', label: 'Guardian' }]} />
        <TextField name="phone" type="tel" inputMode="tel" label="Mobile number" hint="03XX-XXXXXXX" required />
        <TextField name="whatsapp" type="tel" inputMode="tel" label="WhatsApp (if different)" />
        <TextField name="email" type="email" label="Email" />
        <TextField name="guardian_cnic" label="Guardian CNIC" hint="13 digits" />
        <TextField name="city" label="City" />
      </div>
      <TextAreaField name="address" label="Address" rows={2} />
      <SubmitButton pendingText="Sending…">Submit application</SubmitButton>
    </ActionForm>
  );
}
