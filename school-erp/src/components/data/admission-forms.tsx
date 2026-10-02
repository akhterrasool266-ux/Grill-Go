'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { ActionButton, ConfirmAction } from '@/components/ui/confirm-form';
import { Alert } from '@/components/ui/primitives';
import { admitApplicant, advanceAdmission, createApplication, updateApplicationDetails } from '@/app/actions/admissions';

type Opt = { value: string; label: string };
export function ApplicationForm({ classes, campuses, defaults = {} }: { classes: Opt[]; campuses?: Opt[]; defaults?: Record<string, string> }) {
  const d = (k: string) => defaults[k] ?? '';
  return (
    <ActionForm action={createApplication} className="grid gap-4 sm:grid-cols-2">
      {defaults.enquiry_id && <input type="hidden" name="enquiry_id" value={defaults.enquiry_id} />}
      {campuses && <Field label="Campus" name="campus_id" required className="sm:col-span-2"><Select name="campus_id" options={campuses} placeholder="Select campus…" /></Field>}
      <Field label="Admission type" name="type" required><Select name="type" defaultValue="new" options={[{ value: 'new', label: 'New admission' }, { value: 'transfer', label: 'Transfer from another school' }, { value: 'readmission', label: 'Re-admission' }]} /></Field>
      <Field label="Class applying for" name="class_applied_id" required><Select name="class_applied_id" defaultValue={d('class_applied_id')} options={classes} placeholder="Select…" /></Field>
      <Field label="Applicant's full name" name="full_name" required><Input name="full_name" defaultValue={d('full_name')} /></Field>
      <Field label="Gender" name="gender" required><Select name="gender" defaultValue={d('gender')} placeholder="Select…" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} /></Field>
      <Field label="Date of birth" name="dob"><Input name="dob" type="date" /></Field><Field label="B-Form no." name="b_form_no"><Input name="b_form_no" inputMode="numeric" /></Field>
      <Field label="Father's name" name="father_name"><Input name="father_name" /></Field><Field label="Mother's name" name="mother_name"><Input name="mother_name" /></Field>
      <Field label="Guardian's name" name="guardian_name" required><Input name="guardian_name" defaultValue={d('guardian_name')} /></Field>
      <Field label="Relation" name="guardian_relation"><Select name="guardian_relation" defaultValue="father" options={['father', 'mother', 'guardian', 'other'].map((x) => ({ value: x, label: x[0]!.toUpperCase() + x.slice(1) }))} /></Field>
      <Field label="Mobile" name="phone" required><Input name="phone" type="tel" inputMode="tel" defaultValue={d('phone')} /></Field><Field label="WhatsApp" name="whatsapp"><Input name="whatsapp" type="tel" inputMode="tel" /></Field>
      <Field label="Guardian CNIC" name="guardian_cnic"><Input name="guardian_cnic" inputMode="numeric" /></Field><Field label="Email" name="email"><Input name="email" type="email" defaultValue={d('email')} /></Field>
      <Field label="Address" name="address" className="sm:col-span-2"><Input name="address" /></Field><Field label="City" name="city"><Input name="city" /></Field>
      <Field label="Previous school" name="previous_school"><Input name="previous_school" /></Field><Field label="Previous class" name="previous_class"><Input name="previous_class" /></Field><Field label="Transfer certificate no." name="transfer_certificate_no"><Input name="transfer_certificate_no" /></Field>
      <div className="sm:col-span-2"><SubmitButton size="lg">Create application</SubmitButton></div>
    </ActionForm>
  );
}

