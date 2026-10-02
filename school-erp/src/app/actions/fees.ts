'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { callAction, check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import * as v from '@/lib/validation/common';

const arr = (x: unknown) => (x === undefined || x === '' ? [] : Array.isArray(x) ? x : [x]);
const METHODS = ['cash', 'bank', 'jazzcash', 'easypaisa', 'card', 'online_transfer', 'other'] as const;

export const generateInvoices = formAction({
  permission: 'fees.create',
  schema: z.object({
    type: v.oneOf(['monthly', 'adhoc'] as const), month: v.optText(7), due_date: v.date('Due date'), class_id: v.optUuid(), label: v.optText(80),
    categories: z.preprocess(arr, z.array(v.uuid()).optional()), campus_id: v.optUuid(),
  }),
}, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus || !ctx.campuses.some((c) => c.id === campus)) throw { code: 'X', message: 'Choose a campus first (top bar or the Campus field).' };
  if (input.type === 'monthly' && !/^\d{4}-\d{2}$/.test(input.month ?? '')) throw { code: 'X', message: 'Choose the fee month.' };
  const r = check(await sb.rpc('generate_invoices', {
    p_campus: campus, p_month: input.type === 'monthly' ? `${input.month}-01` : new Date().toISOString().slice(0, 10), p_due: input.due_date,
    p_class: input.class_id ?? null, p_student: null, p_type: input.type, p_category_ids: input.categories?.length ? input.categories : null, p_label: input.label ?? null,
  })) as { created: number; skipped_existing: number; no_charges: number };
  revalidatePath('/fees');
  return { message: `Created ${r.created} voucher${r.created === 1 ? '' : 's'}. ${r.skipped_existing} already existed${r.no_charges ? `, ${r.no_charges} student(s) had no fee set up` : ''}.`, data: r };
});

export const applyLateFines = callAction({ permission: 'fees.create', schema: z.object({ campus_id: v.optUuid() }) }, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus) throw { code: 'X', message: 'Choose a campus first.' };
  const r = check(await sb.rpc('apply_late_fines', { p_campus: campus })) as { fined: number };
  revalidatePath('/fees');
  return { message: r.fined ? `Late fine added to ${r.fined} voucher${r.fined === 1 ? '' : 's'}.` : 'No overdue vouchers needed a new fine.' };
});

export const collectPayment = formAction({
  permission: 'payments.create',
  schema: z.object({
    student_id: v.optUuid(), family_id: v.optUuid(), amount: v.num('Amount', 1, 100_000_000), method: v.oneOf(METHODS, 'Payment method'),
    reference: v.optText(80), bank: v.optText(80), notes: v.optText(300), payer: v.optText(120), invoice_ids: z.preprocess(arr, z.array(v.uuid()).optional()),
  }),
}, async ({ sb, input }) => {
  if (!input.student_id && !input.family_id) throw { code: 'X', message: 'Choose a student or family.' };
  let campus: string;
  if (input.student_id) {
    const { data } = await sb.from('students').select('campus_id').eq('id', input.student_id).single();
    campus = data!.campus_id;
  } else {
    const { data } = await sb.from('students').select('campus_id').eq('family_id', input.family_id!).limit(1).single();
    campus = data!.campus_id;
  }
  const r = check(await sb.rpc('collect_payment', {
    p_campus: campus, p_student: input.student_id ?? null, p_family: input.student_id ? null : input.family_id ?? null, p_amount: input.amount, p_method: input.method,
    p_reference: input.reference ?? null, p_bank: input.bank ?? null, p_invoice_ids: input.invoice_ids?.length ? input.invoice_ids : null, p_notes: input.notes ?? null,
    p_account: null, p_payer: input.payer ?? null,
  })) as { payment_id: string };
  revalidatePath('/fees');
  redirect(`/fees/receipts/${r.payment_id}?new=1`);
});

export const refundPayment = callAction({
  permission: 'payments.approve', schema: z.object({ payment_id: v.uuid(), amount: v.num('Amount', 1), reason: v.text('Reason', 300) }),
}, async ({ sb, input }) => {
  check(await sb.rpc('refund_payment', { p_payment: input.payment_id, p_amount: input.amount, p_reason: input.reason }));
  revalidatePath(`/fees/receipts/${input.payment_id}`);
  return { message: 'Refund recorded.' };
});

export const adjustInvoice = callAction({
  permission: 'fees.approve',
  schema: z.object({ invoice_id: v.uuid(), kind: v.oneOf(['discount', 'fine', 'charge', 'waive_fines'] as const), amount: v.optNum(0.01), description: v.optText(120), reason: v.text('Reason', 300) }),
}, async ({ sb, input }) => {
  check(await sb.rpc('adjust_invoice', { p_invoice: input.invoice_id, p_kind: input.kind, p_amount: input.amount ?? null, p_description: input.description ?? null, p_reason: input.reason }));
  revalidatePath(`/fees/invoices/${input.invoice_id}`);
  return { message: 'Voucher updated.' };
});

export const cancelInvoice = callAction({ permission: 'fees.approve', schema: z.object({ invoice_id: v.uuid(), reason: v.text('Reason', 300) }) }, async ({ sb, input }) => {
  check(await sb.rpc('cancel_invoice', { p_invoice: input.invoice_id, p_reason: input.reason }));
  revalidatePath(`/fees/invoices/${input.invoice_id}`); revalidatePath('/fees/invoices');
  return { message: 'Voucher cancelled.' };
});

export const closeDay = formAction({
  permission: 'payments.approve',
  schema: z.object({ date: v.date('Date'), counted: v.num('Counted cash', 0), notes: v.optText(300), campus_id: v.optUuid() }),
}, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus) throw { code: 'X', message: 'Choose a campus first.' };
  const r = check(await sb.rpc('close_day', { p_campus: campus, p_date: input.date, p_counted: input.counted, p_notes: input.notes ?? null })) as { closing_no: string; difference: number };
  revalidatePath('/fees/closing');
  return { message: `Day closed (${r.closing_no}). ${r.difference === 0 ? 'Cash matches.' : `Difference: Rs ${r.difference}.`}` };
});

export const sendFeeReminders = callAction({ permission: 'communication.create', schema: z.object({ student_ids: z.array(v.uuid()).min(1, 'Select at least one student.').max(500) }) }, async ({ sb, input }) => {
  const n = check(await sb.rpc('queue_fee_reminders', { p_student_ids: input.student_ids })) as number;
  revalidatePath('/communication');
  return { message: n ? `${n} reminder${n === 1 ? '' : 's'} queued. Delivery status appears under Communication once your provider sends them.` : 'Nothing queued — the selected guardians have no phone number on file or reminders are switched off.' };
});
