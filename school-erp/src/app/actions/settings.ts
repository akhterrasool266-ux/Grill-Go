'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { ALL_PERMISSIONS } from '@/lib/auth/catalogue';
import { createAdminClient } from '@/lib/supabase/admin';
import * as v from '@/lib/validation/common';

const toList = (x: unknown) => (Array.isArray(x) ? x : x ? [x] : []);

// ── school profile ──
export const saveSchool = formAction({
  permission: 'settings.edit',
  schema: z.object({ name: v.text('School name', 120), short_name: v.optText(40), address: v.optText(200), city: v.optText(80), province: v.optText(80), phone: v.optText(30), email: v.optEmail(), website: v.optText(120), default_language: v.oneOf(['en', 'ur'] as const), date_format: v.oneOf(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const) }),
}, async ({ ctx, sb, input }) => {
  const patch = Object.fromEntries(Object.entries(input).map(([k, x]) => [k, x === undefined ? null : x]));
  patch.name = input.name; patch.default_language = input.default_language; patch.date_format = input.date_format;
  check(await sb.from('schools').update(patch).eq('id', ctx.school.id).select('id').single());
  revalidatePath('/', 'layout');
  return { message: 'School details saved.' };
});

export const uploadLogo = formAction({ permission: 'settings.edit', schema: z.object({ kind: v.oneOf(['logo', 'favicon'] as const), file: z.instanceof(File, { error: 'Choose an image.' }) }) }, async ({ ctx, sb, input }) => {
  const { sniffMime, IMAGE_MIMES } = await import('@/lib/files');
  if (input.file.size > 2_000_000) throw { code: 'X', message: 'The image must be under 2 MB.' };
  const buf = new Uint8Array(await input.file.arrayBuffer());
  const kind = sniffMime(buf);
  if (!kind || !IMAGE_MIMES.has(kind.mime)) throw { code: 'X', message: 'Use a JPG, PNG or WEBP image.' };
  const path = `${ctx.school.id}/${input.kind}-${Date.now()}.${kind.ext}`;
  const up = await sb.storage.from('public-assets').upload(path, buf, { contentType: kind.mime, upsert: true });
  if (up.error) throw up.error;
  check(await sb.from('schools').update(input.kind === 'logo' ? { logo_path: path } : { favicon_path: path }).eq('id', ctx.school.id).select('id').single());
  revalidatePath('/', 'layout');
  return { message: 'Uploaded.' };
});

// ── JSON settings (allow-listed keys only) ──
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM.');
const SETTINGS = {
  fees: z.object({ due_day: z.coerce.number().int().min(1).max(28), sibling_discount_percent: z.coerce.number().min(0).max(100), voucher_note: v.optText(300), late_fine: z.object({ type: z.enum(['none', 'flat', 'per_day']), amount: z.coerce.number().min(0).max(1_000_000), grace_days: z.coerce.number().int().min(0).max(90), max: z.preprocess((x) => (x === '' || x == null ? undefined : x), z.coerce.number().min(0).optional()) }) }),
  attendance: z.object({ school_start: hhmm, late_after: hhmm, half_day_after: hhmm, staff_grace_minutes: z.coerce.number().int().min(0).max(120) }),
  payroll: z.object({ overtime_multiplier: z.coerce.number().min(1).max(5), hours_per_day: z.coerce.number().min(1).max(12), absence_deduction: v.bool() }),
  library: z.object({ loan_days: z.coerce.number().int().min(1).max(120), fine_per_day: z.coerce.number().min(0).max(10000), max_renewals: z.coerce.number().int().min(0).max(10) }),
  exams: z.object({ default_position_scope: z.enum(['none', 'section', 'class']) }),
  notifications: z.object({ guardian_channel: z.enum(['whatsapp', 'sms', 'email']), fallback_channel: z.enum(['whatsapp', 'sms', 'email']), language: z.enum(['en', 'ur']), events: z.record(z.string(), v.bool()) }),
  security: z.object({ session_timeout_minutes: z.coerce.number().int().min(15).max(1440), require_2fa_for_admins: v.bool() }),
} as const;
type Key = keyof typeof SETTINGS;

