'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { callAction, check } from '@/lib/actions';
import * as v from '@/lib/validation/common';

const STATUS = ['present', 'absent', 'late', 'leave', 'half_day'] as const;

export const saveAttendance = callAction({
  permission: 'attendance.create',
  schema: z.object({
    section_id: v.uuid('Section'), date: v.date('Date'), reason: v.optText(300), method: z.enum(['manual', 'qr']).default('manual'),
    rows: z.array(z.object({ student_id: v.uuid(), status: z.enum(STATUS), remarks: v.optText(200) })).min(1, 'No students to save.').max(300),
  }),
}, async ({ sb, input }) => {
  const r = check(await sb.rpc('mark_attendance', { p_section: input.section_id, p_date: input.date, p_rows: input.rows, p_method: input.method, p_reason: input.reason ?? null })) as { saved: number; corrected: number; absence_alerts_queued: number };
  revalidatePath('/attendance');
  const parts = [`${r.saved} saved`, r.corrected ? `${r.corrected} corrected` : '', r.absence_alerts_queued ? `${r.absence_alerts_queued} absence alert${r.absence_alerts_queued === 1 ? '' : 's'} queued for parents` : ''].filter(Boolean);
  return { message: parts.join(' · '), data: r };
});

export const scanAttendance = callAction({
  permission: 'attendance.qr', rateLimit: { key: 'scan', limit: 120, windowMs: 60_000 },
  schema: z.object({ code: z.string().trim().min(3).max(30) }),
}, async ({ sb, input }) => {
  const r = check(await sb.rpc('mark_attendance_qr', { p_code: input.code })) as { student: string; class: string; status: string; already_marked: boolean };
  return { data: r };
});

export const saveStaffAttendance = callAction({
  permission: ['staff_attendance.create', 'staff_attendance.edit'],
  schema: z.object({ date: v.date('Date'), rows: z.array(z.object({ staff_id: v.uuid(), campus_id: v.uuid(), status: z.enum(['present', 'absent', 'late', 'leave', 'half_day', 'holiday']), check_in: v.optTime(), check_out: v.optTime(), overtime_minutes: v.optNum(0, 1000) })).min(1).max(500) }),
}, async ({ sb, input }) => {
  const rows = input.rows.map((r) => ({ staff_id: r.staff_id, campus_id: r.campus_id, date: input.date, status: r.status, check_in: r.check_in ?? null, check_out: r.check_out ?? null, overtime_minutes: r.overtime_minutes ?? 0, method: 'manual' }));
  check(await sb.from('staff_attendance').upsert(rows, { onConflict: 'staff_id,date' }).select('id'));
  revalidatePath('/staff-attendance');
  return { message: `${rows.length} saved.` };
});

export const selfCheck = callAction({ schema: z.object({ kind: z.enum(['in', 'out']) }) }, async ({ sb, input }) => {
  const r = check(await sb.rpc(input.kind === 'in' ? 'staff_check_in' : 'staff_check_out', {})) as Record<string, unknown>;
  revalidatePath('/staff-attendance');
  return { message: input.kind === 'in' ? (r.already_checked_in ? 'You already checked in today.' : `Checked in (${r.status}).`) : 'Checked out. Have a good evening!', data: r };
});
