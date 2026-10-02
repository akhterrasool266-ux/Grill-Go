import type { Metadata } from 'next';
import Link from 'next/link';
import { AttendanceSheet } from '@/components/data/attendance-sheet';
import { LinkButton } from '@/components/ui/button';
import { Alert, Badge, Card, CardBody, EmptyState, PageHeader } from '@/components/ui/primitives';
import { can, currentCampus, requireUser } from '@/lib/auth/session';
import { fmtDate, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Attendance' };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ section?: string; date?: string }> }) {
  const ctx = await requireUser();
  if (!can(ctx, 'attendance.view', 'attendance.create')) redirect('/forbidden');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const today = todayISO();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;

  // sections the user may mark: assigned ones for teachers, everything for classes.all
  let sq = sb.from('sections').select('id,name,campus_id,classes(name,level)').order('name');
  if (campus) sq = sq.eq('campus_id', campus);
  if (!can(ctx, 'classes.all') && ctx.staffId) {
    const { data: mine } = await sb.from('teacher_assignments').select('section_id').eq('staff_id', ctx.staffId);
    sq = sq.in('id', (mine ?? []).map((m: any) => m.section_id));
  }
  const { data: secs } = await sq;
  const sections = ((secs ?? []) as any[]).sort((a, b) => (a.classes?.level ?? 0) - (b.classes?.level ?? 0) || a.name.localeCompare(b.name));
  const sectionId = sp.section && sections.some((s) => s.id === sp.section) ? sp.section : sections.length === 1 ? sections[0]!.id : '';

  let students: any[] = [], marks: Record<string, any> = {};
  if (sectionId) {
    const [{ data: st }, { data: at }] = await Promise.all([
      sb.from('students').select('id,full_name,student_code,roll_no').eq('section_id', sectionId).eq('status', 'active').order('roll_no', { nullsFirst: false }).order('full_name'),
      sb.from('student_attendance').select('student_id,status,remarks').eq('section_id', sectionId).eq('date', date),
    ]);
    students = st ?? []; marks = Object.fromEntries((at ?? []).map((a: any) => [a.student_id, a]));
  }
  const { data: markedToday } = await sb.from('student_attendance').select('section_id').eq('date', date);
  const markedSet = new Set((markedToday ?? []).map((m: any) => m.section_id));
  const canWrite = can(ctx, 'attendance.create');

  return (
    <>
      <PageHeader title="Attendance" description={fmtDate(date, 'long')}
        actions={<>{can(ctx, 'attendance.view') && <LinkButton variant="secondary" href="/attendance/report">Reports</LinkButton>}{can(ctx, 'attendance.qr') && <LinkButton variant="secondary" href="/attendance/scan">QR scan</LinkButton>}</>} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex" role="search">
        <select name="section" defaultValue={sectionId} className="input sm:w-64" aria-label="Section"><option value="">Choose a section…</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.classes?.name} – {s.name}{markedSet.has(s.id) ? ' ✓' : ''}</option>)}</select>
        <input name="date" type="date" defaultValue={date} max={today} className="input sm:w-44" aria-label="Date" />
        <button className="col-span-2 rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg sm:col-span-1">Open</button>
      </form>
      {sections.length === 0 && <Card><EmptyState title="No sections available" hint={can(ctx, 'classes.all') ? 'Add classes and sections under Academics first.' : 'You have not been assigned to a class yet. Ask your administrator to assign you under Academics → Teacher assignments.'} /></Card>}
      {sections.length > 0 && !sectionId && (
        <Card><CardBody>
          <p className="mb-3 text-sm text-muted">Pick a section to mark. ✓ means attendance is already recorded for the date.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{sections.map((s) => <Link key={s.id} href={`/attendance?section=${s.id}&date=${date}`} className="flex items-center justify-between rounded-[10px] border border-line px-3.5 py-3 text-sm font-medium hover:border-brand/50 hover:bg-brand-soft/40">{s.classes?.name} – {s.name}{markedSet.has(s.id) ? <Badge tone="ok">Done</Badge> : <Badge tone="warn">Pending</Badge>}</Link>)}</div>
        </CardBody></Card>
      )}
      {sectionId && students.length === 0 && <Card><EmptyState title="No active students in this section" /></Card>}
      {sectionId && students.length > 0 && (
        canWrite ? <AttendanceSheet key={`${sectionId}-${date}`} sectionId={sectionId} date={date} canCorrect={can(ctx, 'attendance.edit')} locked={false}
          students={students.map((s) => ({ id: s.id, name: s.full_name, code: s.student_code, roll: s.roll_no, status: marks[s.id]?.status ?? null, remarks: marks[s.id]?.remarks ?? null }))} />
          : <Alert tone="info">You can view attendance but not mark it.</Alert>
      )}
    </>
  );
}
