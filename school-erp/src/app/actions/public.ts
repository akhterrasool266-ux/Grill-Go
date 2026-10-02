'use server';
import { headers } from 'next/headers';
import { z } from 'zod';
import type { ActionResult } from '@/lib/actions';
import { friendlyError, newRef } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import * as v from '@/lib/validation/common';
import { fieldErrorsOf, formToObject } from '@/lib/validation/common';

const schema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  full_name: v.text('Child’s name', 120), gender: v.oneOf(['male', 'female', 'other'] as const, 'Gender'), dob: v.optDate(),
  class_id: v.optUuid(), campus_id: v.optUuid(),
  guardian_name: v.text('Parent/guardian name', 120), guardian_relation: v.optText(30), phone: v.phone('Mobile number'), whatsapp: v.optPhone(), email: v.optEmail(),
  guardian_cnic: v.optCnic(), b_form_no: v.optText(20), city: v.optText(80), address: v.optText(300), previous_school: v.optText(160), previous_class: v.optText(60),
  website: z.string().max(200).optional(), // honeypot: real people leave it empty
});

/** Public online admission form. No login: protected by a honeypot, an IP rate limit and server-side validation. */
export async function submitAdmission(_prev: ActionResult<{ no: string }> | null, fd: FormData): Promise<ActionResult<{ no: string }>> {
  try {
    const h = await headers();
    const ip = (h.get('x-forwarded-for') ?? 'unknown').split(',')[0]!.trim();
    const rl = rateLimit(`apply:${ip}`, 5, 3600_000);
    if (!rl.ok) return { ok: false, error: 'Too many applications from this connection. Please try again later or call the school.' };
    const parsed = schema.safeParse(formToObject(fd));
    if (!parsed.success) { const fe = fieldErrorsOf(parsed.error); return { ok: false, error: Object.values(fe)[0] ?? 'Please check the form.', fieldErrors: fe }; }
    const { slug, website, ...data } = parsed.data;
    if (website) return { ok: true, data: { no: 'RECEIVED' } }; // bots get a fake success and nothing is stored
    const { data: no, error } = await createAdminClient().rpc('submit_online_admission', { p_slug: slug, p_data: data });
    if (error) throw error;
    return { ok: true, message: 'Application received.', data: { no: String(no) } };
  } catch (e) {
    return { ok: false, error: friendlyError(e, newRef()) };
  }
}
