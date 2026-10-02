import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { pct, todayISO } from '@/lib/format';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Attendance report' };

export default async function AttendanceReport({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; class?: string; section?: string; below?: string }> }) {
  const ctx = await requirePerm('attendance.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const today = todayISO();
  const from = sp.from ?? today.slice(0, 8) + '01', to = sp.to ?? today;
  const sb = await createClient();
  const { data } = await sb.rpc('attendance_summary', { p_campus: campus, p_from: from, p_to: to, p_class: sp.class || null, p_section: sp.section || null });
  const opts = await classSectionOptions(sb, campus);
  let rows = (data ?? []) as any[];
  const threshold = Number(sp.below) || 0;
  if (threshold) rows = rows.filter((r) => Number(r.percentage) < threshold);
  const tot = rows.reduce((a, r) => ({ p: a.p + r.present + r.late + r.half_day * 0.5, c: a.c + r.marked_days - r.leave }), { p: 0, c: 0 });
  const qs = new URLSearchParams(Object.entries({ ...sp, from, to }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Attendance report" back={{ href: '/attendance', label: 'Attendance' }} actions={can(ctx, 'attendance.export') ? <LinkButton variant="secondary" href={`/api/attendance/export?${qs}`}>Export CSV</LinkButton> : undefined} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <input type="date" name="from" defaultValue={from} className="input sm:w-40" aria-label="From" /><input type="date" name="to" defaultValue={to} className="input sm:w-40" aria-label="To" />
        <select name="class" defaultValue={sp.class ?? ''} className="input sm:w-40"><option value="">All classes</option>{opts.classes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <select name="section" defaultValue={sp.section ?? ''} className="input sm:w-44"><option value="">All sections</option>{opts.sectionsFull.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <select name="below" defaultValue={sp.below ?? ''} className="input sm:w-44"><option value="">Everyone</option><option value="90">Below 90%</option><option value="85">Below 85%</option><option value="75">Below 75%</option></select>
        <button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Apply</button>
      </form>
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Students" value={rows.length} /><Stat label="Average attendance" value={tot.c ? pct((tot.p / tot.c) * 100) : '—'} /></section>
      <Card>{rows.length === 0 ? <EmptyState title="No attendance in this period" /> : (
        <TableWrap><thead><tr><Th>Student</Th><Th>Class</Th><Th className="text-end">Present</Th><Th className="text-end">Absent</Th><Th className="hidden sm:table-cell text-end">Late</Th><Th className="hidden sm:table-cell text-end">Leave</Th><Th className="text-end">%</Th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.student_id} className="hover:bg-surface-2/50"><Td><Link className="font-medium text-brand hover:underline" href={`/students/${r.student_id}?tab=attendance`}>{r.student_name}</Link><span className="block text-xs text-muted">{r.student_code}</span></Td><Td>{r.class_name} {r.section_name}</Td><Td className="tabular text-end">{r.present}</Td><Td className="tabular text-end">{r.absent}</Td><Td className="hidden tabular text-end sm:table-cell">{r.late}</Td><Td className="hidden tabular text-end sm:table-cell">{r.leave}</Td><Td className="text-end"><Badge tone={Number(r.percentage) < 75 ? 'bad' : Number(r.percentage) < 90 ? 'warn' : 'ok'}>{pct(r.percentage)}</Badge></Td></tr>)}
        </tbody></TableWrap>)}</Card>
    </>
  );
}
