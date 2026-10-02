'use client';
import { useState } from 'react';
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from '@/components/ui/action-form';
import { ActionButton } from '@/components/ui/confirm-form';
import { Alert } from '@/components/ui/primitives';
import { cn } from '@/components/ui/cn';
import { createRole, createUser, resetUserPassword, saveNotificationPrefs, saveNumbering, saveProfile, saveRolePermissions, saveSchool, saveSetting, updateUserAccess, uploadLogo } from '@/app/actions/settings';
import { ACTION_COLUMNS, MODULES, type ModuleName } from '@/lib/auth/catalogue';
import { useRouter } from 'next/navigation';

type Opt = { value: string; label: string };
const S = ({ k, children }: { k: string; children: React.ReactNode }) => (<ActionForm action={saveSetting} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="__key" value={k} />{children}<div className="sm:col-span-2"><SubmitButton>Save</SubmitButton></div></ActionForm>);

export function SchoolForm({ s }: { s: Record<string, string | null> }) {
  const d = (k: string) => s[k] ?? '';
  return (
    <ActionForm action={saveSchool} className="grid gap-4 sm:grid-cols-2">
      <Field label="School name" name="name" required className="sm:col-span-2"><Input name="name" defaultValue={d('name')} /></Field>
      <Field label="Short name" name="short_name"><Input name="short_name" defaultValue={d('short_name')} /></Field><Field label="Website" name="website"><Input name="website" defaultValue={d('website')} /></Field>
      <Field label="Address" name="address" className="sm:col-span-2"><Input name="address" defaultValue={d('address')} /></Field>
      <Field label="City" name="city"><Input name="city" defaultValue={d('city')} /></Field><Field label="Province" name="province"><Input name="province" defaultValue={d('province')} /></Field>
      <Field label="Phone" name="phone"><Input name="phone" defaultValue={d('phone')} /></Field><Field label="Email" name="email"><Input name="email" type="email" defaultValue={d('email')} /></Field>
      <Field label="Default language" name="default_language"><Select name="default_language" defaultValue={d('default_language')} options={[{ value: 'en', label: 'English' }, { value: 'ur', label: 'اردو (Urdu)' }]} /></Field>
      <Field label="Date format" name="date_format"><Select name="date_format" defaultValue={d('date_format')} options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map((x) => ({ value: x, label: x }))} /></Field>
      <p className="text-sm text-muted sm:col-span-2">Currency is PKR and the timezone is Asia/Karachi.</p>
      <div className="sm:col-span-2"><SubmitButton>Save</SubmitButton></div>
    </ActionForm>
  );
}
export function LogoForm() {
  return (<ActionForm action={uploadLogo} resetOnSuccess className="flex flex-wrap items-end gap-3"><Field label="Image" name="file"><Input name="file" type="file" accept=".jpg,.jpeg,.png,.webp" /></Field><Field label="Use as" name="kind"><Select name="kind" options={[{ value: 'logo', label: 'School logo' }, { value: 'favicon', label: 'Favicon' }]} /></Field><SubmitButton pendingText="Uploading…">Upload</SubmitButton></ActionForm>);
}