const nest = (flat: Record<string, unknown>) => { // "late_fine.amount" → { late_fine: { amount } }
  const out: Record<string, any> = {};
  for (const [k, val] of Object.entries(flat)) { if (k.startsWith('$') || k === '__key') continue; const parts = k.split('.'); let o = out; parts.slice(0, -1).forEach((p) => (o = o[p] ??= {})); o[parts.at(-1)!] = val; }
  return out;
};

export const saveSetting = formAction({ permission: 'settings.edit' }, async ({ ctx, sb, input }) => {
  const raw = input as Record<string, unknown>;
  const key = String(raw.__key) as Key;
  const schema = SETTINGS[key];
  if (!schema) throw { code: 'X', message: 'Unknown setting.' };
  const parsed = schema.safeParse(nest(raw));
  if (!parsed.success) throw { code: 'X', message: parsed.error.issues[0]?.message ?? 'Please check the values.' };
  const { data: cur } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
  const value = { ...((cur?.value as object) ?? {}), ...parsed.data };
  check(await sb.from('settings').upsert({ school_id: ctx.school.id, key, value, updated_at: new Date().toISOString() }, { onConflict: 'school_id,key' }).select('key'));
  revalidatePath('/settings');
  return { message: 'Saved.' };
});

export const saveNumbering = formAction({
  permission: 'settings.edit', schema: z.object({ key: z.enum(['invoice', 'receipt', 'student_code', 'admission_no', 'employee', 'payslip']), prefix: z.string().trim().max(10, 'Prefix is too long.').regex(/^[A-Za-z0-9\-_/]*$/, 'Letters, numbers, - _ / only.'), padding: v.int('Digits', 1, 10), reset_yearly: v.bool() }),
}, async ({ ctx, sb, input }) => {
  check(await sb.from('number_sequences').upsert({ school_id: ctx.school.id, ...input }, { onConflict: 'school_id,key', ignoreDuplicates: false }).select('key'));
  revalidatePath('/settings/numbering');
  return { message: 'Numbering saved. It applies to new documents only.' };
});

// ── profile ──
export const saveProfile = formAction({ schema: z.object({ full_name: v.text('Name', 120), phone: v.optPhone(), language: v.oneOf(['en', 'ur'] as const), theme: v.oneOf(['light', 'dark', 'system'] as const) }) }, async ({ ctx, sb, input }) => {
  check(await sb.from('profiles').update({ full_name: input.full_name, phone: input.phone ?? null, language: input.language, theme: input.theme }).eq('id', ctx.userId).select('id').single());
  revalidatePath('/', 'layout');
  return { message: 'Profile saved.' };
});
export const saveNotificationPrefs = callAction({ schema: z.object({ prefs: z.array(z.object({ channel: z.enum(['in_app', 'email', 'sms', 'whatsapp', 'push']), event_key: z.string().max(40), enabled: z.boolean() })).max(60) }) }, async ({ ctx, sb, input }) => {
  check(await sb.from('notification_preferences').upsert(input.prefs.map((p) => ({ ...p, user_id: ctx.userId })), { onConflict: 'user_id,channel,event_key' }).select('user_id'));
  return { message: 'Saved.' };
});

