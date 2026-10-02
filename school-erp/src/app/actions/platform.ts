'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { ActionResult } from '@/lib/actions';
import { getIdentity } from '@/lib/auth/session';
import { FEATURES, LIMIT_KEYS } from '@/lib/platform';
import { friendlyError, newRef } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import * as v from '@/lib/validation/common';
import { fieldErrorsOf, formToObject } from '@/lib/validation/common';

/**
 * Platform-operator actions. These use the service-role client (RLS bypass) so EVERY one must pass through
 * `platform()`, which re-checks platform_admins membership on the server for each call.
 */
function platform<I>(schema: z.ZodType<I, unknown>, run: (a: { db: ReturnType<typeof createAdminClient>; input: I; userId: string }) => Promise<{ message?: string } | void>) {
  return async (_p: ActionResult | null, fd: FormData): Promise<ActionResult> => {
    try {
      const id = await getIdentity();
      if (!id?.platform_admin) return { ok: false, error: "You don't have permission to do that." };
      const parsed = schema.safeParse(formToObject(fd));
      if (!parsed.success) { const fe = fieldErrorsOf(parsed.error); return { ok: false, error: Object.values(fe)[0] ?? 'Please check the form.', fieldErrors: fe }; }
      const out = await run({ db: createAdminClient(), input: parsed.data, userId: id.user_id });
      return { ok: true, ...(out ?? {}) };
    } catch (e) {
      if (typeof e === 'object' && e && 'digest' in e) throw e; // redirect()
      return { ok: false, error: friendlyError(e, newRef()) };
    }
  };
}
const toList = (x: unknown) => (Array.isArray(x) ? x : x ? [x] : []);
const must = <T,>(r: { data: T; error: { message: string; code?: string } | null }) => { if (r.error) throw r.error; return r.data; };
const limitsOf = (x: Record<string, unknown>) => Object.fromEntries(LIMIT_KEYS.flatMap((k) => (x[k] === '' || x[k] == null ? [] : [[k, Number(x[k])]])));
const num = (label: string) => z.preprocess((x) => (x === '' ? undefined : x), z.coerce.number({ error: `${label} must be a number.` }).int().min(0).max(1e9).optional());

export const createSchool = platform(z.object({
  name: v.text('School name', 120), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, 'Web name: lowercase letters, numbers and dashes only.'),
  campus_name: v.text('Campus name', 80), campus_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, 'Campus code: 2–8 letters or digits.'),
  owner_name: v.text('Owner name', 120), owner_email: z.string().trim().toLowerCase().email('Enter a valid owner email.'), plan_id: v.optUuid(),
}), async ({ db, input, userId }) => {
  const school = must(await db.rpc('bootstrap_school', { p_name: input.name, p_slug: input.slug, p_short_name: null, p_campus_name: input.campus_name, p_campus_code: input.campus_code })) as string;
  const temp = `${randomBytes(9).toString('base64url')}#${Math.floor(10 + Math.random() * 89)}`;
  const { data: au, error } = await db.auth.admin.createUser({ email: input.owner_email, password: temp, email_confirm: true, user_metadata: { full_name: input.owner_name } });
  if (error || !au.user) { await db.from('schools').delete().eq('id', school); throw { code: error?.status === 422 ? '23505' : 'X', message: error?.status === 422 ? 'users_email' : 'Could not create the owner login.' }; }
  const { data: camp } = await db.from('campuses').select('id').eq('school_id', school);
  const { error: perr } = await db.rpc('provision_user', { p_user: au.user.id, p_school: school, p_full_name: input.owner_name, p_email: input.owner_email, p_phone: null, p_roles: ['school_owner'], p_campuses: (camp ?? []).map((c) => c.id) });
  if (perr) { await db.auth.admin.deleteUser(au.user.id); await db.from('schools').delete().eq('id', school); throw perr; }
  await db.from('profiles').update({ preferences: { must_change_password: true } }).eq('id', au.user.id);
  if (input.plan_id) must(await db.from('subscriptions').insert({ school_id: school, plan_id: input.plan_id, status: 'trialing', trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString() }));
  await db.rpc('log_audit_as', { p_user: userId, p_school: school, p_action: 'platform_create_school', p_table: 'schools', p_record: school, p_new: { slug: input.slug } });
  revalidatePath('/platform');
  redirect(`/platform/schools/${school}?created=1&tp=${encodeURIComponent(temp)}`);
});

