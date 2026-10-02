'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { callAction, check } from '@/lib/actions';
import * as v from '@/lib/validation/common';

const entry = z.object({ section_id: v.uuid('Section'), day: z.coerce.number().int().min(1).max(7), period_id: v.uuid('Period'), subject_id: v.optUuid(), staff_id: v.optUuid(), room_id: v.optUuid() });

export const checkConflicts = callAction({ permission: 'timetable.view', schema: entry }, async ({ sb, input }) => {
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
  if (!year) throw { code: 'X', message: 'no_current_academic_year' };
  const { data: existing } = await sb.from('timetable_entries').select('id').eq('academic_year_id', year.id).eq('section_id', input.section_id).eq('day_of_week', input.day).eq('period_id', input.period_id).maybeSingle();
  const rows = check(await sb.rpc('check_timetable_conflicts', { p_year: year.id, p_section: input.section_id, p_day: input.day, p_period: input.period_id, p_staff: input.staff_id ?? null, p_room: input.room_id ?? null, p_exclude: existing?.id ?? null })) as { kind: string; message: string }[];
  return { data: { conflicts: rows.map((r) => r.message) } };
});

export const saveTimetableEntry = callAction({ permission: ['timetable.create', 'timetable.edit'], schema: entry }, async ({ sb, input }) => {
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
  if (!year) throw { code: 'X', message: 'no_current_academic_year' };
  const { data: sec } = await sb.from('sections').select('campus_id').eq('id', input.section_id).single();
  const { data: existing } = await sb.from('timetable_entries').select('id').eq('academic_year_id', year.id).eq('section_id', input.section_id).eq('day_of_week', input.day).eq('period_id', input.period_id).maybeSingle();
  const conflicts = check(await sb.rpc('check_timetable_conflicts', { p_year: year.id, p_section: input.section_id, p_day: input.day, p_period: input.period_id, p_staff: input.staff_id ?? null, p_room: input.room_id ?? null, p_exclude: existing?.id ?? null })) as { message: string }[];
  const own = conflicts.filter((c) => !c.message.startsWith('This class already'));    // the same-cell clash is just "replace"
  if (own.length) throw { code: 'X', message: own.map((c) => c.message).join(' ') };
  const row = { campus_id: sec!.campus_id, academic_year_id: year.id, section_id: input.section_id, day_of_week: input.day, period_id: input.period_id, subject_id: input.subject_id ?? null, staff_id: input.staff_id ?? null, room_id: input.room_id ?? null };
  if (existing) check(await sb.from('timetable_entries').update(row).eq('id', existing.id).select('id').single());
  else check(await sb.from('timetable_entries').insert(row).select('id').single());
  revalidatePath('/timetable');
  return { message: 'Saved.' };
});

export const clearTimetableCell = callAction({ permission: 'timetable.delete', schema: z.object({ section_id: v.uuid(), day: z.coerce.number().int().min(1).max(7), period_id: v.uuid() }) }, async ({ sb, input }) => {
  const { data: year } = await sb.from('academic_years').select('id').eq('is_current', true).maybeSingle();
  check(await sb.from('timetable_entries').delete().eq('academic_year_id', year!.id).eq('section_id', input.section_id).eq('day_of_week', input.day).eq('period_id', input.period_id).select('id'));
  revalidatePath('/timetable');
  return { message: 'Cleared.' };
});
