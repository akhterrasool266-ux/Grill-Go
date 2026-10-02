'use client';
import { createSchool, savePlan, saveSubscription, setFlag, setSchoolStatus } from '@/app/actions/platform';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, TextField } from '@/components/ui/action-form';
import { FEATURES, LIMIT_KEYS } from '@/lib/platform';

type Opt = { value: string; label: string };
const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const Limits = ({ v = {}, blank }: { v?: Record<string, number>; blank: string }) => (<>{LIMIT_KEYS.map((k) => <TextField key={k} name={k} type="number" min={0} label={label(k)} defaultValue={v[k] ?? ''} placeholder={blank} />)}</>);

export function CreateSchoolForm({ plans }: { plans: Opt[] }) {
  return (
    <ActionForm action={createSchool} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TextField name="name" label="School name" required /><TextField name="slug" label="Web name" hint="lowercase, e.g. al-noor → /site/al-noor" required />
      <TextField name="campus_name" label="First campus name" defaultValue="Main Campus" required /><TextField name="campus_code" label="Campus code" defaultValue="MAIN" required />
      <TextField name="owner_name" label="Owner's name" required /><TextField name="owner_email" type="email" label="Owner's email (login)" required />
      <Field label="Plan" name="plan_id"><Select name="plan_id" options={plans} placeholder="No plan (unmetered)" /></Field>
      <div className="flex items-end"><SubmitButton pendingText="Creating…">Create school</SubmitButton></div>
    </ActionForm>
  );
}
export function StatusForm({ id, status }: { id: string; status: string }) {
  return (<ActionForm action={setSchoolStatus} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={id} />
    <Field label="Status" name="status"><Select name="status" defaultValue={status} options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended (users cannot sign in to data)' }, { value: 'archived', label: 'Archived' }]} /></Field><SubmitButton variant="secondary">Update</SubmitButton></ActionForm>);
}
export function SubscriptionForm({ schoolId, plans, sub }: { schoolId: string; plans: Opt[]; sub: any }) {
  return (
    <ActionForm action={saveSubscription} className="space-y-4"><input type="hidden" name="school_id" value={schoolId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Plan" name="plan_id" required><Select name="plan_id" options={plans} defaultValue={sub?.plan_id ?? ''} placeholder="Select" /></Field>
        <Field label="Status" name="status"><Select name="status" defaultValue={sub?.status ?? 'trialing'} options={['trialing', 'active', 'past_due', 'cancelled'].map((x) => ({ value: x, label: label(x) }))} /></Field>
        <TextField name="period_end" type="date" label="Paid until" defaultValue={sub?.current_period_end ?? ''} />
        <TextField name="trial_ends" type="date" label="Trial ends" defaultValue={sub?.trial_ends_at ? String(sub.trial_ends_at).slice(0, 10) : ''} />
      </div>
      <p className="text-sm text-muted">Limit overrides for this school only. Empty = use the plan's limit.</p>
      <div className="grid gap-4 sm:grid-cols-4"><Limits v={sub?.limits_override} blank="plan" /></div>
      <SubmitButton pendingText="Saving…">Save subscription</SubmitButton>
    </ActionForm>
  );
}
export function FlagRow({ schoolId, k, mode }: { schoolId: string; k: string; mode: 'on' | 'off' | 'inherit' }) {
  return (<ActionForm action={setFlag} className="flex items-center gap-2"><input type="hidden" name="school_id" value={schoolId} /><input type="hidden" name="key" value={k} />
    <Select name="mode" defaultValue={mode} options={[{ value: 'inherit', label: 'Follow plan' }, { value: 'on', label: 'Force on' }, { value: 'off', label: 'Force off' }]} /><SubmitButton variant="secondary" size="sm">Set</SubmitButton></ActionForm>);
}
export function PlanForm({ plan }: { plan?: any }) {
  return (
    <ActionForm action={savePlan} className="space-y-4" resetOnSuccess={!plan}>{plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="grid gap-4 sm:grid-cols-3"><TextField name="code" label="Code" defaultValue={plan?.code} required /><TextField name="name" label="Name" defaultValue={plan?.name} required /><TextField name="price" type="number" min={0} label="Price / month (Rs)" defaultValue={plan?.price_pkr_monthly ?? 0} required /></div>
      <div className="grid gap-4 sm:grid-cols-4"><Limits v={plan?.limits} blank="unlimited" /></div>
      <div className="flex flex-wrap gap-4">{FEATURES.map((f) => <Checkbox key={f} name="features" value={f} label={label(f)} defaultChecked={plan ? plan.features?.[f] !== false : true} />)}</div>
      <SubmitButton pendingText="Saving…">{plan ? 'Save plan' : 'Add plan'}</SubmitButton>
    </ActionForm>
  );
}