export function ReviewForm({ classes, a }: { classes: Opt[]; a: { class_applied_id: string | null; id: string; documents_verified: boolean; test_date: string | null; test_score: number | null; test_max: number | null; interview_date: string | null; interview_notes: string | null } }) {
  return (
    <ActionForm action={updateApplicationDetails} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={a.id} />
      <Field label="Class applying for" name="class_applied_id"><Select name="class_applied_id" defaultValue={a.class_applied_id ?? ''} options={classes} placeholder="Select…" /></Field><span />
      <Checkbox name="documents_verified" label="Documents verified (B-Form, previous result, photographs…)" defaultChecked={a.documents_verified} className="sm:col-span-2" />
      <Field label="Test date" name="test_date"><Input name="test_date" type="date" defaultValue={a.test_date ?? ''} /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Score" name="test_score"><Input name="test_score" type="number" step="0.5" defaultValue={a.test_score ?? ''} /></Field><Field label="Out of" name="test_max"><Input name="test_max" type="number" step="0.5" defaultValue={a.test_max ?? ''} /></Field></div>
      <Field label="Interview" name="interview_date"><Input name="interview_date" type="datetime-local" defaultValue={a.interview_date ? a.interview_date.slice(0, 16) : ''} /></Field>
      <Field label="Interview notes" name="interview_notes"><Textarea name="interview_notes" rows={2} defaultValue={a.interview_notes ?? ''} /></Field>
      <div className="sm:col-span-2"><SubmitButton variant="secondary">Save review</SubmitButton></div>
    </ActionForm>
  );
}

const NEXT: Record<string, { stage: string; label: string }[]> = {
  application: [{ stage: 'document_verification', label: 'Start document verification' }],
  document_verification: [{ stage: 'test_interview', label: 'Send to test / interview' }, { stage: 'approval', label: 'Skip to approval' }],
  test_interview: [{ stage: 'approval', label: 'Send for approval' }],
  waitlisted: [{ stage: 'approval', label: 'Move to approval' }],
};
export function StageActions({ id, stage, canApprove, sections }: { id: string; stage: string; canApprove: boolean; sections: Opt[] }) {
  const [section, setSection] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const final = ['admitted', 'rejected', 'withdrawn'].includes(stage);
  if (final) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(NEXT[stage] ?? []).map((n) => <ActionButton key={n.stage} action={advanceAdmission} data={{ id, stage: n.stage }} variant="primary" size="md">{n.label}</ActionButton>)}
        {canApprove && stage !== 'waitlisted' && <ConfirmAction action={advanceAdmission} data={{ id, stage: 'waitlisted' }} withReason title="Waitlist this applicant?" confirmLabel="Waitlist" variant="secondary" size="md">Waitlist</ConfirmAction>}
        {canApprove && <ConfirmAction action={advanceAdmission} data={{ id, stage: 'rejected' }} withReason title="Reject this application?" confirmLabel="Reject" size="md">Reject</ConfirmAction>}
        <ConfirmAction action={advanceAdmission} data={{ id, stage: 'withdrawn' }} title="Mark as withdrawn?" confirmLabel="Withdraw" variant="ghost" size="md">Withdrawn</ConfirmAction>
      </div>
      {stage === 'approval' && canApprove && (
        <div className="rounded-[14px] border border-brand/40 bg-brand-soft/40 p-4">
          <p className="mb-2 text-sm font-medium">Admit and assign a section — this creates the student, family, student ID and the admission fee voucher.</p>
          <div className="flex flex-wrap gap-2"><select className="input w-56" value={section} onChange={(e) => setSection(e.target.value)} aria-label="Section"><option value="">Choose section…</option>{sections.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            <ConfirmAction action={async (d: { id: string; section_id: string }) => { const r = await admitApplicant(d); if (r.ok) { setMsg(r.message ?? 'Admitted'); const sid = (r.data as { student_id: string }).student_id; router.push(`/students/${sid}?created=${(r.data as { student_code: string }).student_code}`); } return r; }} data={{ id, section_id: section }} title="Admit this student?" message="A student record and ID will be created." confirmLabel="Admit" variant="primary" size="md">Admit student</ConfirmAction></div>
          {msg && <Alert tone="ok">{msg}</Alert>}
        </div>
      )}
    </div>
  );
}
