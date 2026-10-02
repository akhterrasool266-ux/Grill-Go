import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImportWizard } from '@/components/data/import-wizard';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { can, currentCampus, requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Import' };
const KINDS = { students: { title: 'Import students', perm: 'students.create', hint: 'Class and section names must match the ones in this campus. Siblings are linked automatically when the guardian phone number matches.', back: '/students' },
  staff: { title: 'Import staff', perm: 'staff.create', hint: 'Employee IDs are generated when left blank. Designations are created if they do not exist yet.', back: '/staff' },
  marks: { title: 'Import marks', perm: 'marks.create', hint: 'Pick the exam and subject, then upload one row per student.', back: '/exams' },
  fees: { title: 'Import fee amounts', perm: 'fees.create', hint: 'One row per class and fee category. Existing amounts for the current academic year are updated.', back: '/fees' } } as const;

export default async function ImportPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const k = KINDS[kind as keyof typeof KINDS];
  if (!k) notFound();
  const ctx = await requireUser();
  if (!can(ctx, k.perm)) redirect('/forbidden');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  let examSubjects: { value: string; label: string }[] | undefined;
  if (kind === 'marks') {
    const { data } = await sb.from('exam_subjects').select('id,max_marks,classes(name),subjects(name),exams(name,status)').in('exam_id', ((await sb.from('exams').select('id').in('status', ['scheduled', 'marks_entry'])).data ?? []).map((e: any) => e.id)).limit(300);
    examSubjects = (data ?? []).map((x: any) => ({ value: x.id, label: `${x.exams?.name} · ${x.classes?.name} · ${x.subjects?.name} (max ${x.max_marks})` }));
  }
  return (
    <>
      <PageHeader title={k.title} description={k.hint} back={{ href: k.back, label: 'Back' }} actions={<LinkButton variant="secondary" href={`/api/templates/${kind}`}>Download template</LinkButton>} />
      {!campus && ctx.campuses.length > 1 && kind !== 'marks' && <div className="mb-4"><Alert tone="info">Several campuses are available — choose one below, or pick a campus in the top bar.</Alert></div>}
      <ImportWizard kind={kind as 'students'} examSubjects={examSubjects} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} />
      <p className="mt-6 text-sm text-muted">Need to review what changed afterwards? <Link href="/audit" className="text-brand hover:underline">Audit log</Link>.</p>
    </>
  );
}
