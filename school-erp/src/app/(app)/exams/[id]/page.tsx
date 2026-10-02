import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExamControls, PaperForm, RemovePaper } from '@/components/data/exam-forms';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDate, fmtTime, pct, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Exam' };

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: e } = await sb.from('exams').select('*,campuses(name),grading_systems(name)').eq('id', id).maybeSingle();
  if (!e) notFound();
  const [{ data: papers }, { data: cards }, { data: summary }, { data: classes }, { data: subjects }] = await Promise.all([
    sb.from('exam_subjects').select('id,exam_date,start_time,end_time,max_marks,passing_marks,subjects(name),classes(name,level)').eq('exam_id', id),
    can(ctx, 'results.view') ? sb.from('result_cards').select('result_status,is_published').eq('exam_id', id) : Promise.resolve({ data: [] }),
    can(ctx, 'results.view') ? sb.rpc('exam_summary', { p_exam: id }) : Promise.resolve({ data: [] }),
    sb.from('classes').select('id,name,level').eq('campus_id', e.campus_id).eq('is_active', true).order('level'),
    sb.from('subjects').select('id,name').order('name'),
  ]);
  const sorted = ((papers ?? []) as any[]).sort((a, b) => (a.classes?.level ?? 0) - (b.classes?.level ?? 0) || String(a.exam_date).localeCompare(String(b.exam_date)));
  const canEdit = can(ctx, 'exams.edit') && ['draft', 'scheduled', 'marks_entry'].includes(e.status);
  const cardsArr = (cards ?? []) as any[];
  return (
    <>
      <PageHeader back={{ href: '/exams', label: 'Exams' }} title={e.name} description={`${titleCase(e.kind)} · ${e.campuses?.name} · ${e.grading_systems?.name ?? 'Default grading'} · ${fmtDate(e.start_date)} – ${fmtDate(e.end_date)}`}
        actions={<Badge tone={statusTone(e.status)} className="text-sm">{titleCase(e.status)}</Badge>} />
      {can(ctx, 'exams.edit', 'results.create', 'marks.approve') && <div className="mb-5"><ExamControls examId={id} status={e.status} canPublish={can(ctx, 'exams.publish') && can(ctx, 'results.publish')} canLock={can(ctx, 'marks.approve')} /></div>}
      {cardsArr.length > 0 && <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Result cards" value={cardsArr.length} /><Stat label="Passed" value={cardsArr.filter((c) => c.result_status === 'pass').length} tone="ok" /><Stat label="Failed" value={cardsArr.filter((c) => ['fail', 'absent'].includes(c.result_status)).length} tone="bad" /><Stat label="Incomplete" value={cardsArr.filter((c) => c.result_status === 'incomplete').length} tone={cardsArr.some((c) => c.result_status === 'incomplete') ? 'warn' : undefined} /></section>}
      <Card className="mb-5"><CardHeader title="Papers & datesheet" action={<LinkButton variant="secondary" size="sm" href={`/exams/${id}/datesheet`}>Print datesheet</LinkButton>} />
        {sorted.length === 0 ? <EmptyState title="No papers yet" hint="Add the subjects and dates below." /> : (
          <TableWrap><thead><tr><Th>Class</Th><Th>Subject</Th><Th>Date</Th><Th className="hidden sm:table-cell">Time</Th><Th className="text-end">Max / pass</Th><Th><span className="sr-only">Actions</span></Th></tr></thead><tbody>
            {sorted.map((p) => <tr key={p.id}><Td>{p.classes?.name}</Td><Td className="font-medium">{p.subjects?.name}</Td><Td>{fmtDate(p.exam_date)}</Td><Td className="hidden sm:table-cell">{p.start_time ? `${fmtTime(p.start_time)} – ${fmtTime(p.end_time)}` : '—'}</Td><Td className="tabular text-end">{p.max_marks} / {p.passing_marks}</Td>
              <Td className="text-end"><div className="flex justify-end gap-1">{can(ctx, 'marks.view', 'marks.create') && e.status !== 'draft' && <LinkButton size="sm" variant="soft" href={`/exams/${id}/marks?paper=${p.id}`}>Marks</LinkButton>}{canEdit && <RemovePaper id={p.id} examId={id} />}</div></Td></tr>)}
          </tbody></TableWrap>)}
      </Card>
      {canEdit && <Card className="mb-5"><CardHeader title="Add a paper" description="Leave class empty to schedule the subject for every class in the campus." /><CardBody><PaperForm examId={id} classes={(classes ?? []).map((c: any) => ({ value: c.id, label: c.name }))} subjects={(subjects ?? []).map((s: any) => ({ value: s.id, label: s.name }))} /></CardBody></Card>}
      {(summary ?? []).length > 0 && <Card><CardHeader title="Class-wise summary" /><TableWrap><thead><tr><Th>Class</Th><Th className="text-end">Appeared</Th><Th className="text-end">Passed</Th><Th className="text-end">Failed</Th><Th className="text-end">Average</Th><Th className="hidden sm:table-cell text-end">High / low</Th></tr></thead><tbody>{(summary as any[]).map((s) => <tr key={s.class_name}><Td className="font-medium">{s.class_name}</Td><Td className="tabular text-end">{s.appeared}</Td><Td className="tabular text-end">{s.passed}</Td><Td className="tabular text-end">{s.failed}</Td><Td className="tabular text-end">{pct(s.avg_percentage)}</Td><Td className="hidden tabular text-end sm:table-cell">{pct(s.highest)} / {pct(s.lowest)}</Td></tr>)}</tbody></TableWrap><div className="p-4"><Link className="text-sm text-brand hover:underline" href={`/results?exam=${id}`}>View all result cards →</Link></div></Card>}
    </>
  );
}
