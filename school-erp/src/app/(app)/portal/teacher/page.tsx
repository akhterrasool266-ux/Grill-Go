import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDate, fmtTime, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My classes' };
const dow = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })).getDay(); return d === 0 ? 7 : d; };

export default async function TeacherPortal() {
  const ctx = await requireUser();
  const sb = await createClient();
  const today = todayISO();
  const staffId = ctx.staffId;
  const [{ data: assigned }, { data: lessons }, { data: marked }, { data: hw }, { data: notices }] = staffId ? await Promise.all([
    sb.from('teacher_assignments').select('is_class_teacher,section_id,subjects(name),sections(id,name,classes(name))').eq('staff_id', staffId),
    sb.from('timetable_entries').select('period_id,periods(name,start_time,end_time,sort_order),subjects(name),sections(name,classes(name)),rooms(name)').eq('staff_id', staffId).eq('day_of_week', dow()),
    sb.from('student_attendance').select('section_id').eq('date', today),
    sb.from('homework').select('id,title,due_date,sections(name,classes(name))').eq('staff_id', staffId).gte('due_date', today).order('due_date').limit(5),
    sb.from('announcements').select('id,title,body,publish_at').order('publish_at', { ascending: false }).limit(3),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const markedSet = new Set((marked ?? []).map((m: any) => m.section_id));
  const secMap = new Map<string, any>();
  for (const a of (assigned ?? []) as any[]) { const e = secMap.get(a.section_id) ?? { ...a.sections, subjects: [] as string[], ct: false }; if (a.subjects?.name) e.subjects.push(a.subjects.name); if (a.is_class_teacher) e.ct = true; secMap.set(a.section_id, e); }
  const mySections = [...secMap.values()];
  const lessonsSorted = ((lessons ?? []) as any[]).sort((a, b) => (a.periods?.sort_order ?? 0) - (b.periods?.sort_order ?? 0));
  return (
    <>
      <PageHeader title={`Welcome, ${ctx.profile.full_name.split(' ')[0]}`} description={fmtDate(today, 'long')} actions={<>{can(ctx, 'leave.create') && <LinkButton variant="secondary" href="/leave">Request leave</LinkButton>}</>} />
      {!staffId && <Card><EmptyState title="Your login is not linked to a staff record" hint="Ask the administrator to link it, so your classes and timetable appear here." /></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="My classes" />
          {mySections.length === 0 ? <EmptyState title="No classes assigned yet" /> : <ul className="divide-y divide-line">{mySections.map((s) => (
            <li key={s.id} className="space-y-2 p-4"><div className="flex items-center justify-between gap-2"><p className="font-medium">{s.classes?.name} – {s.name}{s.ct && <Badge tone="brand" className="ms-2">Class teacher</Badge>}</p>{can(ctx, 'attendance.create') && <Badge tone={markedSet.has(s.id) ? 'ok' : 'warn'}>{markedSet.has(s.id) ? 'Attendance done' : 'Attendance pending'}</Badge>}</div>
              {s.subjects.length > 0 && <p className="text-sm text-muted">{[...new Set(s.subjects)].join(', ')}</p>}
              <div className="flex flex-wrap gap-2 text-sm"><Link className="rounded-full border border-line px-3 py-1 hover:bg-surface-2" href={`/attendance?section=${s.id}`}>Attendance</Link><Link className="rounded-full border border-line px-3 py-1 hover:bg-surface-2" href={`/students?section=${s.id}`}>Students</Link><Link className="rounded-full border border-line px-3 py-1 hover:bg-surface-2" href={`/homework?section=${s.id}`}>Homework</Link></div></li>))}</ul>}
        </Card>
        <div className="space-y-4">
          <Card><CardHeader title="Today's lessons" />
            {lessonsSorted.length === 0 ? <EmptyState title="No lessons today" /> : <ul className="divide-y divide-line">{lessonsSorted.map((l, i) => <li key={i} className="flex justify-between gap-3 p-3.5 text-sm"><span><span className="font-medium">{l.subjects?.name}</span><span className="block text-xs text-muted">{l.sections?.classes?.name} – {l.sections?.name}{l.rooms?.name ? ` · ${l.rooms.name}` : ''}</span></span><span className="text-muted">{fmtTime(l.periods?.start_time)}</span></li>)}</ul>}
          </Card>
          <Card><CardHeader title="Homework due" action={can(ctx, 'homework.create') ? <Link href="/homework/new" className="text-sm text-brand hover:underline">+ New</Link> : undefined} />
            {(hw ?? []).length === 0 ? <EmptyState title="Nothing due" /> : <ul className="divide-y divide-line">{(hw ?? []).map((h: any) => <li key={h.id} className="flex justify-between gap-3 p-3.5 text-sm"><span className="font-medium">{h.title}<span className="block text-xs font-normal text-muted">{h.sections?.classes?.name} – {h.sections?.name}</span></span><span className="text-muted">{fmtDate(h.due_date)}</span></li>)}</ul>}
          </Card>
        </div>
        <Card className="lg:col-span-2"><CardHeader title="Announcements" />{(notices ?? []).length === 0 ? <EmptyState title="No announcements" /> : <ul className="divide-y divide-line">{(notices ?? []).map((n: any) => <li key={n.id} className="p-4 text-sm"><p className="font-medium">{n.title}</p><p className="text-muted">{n.body}</p></li>)}</ul>}</Card>
      </div>
    </>
  );
}
