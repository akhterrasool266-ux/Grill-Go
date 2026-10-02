import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IdCard } from '@/components/data/id-card';
import { PrintButton } from '@/components/ui/print-button';
import { PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Student ID card' };

export default async function StudentIdCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePerm('students.print');
  const sb = await createClient();
  const { data: s } = await sb.from('students').select('id,full_name,student_code,photo_path,blood_group,classes(name),sections(name),emergency_contact_phone,roll_no,student_guardians(is_primary,guardians(phone))').eq('id', id).maybeSingle();
  if (!s) notFound();
  const g = ((s as any).student_guardians ?? [])[0]?.guardians;
  return (
    <>
      <PageHeader title="Student ID card" back={{ href: `/students/${id}`, label: s.full_name }} actions={<PrintButton />} />
      <div className="flex justify-center py-4">
        <IdCard kind="STUDENT" schoolName={ctx.school.name} name={s.full_name} code={s.student_code} bloodGroup={s.blood_group} phone={s.emergency_contact_phone ?? g?.phone}
          line1={`${(s as any).classes?.name ?? ''}${(s as any).sections?.name ? ' – ' + (s as any).sections.name : ''}`} line2={s.roll_no ? `Roll no. ${s.roll_no}` : undefined} photoUrl={s.photo_path ? `/api/photo/${s.id}` : null} />
      </div>
      <p className="no-print mx-auto max-w-md text-center text-sm text-muted">Print on card stock at 100% scale. The QR code holds only the student ID, for gate attendance scanning.</p>
    </>
  );
}
