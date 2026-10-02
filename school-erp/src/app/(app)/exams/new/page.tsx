import type { Metadata } from 'next';
import { ExamCreateForm } from '@/components/data/exam-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'New exam' };

export default async function NewExam() {
  const ctx = await requirePerm('exams.create');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const { data: gs } = await sb.from('grading_systems').select('id,name').order('name');
  return (<><PageHeader title="New exam" back={{ href: '/exams', label: 'Exams' }} /><Card><CardBody><ExamCreateForm gradings={(gs ?? []).map((g: any) => ({ value: g.id, label: g.name }))} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} /></CardBody></Card></>);
}
