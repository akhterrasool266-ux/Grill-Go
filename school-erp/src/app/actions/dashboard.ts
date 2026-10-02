'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { callAction, check } from '@/lib/actions';

export const saveDashboardPrefs = callAction({ schema: z.object({ hidden: z.array(z.string().max(40)).max(40) }) }, async ({ ctx, sb, input }) => {
  const prefs = { ...ctx.profile.preferences, dashboard_hidden: input.hidden };
  check(await sb.from('profiles').update({ preferences: prefs }).eq('id', ctx.userId));
  revalidatePath('/dashboard');
  return { message: 'Dashboard updated.' };
});
