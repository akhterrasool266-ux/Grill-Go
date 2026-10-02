import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReviewForm, StageActions } from '@/components/data/admission-forms';
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, statusTone } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDate, fmtDateTime, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/components/ui/cn';

export const metadata: Metadata = { title: 'Application' };
const FLOW = ['application', 'document_verification', 'test_interview', 'approval', 'admitted'];

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: a } = await sb.from('admissions').select('*,classes(name),campuses(name)').eq('id', id).maybeSingle();
  if (!a) notFound();
  const { data: secs } = a.class_applied_id ? await sb.from('sections').select('id,name').eq('class_id', a.class_applied_id).order('name') : { data: [] };
  const { data: cls } = await sb.from('classes').select('id,name').eq('campus_id', a.campus_id).eq('is_active', true).order('level');
  const classOptions = (cls ?? []).map((c: any) => ({ value: c.id, label: c.name }));
  const idx = FLOW.indexOf(a.stage);
  const edit = can(ctx, 'admissions.edit') && !['admitted', 'rejected', 'withdrawn'].includes(a.stage);
  return (
    <>
      <PageHeader back={{ href: '/admissions', label: 'Admissions' }} title={a.full_name} description={`${a.application_no} · ${titleCase(a.type)} · ${a.classes?.name ?? 'No class'} · ${a.campuses?.name}`}
        actions={<><Badge tone={statusTone(a.stage)} className="text-sm">{titleCase(a.stage)}</Badge>{a.student_id && <LinkButton href={`/students/${a.student_id}`}>Open student</LinkButton>}</>} />
      <ol className="no-print mb-5 grid grid-cols-5 gap-1.5 text-center text-[11px] font-medium sm:text-xs" aria-label="Progress">
        {FLOW.map((s, i) => <li key={s} className={cn('rounded-lg px-1 py-2', i < idx || a.stage === 'admitted' ? 'bg-ok-soft text-ok' : i === idx ? 'bg-brand text-brand-fg' : 'bg-surface-2 text-muted')}>{titleCase(s === 'document_verification' ? 'documents' : s === 'test_interview' ? 'test' : s)}</li>)}
      </ol>
      {edit && <Card className="mb-4"><CardBody><StageActions id={id} stage={a.stage} canApprove={can(ctx, 'admissions.approve')} sections={(secs ?? []).map((s: any) => ({ value: s.id, label: `${a.classes?.name} – ${s.name}` }))} /></CardBody></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Applicant" /><CardBody><DescriptionList items={[['Gender', titleCase(a.gender)], ['Date of birth', fmtDate(a.dob)], ['B-Form', a.b_form_no], ["Father's name", a.father_name], ["Mother's name", a.mother_name], ['Previous school', [a.previous_school, a.previous_class].filter(Boolean).join(' · ')], ['Transfer certificate', a.transfer_certificate_no], ['Address', [a.address, a.city].filter(Boolean).join(', ')]]} /></CardBody></Card>
        <Card><CardHeader title="Guardian" /><CardBody><DescriptionList items={[['Name', `${a.guardian_name} (${a.guardian_relation})`], ['Mobile', a.phone ? <a key="p" className="text-brand hover:underline" href={`tel:${a.phone}`}>{a.phone}</a> : null], ['WhatsApp', a.whatsapp], ['Email', a.email], ['CNIC', a.guardian_cnic], ['Received', fmtDateTime(a.created_at) + (a.source === 'online' ? ' · via website' : '')]]} /></CardBody></Card>
        <Card className="lg:col-span-2"><CardHeader title="Review" description="Documents, admission test and interview." /><CardBody>
          {edit ? <ReviewForm a={a} classes={classOptions} /> : <DescriptionList items={[['Documents verified', a.documents_verified ? 'Yes' : 'No'], ['Test', a.test_date ? `${fmtDate(a.test_date)} — ${a.test_score ?? '—'}/${a.test_max ?? '—'}` : null], ['Interview', a.interview_date ? fmtDateTime(a.interview_date) : null], ['Interview notes', a.interview_notes], ['Decision notes', a.decision_notes]]} />}
        </CardBody></Card>
      </div>
      <p className="no-print mt-4 text-sm text-muted">Upload the applicant&apos;s documents on the student record after admission, or keep paper copies on file. <Link className="text-brand hover:underline" href="/admissions">Back to pipeline</Link></p>
    </>
  );
}
