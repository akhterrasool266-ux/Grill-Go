import type { Metadata } from 'next';
import { ApplicationForm } from '@/components/data/admission-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'New application' };

export default async function NewApplication() {
  const ctx = await requirePerm('admissions.create');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const opts = await classSectionOptions(sb, campus);
  return (<><PageHeader title="New admission application" back={{ href: '/admissions', label: 'Admissions' }} /><Card><CardBody><ApplicationForm classes={opts.classes} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} /></CardBody></Card></>);
}
