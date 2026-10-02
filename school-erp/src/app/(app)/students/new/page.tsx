import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/primitives';
import { StudentForm } from '@/components/data/student-form';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Add student' };

export default async function NewStudentPage() {
  const ctx = await requirePerm('students.create');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const opts = await classSectionOptions(sb, campus);
  return (
    <>
      <PageHeader title="Add student" description="Creates the student, their family and guardian in one step and generates the student ID." back={{ href: '/students', label: 'Students' }} />
      <StudentForm mode="create" backHref="/students" classes={opts.classes} sections={opts.sections} houses={opts.houses}
        campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} />
    </>
  );
}
