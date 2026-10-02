import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Avatar } from '@/components/ui/avatar';
import { Badge, Card, CardBody, CardHeader, EmptyState, Stat, statusTone } from '@/components/ui/primitives';
import { TimetableGrid, type Cell, type Period } from '@/components/data/timetable-grid';
import { fmtDate, pkr, titleCase, todayISO } from '@/lib/format';
import { getT } from '@/lib/i18n';

const isoDow = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' })).getDay(); return d === 0 ? 7 : d; };

/** Shared by the parent portal (one or many children) and the student portal. Everything is read through RLS. */
export async function PortalHome({ sb, studentIds, child, basePath }: { sb: SupabaseClient; studentIds: string[]; child?: string; basePath: string }) {
  const { t } = await getT();
  if (studentIds.length === 0) return <Card><EmptyState title="No student is linked to your account yet" hint="Ask the school office to link your login to your child's record." /></Card>;
  const { data: kids } = await sb.from('students').select('id,full_name,student_code,photo_path,class_id,section_id,campus_id,classes(name),sections(name)').in('id', studentIds).order('full_name');
  const list = (kids ?? []) as any[];
  const s = list.find((k) => k.id === child) ?? list[0];
  if (!s) return <Card><EmptyState title="Student not found" /></Card>;
  const today = todayISO(), soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  const [att, inv, exams, hw, notices, tt, periods, teacher] = await Promise.all([
    sb.from('student_attendance').select('status').eq('student_id', s.id).eq('date', today).maybeSingle(),
    sb.from('fee_invoices').select('id,balance,due_date,period_label,status').eq('student_id', s.id).in('status', ['unpaid', 'partial']).gt('balance', 0).order('due_date'),
    s.class_id ? sb.from('exam_subjects').select('exam_date,start_time,subjects(name),exams(name)').eq('class_id', s.class_id).gte('exam_date', today).lte('exam_date', soon).order('exam_date').limit(6) : Promise.resolve({ data: [] }),
    s.section_id ? sb.from('homework').select('id,title,due_date,subjects(name)').eq('section_id', s.section_id).gte('due_date', today).order('due_date').limit(5) : Promise.resolve({ data: [] }),
    sb.from('announcements').select('id,title,body,level,publish_at,is_pinned').order('is_pinned', { ascending: false }).order('publish_at', { ascending: false }).limit(4),
    s.section_id ? sb.from('timetable_entries').select('day_of_week,period_id,subjects(name),staff(full_name),rooms(name)').eq('section_id', s.section_id) : Promise.resolve({ data: [] }),
    s.campus_id ? sb.from('periods').select('id,name,start_time,end_time,is_break').eq('campus_id', s.campus_id).order('sort_order') : Promise.resolve({ data: [] }),
    s.section_id ? sb.from('teacher_assignments').select('staff(full_name)').eq('section_id', s.section_id).eq('is_class_teacher', true).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const owed = ((inv.data ?? []) as any[]).reduce((a, i) => a + Number(i.balance), 0);
  const overdue = ((inv.data ?? []) as any[]).filter((i) => i.due_date < today).length;
  const cells: Cell[] = ((tt.data ?? []) as any[]).map((e) => ({ day: e.day_of_week, period_id: e.period_id, subject: e.subjects?.name, staff: e.staff?.full_name, room: e.rooms?.name }));
  const todayStatus = (att.data as any)?.status as string | undefined;

  return (
    <div className="space-y-5">
      {list.length > 1 && (
        <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0"><div className="flex min-w-max gap-2" role="tablist" aria-label="Children">
          {list.map((k) => (
            <Link key={k.id} href={`${basePath}?child=${k.id}`} role="tab" aria-selected={k.id === s.id} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${k.id === s.id ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface'}`}>
              <Avatar name={k.full_name} size={24} />{k.full_name.split(' ')[0]}
            </Link>
          ))}
        </div></div>
      )}
      <Card><CardBody className="flex items-center gap-4">
        <Avatar name={s.full_name} size={56} src={s.photo_path ? `/api/photo/${s.id}` : null} />
        <div className="min-w-0"><p className="truncate text-lg font-semibold">{s.full_name}</p><p className="text-sm text-muted">{s.classes?.name}{s.sections?.name ? ` – ${s.sections.name}` : ''} · {s.student_code}</p>{(teacher.data as any)?.staff?.full_name && <p className="text-sm text-muted">Class teacher: {(teacher.data as any).staff.full_name}</p>}</div>
      </CardBody></Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('portal.today')} value={todayStatus ? t(`status.${todayStatus}`) : 'Not marked yet'} tone={todayStatus === 'absent' ? 'bad' : todayStatus ? 'ok' : undefined} href={`/students/${s.id}?tab=attendance`} />
        <Stat label={t('portal.fees')} value={pkr(owed)} tone={overdue ? 'bad' : owed ? 'warn' : 'ok'} hint={overdue ? `${overdue} overdue` : owed ? undefined : 'All paid'} href={`/students/${s.id}?tab=fees`} />
        <Stat label={t('portal.exams')} value={((exams.data ?? []) as any[]).length} href={`/students/${s.id}?tab=exams`} />
        <Stat label={t('portal.homework')} value={((hw.data ?? []) as any[]).length} href={`/students/${s.id}?tab=homework`} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title={t('portal.notices')} />
          {((notices.data ?? []) as any[]).length === 0 ? <EmptyState title="No notices" /> : <ul className="divide-y divide-line">{((notices.data ?? []) as any[]).map((n) => <li key={n.id} className="p-4 text-sm"><div className="flex items-center justify-between gap-2"><p className="font-medium">{n.title}</p><Badge tone={n.level === 'urgent' ? 'bad' : n.level === 'warning' ? 'warn' : 'neutral'}>{fmtDate(n.publish_at)}</Badge></div><p className="mt-1 text-muted">{n.body}</p></li>)}</ul>}
        </Card>
        <div className="space-y-4">
          <Card><CardHeader title={t('portal.homework')} />{((hw.data ?? []) as any[]).length === 0 ? <EmptyState title="No homework due" /> : <ul className="divide-y divide-line">{((hw.data ?? []) as any[]).map((h) => <li key={h.id} className="flex items-center justify-between gap-3 p-3.5 text-sm"><span><span className="font-medium">{h.title}</span><span className="block text-xs text-muted">{h.subjects?.name}</span></span><Badge tone="warn">Due {fmtDate(h.due_date)}</Badge></li>)}</ul>}</Card>
          <Card><CardHeader title={t('portal.exams')} />{((exams.data ?? []) as any[]).length === 0 ? <EmptyState title="No exams in the next two weeks" /> : <ul className="divide-y divide-line">{((exams.data ?? []) as any[]).map((e, i) => <li key={i} className="flex justify-between gap-3 p-3.5 text-sm"><span><span className="font-medium">{e.subjects?.name}</span><span className="block text-xs text-muted">{e.exams?.name}</span></span><span className="text-muted">{fmtDate(e.exam_date)}</span></li>)}</ul>}</Card>
        </div>
      </div>

      {cells.length > 0 && <section><h2 className="mb-2 text-base font-semibold">Timetable</h2><TimetableGrid periods={(periods.data ?? []) as Period[]} cells={cells} /></section>}

      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="More about this child">
        {['attendance', 'fees', 'results', 'documents', 'transport', 'promotion'].map((tab) => <Link key={tab} href={`/students/${s.id}?tab=${tab}`} className="rounded-[10px] border border-line bg-surface px-3 py-2.5 text-center text-sm font-medium hover:bg-surface-2">{titleCase(tab)}</Link>)}
      </nav>
      {inv.data && (inv.data as any[]).length > 0 && <p className="text-xs text-muted">To pay: show your voucher at the school accounts office{process.env.JAZZCASH_MERCHANT_ID ? ' or pay online (coming from your voucher page)' : ''}. Online payment is shown here only when the school has switched it on.</p>}
    </div>
  );
}
void statusTone;
