import type { Metadata } from 'next';
import { TimetableCellForm } from '@/components/data/timetable-cell-form';
import { DAYS, TimetableGrid, type Cell } from '@/components/data/timetable-grid';
import { LinkButton } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Timetable' };

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ section?: string; staff?: string; room?: string; cell?: string }> }) {
  const ctx = await requirePerm('timetable.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const opts = await classSectionOptions(sb, campus);
  const section = sp.section ?? (ctx.staffId ? '' : '');
  const mode = sp.staff ? 'staff' : sp.room ? 'room' : 'section';
  const { data: year } = await sb.from('academic_years').select('id,name').eq('is_current', true).maybeSingle();

  let pcamp = campus;
  if (!pcamp && section) pcamp = (await sb.from('sections').select('campus_id').eq('id', section).maybeSingle()).data?.campus_id ?? null;
  if (!pcamp && mode !== 'section') pcamp = ctx.campuses[0]?.id ?? null;
  const periods = pcamp ? ((await sb.from('periods').select('id,name,start_time,end_time,is_break').eq('campus_id', pcamp).order('sort_order')).data ?? []) : [];

  let cells: Cell[] = [];
  if ((section || mode !== 'section') && year) {
    let q = sb.from('timetable_entries').select('day_of_week,period_id,subjects(name),staff(full_name),rooms(name),sections(name,classes(name))').eq('academic_year_id', year.id);
    q = mode === 'staff' ? q.eq('staff_id', sp.staff!) : mode === 'room' ? q.eq('room_id', sp.room!) : q.eq('section_id', section);
    cells = ((await q).data ?? []).map((e: any) => ({ day: e.day_of_week, period_id: e.period_id, subject: e.subjects?.name, staff: e.staff?.full_name, room: e.rooms?.name, section: `${e.sections?.classes?.name ?? ''} ${e.sections?.name ?? ''}` }));
  }
  const canEdit = can(ctx, 'timetable.create', 'timetable.edit') && mode === 'section' && !!section;

  let editor: React.ReactNode = null;
  if (canEdit && sp.cell) {
    const [d, pid] = sp.cell.split(':'); const day = Number(d);
    const per = periods.find((p: any) => p.id === pid);
    if (per && day >= 1 && day <= 7) {
      const [{ data: cur }, { data: subj }, { data: stf }, { data: rms }] = await Promise.all([
        sb.from('timetable_entries').select('subject_id,staff_id,room_id').eq('academic_year_id', year!.id).eq('section_id', section).eq('day_of_week', day).eq('period_id', pid!).maybeSingle(),
        sb.from('subjects').select('id,name').order('name'), sb.from('staff').select('id,full_name').eq('status', 'active').eq('campus_id', pcamp!).order('full_name'), sb.from('rooms').select('id,name').eq('campus_id', pcamp!).order('name'),
      ]);
      editor = <TimetableCellForm key={sp.cell} sectionId={section} day={day} periodId={pid!} label={`${DAYS.find((x) => x[0] === day)?.[1]} · ${per.name}`} backHref={`/timetable?section=${section}`} canDelete={can(ctx, 'timetable.delete')}
        subjects={(subj ?? []).map((s: any) => ({ value: s.id, label: s.name }))} staff={(stf ?? []).map((s: any) => ({ value: s.id, label: s.full_name }))} rooms={(rms ?? []).map((r: any) => ({ value: r.id, label: r.name }))}
        initial={cur ? { subject_id: cur.subject_id ?? '', staff_id: cur.staff_id ?? '', room_id: cur.room_id ?? '' } : {}} />;
    }
  }
  const { data: allStaff } = can(ctx, 'staff.view') ? await sb.from('staff').select('id,full_name').eq('status', 'active').order('full_name') : { data: [] };

  return (
    <>
      <PageHeader title="Timetable" description={year ? `Academic year ${year.name}. Clashes are blocked: a teacher, room or class cannot be in two places in one period.` : 'No current academic year set.'}
        actions={<>{can(ctx, 'academics.create') && <LinkButton variant="secondary" href="/manage/periods">Periods</LinkButton>}{(section || mode !== 'section') && <PrintButton variant="secondary" />}</>} />
      <form className="no-print mb-4 grid grid-cols-2 gap-2 sm:flex" role="search">
        <select name="section" defaultValue={mode === 'section' ? section : ''} className="input sm:w-60" aria-label="Class"><option value="">Class timetable…</option>{opts.sectionsFull.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        {(allStaff ?? []).length > 0 && <select name="staff" defaultValue={sp.staff ?? ''} className="input sm:w-56" aria-label="Teacher"><option value="">Teacher timetable…</option>{(allStaff ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select>}
        <button className="rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Show</button>
      </form>
      {editor && <div className="no-print mb-4">{editor}</div>}
      {periods.length === 0 ? <Card><EmptyState title="No periods defined" hint="Add periods and breaks first." action={can(ctx, 'academics.create') ? <LinkButton href="/manage/periods/new">Add period</LinkButton> : undefined} /></Card>
        : !(section || mode !== 'section') ? <Card><EmptyState title="Choose a class or a teacher" /></Card>
        : <TimetableGrid periods={periods as never} cells={cells} showSection={mode !== 'section'} activeCell={sp.cell} editHref={canEdit ? (d, p) => `/timetable?section=${section}&cell=${d}:${p}` : undefined} />}
    </>
  );
}
