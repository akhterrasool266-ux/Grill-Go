import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, PageHeader } from '@/components/ui/primitives';
import { cn } from '@/components/ui/cn';
import { can, requireUser } from '@/lib/auth/session';
import { todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Calendar' };
const KIND_TONE: Record<string, 'warn' | 'info' | 'brand' | 'bad' | 'ok'> = { holiday: 'warn', exam: 'bad', event: 'brand', meeting: 'info', ptm: 'ok', admission: 'info' };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const ctx = await requireUser();
  if (!can(ctx, 'calendar.view') && ctx.studentIds.length === 0) redirect('/forbidden');
  const sp = await searchParams;
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : today.slice(0, 7);
  const first = new Date(`${month}-01T00:00:00Z`), daysIn = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const last = `${month}-${String(daysIn).padStart(2, '0')}`;
  const sb = await createClient();
  const [{ data: ev }, { data: ex }] = await Promise.all([
    sb.from('calendar_events').select('id,title,kind,start_date,end_date').lte('start_date', last).or(`end_date.gte.${month}-01,and(end_date.is.null,start_date.gte.${month}-01)`),
    can(ctx, 'exams.view') ? sb.from('exam_subjects').select('exam_date,exams(name)').gte('exam_date', `${month}-01`).lte('exam_date', last) : Promise.resolve({ data: [] }),
  ]);
  const items = [...((ev ?? []) as any[]).map((e) => ({ ...e, end: e.end_date ?? e.start_date })), ...[...new Map(((ex ?? []) as any[]).map((x) => [`${x.exam_date}${x.exams?.name}`, { id: `x${x.exam_date}${x.exams?.name}`, title: `${x.exams?.name} paper`, kind: 'exam', start_date: x.exam_date, end: x.exam_date }])).values()]];
  const dayItems = (d: string) => items.filter((e) => e.start_date <= d && e.end >= d);
  const lead = (first.getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => { const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1)); return d.toISOString().slice(0, 7); };
  return (
    <>
      <PageHeader title={first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })} actions={<><Link className="rounded-[10px] border border-line px-3 py-2 text-sm" href={`/calendar?m=${shift(-1)}`}>←</Link><Link className="rounded-[10px] border border-line px-3 py-2 text-sm" href="/calendar">Today</Link><Link className="rounded-[10px] border border-line px-3 py-2 text-sm" href={`/calendar?m=${shift(1)}`}>→</Link>{can(ctx, 'calendar.create') && <LinkButton href="/manage/calendar-events/new">+ Event</LinkButton>}</>} />
      <Card className="hidden overflow-hidden sm:block"><div className="grid grid-cols-7 border-b border-line bg-surface-2/60 text-center text-xs font-semibold uppercase text-muted">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="p-2">{d}</div>)}</div>
        <div className="grid grid-cols-7">{cells.map((d, i) => <div key={i} className={cn('min-h-24 border-b border-e border-line p-1.5', d === today && 'bg-brand-soft/40', i % 7 === 6 && 'bg-surface-2/40')}>{d && <><p className={cn('mb-1 text-xs tabular', d === today ? 'font-bold text-brand' : 'text-muted')}>{Number(d.slice(8))}</p>{dayItems(d).slice(0, 3).map((e) => <p key={e.id} className={cn('mb-0.5 truncate rounded px-1.5 py-0.5 text-[11px] font-medium', e.kind === 'holiday' ? 'bg-warn-soft text-warn' : e.kind === 'exam' ? 'bg-bad-soft text-bad' : 'bg-brand-soft text-brand')} title={e.title}>{e.title}</p>)}</>}</div>)}</div></Card>
      <Card className="sm:hidden"><ul className="divide-y divide-line">{Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter((d) => dayItems(d).length).map((d) => <li key={d} className="p-3.5 text-sm"><p className="font-medium">{new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</p>{dayItems(d).map((e) => <p key={e.id} className="mt-1 flex items-center gap-2"><Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{e.kind}</Badge>{e.title}</p>)}</li>)}{items.length === 0 && <li className="p-6 text-center text-sm text-muted">Nothing scheduled this month.</li>}</ul></Card>
    </>
  );
}
