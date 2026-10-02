import type { Metadata } from 'next';
import { HomeworkForm } from '@/components/data/ops-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'New homework' };

export default async function NewHomework() {
  const ctx = await requirePerm('homework.create');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const opts = await classSectionOptions(sb, campus);
  let sections = opts.sectionsFull;
  if (!can(ctx, 'classes.all') && ctx.staffId) { const { data } = await sb.from('teacher_assignments').select('section_id').eq('staff_id', ctx.staffId); const ok = new Set((data ?? []).map((x: any) => x.section_id)); sections = sections.filter((s) => ok.has(s.value)); }
  const { data: subj } = await sb.from('subjects').select('id,name').order('name');
  return (<><PageHeader title="New homework" back={{ href: '/homework', label: 'Homework' }} /><Card><CardBody><HomeworkForm sections={sections} subjects={(subj ?? []).map((s: any) => ({ value: s.id, label: s.name }))} /></CardBody></Card></>);
}
