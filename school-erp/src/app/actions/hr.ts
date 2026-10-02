'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import * as v from '@/lib/validation/common';

const staffFields = {
  full_name: v.text('Full name', 120), gender: z.preprocess((x) => x || undefined, z.enum(['male', 'female', 'other']).optional()), dob: v.optDate(), cnic: v.optCnic(), phone: v.phone('Phone'), email: v.optEmail(), address: v.optText(300),
  department_id: v.optUuid(), designation_id: v.optUuid(), joining_date: v.optDate(), employment_type: v.oneOf(['permanent', 'contract', 'part_time', 'visiting'] as const, 'Employment type'),
  qualification: v.optText(160), experience_years: v.optNum(0, 60), bank_name: v.optText(80), bank_account: v.optText(40), shift_start: v.optTime(), shift_end: v.optTime(),
};
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== undefined && x !== ''));

export const createStaff = formAction({ permission: 'staff.create', schema: z.object({ ...staffFields, campus_id: v.optUuid(), employee_code: v.optText(20) }) }, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus || !ctx.campuses.some((c) => c.id === campus)) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };
  const { campus_id: _c, ...rest } = input;
  const r = check(await sb.rpc('create_staff', { p_campus: campus, p: clean(rest) })) as { id: string };
  revalidatePath('/staff');
  redirect(`/staff/${r.id}`);
});

export const updateStaff = formAction({ permission: 'staff.edit', schema: z.object({ id: v.uuid(), ...staffFields }) }, async ({ sb, input }) => {
  const { id, ...rest } = input;
  const patch = Object.fromEntries(Object.entries(rest).map(([k, x]) => [k, x === undefined ? null : x]));
  patch.shift_start = rest.shift_start ?? '08:00'; patch.shift_end = rest.shift_end ?? '14:00'; patch.joining_date = rest.joining_date ?? undefined as never;
  check(await sb.from('staff').update(patch).eq('id', id).select('id').single());
  revalidatePath(`/staff/${id}`);
  redirect(`/staff/${id}`);
});

export const setStaffStatus = callAction({ permission: 'staff.edit', schema: z.object({ id: v.uuid(), status: v.oneOf(['active', 'on_leave', 'resigned', 'terminated'] as const) }) }, async ({ sb, input }) => {
  check(await sb.from('staff').update({ status: input.status, left_date: ['resigned', 'terminated'].includes(input.status) ? new Date().toISOString().slice(0, 10) : null }).eq('id', input.id).select('id').single());
  revalidatePath(`/staff/${input.id}`);
  return { message: 'Status updated.' };
});

// ── leave ──
export const requestLeave = formAction({
  permission: ['leave.create'],
  schema: z.object({ leave_type_id: v.uuid('Leave type'), from_date: v.date('From'), to_date: v.date('To'), reason: v.text('Reason', 300) }),
}, async ({ ctx, sb, input }) => {
  if (!ctx.staffId) throw { code: 'X', message: 'Your login is not linked to a staff record. Ask HR to link it.' };
  if (input.to_date < input.from_date) throw { code: 'X', message: 'The end date cannot be before the start date.' };
  const { data: st } = await sb.from('staff').select('campus_id').eq('id', ctx.staffId).single();
  check(await sb.from('leave_requests').insert({ requester_type: 'staff', staff_id: ctx.staffId, campus_id: st!.campus_id, days: 1, requested_by: ctx.userId, ...input }).select('id').single());
  revalidatePath('/leave');
  return { message: 'Leave request sent for approval.' };
});

export const decideLeave = callAction({ permission: 'leave.approve', schema: z.object({ id: v.uuid(), decision: z.enum(['approved', 'rejected']), note: v.optText(300) }) }, async ({ sb, input }) => {
  check(await sb.rpc('decide_leave', { p_request: input.id, p_decision: input.decision, p_note: input.note ?? null }));
  revalidatePath('/leave');
  return { message: input.decision === 'approved' ? 'Leave approved.' : 'Leave rejected.' };
});

export const cancelLeave = callAction({ permission: 'leave.view', schema: z.object({ id: v.uuid() }) }, async ({ sb, input }) => {
  check(await sb.from('leave_requests').update({ status: 'cancelled' }).eq('id', input.id).eq('status', 'pending').select('id').single());
  revalidatePath('/leave');
  return { message: 'Request cancelled.' };
});

// ── payroll ──
export const generatePayroll = formAction({ permission: 'payroll.create', schema: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'Choose a month.'), campus_id: v.optUuid() }) }, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus) throw { code: 'X', message: 'Choose a campus first.' };
  const r = check(await sb.rpc('generate_payroll', { p_campus: campus, p_month: `${input.month}-01` })) as { run_id: string; payslips: number; skipped_no_salary_structure: number };
  revalidatePath('/payroll');
  redirect(`/payroll/${r.run_id}?generated=${r.payslips}&skipped=${r.skipped_no_salary_structure}`);
});
export const approvePayroll = callAction({ permission: 'payroll.approve', schema: z.object({ id: v.uuid() }) }, async ({ sb, input }) => { check(await sb.rpc('approve_payroll', { p_run: input.id })); revalidatePath(`/payroll/${input.id}`); return { message: 'Payroll approved.' }; });
export const payPayroll = callAction({ permission: 'payroll.approve', schema: z.object({ id: v.uuid(), account_id: v.optUuid() }) }, async ({ sb, input }) => { check(await sb.rpc('pay_payroll', { p_run: input.id, p_account: input.account_id ?? null })); revalidatePath(`/payroll/${input.id}`); return { message: 'Marked as paid and recorded in the cash book.' }; });
