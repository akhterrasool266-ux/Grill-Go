'use client';
import { ActionForm, Field, Input, Select, SubmitButton } from '@/components/ui/action-form';
import { postJournal } from '@/app/actions/finance';

export function JournalForm({ accounts, today, campuses }: { accounts: { value: string; label: string }[]; today: string; campuses?: { value: string; label: string }[] }) {
  return (
    <ActionForm action={postJournal} resetOnSuccess className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">{campuses && <Field label="Campus" name="campus_id"><Select name="campus_id" options={campuses} placeholder="Select…" /></Field>}<Field label="Date" name="entry_date"><Input name="entry_date" type="date" defaultValue={today} /></Field><Field label="Memo" name="memo" className={campuses ? '' : 'sm:col-span-2'}><Input name="memo" placeholder="e.g. Owner capital introduced" /></Field></div>
      <div className="space-y-2">{[0, 1, 2, 3].map((i) => (<div key={i} className="grid grid-cols-[1fr_6.5rem_6.5rem] gap-2"><select name="gl" className="input" aria-label={`Account ${i + 1}`}><option value="">Account…</option>{accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select><input name="debit" type="number" min={0} step="0.01" className="input" placeholder="Debit" aria-label="Debit" /><input name="credit" type="number" min={0} step="0.01" className="input" placeholder="Credit" aria-label="Credit" /></div>))}</div>
      <p className="text-xs text-muted">Debits must equal credits. Entries are append-only — correct a mistake with a reversing entry.</p>
      <SubmitButton>Post entry</SubmitButton>
    </ActionForm>
  );
}
