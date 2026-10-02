import type { Metadata } from 'next';
import { IdCard } from '@/components/data/id-card';
import { PrintButton } from '@/components/ui/print-button';
import { PageHeader } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'ID cards' };

export default async function BulkIdCards({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const ctx = await requirePerm('students.print');
  const { section } = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const opts = await classSectionOptions(sb, campus);
  const { data } = section ? await sb.from('students').select('id,full_name,student_code,photo_path,blood_group,roll_no,classes(name),sections(name),emergency_contact_phone').eq('section_id', section).eq('status', 'active').order('roll_no').order('full_name') : { data: [] };
  return (
    <>
      <PageHeader title="Print ID cards" back={{ href: '/students', label: 'Students' }} actions={section ? <PrintButton /> : undefined} />
      <form className="no-print mb-5 flex gap-2"><select name="section" defaultValue={section ?? ''} className="input max-w-xs" aria-label="Section"><option value="">Choose a section…</option>{opts.sectionsFull.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Show</button></form>
      <div className="grid justify-center gap-[4mm] sm:grid-cols-[repeat(auto-fill,85.6mm)] print:grid-cols-2">
        {(data ?? []).map((s: any) => <IdCard key={s.id} kind="STUDENT" schoolName={ctx.school.name} name={s.full_name} code={s.student_code} bloodGroup={s.blood_group} phone={s.emergency_contact_phone} line1={`${s.classes?.name ?? ''} – ${s.sections?.name ?? ''}`} line2={s.roll_no ? `Roll no. ${s.roll_no}` : undefined} photoUrl={s.photo_path ? `/api/photo/${s.id}` : null} />)}
      </div>
    </>
  );
}
