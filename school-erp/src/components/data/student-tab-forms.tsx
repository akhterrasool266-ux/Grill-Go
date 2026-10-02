'use client';
import { useMemo, useState } from 'react';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { addDiscipline, changePlacement } from '@/app/actions/students';
import { uploadDocument } from '@/app/actions/documents';

const DOC_TYPES: [string, string][] = [['photo', 'Photo'], ['b_form', 'B-Form'], ['cnic', 'Guardian CNIC'], ['birth_certificate', 'Birth certificate'], ['transfer_certificate', 'Transfer certificate'], ['previous_result', 'Previous result'], ['medical', 'Medical record'], ['certificate', 'Certificate'], ['other', 'Other']];

export function StudentDocUpload({ studentId }: { studentId: string }) {
  return (
    <ActionForm action={uploadDocument} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="owner_type" value="student" /><input type="hidden" name="owner_id" value={studentId} />
      <Field label="Document type" name="doc_type" required><Select name="doc_type" defaultValue="b_form" options={DOC_TYPES.map(([value, label]) => ({ value, label }))} /></Field>
      <Field label="Title (optional)" name="title"><Input name="title" /></Field>
      <Field label="File" name="file" required hint="PDF, JPG, PNG, WEBP or Word · max 10 MB" className="sm:col-span-2"><Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" capture={undefined} /></Field>
      <Checkbox name="visible_to_guardian" label="Share with parents in their portal" defaultChecked={false} className="sm:col-span-2" />
      <div className="sm:col-span-2"><SubmitButton pendingText="Uploading…">Upload</SubmitButton></div>
    </ActionForm>
  );
}

export function DisciplineForm({ studentId, today }: { studentId: string; today: string }) {
  return (
    <ActionForm action={addDiscipline} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="student_id" value={studentId} />
      <Field label="Type" name="kind" required><Select name="kind" defaultValue="incident" options={[{ value: 'incident', label: 'Incident' }, { value: 'warning', label: 'Warning' }, { value: 'suspension', label: 'Suspension' }, { value: 'commendation', label: 'Commendation' }]} /></Field>
      <Field label="Date" name="incident_date" required><Input name="incident_date" type="date" defaultValue={today} /></Field>
      <Field label="What happened" name="description" required className="sm:col-span-2"><Textarea name="description" rows={2} /></Field>
      <Field label="Action taken" name="action_taken" className="sm:col-span-2"><Input name="action_taken" /></Field>
      <div className="sm:col-span-2"><SubmitButton>Save record</SubmitButton></div>
    </ActionForm>
  );
}

export function PlacementForm({ studentId, classId, sectionId, rollNo, classes, sections }: {
  studentId: string; classId: string | null; sectionId: string | null; rollNo: string | null;
  classes: { value: string; label: string }[]; sections: { value: string; label: string; class_id: string }[];
}) {
  const [cls, setCls] = useState(classId ?? '');
  const opts = useMemo(() => sections.filter((s) => s.class_id === cls), [sections, cls]);
  return (
    <ActionForm action={changePlacement} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="id" value={studentId} />
      <Field label="Class" name="class_id"><Select name="class_id" value={cls} onChange={(e) => setCls(e.target.value)} options={classes} placeholder="Select…" /></Field>
      <Field label="Section" name="section_id"><Select name="section_id" key={cls} defaultValue={opts.some((s) => s.value === sectionId) ? sectionId ?? '' : ''} options={opts} placeholder="—" /></Field>
      <Field label="Roll no." name="roll_no"><Input name="roll_no" defaultValue={rollNo ?? ''} /></Field>
      <div className="sm:col-span-3"><SubmitButton variant="secondary">Update placement</SubmitButton></div>
    </ActionForm>
  );
}
