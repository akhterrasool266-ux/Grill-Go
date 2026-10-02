'use client';
import { useState } from 'react';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { ActionButton, ConfirmAction } from '@/components/ui/confirm-form';
import { adjustInvoice, applyLateFines, cancelInvoice, closeDay, collectPayment, generateInvoices, refundPayment, sendFeeReminders } from '@/app/actions/fees';
import { pkr } from '@/lib/format';

type Opt = { value: string; label: string };
const METHODS: Opt[] = [{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank deposit' }, { value: 'jazzcash', label: 'JazzCash' }, { value: 'easypaisa', label: 'Easypaisa' }, { value: 'card', label: 'Card' }, { value: 'online_transfer', label: 'Online transfer' }, { value: 'other', label: 'Other' }];

export function GenerateForm({ classes, categories, campuses, month, due }: { classes: Opt[]; categories: Opt[]; campuses?: Opt[]; month: string; due: string }) {
  const [type, setType] = useState('monthly');
  return (
    <div className="space-y-5">
      <ActionForm action={generateInvoices} className="grid gap-4 sm:grid-cols-2">
        {campuses && <Field label="Campus" name="campus_id" required className="sm:col-span-2"><Select name="campus_id" options={campuses} placeholder="Select campus…" /></Field>}
        <Field label="What to bill" name="type"><Select name="type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'monthly', label: 'Monthly fee voucher' }, { value: 'adhoc', label: 'One-off charge (annual, exam, admission…)' }]} /></Field>
        <Field label="Class (optional)" name="class_id"><Select name="class_id" options={classes} placeholder="All classes" /></Field>
        {type === 'monthly'
          ? <Field label="Fee month" name="month" required><Input name="month" type="month" defaultValue={month} /></Field>
          : <Field label="Charge name" name="label" required hint='e.g. "Annual Fee 2026-27"'><Input name="label" /></Field>}
        <Field label="Due date" name="due_date" required><Input name="due_date" type="date" defaultValue={due} /></Field>
        {type === 'adhoc' && (
          <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium">Fee categories</legend>
            <div className="grid gap-2 sm:grid-cols-2">{categories.map((c) => <label key={c.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="categories" value={c.value} className="size-4 accent-[var(--brand)]" />{c.label}</label>)}</div>
          </fieldset>
        )}
        <p className="text-sm text-muted sm:col-span-2">Amounts, discounts, sibling discount, transport/hostel fees and previous balance are calculated on the server from your fee structure. Running it twice never creates duplicate vouchers.</p>
        <div className="sm:col-span-2"><SubmitButton size="lg" pendingText="Generating…">Generate vouchers</SubmitButton></div>
      </ActionForm>
      <div className="border-t border-line pt-4">
        <h3 className="mb-1 text-sm font-semibold">Late fines</h3>
        <p className="mb-2 text-sm text-muted">Adds the late fine configured in Settings → Fees to every overdue voucher (once; waived fines are not re-added).</p>
        <ActionButton action={applyLateFines} data={{}} variant="secondary" size="md">Apply late fines now</ActionButton>
      </div>
    </div>
  );
}

export interface OpenInvoice { id: string; invoice_no: string; period_label: string; balance: number; due_date: string; student?: string }
export function CollectForm({ studentId, familyId, payerDefault, total, invoices, familyMode }: { studentId?: string; familyId?: string; payerDefault: string; total: number; invoices: OpenInvoice[]; familyMode: boolean }) {
  const [method, setMethod] = useState('cash');
  const [pick, setPick] = useState<string[]>([]);
  const due = pick.length ? invoices.filter((i) => pick.includes(i.id)).reduce((a, i) => a + i.balance, 0) : total;
  return (
    <ActionForm action={collectPayment} className="space-y-4">
      {studentId && !familyMode && <input type="hidden" name="student_id" value={studentId} />}
      {familyId && familyMode && <input type="hidden" name="family_id" value={familyId} />}
      {invoices.length > 0 && (
        <fieldset><legend className="mb-1 text-sm font-medium">Pay against <span className="font-normal text-muted">(leave all unticked to settle oldest first)</span></legend>
          <ul className="divide-y divide-line rounded-[10px] border border-line">{invoices.map((i) => (
            <li key={i.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
              <input type="checkbox" name="invoice_ids" value={i.id} className="size-4 accent-[var(--brand)]" onChange={(e) => setPick((p) => e.target.checked ? [...p, i.id] : p.filter((x) => x !== i.id))} />
              <span className="min-w-0 flex-1"><span className="font-medium">{i.period_label}</span>{i.student && <span className="text-muted"> · {i.student}</span>}<span className="block text-xs text-muted">{i.invoice_no} · due {i.due_date}</span></span>
              <span className="tabular font-medium">{pkr(i.balance)}</span>
            </label></li>
          ))}</ul>
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount received (Rs)" name="amount" required hint={`Selected due: ${pkr(due)}. Extra is kept as advance credit.`}><Input key={due} name="amount" type="number" inputMode="decimal" min={1} step={1} defaultValue={due > 0 ? due : ''} className="text-lg font-semibold" /></Field>
        <Field label="Payment method" name="method" required><Select name="method" value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS} /></Field>
        {method !== 'cash' && <Field label="Reference / transaction no." name="reference" required><Input name="reference" autoComplete="off" /></Field>}
        {method === 'bank' && <Field label="Bank" name="bank"><Input name="bank" /></Field>}
        <Field label="Received from" name="payer"><Input name="payer" defaultValue={payerDefault} /></Field>
        <Field label="Notes" name="notes"><Input name="notes" /></Field>
      </div>
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Saving…">Receive payment</SubmitButton>
    </ActionForm>
  );
}

export function RefundForm({ paymentId, max }: { paymentId: string; max: number }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-bad hover:underline">Refund…</button>;
  return (
    <ActionForm action={async (_p, fd) => { const r = await refundPayment({ payment_id: paymentId, amount: fd.get('amount'), reason: fd.get('reason') }); return r; }} className="grid gap-3 rounded-[10px] border border-line p-3 sm:grid-cols-3">
      <Field label="Refund amount" name="amount"><Input name="amount" type="number" min={1} max={max} step={1} defaultValue={max} /></Field>
      <Field label="Reason" name="reason" className="sm:col-span-2"><Input name="reason" /></Field>
      <div className="sm:col-span-3"><SubmitButton variant="danger">Refund</SubmitButton></div>
    </ActionForm>
  );
}

export function AdjustForm({ invoiceId, canWaive }: { invoiceId: string; canWaive: boolean }) {
  return (
    <ActionForm action={async (_p, fd) => adjustInvoice({ invoice_id: invoiceId, kind: fd.get('kind'), amount: fd.get('amount'), description: fd.get('description'), reason: fd.get('reason') })} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <Field label="Adjustment" name="kind"><Select name="kind" options={[{ value: 'discount', label: 'Discount' }, { value: 'fine', label: 'Fine' }, { value: 'charge', label: 'Extra charge' }, ...(canWaive ? [{ value: 'waive_fines', label: 'Waive all fines' }] : [])]} /></Field>
      <Field label="Amount (Rs)" name="amount"><Input name="amount" type="number" min={1} step={1} /></Field>
      <Field label="Description" name="description"><Input name="description" placeholder="e.g. Principal's concession" /></Field>
      <Field label="Reason (recorded in the audit log)" name="reason" required><Input name="reason" /></Field>
      <div className="sm:col-span-2"><SubmitButton variant="secondary">Apply</SubmitButton></div>
    </ActionForm>
  );
}

export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  return <ConfirmAction action={cancelInvoice} data={{ invoice_id: invoiceId }} withReason title="Cancel this voucher?" message="Cancelled vouchers are kept for the records but no longer count as owed." confirmLabel="Cancel voucher">Cancel voucher</ConfirmAction>;
}

export function CloseDayForm({ today, campuses, expected }: { today: string; campuses?: Opt[]; expected: number }) {
  return (
    <ActionForm action={closeDay} className="grid gap-4 sm:grid-cols-2">
      {campuses && <Field label="Campus" name="campus_id" required className="sm:col-span-2"><Select name="campus_id" options={campuses} placeholder="Select campus…" /></Field>}
      <Field label="Date" name="date" required><Input name="date" type="date" defaultValue={today} max={today} /></Field>
      <Field label="Cash counted in the drawer (Rs)" name="counted" required hint={`System expects ${pkr(expected)} in cash today.`}><Input name="counted" type="number" min={0} step={1} defaultValue={expected} /></Field>
      <Field label="Notes" name="notes" className="sm:col-span-2"><Textarea name="notes" rows={2} /></Field>
      <div className="sm:col-span-2"><SubmitButton>Close day</SubmitButton><p className="mt-2 text-xs text-muted">After closing, no more payments can be recorded for that date.</p></div>
    </ActionForm>
  );
}

export function ReminderBar({ ids }: { ids: string[] }) {
  return <ActionButton action={sendFeeReminders} data={{ student_ids: ids }} variant="primary" size="md">Queue reminder for {ids.length} selected</ActionButton>;
}
void Checkbox;
