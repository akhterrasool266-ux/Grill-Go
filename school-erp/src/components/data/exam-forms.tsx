'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ActionForm, Field, Input, Select, SubmitButton } from '@/components/ui/action-form';
import { ActionButton, ConfirmAction } from '@/components/ui/confirm-form';
import { Alert } from '@/components/ui/primitives';
import { addExamSubjects, createExam, generateResults, promoteStudents, publishResults, removeExamSubject, saveMarks, saveRemarks, setExamStatus } from '@/app/actions/exams';

type Opt = { value: string; label: string };

export function ExamCreateForm({ gradings, campuses }: { gradings: Opt[]; campuses?: Opt[] }) {
  return (
    <ActionForm action={createExam} className="grid gap-4 sm:grid-cols-2">
      {campuses && <Field label="Campus" name="campus_id" required className="sm:col-span-2"><Select name="campus_id" options={campuses} placeholder="Select campus…" /></Field>}
      <Field label="Exam name" name="name" required className="sm:col-span-2"><Input name="name" placeholder="e.g. Mid Term 2026" /></Field>
      <Field label="Type" name="kind" required><Select name="kind" defaultValue="term" options={[{ value: 'monthly', label: 'Monthly test' }, { value: 'test', label: 'Class test' }, { value: 'midterm', label: 'Mid term' }, { value: 'term', label: 'Term exam' }, { value: 'final', label: 'Final' }]} /></Field>
      <Field label="Grading system" name="grading_system_id"><Select name="grading_system_id" options={gradings} placeholder="School default" /></Field>
      <Field label="Starts" name="start_date"><Input name="start_date" type="date" /></Field><Field label="Ends" name="end_date"><Input name="end_date" type="date" /></Field>
      <Field label="Position (rank) in" name="position_scope"><Select name="position_scope" defaultValue="section" options={[{ value: 'section', label: 'Section' }, { value: 'class', label: 'Whole class' }, { value: 'none', label: 'No positions' }]} /></Field>
      <div className="sm:col-span-2"><SubmitButton size="lg">Create exam</SubmitButton></div>
    </ActionForm>
  );
}

export function PaperForm({ examId, classes, subjects }: { examId: string; classes: Opt[]; subjects: Opt[] }) {
  return (
    <ActionForm action={addExamSubjects} resetOnSuccess className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="exam_id" value={examId} />
      <Field label="Subject" name="subject_id" required><Select name="subject_id" options={subjects} placeholder="Select…" /></Field>
      <Field label="Class" name="class_id"><Select name="class_id" options={classes} placeholder="All classes" /></Field>
      <Field label="Date" name="exam_date"><Input name="exam_date" type="date" /></Field>
      <div className="grid grid-cols-2 gap-2"><Field label="From" name="start_time"><Input name="start_time" type="time" /></Field><Field label="To" name="end_time"><Input name="end_time" type="time" /></Field></div>
      <Field label="Max marks" name="max_marks" required><Input name="max_marks" type="number" defaultValue={100} min={1} /></Field>
      <Field label="Passing marks" name="passing_marks" required><Input name="passing_marks" type="number" defaultValue={40} min={0} /></Field>
      <div className="flex items-end sm:col-span-2"><SubmitButton variant="secondary">Add paper</SubmitButton></div>
    </ActionForm>
  );
}

export function RemovePaper({ id, examId }: { id: string; examId: string }) {
  return <ConfirmAction action={removeExamSubject} data={{ id, exam_id: examId }} title="Remove this paper?" message="Marks already entered for it will be deleted too." confirmLabel="Remove" variant="ghost">Remove</ConfirmAction>;
}