export function FeesSettings({ v }: { v: any }) {
  return (<S k="fees">
    <Field label="Usual due day of the month" name="due_day"><Input name="due_day" type="number" min={1} max={28} defaultValue={v.due_day ?? 10} /></Field>
    <Field label="Sibling discount (%)" name="sibling_discount_percent" hint="Every child except the eldest gets this off monthly tuition. 0 = off."><Input name="sibling_discount_percent" type="number" min={0} max={100} step="0.5" defaultValue={v.sibling_discount_percent ?? 0} /></Field>
    <Field label="Late fine" name="late_fine.type"><Select name="late_fine.type" defaultValue={v.late_fine?.type ?? 'none'} options={[{ value: 'none', label: 'No fine' }, { value: 'flat', label: 'Flat amount once' }, { value: 'per_day', label: 'Per day overdue' }]} /></Field>
    <Field label="Fine amount (Rs)" name="late_fine.amount"><Input name="late_fine.amount" type="number" min={0} defaultValue={v.late_fine?.amount ?? 0} /></Field>
    <Field label="Grace days" name="late_fine.grace_days"><Input name="late_fine.grace_days" type="number" min={0} defaultValue={v.late_fine?.grace_days ?? 0} /></Field>
    <Field label="Maximum fine per voucher (Rs)" name="late_fine.max"><Input name="late_fine.max" type="number" min={0} defaultValue={v.late_fine?.max ?? ''} /></Field>
    <Field label="Note printed on vouchers" name="voucher_note" className="sm:col-span-2"><Textarea name="voucher_note" rows={2} defaultValue={v.voucher_note ?? ''} /></Field></S>);
}
export function AttendanceSettings({ v }: { v: any }) {
  return (<S k="attendance">
    <Field label="School starts" name="school_start"><Input name="school_start" type="time" defaultValue={v.school_start ?? '08:00'} /></Field>
    <Field label="Students after this are Late (QR scan)" name="late_after"><Input name="late_after" type="time" defaultValue={v.late_after ?? '08:30'} /></Field>
    <Field label="Half-day after" name="half_day_after"><Input name="half_day_after" type="time" defaultValue={v.half_day_after ?? '11:00'} /></Field>
    <Field label="Staff grace (minutes)" name="staff_grace_minutes"><Input name="staff_grace_minutes" type="number" min={0} defaultValue={v.staff_grace_minutes ?? 10} /></Field></S>);
}
export function PayrollSettings({ v }: { v: any }) {
  return (<S k="payroll">
    <Field label="Overtime multiplier" name="overtime_multiplier" hint="1.5 = time-and-a-half"><Input name="overtime_multiplier" type="number" step="0.1" min={1} defaultValue={v.overtime_multiplier ?? 1.5} /></Field>
    <Field label="Working hours per day" name="hours_per_day"><Input name="hours_per_day" type="number" min={1} max={12} defaultValue={v.hours_per_day ?? 6} /></Field>
    <Checkbox name="absence_deduction" label="Deduct salary for unmarked-as-leave absences" defaultChecked={v.absence_deduction ?? true} /></S>);
}
export function LibrarySettings({ v }: { v: any }) {
  return (<S k="library"><Field label="Loan period (days)" name="loan_days"><Input name="loan_days" type="number" min={1} defaultValue={v.loan_days ?? 14} /></Field><Field label="Fine per overdue day (Rs)" name="fine_per_day"><Input name="fine_per_day" type="number" min={0} defaultValue={v.fine_per_day ?? 5} /></Field><Field label="Maximum renewals" name="max_renewals"><Input name="max_renewals" type="number" min={0} defaultValue={v.max_renewals ?? 2} /></Field></S>);
}
export function ExamSettings({ v }: { v: any }) {
  return (<S k="exams"><Field label="Position (rank) by default in" name="default_position_scope"><Select name="default_position_scope" defaultValue={v.default_position_scope ?? 'section'} options={[{ value: 'section', label: 'Section' }, { value: 'class', label: 'Whole class' }, { value: 'none', label: 'No positions' }]} /></Field></S>);
}
const EVENTS: [string, string][] = [['absence_alert', 'Absence alert'], ['fee_receipt', 'Fee receipt'], ['fee_reminder', 'Fee reminder'], ['result_published', 'Result published'], ['admission_confirmation', 'Admission confirmation'], ['homework', 'New homework'], ['announcement', 'Announcements'], ['event_reminder', 'Event reminder']];
export function NotificationSettings({ v }: { v: any }) {
  const ch = [{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }, { value: 'email', label: 'Email' }];
  return (<S k="notifications">
    <Field label="Send parent messages by" name="guardian_channel"><Select name="guardian_channel" defaultValue={v.guardian_channel ?? 'whatsapp'} options={ch} /></Field>
    <Field label="Message language" name="language"><Select name="language" defaultValue={v.language ?? 'en'} options={[{ value: 'en', label: 'English' }, { value: 'ur', label: 'اردو (Urdu)' }]} /></Field>
    <Field label="If that fails, fall back to" name="fallback_channel" hint="Reserved for the dispatcher"><Select name="fallback_channel" defaultValue={v.fallback_channel ?? 'sms'} options={ch} /></Field><span />
    <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium">Automatic messages</legend><div className="grid gap-2 sm:grid-cols-2">{EVENTS.map(([k, l]) => <Checkbox key={k} name={`events.${k}`} label={l} defaultChecked={v.events?.[k] ?? true} />)}</div></fieldset></S>);
}
export function SecuritySettings({ v }: { v: any }) {
  return (<S k="security"><Field label="Sign out after inactivity (minutes)" name="session_timeout_minutes" hint="Recorded policy; enforced by the host's session settings — see README → Security."><Input name="session_timeout_minutes" type="number" min={15} max={1440} defaultValue={v.session_timeout_minutes ?? 480} /></Field><Checkbox name="require_2fa_for_admins" label="Require 2-step verification for administrators (policy flag — see README)" defaultChecked={v.require_2fa_for_admins ?? false} /></S>);
}
export function NumberingForm({ rows }: { rows: { key: string; label: string; prefix: string; padding: number; reset_yearly: boolean; sample: string }[] }) {
  return (<div className="divide-y divide-line">{rows.map((r) => (
    <ActionForm key={r.key} action={saveNumbering} className="grid items-end gap-3 py-4 sm:grid-cols-[1fr_8rem_6rem_auto_auto]">
      <input type="hidden" name="key" value={r.key} /><div><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted">Next looks like <span className="tabular">{r.sample}</span></p></div>
      <Field label="Prefix" name="prefix"><Input name="prefix" defaultValue={r.prefix} maxLength={10} /></Field><Field label="Digits" name="padding"><Input name="padding" type="number" min={1} max={10} defaultValue={r.padding} /></Field>
      <Checkbox name="reset_yearly" label="Restart yearly" defaultChecked={r.reset_yearly} /><SubmitButton variant="secondary">Save</SubmitButton></ActionForm>))}</div>);
}
export function ProfileForm({ p }: { p: { full_name: string; phone: string | null; language: string; theme: string; email: string | null } }) {
  return (<ActionForm action={saveProfile} className="grid gap-4 sm:grid-cols-2"><Field label="Full name" name="full_name" required><Input name="full_name" defaultValue={p.full_name} /></Field><Field label="Email (login)" name="email"><Input name="email" value={p.email ?? ''} readOnly disabled /></Field><Field label="Mobile" name="phone"><Input name="phone" type="tel" defaultValue={p.phone ?? ''} /></Field>
    <Field label="Language" name="language"><Select name="language" defaultValue={p.language} options={[{ value: 'en', label: 'English' }, { value: 'ur', label: 'اردو (Urdu)' }]} /></Field><Field label="Theme" name="theme"><Select name="theme" defaultValue={p.theme} options={[{ value: 'system', label: 'Match my device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /></Field><div className="sm:col-span-2"><SubmitButton>Save profile</SubmitButton></div></ActionForm>);
}
export function NotifPrefs({ channels, events, initial }: { channels: string[]; events: [string, string][]; initial: Record<string, boolean> }) {
  const [v, setV] = useState(initial); const [msg, setMsg] = useState<string | null>(null);
  return (<div className="space-y-3"><div className="scroll-x"><table className="w-full min-w-[420px] text-sm"><thead><tr><th className="p-2 text-start text-xs uppercase text-muted">Message</th>{channels.map((c) => <th key={c} className="p-2 text-center text-xs uppercase text-muted">{c.replace('_', ' ')}</th>)}</tr></thead><tbody>{events.map(([k, l]) => <tr key={k} className="border-t border-line"><td className="p-2">{l}</td>{channels.map((c) => <td key={c} className="p-2 text-center"><input type="checkbox" aria-label={`${l} via ${c}`} className="size-4 accent-[var(--brand)]" checked={v[`${c}:${k}`] ?? true} onChange={(e) => setV((s) => ({ ...s, [`${c}:${k}`]: e.target.checked }))} /></td>)}</tr>)}</tbody></table></div>
    <ActionButton action={saveNotificationPrefs} data={{ prefs: Object.entries(v).map(([key, enabled]) => ({ channel: key.split(':')[0], event_key: key.split(':')[1], enabled })) }} variant="primary" size="md" onOk={() => setMsg('Saved.')}>Save preferences</ActionButton>{msg && <p className="text-sm text-ok">{msg}</p>}</div>);
}

export function UserCreateForm({ roles, campuses }: { roles: Opt[]; campuses: Opt[] }) {
  return (
    <ActionForm action={createUser} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" name="full_name" required><Input name="full_name" /></Field><Field label="Email (used to sign in)" name="email" required><Input name="email" type="email" autoComplete="off" /></Field>
      <Field label="Mobile" name="phone"><Input name="phone" type="tel" /></Field><span />
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Roles <span className="text-bad">*</span></legend>{roles.map((r) => <label key={r.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value={r.value} className="size-4 accent-[var(--brand)]" />{r.label}</label>)}</fieldset>
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Campuses</legend>{campuses.map((c) => <label key={c.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="campuses" value={c.value} className="size-4 accent-[var(--brand)]" />{c.label}</label>)}</fieldset>
      <div className="rounded-[10px] border border-line p-3 text-sm sm:col-span-2"><p className="mb-2 font-medium">Link to a record <span className="font-normal text-muted">(teachers, parents and students need this to see their own data)</span></p>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="Staff ID" name="link_staff"><Input name="link_staff" className="uppercase" placeholder="EMP-0001" /></Field><Field label="Parent: family ID" name="link_family"><Input name="link_family" className="uppercase" placeholder="FAM-0001" /></Field><Field label="Student ID" name="link_student"><Input name="link_student" className="uppercase" placeholder="STD-0001" /></Field></div></div>
      <div className="sm:col-span-2"><SubmitButton size="lg" pendingText="Creating…">Create user</SubmitButton><p className="mt-2 text-xs text-muted">A one-time temporary password is shown after creation. The user must choose a new one at first sign-in.</p></div>
    </ActionForm>
  );
}
export function UserAccessForm({ u, roles, campuses, canRoles, self }: { u: { id: string; full_name: string; phone: string | null; is_active: boolean; roleIds: string[]; campusIds: string[] }; roles: Opt[]; campuses: Opt[]; canRoles: boolean; self: boolean }) {
  return (
    <ActionForm action={updateUserAccess} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={u.id} />
      <Field label="Full name" name="full_name"><Input name="full_name" defaultValue={u.full_name} /></Field><Field label="Mobile" name="phone"><Input name="phone" defaultValue={u.phone ?? ''} /></Field>
      {canRoles && <fieldset className="space-y-2"><legend className="text-sm font-medium">Roles</legend>{roles.map((r) => <label key={r.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="roles" value={r.value} defaultChecked={u.roleIds.includes(r.value)} disabled={self} className="size-4 accent-[var(--brand)]" />{r.label}</label>)}</fieldset>}
      <fieldset className="space-y-2"><legend className="text-sm font-medium">Campuses</legend>{campuses.map((c) => <label key={c.value} className="flex items-center gap-2 text-sm"><input type="checkbox" name="campuses" value={c.value} defaultChecked={u.campusIds.includes(c.value)} disabled={self} className="size-4 accent-[var(--brand)]" />{c.label}</label>)}</fieldset>
      <Checkbox name="is_active" label="Account is active (untick to block sign-in)" defaultChecked={u.is_active} className="sm:col-span-2" />
      {self ? <p className="text-sm text-muted sm:col-span-2">You cannot change your own roles or access.</p> : <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>}
    </ActionForm>
  );
}
export function ResetPassword({ id }: { id: string }) { return <ActionButton action={resetUserPassword} data={{ id }} size="md" variant="secondary">Reset password…</ActionButton>; }
export function RoleCreate() { return (<ActionForm action={createRole} className="grid gap-3 sm:grid-cols-3"><Field label="Role name" name="name"><Input name="name" placeholder="e.g. Coordinator" /></Field><Field label="Code" name="code"><Input name="code" placeholder="coordinator" /></Field><div className="flex items-end"><SubmitButton variant="secondary">Create role</SubmitButton></div></ActionForm>); }

/** The permission matrix: modules down the side, actions across. */
export function PermissionMatrix({ roleId, granted, readOnly }: { roleId: string; granted: string[]; readOnly: boolean }) {
  const [on, setOn] = useState(new Set(granted)); const [msg, setMsg] = useState<{ t: 'ok' | 'bad'; s: string } | null>(null); const [busy, setBusy] = useState(false); const router = useRouter();
  const toggle = (c: string) => setOn((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const mods = Object.keys(MODULES) as ModuleName[];
  const other = (m: ModuleName) => (MODULES[m] as readonly string[]).filter((a) => !(ACTION_COLUMNS as readonly string[]).includes(a));
  const rowAll = (m: ModuleName, on2: boolean) => setOn((s) => { const n = new Set(s); (MODULES[m] as readonly string[]).forEach((a) => (on2 ? n.add(`${m}.${a}`) : n.delete(`${m}.${a}`))); return n; });
  async function save() { setBusy(true); const r = await saveRolePermissions({ role_id: roleId, codes: [...on] }); setBusy(false); setMsg(r.ok ? { t: 'ok', s: r.message ?? 'Saved' } : { t: 'bad', s: r.error }); if (r.ok) router.refresh(); }
  return (
    <div className="space-y-3">
      <div className="scroll-x rounded-[14px] border border-line bg-surface"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-line bg-surface-2/60 text-xs uppercase text-muted"><th className="sticky start-0 bg-surface-2 p-2.5 text-start">Module</th>{ACTION_COLUMNS.map((a) => <th key={a} className="p-2 text-center">{a}</th>)}<th className="p-2 text-start">Special</th><th /></tr></thead><tbody>
        {mods.map((m) => (
          <tr key={m} className="border-b border-line last:border-0"><th className="sticky start-0 bg-surface p-2.5 text-start font-medium capitalize">{m.replace(/_/g, ' ')}</th>
            {ACTION_COLUMNS.map((a) => { const code = `${m}.${a}`; const has = (MODULES[m] as readonly string[]).includes(a); return <td key={a} className="p-2 text-center">{has ? <input type="checkbox" aria-label={code} disabled={readOnly} checked={on.has(code)} onChange={() => toggle(code)} className="size-4 accent-[var(--brand)]" /> : <span className="text-line">·</span>}</td>; })}
            <td className="p-2">{other(m).map((a) => <label key={a} className="me-3 inline-flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={readOnly} checked={on.has(`${m}.${a}`)} onChange={() => toggle(`${m}.${a}`)} className="size-4 accent-[var(--brand)]" />{a}</label>)}</td>
            <td className="p-2 text-end">{!readOnly && <button type="button" className="text-xs text-brand hover:underline" onClick={() => rowAll(m, !(MODULES[m] as readonly string[]).every((a) => on.has(`${m}.${a}`)))}>all/none</button>}</td></tr>))}
      </tbody></table></div>
      {msg && <Alert tone={msg.t}>{msg.s}</Alert>}
      {!readOnly && <button onClick={save} disabled={busy} className={cn('h-11 rounded-[10px] bg-brand px-6 text-sm font-medium text-brand-fg', busy && 'opacity-60')}>{busy ? 'Saving…' : 'Save permissions'}</button>}
    </div>
  );
}
