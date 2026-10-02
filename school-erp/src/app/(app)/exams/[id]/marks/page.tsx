import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarksGrid } from '@/components/data/exam-forms';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Enter marks' };

export default async function MarksPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paper?: string; section?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requirePerm('marks.view', 'marks.create');
  const sb = await createClient();
  const { data: e } = await sb.from('exams').select('id,name,status').eq('id', id).maybeSingle();
  if (!e) notFound();
  const { data: papers } = await sb.from('exam_subjects').select('id,class_id,max_marks,passing_marks,subjects(name),classes(name,level)').eq('exam_id', id);
  const list = ((papers ?? []) as any[]).sort((a, b) => (a.classes?.level ?? 0) - (b.classes?.level ?? 0));
  const paper = list.find((p) => p.id === sp.paper);
  let rows: any[] = [], sections: any[] = [];
  if (paper) {
    const { data: sec } = await sb.from('sections').select('id,name').eq('class_id', paper.class_id).order('name');
    sections = sec ?? [];
    let sq = sb.from('students').select('id,full_name,student_code,roll_no,section_id').eq('class_id', paper.class_id).eq('status', 'active').order('roll_no', { nullsFirst: false }).order('full_name');
    if (sp.section) sq = sq.eq('section_id', sp.section);
    const [{ data: st }, { data: mk }] = await Promise.all([sq, sb.from('marks').select('student_id,marks_obtained,is_absent').eq('exam_subject_id', paper.id)]);
    const m = Object.fromEntries((mk ?? []).map((x: any) => [x.student_id, x]));
    rows = (st ?? []).map((s: any) => ({ id: s.id, name: s.full_name, code: s.student_code, roll: s.roll_no, marks: m[s.id]?.marks_obtained ?? null, absent: m[s.id]?.is_absent ?? false }));
  }
  const locked = e.status === 'published' || (e.status === 'locked' && !can(ctx, 'marks.approve')) || !can(ctx, 'marks.create');
  return (
    <>
      <PageHeader title="Enter marks" description={e.name} back={{ href: `/exams/${id}`, label: 'Exam' }} actions={can(ctx, 'marks.create') ? <LinkButton variant="secondary" href="/import/marks">Import CSV</LinkButton> : undefined} />
      {e.status === 'published' && <div className="mb-4"><Alert tone="info">Results are published. Reopen the exam (with a reason) to change marks.</Alert></div>}
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex"><select name="paper" defaultValue={sp.paper ?? ''} className="input col-span-2 sm:w-72" aria-label="Paper"><option value="">Choose a paper…</option>{list.map((p) => <option key={p.id} value={p.id}>{p.classes?.name} · {p.subjects?.name} (max {p.max_marks})</option>)}</select>
        {sections.length > 1 && <select name="section" defaultValue={sp.section ?? ''} className="input sm:w-40" aria-label="Section"><option value="">All sections</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        <button className="rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Open</button></form>
      {!paper ? <Card><EmptyState title="Choose a paper to enter marks" /></Card> : rows.length === 0 ? <Card><EmptyState title="No students found" hint="Teachers only see the sections they are assigned to." /></Card>
        : <MarksGrid key={`${paper.id}-${sp.section}`} examSubjectId={paper.id} max={Number(paper.max_marks)} passing={Number(paper.passing_marks)} rows={rows} locked={locked} />}
    </>
  );
}
