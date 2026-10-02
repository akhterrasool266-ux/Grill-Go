import type { Metadata } from 'next';
import { StaffAttendanceSheet } from '@/components/data/staff-attendance-sheet';
import { ActionButton } from '@/components/ui/confirm-form';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { selfCheck } from '@/app/actions/attendance';

export const metadata: Metadata = { title: 'Staff attendance' };

export default async function StaffAttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requirePerm('staff_attendance.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const sb = await createClient();
  let q = sb.from('staff').select('id,full_name,employee_code,campus_id,shift_start').eq('status', 'active').order('full_name');
  if (campus) q = q.eq('campus_id', campus);
  const [{ data: staff }, { data: att }] = await Promise.all([q, sb.from('staff_attendance').select('staff_id,status,check_in,check_out,overtime_minutes').eq('date', date)]);
  const map = Object.fromEntries((att ?? []).map((a: any) => [a.staff_id, a]));
  const canWrite = can(ctx, 'staff_attendance.create', 'staff_attendance.edit');
  return (
    <>
      <PageHeader title="Staff attendance" description={fmtDate(date, 'long')} actions={ctx.staffId ? <><ActionButton action={selfCheck} data={{ kind: 'in' }} variant="primary" size="md">Check in</ActionButton><ActionButton action={selfCheck} data={{ kind: 'out' }} size="md">Check out</ActionButton></> : undefined} />
      <form className="mb-4 flex gap-2"><input type="date" name="date" defaultValue={date} max={today} className="input w-44" aria-label="Date" /><button className="rounded-[10px] border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">Open</button></form>
      <Card>{(staff ?? []).length === 0 ? <EmptyState title="No staff found" /> :
        <StaffAttendanceSheet date={date} canWrite={canWrite} rows={(staff ?? []).map((s: any) => ({ id: s.id, campus_id: s.campus_id, name: s.full_name, code: s.employee_code, shift: s.shift_start?.slice(0, 5), status: map[s.id]?.status ?? '', check_in: map[s.id]?.check_in?.slice(0, 5) ?? '', check_out: map[s.id]?.check_out?.slice(0, 5) ?? '', ot: map[s.id]?.overtime_minutes ?? 0 }))} />}
      </Card>
    </>
  );
}
