import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { KV, Letterhead, Sheet } from '@/components/data/print-doc';
import { RemarksForm } from '@/components/data/exam-forms';
import { PrintButton } from '@/components/ui/print-button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDate, pct } from '@/lib/format';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Result card' };

export default async function ResultCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: r } = await sb.from('result_cards').select('*,exams(name,published_at,start_date,end_date),students(full_name,student_code,roll_no,father_name,dob,photo_path,id),classes(name),sections(name)').eq('id', id).maybeSingle();
  if (!r) notFound();
  const school = await getSchoolInfo(sb, ctx.school.id);
  const subjects = (r.subjects ?? []) as { subject: string; max: number; passing: number; obtained: number | null; absent: boolean; grade: string | null }[];
  const canEdit = can(ctx, 'results.create') && !r.is_published;
  return (
    <>
      <PageHeader title="Result card" back={{ href: can(ctx, 'results.view') ? '/results' : '/portal/parent', label: 'Back' }} actions={can(ctx, 'results.print') || ctx.studentIds.includes(r.students.id) ? <PrintButton /> : undefined} />
      <Sheet>
        <Letterhead school={school} title="Result card" right={<p className="text-xs text-neutral-600">{r.exams?.name}</p>} />
        <div className="flex items-start gap-4"><Avatar name={r.students.full_name} size={72} src={r.students.photo_path ? `/api/photo/${r.students.id}` : null} className="rounded-md" />
          <div className="flex-1"><KV items={[['Student', r.students.full_name], ['Student ID', r.students.student_code], ['Roll no.', r.students.roll_no], ['Class', `${r.classes?.name ?? ''} ${r.sections?.name ?? ''}`], ['Father', r.students.father_name], ['Date of birth', fmtDate(r.students.dob)]]} /></div></div>
        <table className="w-full text-sm"><thead><tr className="border-b-2 border-neutral-800 text-left text-xs uppercase"><th className="py-1.5">Subject</th><th className="text-right">Max</th><th className="text-right">Obtained</th><th className="text-center">Grade</th></tr></thead><tbody>
          {subjects.map((s) => { const failed = s.absent || (s.obtained !== null && s.obtained < s.passing); return <tr key={s.subject} className="border-b border-neutral-200"><td className="py-1.5">{s.subject}</td><td className="text-right tabular">{s.max}</td><td className={`text-right tabular ${failed ? 'font-bold text-red-700' : ''}`}>{s.absent ? 'Absent' : s.obtained ?? '—'}</td><td className="text-center">{s.grade ?? '—'}</td></tr>; })}
        </tbody><tfoot><tr className="border-t-2 border-neutral-800 font-bold"><td className="py-1.5">Total</td><td className="text-right tabular">{r.total_max}</td><td className="text-right tabular">{r.total_obtained}</td><td /></tr></tfoot></table>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[['Percentage', pct(r.percentage)], ['Grade', r.grade ?? '—'], ['GPA', r.gpa ?? '—'], ['Position', r.position ?? '—'], ['Attendance', r.attendance_percent == null ? '—' : pct(r.attendance_percent)]].map(([k, v]) => <div key={k as string} className="rounded-lg border border-neutral-300 p-2.5 text-center"><p className="text-[11px] uppercase text-neutral-500">{k}</p><p className="text-lg font-bold">{v}</p></div>)}
        </div>
        <p className="text-center text-base font-bold uppercase tracking-wide" style={{ color: r.result_status === 'pass' ? '#15803d' : '#b91c1c' }}>Result: {r.result_status}</p>
        <div className="grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-xs uppercase text-neutral-500">Teacher&apos;s remarks</p><p className="min-h-10 border-b border-neutral-300">{r.teacher_remarks}</p></div><div><p className="text-xs uppercase text-neutral-500">Principal&apos;s remarks</p><p className="min-h-10 border-b border-neutral-300">{r.principal_remarks}</p></div></div>
        <div className="flex justify-between pt-8 text-xs text-neutral-500"><span>Class teacher</span><span>Principal</span><span>Parent / guardian</span></div>
      </Sheet>
      {canEdit && <Card className="no-print mx-auto mt-5 max-w-[210mm]"><CardHeader title="Remarks" /><CardBody><RemarksForm id={id} teacher={r.teacher_remarks ?? ''} principal={r.principal_remarks ?? ''} canPrincipal={can(ctx, 'results.publish')} /></CardBody></Card>}
    </>
  );
}
