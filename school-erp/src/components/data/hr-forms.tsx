'use client';
import { useState } from 'react';
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { ActionButton, ConfirmAction } from '@/components/ui/confirm-form';
import { approvePayroll, cancelLeave, createStaff, decideLeave, generatePayroll, payPayroll, requestLeave, updateStaff } from '@/app/actions/hr';

type Opt = { value: string; label: string };
export function StaffForm({ mode, id, v = {}, departments, designations, campuses }: { mode: 'create' | 'edit'; id?: string; v?: Record<string, string | number | null>; departments: Opt[]; designations: Opt[]; campuses?: Opt[] }) {
  const d = (k: string) => (v[k] ?? '') as string;
  return (
    <ActionForm action={mode === 'create' ? createStaff : updateStaff} className="grid gap-4 sm:grid-cols-2">
      {id && <input type="hidden" name="id" value={id} />}
      {campuses && <Field label="Campus" name="campus_id" required className="sm:col-span-2"><Select name="campus_id" options={campuses} placeholder="Select campus…" /></Field>}
      <Field label="Full name" name="full_name" required><Input name="full_name" defaultValue={d('full_name')} /></Field>
      <Field label="Gender" name="gender"><Select name="gender" defaultValue={d('gender')} placeholder="—" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} /></Field>
      <Field label="Mobile" name="phone" required><Input name="phone" type="tel" inputMode="tel" defaultValue={d('phone')} /></Field>
      <Field label="Email" name="email"><Input name="email" type="email" defaultValue={d('email')} /></Field>
      <Field label="CNIC" name="cnic" hint="35202-1234567-1"><Input name="cnic" inputMode="numeric" defaultValue={d('cnic')} /></Field>
      <Field label="Date of birth" name="dob"><Input name="dob" type="date" defaultValue={d('dob')} /></Field>
      <Field label="Department" name="department_id"><Select name="department_id" defaultValue={d('department_id')} options={departments} placeholder="—" /></Field>
      <Field label="Designation" name="designation_id"><Select name="designation_id" defaultValue={d('designation_id')} options={designations} placeholder="—" /></Field>
      <Field label="Employment type" name="employment_type" required><Select name="employment_type" defaultValue={d('employment_type') || 'permanent'} options={[{ value: 'permanent', label: 'Permanent' }, { value: 'contract', label: 'Contract' }, { value: 'part_time', label: 'Part time' }, { value: 'visiting', label: 'Visiting' }]} /></Field>
      <Field label="Joining date" name="joining_date"><Input name="joining_date" type="date" defaultValue={d('joining_date')} /></Field>
      <Field label="Qualification" name="qualification"><Input name="qualification" defaultValue={d('qualification')} /></Field>
      <Field label="Experience (years)" name="experience_years"><Input name="experience_years" type="number" step="0.5" defaultValue={d('experience_years')} /></Field>
      <Field label="Shift starts" name="shift_start" hint="Used to mark late arrivals"><Input name="shift_start" type="time" defaultValue={d('shift_start').slice(0, 5) || '08:00'} /></Field>
      <Field label="Shift ends" name="shift_end"><Input name="shift_end" type="time" defaultValue={d('shift_end').slice(0, 5) || '14:00'} /></Field>
      <Field label="Bank" name="bank_name"><Input name="bank_name" defaultValue={d('bank_name')} /></Field><Field label="Account no. / IBAN" name="bank_account"><Input name="bank_account" defaultValue={d('bank_account')} /></Field>
      <Field label="Address" name="address" className="sm:col-span-2"><Input name="address" defaultValue={d('address')} /></Field>
      <div className="sm:col-span-2"><SubmitButton size="lg">{mode === 'create' ? 'Add staff member' : 'Save changes'}</SubmitButton></div>
    </ActionForm>
  );
}

export function LeaveForm({ types }: { types: Opt[] }) {
  return (
    <ActionForm action={requestLeave} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <Field label="Leave type" name="leave_type_id" required><Select name="leave_type_id" options={types} placeholder="Select…" /></Field><span />
      <Field label="From" name="from_date" required><Input name="from_date" type="date" /></Field><Field label="To" name="to_date" required><Input name="to_date" type="date" /></Field>
      <Field label="Reason" name="reason" required className="sm:col-span-2"><Textarea name="reason" rows={2} /></Field>
      <div className="sm:col-span-2"><SubmitButton>Send request</SubmitButton></div>
    </ActionForm>
  );
}
export function LeaveActions({ id, canDecide, mine }: { id: string; canDecide: boolean; mine: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canDecide && !mine && <ActionButton action={decideLeave} data={{ id, decision: 'approved' }} variant="primary">Approve</ActionButton>}
      {canDecide && !mine && <ConfirmAction action={decideLeave} data={{ id, decision: 'rejected' }} withReason title="Reject this leave?" confirmLabel="Reject">Reject</ConfirmAction>}
      {mine && <ConfirmAction action={cancelLeave} data={{ id }} title="Cancel your request?" confirmLabel="Cancel request" variant="ghost">Cancel</ConfirmAction>}
    </div>
  );
}

export function PayrollGenerate({ month, campuses }: { month: string; campuses?: Opt[] }) {
  return (
    <ActionForm action={generatePayroll} className="flex flex-wrap items-end gap-3">
      {campuses && <Field label="Campus" name="campus_id"><Select name="campus_id" options={campuses} placeholder="Select…" /></Field>}
      <Field label="Month" name="month"><Input name="month" type="month" defaultValue={month} /></Field>
      <SubmitButton pendingText="Calculating…">Generate / refresh draft</SubmitButton>
    </ActionForm>
  );
}
export function PayrollActions({ id, status, accounts, canApprove }: { id: string; status: string; accounts: Opt[]; canApprove: boolean }) {
  const [acct, setAcct] = useState('');
  if (!canApprove) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'draft' && <ConfirmAction action={approvePayroll} data={{ id }} title="Approve this payroll?" message="Approved payroll can no longer be regenerated." confirmLabel="Approve" variant="primary" size="md">Approve payroll</ConfirmAction>}
      {status === 'approved' && (<>
        {accounts.length > 0 && <select className="input w-52" value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Pay from"><option value="">Default account</option>{accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>}
        <ConfirmAction action={payPayroll} data={{ id, account_id: acct || undefined }} title="Mark salaries as paid?" message="This records the payout in the cash book and reduces staff loan balances by their instalments." confirmLabel="Mark paid" variant="primary" size="md">Mark as paid</ConfirmAction></>)}
    </div>
  );
}