// ── users & roles ──
export const createUser = formAction({
  permission: 'users.create',
  schema: z.object({ full_name: v.text('Full name', 120), email: z.string().trim().toLowerCase().email('Enter a valid email address.'), phone: v.optPhone(), roles: z.preprocess(toList, z.array(z.string().max(40)).min(1, 'Choose at least one role.')), campuses: z.preprocess(toList, z.array(v.uuid()).optional()), link_staff: v.optText(30), link_student: v.optText(30), link_family: v.optText(30) }),
}, async ({ ctx, sb, input }) => {
  // No privilege escalation: you may only hand out roles whose permissions you already hold (unless you manage roles).
  if (!ctx.permissions.includes('roles.manage')) {
    const { data: rp } = await sb.from('roles').select('code,role_permissions(permission_code)').in('code', input.roles);
    for (const r of (rp ?? []) as any[]) for (const p of r.role_permissions as { permission_code: string }[]) if (!ctx.permissions.includes(p.permission_code)) throw { code: '42501', message: 'permission_denied' };
  }
  if (!input.campuses?.length && !ctx.permissions.includes('campus.all')) throw { code: 'X', message: 'Choose at least one campus.' };
  const link: Record<string, string> = {};
  if (input.link_staff) { const { data } = await sb.from('staff').select('id').eq('employee_code', input.link_staff.toUpperCase()).maybeSingle(); if (!data) throw { code: 'X', message: 'staff_not_found' }; link.staff_id = data.id; }
  if (input.link_student) { const { data } = await sb.from('students').select('id').eq('student_code', input.link_student.toUpperCase()).maybeSingle(); if (!data) throw { code: 'X', message: 'student_not_found' }; link.student_id = data.id; }
  if (input.link_family) {
    const { data: f } = await sb.from('families').select('id').eq('family_code', input.link_family.toUpperCase()).maybeSingle();
    if (!f) throw { code: 'X', message: 'family_not_found' };
    const { data: g } = await sb.from('guardians').select('id').eq('family_id', f.id).order('created_at').limit(1).maybeSingle();
    if (!g) throw { code: 'X', message: 'That family has no guardian record.' };
    link.guardian_id = g.id;
  }
  const admin = createAdminClient();
  const temp = `${randomBytes(9).toString('base64url')}#${Math.floor(10 + Math.random() * 89)}`;
  const { data: au, error } = await admin.auth.admin.createUser({ email: input.email, password: temp, email_confirm: true, user_metadata: { full_name: input.full_name } });
  if (error || !au.user) throw { code: error?.status === 422 ? '23505' : 'X', message: error?.status === 422 ? 'users_email' : 'Could not create the login. Please try again.' };
  const { error: perr } = await admin.rpc('provision_user', { p_user: au.user.id, p_school: ctx.school.id, p_full_name: input.full_name, p_email: input.email, p_phone: input.phone ?? null, p_roles: input.roles, p_campuses: input.campuses ?? [], p_link: link });
  if (perr) { await admin.auth.admin.deleteUser(au.user.id); throw perr; }
  await admin.from('profiles').update({ preferences: { must_change_password: true } }).eq('id', au.user.id);
  await admin.rpc('log_audit_as', { p_user: ctx.userId, p_school: ctx.school.id, p_action: 'create_user', p_table: 'profiles', p_record: au.user.id, p_new: { email: input.email, roles: input.roles } });
  revalidatePath('/settings/users');
  redirect(`/settings/users/${au.user.id}?created=1&tp=${encodeURIComponent(temp)}`);
});

