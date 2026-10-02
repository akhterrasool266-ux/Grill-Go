import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { LinkButton } from '@/components/ui/button';
import { Alert, Badge, PageHeader, Tabs, statusTone } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { titleCase } from '@/lib/format';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';
import { AcademicTab, AttendanceTab, CommunicationTab, DisciplineTab, DocumentsTab, ExamsTab, FeesTab, HomeworkTab, OverviewTab, PromotionTab, ResultsTab, TransportTab } from './tabs';

export const metadata: Metadata = { title: 'Student profile' };

const TABS: { id: string; label: string; perms?: string[]; portal?: boolean }[] = [
  { id: 'overview', label: 'Overview', portal: true }, { id: 'academic', label: 'Academic', portal: true },
  { id: 'attendance', label: 'Attendance', perms: ['attendance.view'], portal: true }, { id: 'fees', label: 'Fees', perms: ['fees.view'], portal: true },
  { id: 'exams', label: 'Exams', perms: ['exams.view'], portal: true }, { id: 'results', label: 'Results', perms: ['results.view'], portal: true },
  { id: 'homework', label: 'Homework', perms: ['homework.view'], portal: true }, { id: 'documents', label: 'Documents', perms: ['documents.view'], portal: true },
  { id: 'communication', label: 'Communication', perms: ['communication.view'] }, { id: 'transport', label: 'Transport', perms: ['transport.view'], portal: true },
  { id: 'discipline', label: 'Discipline', perms: ['students.edit', 'students.view'] }, { id: 'promotion', label: 'Promotion', perms: ['promotion.view'], portal: true },
];

export default async function StudentProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; created?: string; saved?: string; sibling?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: s } = await sb.from('students').select('*,classes(name),sections(name),houses(name),campuses(name)').eq('id', id).maybeSingle();
  if (!s) notFound();
  const isOwner = ctx.studentIds.includes(id);
  const staff = can(ctx, 'students.view');
  const tabs = TABS.filter((t) => (t.id === 'discipline' ? staff : isOwner && !staff ? t.portal : !t.perms || can(ctx, ...t.perms) || (isOwner && t.portal)));
  const tab = tabs.find((t) => t.id === sp.tab)?.id ?? 'overview';
  const classOpts = tab === 'academic' && can(ctx, 'students.edit') ? await classSectionOptions(sb, s.campus_id) : { classes: [], sections: [] };
  const p = { sb, s, ctx };

  return (
    <>
      {sp.created && <div className="mb-4"><Alert tone="ok" title={`Student added — ID ${sp.created}`}>{sp.sibling ? 'Linked to an existing family as a sibling. ' : ''}You can now upload documents, assign a fee structure and print the ID card.</Alert></div>}
      {sp.saved && <div className="mb-4"><Alert tone="ok">Changes saved.</Alert></div>}
      <PageHeader back={staff ? { href: '/students', label: 'Students' } : undefined}
        title={<span className="flex items-center gap-3"><Avatar name={s.full_name} size={48} src={s.photo_path ? `/api/photo/${s.id}` : null} /><span>{s.full_name}</span></span>}
        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="tabular">{s.student_code}</span><span>{s.classes?.name ?? 'No class'}{s.sections?.name ? ` – ${s.sections.name}` : ''}</span><span>{s.campuses?.name}</span><Badge tone={statusTone(s.status)}>{titleCase(s.status)}</Badge></span>}
        actions={<>
          {can(ctx, 'students.print') && <LinkButton variant="secondary" href={`/students/${id}/id-card`}>ID card</LinkButton>}
          {can(ctx, 'students.edit') && <LinkButton variant="secondary" href={`/students/${id}/edit`}>Edit</LinkButton>}
          {can(ctx, 'payments.create') && <LinkButton href={`/fees/collect?student=${s.student_code}`}>Collect fee</LinkButton>}
        </>} />
      <Tabs active={tab} tabs={tabs.map((t) => ({ id: t.id, label: t.label, href: `/students/${id}?tab=${t.id}` }))} />
      {tab === 'overview' && <OverviewTab {...p} />}
      {tab === 'academic' && <AcademicTab {...p} classOpts={classOpts} />}
      {tab === 'attendance' && <AttendanceTab {...p} />}
      {tab === 'fees' && <FeesTab {...p} />}
      {tab === 'exams' && <ExamsTab {...p} />}
      {tab === 'results' && <ResultsTab {...p} />}
      {tab === 'homework' && <HomeworkTab {...p} />}
      {tab === 'documents' && <DocumentsTab {...p} />}
      {tab === 'communication' && <CommunicationTab {...p} />}
      {tab === 'transport' && <TransportTab {...p} />}
      {tab === 'discipline' && <DisciplineTab {...p} />}
      {tab === 'promotion' && <PromotionTab {...p} />}
      <p className="sr-only"><Link href="/students">Back to students</Link></p>
    </>
  );
}
