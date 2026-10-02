'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { check, formAction } from '@/lib/actions';
import { currentCampus } from '@/lib/auth/session';
import * as v from '@/lib/validation/common';

export const postJournal = formAction({
  permission: 'finance.create',
  schema: z.object({ entry_date: v.date('Date'), memo: v.text('Memo', 200), campus_id: v.optUuid(),
    gl: z.preprocess((x) => (Array.isArray(x) ? x : [x]), z.array(z.string())), debit: z.preprocess((x) => (Array.isArray(x) ? x : [x]), z.array(z.string())), credit: z.preprocess((x) => (Array.isArray(x) ? x : [x]), z.array(z.string())) }),
}, async ({ ctx, sb, input }) => {
  const campus = (await currentCampus(ctx)) ?? input.campus_id;
  if (!campus) throw { code: 'X', message: 'Choose a campus first.' };
  const lines = input.gl.map((g, i) => ({ gl_account_id: g, debit: Number(input.debit[i] || 0), credit: Number(input.credit[i] || 0) })).filter((l) => l.gl_account_id && (l.debit > 0 || l.credit > 0));
  check(await sb.rpc('post_journal', { p_campus: campus, p_date: input.entry_date, p_memo: input.memo, p_lines: lines }));
  revalidatePath('/finance/journal');
  return { message: 'Journal entry posted.' };
});