export const updateUserAccess = formAction({
  permission: 'users.edit',
  schema: z.object({ id: v.uuid(), full_name: v.text('Name', 120), phone: v.optPhone(), is_active: v.bool(), campuses: z.preprocess(toList, z.array(v.uuid()).optional()), roles: z.preprocess(toList, z.array(v.uuid()).optional()) }),
}, async ({ ctx, sb, input }) => {
  if (input.id === ctx.userId) throw { code: 'X', message: 'You cannot change your own access. Ask another administrator.' };
  check(await sb.from('profiles').update({ full_name: input.full_name, phone: input.phone ?? null, is_active: input.is_active }).eq('id', input.id).select('id').single());
  const wantC = new Set(input.campuses ?? []);
  const { data: haveC } = await sb.from('user_campuses').select('campus_id').eq('user_id', input.id);
  const hc = new Set((haveC ?? []).map((x: any) => x.campus_id));
  for (const c of wantC) if (!hc.has(c)) check(await sb.from('user_campuses').insert({ user_id: input.id, campus_id: c }));
  for (const c of hc) if (!wantC.has(c)) check(await sb.from('user_campuses').delete().eq('user_id', input.id).eq('campus_id', c));
  if (ctx.permissions.includes('roles.manage')) {
    const wantR = new Set(input.roles ?? []);
    const { data: haveR } = await sb.from('user_roles').select('role_id').eq('user_id', input.id);
    const hr = new Set((haveR ?? []).map((x: any) => x.role_id));
    for (const r of wantR) if (!hr.has(r)) check(await sb.from('user_roles').insert({ user_id: input.id, role_id: r }));
    for (const r of hr) if (!wantR.has(r)) check(await sb.from('user_roles').delete().eq('user_id', input.id).eq('role_id', r));
  }
  if (!input.is_active) await createAdminClient().auth.admin.signOut(input.id).catch(() => undefined);
  revalidatePath(`/settings/users/${input.id}`);
  return { message: 'Access updated.' };
});

export const resetUserPassword = callAction({ permission: 'users.edit', schema: z.object({ id: v.uuid() }) }, async ({ ctx, sb, input }) => {
  const { data: p } = await sb.from('profiles').select('id').eq('id', input.id).maybeSingle();
  if (!p || input.id === ctx.userId) throw { code: 'X', message: 'You cannot reset this account.' };
  const admin = createAdminClient();
  const temp = `${randomBytes(9).toString('base64url')}#${Math.floor(10 + Math.random() * 89)}`;
  const { error } = await admin.auth.admin.updateUserById(input.id, { password: temp });
  if (error) throw { code: 'X', message: 'Could not reset the password.' };
  await admin.from('profiles').update({ preferences: { must_change_password: true } }).eq('id', input.id);
  await admin.auth.admin.signOut(input.id).catch(() => undefined);
  await admin.rpc('log_audit_as', { p_user: ctx.userId, p_school: ctx.school.id, p_action: 'reset_password', p_table: 'profiles', p_record: input.id });
  return { message: `Temporary password: ${temp} — share it privately. The user must change it at first sign-in.` };
});

export const createRole = formAction({ permission: 'roles.manage', schema: z.object({ name: v.text('Role name', 60), code: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,30}$/, 'Code: lowercase letters, numbers and underscores.') }) }, async ({ ctx, sb, input }) => {
  const r = check(await sb.from('roles').insert({ ...input, school_id: ctx.school.id, is_system: false }).select('id').single());
  redirect(`/settings/roles/${r!.id}`);
});

export const saveRolePermissions = callAction({ permission: 'roles.manage', schema: z.object({ role_id: v.uuid(), codes: z.array(z.string()).max(300) }) }, async ({ sb, input }) => {
  const valid = new Set<string>(ALL_PERMISSIONS);
  const want = new Set(input.codes.filter((c) => valid.has(c)));
  const { data: role } = await sb.from('roles').select('code').eq('id', input.role_id).single();
  if (role?.code === 'super_admin') throw { code: 'X', message: 'The Super Admin role always has every permission and cannot be edited.' };
  const { data: have } = await sb.from('role_permissions').select('permission_code').eq('role_id', input.role_id);
  const hs = new Set((have ?? []).map((x: any) => x.permission_code as string));
  const add = [...want].filter((c) => !hs.has(c)), del = [...hs].filter((c) => !want.has(c));
  if (add.length) check(await sb.from('role_permissions').insert(add.map((permission_code) => ({ role_id: input.role_id, permission_code }))));
  if (del.length) check(await sb.from('role_permissions').delete().eq('role_id', input.role_id).in('permission_code', del));
  revalidatePath('/settings/roles');
  return { message: `Saved: ${add.length} added, ${del.length} removed. Users get the change on their next page load.` };
});
