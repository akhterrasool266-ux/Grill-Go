'use client';
import { ActionForm, Field, Select, SubmitButton, Input, Textarea } from '@/components/ui/action-form';
import { ActionButton } from '@/components/ui/confirm-form';
import { retryFailed, sendClassMessage, sendNow } from '@/app/actions/communication';

type Opt = { value: string; label: string };
export function ClassMessageForm({ classes, sections, campuses }: { classes: Opt[]; sections: Opt[]; campuses?: Opt[] }) {
  return (
    <ActionForm action={sendClassMessage} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      {campuses && <Field label="Campus" name="campus_id" required className="sm:col-span-2"><Select name="campus_id" options={campuses} placeholder="Select…" /></Field>}
      <Field label="Class (blank = everyone)" name="class_id"><Select name="class_id" options={classes} placeholder="All classes" /></Field>
      <Field label="Section (optional)" name="section_id"><Select name="section_id" options={sections} placeholder="All sections" /></Field>
      <Field label="Title (optional)" name="title" className="sm:col-span-2"><Input name="title" maxLength={80} /></Field>
      <Field label="Message" name="body" required className="sm:col-span-2" hint="Goes to each child's primary guardian by the channel chosen in Settings → Notifications."><Textarea name="body" rows={3} maxLength={600} /></Field>
      <div className="sm:col-span-2"><SubmitButton>Queue message</SubmitButton></div>
    </ActionForm>
  );
}
export const SendNowButton = () => <ActionButton action={sendNow} data={{}} variant="primary" size="md">Send queued now</ActionButton>;
export const RetryButton = () => <ActionButton action={retryFailed} data={{}} size="md">Retry failed</ActionButton>;
