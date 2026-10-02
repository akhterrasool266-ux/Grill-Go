import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui/primitives';
import { StudentForm } from '@/components/data/student-form';
import { requirePerm } from '@/lib/auth/session';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit student' };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm('students.edit');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data: s } = await sb.from('students').select('*').eq('id', id).maybeSingle();
  if (!s) notFound();
  const opts = await classSectionOptions(sb, s.campus_id);
  return (
    <>
      <PageHeader title={`Edit ${s.full_name}`} description={`${s.student_code} · admission no. ${s.admission_no}`} back={{ href: `/students/${id}`, label: 'Profile' }} />
      <StudentForm mode="edit" studentId={id} backHref={`/students/${id}`} values={s} classes={opts.classes} sections={opts.sections} houses={opts.houses} />
    </>
  );
}