export function ExamControls({ examId, status, canPublish, canLock }: { examId: string; status: string; canPublish: boolean; canLock: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'draft' && <ActionButton action={setExamStatus} data={{ exam_id: examId, status: 'scheduled' }} variant="primary" size="md">Schedule exam</ActionButton>}
      {['scheduled', 'marks_entry'].includes(status) && <ActionButton action={generateResults} data={{ exam_id: examId }} size="md">Generate results</ActionButton>}
      {status === 'marks_entry' && canLock && <ConfirmAction action={setExamStatus} data={{ exam_id: examId, status: 'locked' }} title="Lock marks?" message="Teachers will no longer be able to change marks. Only users with the approve right can unlock." confirmLabel="Lock" variant="secondary" size="md">Lock marks</ConfirmAction>}
      {['marks_entry', 'locked'].includes(status) && canPublish && <ConfirmAction action={publishResults} data={{ exam_id: examId }} title="Publish results?" message="Parents and students will see the result cards and guardians are notified. Generate results first." confirmLabel="Publish" variant="primary" size="md">Publish results</ConfirmAction>}
      {['locked', 'published'].includes(status) && canLock && <ConfirmAction action={setExamStatus} data={{ exam_id: examId, status: 'marks_entry' }} withReason title="Reopen for changes?" message="Published results are withdrawn until you publish again. A reason is required and is audited." confirmLabel="Reopen" variant="secondary" size="md">Reopen</ConfirmAction>}
    </div>
  );
}

export interface MarkRow { id: string; name: string; code: string; roll: string | null; marks: number | null; absent: boolean }
export function MarksGrid({ examSubjectId, max, passing, rows, locked }: { examSubjectId: string; max: number; passing: number; rows: MarkRow[]; locked: boolean }) {
  const [v, setV] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { m: r.marks === null ? '' : String(r.marks), a: r.absent }])));
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const bad = (id: string) => { const n = Number(v[id]!.m); return !v[id]!.a && v[id]!.m !== '' && (!Number.isFinite(n) || n < 0 || n > max); };
  const anyBad = rows.some((r) => bad(r.id));
  const save = () => start(async () => {
    const r = await saveMarks({ exam_subject_id: examSubjectId, rows: rows.filter((x) => v[x.id]!.a || v[x.id]!.m !== '').map((x) => ({ student_id: x.id, marks: v[x.id]!.m, absent: v[x.id]!.a })) });
    if (r.ok) { setMsg({ tone: 'ok', text: r.message ?? 'Saved.' }); router.refresh(); } else setMsg({ tone: 'bad', text: r.error });
  });
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 text-end text-xs text-muted tabular">{r.roll ?? i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.name}</span><span className="block text-xs text-muted">{r.code}</span></span>
            <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" disabled={locked} className="size-4 accent-[var(--bad)]" checked={v[r.id]!.a} onChange={(e) => setV((s) => ({ ...s, [r.id]: { m: '', a: e.target.checked } }))} />Abs</label>
            <input aria-label={`Marks for ${r.name}`} inputMode="decimal" disabled={locked || v[r.id]!.a} value={v[r.id]!.m} onChange={(e) => setV((s) => ({ ...s, [r.id]: { ...s[r.id]!, m: e.target.value } }))} aria-invalid={bad(r.id)}
              className={`input h-10 w-20 min-h-0 py-0 text-center tabular ${v[r.id]!.m !== '' && !bad(r.id) && Number(v[r.id]!.m) < passing ? 'text-bad' : ''}`} placeholder={`/${max}`} />
          </li>
        ))}
      </ul>
      {anyBad && <Alert tone="bad">Marks must be between 0 and {max}.</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {!locked && <button onClick={save} disabled={pending || anyBad} className="h-12 w-full rounded-[10px] bg-brand text-base font-medium text-brand-fg disabled:opacity-50 sm:w-auto sm:px-8">{pending ? 'Saving…' : 'Save marks'}</button>}
    </div>
  );
}