export const setSchoolStatus = platform(z.object({ id: v.uuid(), status: v.oneOf(['active', 'suspended', 'archived'] as const) }), async ({ db, input, userId }) => {
  must(await db.from('schools').update({ status: input.status }).eq('id', input.id).select('id').single());
  await db.rpc('log_audit_as', { p_user: userId, p_school: input.id, p_action: 'platform_set_status', p_table: 'schools', p_record: input.id, p_new: { status: input.status } });
  revalidatePath(`/platform/schools/${input.id}`); revalidatePath('/platform');
  return { message: `School is now ${input.status}.` };
});

export const saveSubscription = platform(z.object({
  school_id: v.uuid(), plan_id: v.uuid('Plan'), status: v.oneOf(['trialing', 'active', 'past_due', 'cancelled'] as const), period_end: v.optDate(), trial_ends: v.optDate(),
  students: num('Students'), staff: num('Staff'), campuses: num('Campuses'), storage_mb: num('Storage'), whatsapp_messages: num('WhatsApp'), sms: num('SMS'), ai_requests: num('AI requests'),
}), async ({ db, input, userId }) => {
  const { school_id, plan_id, status, period_end, trial_ends, ...lim } = input;
  must(await db.from('subscriptions').upsert({ school_id, plan_id, status, current_period_end: period_end ?? null, trial_ends_at: trial_ends ? `${trial_ends}T23:59:59+05:00` : null, limits_override: limitsOf(lim) }, { onConflict: 'school_id' }).select('id').single());
  await db.rpc('log_audit_as', { p_user: userId, p_school: school_id, p_action: 'platform_set_subscription', p_table: 'subscriptions', p_record: school_id, p_new: { plan_id, status, override: limitsOf(lim) } });
  revalidatePath(`/platform/schools/${school_id}`);
  return { message: 'Subscription saved.' };
});

export const setFlag = platform(z.object({ school_id: v.uuid(), key: z.string().regex(/^[a-z_]{2,40}$/), mode: v.oneOf(['on', 'off', 'inherit'] as const) }), async ({ db, input }) => {
  if (input.mode === 'inherit') must(await db.from('feature_flags').delete().eq('school_id', input.school_id).eq('key', input.key));
  else must(await db.from('feature_flags').upsert({ school_id: input.school_id, key: input.key, enabled: input.mode === 'on' }, { onConflict: 'school_id,key' }).select('id'));
  revalidatePath(`/platform/schools/${input.school_id}`);
  return { message: 'Saved.' };
});

export const savePlan = platform(z.object({
  id: v.optUuid(), code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,30}$/, 'Code: lowercase letters, numbers, - and _.'), name: v.text('Plan name', 60), price: v.num('Monthly price', 0, 1e8),
  students: num('Students'), staff: num('Staff'), campuses: num('Campuses'), storage_mb: num('Storage'), whatsapp_messages: num('WhatsApp'), sms: num('SMS'), ai_requests: num('AI requests'),
  features: z.preprocess(toList, z.array(z.string())),
}), async ({ db, input }) => {
  const features = Object.fromEntries(FEATURES.map((f) => [f, input.features.includes(f)]));
  const row = { code: input.code, name: input.name, price_pkr_monthly: input.price, limits: limitsOf(input), features };
  must(input.id ? await db.from('plans').update(row).eq('id', input.id).select('id').single() : await db.from('plans').insert(row).select('id').single());
  revalidatePath('/platform/plans');
  return { message: 'Plan saved.' };
});
