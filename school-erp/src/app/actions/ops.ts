'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import * as v from '@/lib/validation/common';

// ── library ──
export const issueBook = formAction({ permission: 'library.create', schema: z.object({ book_id: v.uuid('Book'), borrower: v.text('Borrower ID', 30) }) }, async ({ sb, input }) => {
  const code = input.borrower.trim().toUpperCase();
  const isStaff = code.startsWith('EMP');
  const { data: who } = isStaff ? await sb.from('staff').select('id').eq('employee_code', code).maybeSingle() : await sb.from('students').select('id').eq('student_code', code).maybeSingle();
  if (!who) throw { code: 'X', message: isStaff ? 'staff_not_found' : 'student_not_found' };
  const r = check(await sb.rpc('issue_book', { p_book: input.book_id, p_student: isStaff ? null : who.id, p_staff: isStaff ? who.id : null })) as { due_on: string };
  revalidatePath('/library');
  return { message: `Issued. Due on ${r.due_on}.` };
});
export const returnBook = callAction({ permission: 'library.edit', schema: z.object({ id: v.uuid(), lost: v.optText(5) }) }, async ({ sb, input }) => {
  const r = check(await sb.rpc('return_book', { p_tx: input.id, p_lost: input.lost === 'true' })) as { fine: number };
  revalidatePath('/library');
  return { message: r.fine > 0 ? `Returned. Late fine: Rs ${r.fine}.` : 'Returned.' };
});
export const renewBook = callAction({ permission: 'library.edit', schema: z.object({ id: v.uuid() }) }, async ({ sb, input }) => { check(await sb.rpc('renew_book', { p_tx: input.id })); revalidatePath('/library'); return { message: 'Renewed.' }; });

// ── homework ──
export const createHomework = formAction({
  permission: 'homework.create',
  schema: z.object({ section_id: v.uuid('Section'), subject_id: v.optUuid(), title: v.text('Title', 150), description: v.optText(2000), due_date: v.date('Due date'), allow_submission: v.bool() }),
}, async ({ ctx, sb, input }) => {
  const { data: sec } = await sb.from('sections').select('campus_id').eq('id', input.section_id).single();
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
  check(await sb.from('homework').insert({ ...input, subject_id: input.subject_id ?? null, description: input.description ?? null, campus_id: sec!.campus_id, academic_year_id: year?.id ?? null, staff_id: ctx.staffId, is_published: true }).select('id').single());
  revalidatePath('/homework');
  redirect('/homework');
});
export const deleteHomework = callAction({ permission: 'homework.delete', schema: z.object({ id: v.uuid() }) }, async ({ sb, input }) => { check(await sb.from('homework').delete().eq('id', input.id).select('id').single()); revalidatePath('/homework'); return { message: 'Deleted.' }; });
export const submitHomework = formAction({ schema: z.object({ homework_id: v.uuid(), student_id: v.uuid(), text_answer: v.text('Your answer', 3000) }) }, async ({ ctx, sb, input }) => {
  if (!ctx.studentIds.includes(input.student_id)) throw { code: '42501', message: 'permission_denied' };
  const { data: s } = await sb.from('students').select('campus_id').eq('id', input.student_id).single();
  const { data: h } = await sb.from('homework').select('due_date').eq('id', input.homework_id).single();
  const late = h && h.due_date < new Date().toISOString().slice(0, 10);
  check(await sb.from('homework_submissions').upsert({ homework_id: input.homework_id, student_id: input.student_id, text_answer: input.text_answer, campus_id: s!.campus_id, status: late ? 'late' : 'submitted' }, { onConflict: 'homework_id,student_id' }).select('id').single());
  revalidatePath('/homework');
  return { message: late ? 'Submitted (marked late).' : 'Submitted.' };
});

// ── announcements ──
export const createAnnouncement = formAction({
  permission: 'announcements.create',
  schema: z.object({ title: v.text('Title', 150), body: v.text('Message', 2000), audience: v.oneOf(['all', 'parents', 'students', 'teachers', 'staff'] as const), level: v.oneOf(['info', 'success', 'warning', 'urgent'] as const), is_pinned: v.bool(), notify: v.bool(), campus_id: v.optUuid() }),
}, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id ?? null;
  const { campus_id: _c, notify, ...rest } = input;
  const row = check(await sb.from('announcements').insert({ ...rest, campus_id: campus, notify }).select('id').single());
  if (notify && ['all', 'parents'].includes(input.audience) && ctx.permissions.includes('communication.create')) await sb.rpc('queue_announcement', { p_announcement: row!.id });
  revalidatePath('/announcements');
  redirect('/announcements');
});

// ── notifications ──
export const markNotificationsRead = callAction({ schema: z.object({ id: v.optUuid() }) }, async ({ ctx, sb, input }) => {
  let q = sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', ctx.userId).is('read_at', null);
  if (input.id) q = q.eq('id', input.id);
  check(await q.select('id'));
  revalidatePath('/notifications');
  return { message: 'Marked as read.' };
});

// ── transport ──
export const markRoute = callAction({ schema: z.object({ route_id: v.uuid(), student_id: v.uuid(), trip: z.enum(['pickup', 'drop']), status: z.enum(['boarded', 'absent', 'dropped']) }) }, async ({ sb, input }) => {
  check(await sb.rpc('mark_route_attendance', { p_route: input.route_id, p_student: input.student_id, p_trip: input.trip, p_status: input.status }));
  revalidatePath('/transport/my-route');
  return { message: 'Saved.' };
});
