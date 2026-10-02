'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCtx } from '@/lib/auth/session';

const YEAR = 60 * 60 * 24 * 365;

export async function setCampus(fd: FormData) {
  const ctx = await getCtx();
  if (!ctx) return;
  const v = String(fd.get('campus') ?? '');
  const store = await cookies();
  if (v && ctx.campuses.some((c) => c.id === v)) store.set('erp_campus', v, { path: '/', maxAge: YEAR, sameSite: 'lax', httpOnly: true });
  else store.delete('erp_campus');
  revalidatePath('/', 'layout');
}

export async function setLanguage(fd: FormData) {
  const lang = fd.get('lang') === 'ur' ? 'ur' : 'en';
  (await cookies()).set('erp_lang', lang, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  const ctx = await getCtx();
  if (ctx) { const sb = await createClient(); await sb.from('profiles').update({ language: lang }).eq('id', ctx.userId); }
  revalidatePath('/', 'layout');
}

export async function setTheme(theme: 'light' | 'dark' | 'system') {
  if (!['light', 'dark', 'system'].includes(theme)) return;
  (await cookies()).set('erp_theme', theme, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  const ctx = await getCtx();
  if (ctx) { const sb = await createClient(); await sb.from('profiles').update({ theme }).eq('id', ctx.userId); }
}

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect('/login');
}