export function RemarksForm({ id, teacher, principal, canPrincipal }: { id: string; teacher: string; principal: string; canPrincipal: boolean }) {
  return (
    <ActionForm action={async (_p, fd) => saveRemarks({ id, teacher_remarks: fd.get('teacher_remarks'), ...(canPrincipal ? { principal_remarks: fd.get('principal_remarks') } : {}) })} className="grid gap-3 sm:grid-cols-2">
      <Field label="Teacher's remarks" name="teacher_remarks"><Input name="teacher_remarks" defaultValue={teacher} maxLength={300} /></Field>
      {canPrincipal && <Field label="Principal's remarks" name="principal_remarks"><Input name="principal_remarks" defaultValue={principal} maxLength={300} /></Field>}
      <div className="sm:col-span-2"><SubmitButton variant="secondary">Save remarks</SubmitButton></div>
    </ActionForm>
  );
}

export interface PromoRow { id: string; name: string; code: string; cls: string; section: string; nextClass: string | null; pct: number | null; status: string | null }
export function PromotionTable({ rows, toYears, sectionsByNext }: { rows: PromoRow[]; toYears: Opt[]; sectionsByNext: Record<string, Opt[]> }) {
  const [year, setYear] = useState(toYears[0]?.value ?? '');
  const [pick, setPick] = useState<Record<string, { outcome: string; conditions: string }>>(() => Object.fromEntries(rows.map((r) => [r.id, { outcome: r.nextClass ? (r.status === 'fail' ? 'retained' : 'promoted') : 'graduated', conditions: '' }])));
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = () => start(async () => {
    const r = await promoteStudents({ to_year: year, rows: rows.map((x) => ({ student_id: x.id, outcome: pick[x.id]!.outcome, conditions: pick[x.id]!.conditions || undefined })) });
    if (r.ok) { setMsg({ tone: 'ok', text: r.message ?? 'Done.' }); router.refresh(); } else setMsg({ tone: 'bad', text: r.error });
  });
  void sectionsByNext;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3"><label className="space-y-1 text-sm font-medium">Promote into academic year<select className="input w-56" value={year} onChange={(e) => setYear(e.target.value)}>{toYears.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}</select></label>
        <div className="flex gap-2 text-sm"><button type="button" className="rounded-full border border-line px-3 py-1.5" onClick={() => setPick(Object.fromEntries(rows.map((r) => [r.id, { outcome: r.nextClass ? 'promoted' : 'graduated', conditions: '' }])))}>All promote</button></div></div>
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[1fr_8rem_11rem_1fr]">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{r.name}</p><p className="text-xs text-muted">{r.code} · {r.cls} {r.section}{r.nextClass ? ` → ${r.nextClass}` : ' · final class'}</p></div>
            <span className="hidden text-sm tabular text-muted sm:block">{r.pct === null ? '—' : `${r.pct}%`} {r.status && <span className={r.status === 'fail' ? 'text-bad' : 'text-ok'}>{r.status}</span>}</span>
            <select aria-label={`Outcome for ${r.name}`} className="input h-9 min-h-0 py-0 text-sm" value={pick[r.id]!.outcome} onChange={(e) => setPick((s) => ({ ...s, [r.id]: { ...s[r.id]!, outcome: e.target.value } }))}>
              {[['promoted', 'Promoted'], ['promoted_conditional', 'Promoted (conditions)'], ['retained', 'Retained'], ['graduated', 'Graduated'], ['transferred', 'Transferred'], ['left', 'Left school']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {pick[r.id]!.outcome === 'promoted_conditional' ? <input aria-label="Conditions" placeholder="Conditions" className="input col-span-2 h-9 min-h-0 py-0 text-sm sm:col-span-1" value={pick[r.id]!.conditions} onChange={(e) => setPick((s) => ({ ...s, [r.id]: { ...s[r.id]!, conditions: e.target.value } }))} /> : <span className="hidden sm:block" />}
          </li>
        ))}
      </ul>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <ConfirmAction action={async () => { run(); return { ok: true as const }; }} title="Promote these students?" message="This moves each student to the next class and records the outcome. Past results, attendance and fee records are kept untouched." confirmLabel="Promote" variant="primary" size="md">{pending ? 'Working…' : `Apply to ${rows.length} students`}</ConfirmAction>
    </div>
  );
}
