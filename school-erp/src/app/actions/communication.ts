'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import { dispatchQueued } from '@/lib/notify/dispatch';
import * as v from '@/lib/validation/common';

export const sendClassMessage = formAction({
  permission: 'communication.create',
  schema: z.object({ class_id: v.optUuid(), section_id: v.optUuid(), title: v.optText(80), body: v.text('Message', 600), campus_id: v.optUuid() }),
}, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };
  const n = check(await sb.rpc('queue_custom_message', { p_campus: campus, p_class: input.class_id ?? null, p_section: input.section_id ?? null, p_title: input.title ?? null, p_body: input.body })) as number;
  revalidatePath('/communication');
  return { message: n ? `${n} message${n === 1 ? '' : 's'} queued for guardians.` : 'No guardian with a phone number was found for that selection.' };
});

export const sendNow = callAction({ permission: 'communication.manage' }, async ({ ctx }) => {
  const r = await dispatchQueued({ school: ctx.school.id, limit: 50 });
  revalidatePath('/communication');
  return { message: r.claimed === 0 ? 'Nothing waiting in the outbox.' : `Tried ${r.claimed}: ${r.sent} accepted by the provider, ${r.failed} failed.${r.failed ? ' See the reason in the log.' : ''}` };
});

export const retryFailed = callAction({ permission: 'communication.manage' }, async ({ ctx, sb }) => {
  check(await sb.from('notification_logs').update({ status: 'queued', attempts: 0, error: null, scheduled_for: new Date().toISOString() }).eq('school_id', ctx.school.id).eq('status', 'failed').select('id'));
  revalidatePath('/communication');
  return { message: 'Failed messages re-queued.' };
});
