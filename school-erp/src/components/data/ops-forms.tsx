'use client';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { ActionButton, ConfirmAction } from '@/components/ui/confirm-form';
import { createAnnouncement, createHomework, deleteHomework, issueBook, markNotificationsRead, renewBook, returnBook, submitHomework } from '@/app/actions/ops';

type Opt = { value: string; label: string };
export function IssueForm({ books }: { books: Opt[] }) {
  return (
    <ActionForm action={issueBook} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
      <Field label="Book" name="book_id" required className="sm:col-span-1"><Select name="book_id" options={books} placeholder="Select a book…" /></Field>
      <Field label="Student or staff ID" name="borrower" required><Input name="borrower" className="uppercase" placeholder="STD-0001 or EMP-0001" autoComplete="off" /></Field>
      <div className="flex items-end"><SubmitButton>Issue book</SubmitButton></div>
    </ActionForm>
  );
}
export function LoanActions({ id }: { id: string }) {
  return <div className="flex gap-1.5"><ActionButton action={returnBook} data={{ id }} variant="soft">Return</ActionButton><ActionButton action={renewBook} data={{ id }}>Renew</ActionButton><ConfirmAction action={returnBook} data={{ id, lost: 'true' }} title="Mark as lost?" message="The copy is removed from stock." confirmLabel="Mark lost" variant="ghost">Lost</ConfirmAction></div>;
}
export function HomeworkForm({ sections, subjects }: { sections: Opt[]; subjects: Opt[] }) {
  return (
    <ActionForm action={createHomework} className="grid gap-4 sm:grid-cols-2">
      <Field label="Class & section" name="section_id" required><Select name="section_id" options={sections} placeholder="Select…" /></Field>
      <Field label="Subject" name="subject_id"><Select name="subject_id" options={subjects} placeholder="—" /></Field>
      <Field label="Title" name="title" required className="sm:col-span-2"><Input name="title" /></Field>
      <Field label="Instructions" name="description" className="sm:col-span-2"><Textarea name="description" rows={3} /></Field>
      <Field label="Due date" name="due_date" required><Input name="due_date" type="date" /></Field>
      <div className="flex items-end"><Checkbox name="allow_submission" label="Students can submit answers online" /></div>
      <div className="sm:col-span-2"><SubmitButton size="lg">Publish homework</SubmitButton></div>
    </ActionForm>
  );
}
export function DeleteHomework({ id }: { id: string }) { return <ConfirmAction action={deleteHomework} data={{ id }} title="Delete this homework?" confirmLabel="Delete" variant="ghost">Delete</ConfirmAction>; }
export function SubmitHomeworkForm({ homeworkId, studentId }: { homeworkId: string; studentId: string }) {
  return <ActionForm action={submitHomework} className="flex gap-2"><input type="hidden" name="homework_id" value={homeworkId} /><input type="hidden" name="student_id" value={studentId} /><Input name="text_answer" placeholder="Type your answer" /><SubmitButton variant="secondary">Submit</SubmitButton></ActionForm>;
}
export function AnnouncementForm({ campuses }: { campuses?: Opt[] }) {
  return (
    <ActionForm action={createAnnouncement} className="grid gap-4 sm:grid-cols-2">
      {campuses && <Field label="Campus (blank = all)" name="campus_id"><Select name="campus_id" options={campuses} placeholder="All campuses" /></Field>}
      <Field label="Title" name="title" required className="sm:col-span-2"><Input name="title" /></Field>
      <Field label="Message" name="body" required className="sm:col-span-2"><Textarea name="body" rows={4} maxLength={2000} /></Field>
      <Field label="Audience" name="audience"><Select name="audience" defaultValue="all" options={[{ value: 'all', label: 'Everyone' }, { value: 'parents', label: 'Parents' }, { value: 'students', label: 'Students' }, { value: 'teachers', label: 'Teachers' }, { value: 'staff', label: 'All staff' }]} /></Field>
      <Field label="Importance" name="level"><Select name="level" defaultValue="info" options={[{ value: 'info', label: 'Normal' }, { value: 'success', label: 'Good news' }, { value: 'warning', label: 'Important' }, { value: 'urgent', label: 'Urgent' }]} /></Field>
      <Checkbox name="is_pinned" label="Pin to the top" /><Checkbox name="notify" label="Also message parents (WhatsApp / SMS outbox)" />
      <div className="sm:col-span-2"><SubmitButton size="lg">Publish</SubmitButton></div>
    </ActionForm>
  );
}
export function MarkAllRead() { return <ActionButton action={markNotificationsRead} data={{}} size="md">Mark all as read</ActionButton>; }
