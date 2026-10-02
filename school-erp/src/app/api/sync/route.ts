import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin } from '@/lib/csrf';
import { friendlyError, newRef } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

/**
 * Replay endpoint for work queued on a phone while offline (attendance sheets, marks sheets).
 * A plain JSON route (not a server action) so a queued item still works after the app has been redeployed.
 * The database functions do the real checks (permissions, section/campus access, locks, idempotency, conflicts).
 */
const uuid = z.string().uuid();
const attendance = z.object({ section_id: uuid, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), rows: z.array(z.object({ student_id: uuid, status: z.enum(['present', 'absent', 'late', 'leave', 'half_day']), remarks: z.string().max(200).optional() })).min(1).max(200) });
const marks = z.object({ exam_subject_id: uuid, rows: z.array(z.object({
  student_id: uuid, marks: z.union([z.string().max(8), z.number()]).optional(), absent: z.boolean().optional(), remarks: z.string().max(200).optional(),
  base: z.object({ marks: z.number().nullable(), absent: z.boolean() }).nullable().optional(),
})).min(1).max(300) });
const body = z.discriminatedUnion('kind', [z.object({ id: uuid, kind: z.literal('attendance'), payload: attendance }), z.object({ id: uuid, kind: z.literal('marks'), payload: marks })]);

export async function POST(req: NextRequest) {
  if (!assertSameOrigin(req)) return NextResponse.json({ ok: false, error: 'Bad origin.' }, { status: 403 });
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });
  const rl = rateLimit(`sync:${u.user.id}`, 120, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: 'Too many requests. Retrying shortly.' }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'This item is not in a valid format.' }, { status: 400 });
  const b = parsed.data;
  try {
    const { data, error } = b.kind === 'attendance'
      ? await sb.rpc('sync_attendance', { p_op: b.id, p_section: b.payload.section_id, p_date: b.payload.date, p_rows: b.payload.rows })
      : await sb.rpc('sync_marks', { p_op: b.id, p_exam_subject: b.payload.exam_subject_id, p_rows: b.payload.rows.map((r) => ({ student_id: r.student_id, marks: r.absent ? '' : String(r.marks ?? ''), absent: !!r.absent, remarks: r.remarks ?? '', base: r.base ?? null })) });
    if (error) throw error;
    return NextResponse.json({ ok: true, result: data });
  } catch (e) {
    const code = String((e as { code?: string }).code ?? '');
    const status = code === '42501' ? 403 : /^[A-Z0-9]{5}$/.test(code) ? 422 : 500;
    return NextResponse.json({ ok: false, error: friendlyError(e, newRef()) }, { status });
  }
}
