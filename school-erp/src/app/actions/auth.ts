'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { formToObject, fieldErrorsOf } from '@/lib/validation/common';
import type { ActionResult } from '@/lib/actions';

async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}
const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : '/');

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function login(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const raw = formToObject(fd);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: Object.values(fieldErrorsOf(parsed.error))[0]!, fieldErrors: fieldErrorsOf(parsed.error) };
  const ip = await clientIp();
  const byIp = rateLimit(`login-ip:${ip}`, 20, 10 * 60_000);
  const byUser = rateLimit(`login-user:${parsed.data.email}`, 8, 10 * 60_000);
  if (!byIp.ok || !byUser.ok) return { ok: false, error: `Too many sign-in attempts. Try again in ${Math.max(byIp.retryAfter, byUser.retryAfter)} seconds.` };

  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  // Same message for unknown email and wrong password, so accounts cannot be enumerated.
  if (error) return { ok: false, error: 'Incorrect email or password.' };
  redirect(safeNext(raw.next) === '/' ? '/dashboard' : safeNext(raw.next));
}

export async function requestReset(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.') }).safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: 'Enter a valid email address.' };
  const ip = await clientIp();
  if (!rateLimit(`reset:${ip}`, 5, 15 * 60_000).ok) return { ok: false, error: 'Too many requests. Please try again later.' };
  const sb = await createClient();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  await sb.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${base}/auth/callback?next=/reset-password` });
  // Identical response whether or not the account exists.
  return { ok: true, message: 'If that email belongs to an account, a reset link is on its way.' };
}

export async function updatePassword(_p: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const schema = z.object({
    password: z.string().min(10, 'Use at least 10 characters.').regex(/[A-Za-z]/, 'Include a letter.').regex(/\d/, 'Include a number.'),
    confirm: z.string(),
  }).refine((v) => v.password === v.confirm, { message: 'Passwords do not match.', path: ['confirm'] });
  const parsed = schema.safeParse(formToObject(fd));
  if (!parsed.success) { const fe = fieldErrorsOf(parsed.error); return { ok: false, error: Object.values(fe)[0]!, fieldErrors: fe }; }
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false, error: 'This reset link has expired. Request a new one.' };
  const { error } = await sb.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: 'Could not update the password. Try a different one.' };
  const { data: prof } = await sb.from('profiles').select('preferences').eq('id', data.user.id).maybeSingle();
  if (prof?.preferences && (prof.preferences as Record<string, unknown>).must_change_password) {
    const { must_change_password: _m, ...rest } = prof.preferences as Record<string, unknown>;
    await sb.from('profiles').update({ preferences: rest }).eq('id', data.user.id);
  }
  redirect('/dashboard');
}
