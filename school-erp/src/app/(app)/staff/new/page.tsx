import type { Metadata } from 'next';
import { StaffForm } from '@/components/data/hr-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Add staff' };

export default async function NewStaff() {
  const ctx = await requirePerm('staff.create');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const [{ data: dep }, { data: des }] = await Promise.all([sb.from('departments').select('id,name').order('name'), sb.from('designations').select('id,name').order('name')]);
  return (<><PageHeader title="Add staff member" back={{ href: '/staff', label: 'Staff' }} /><Card><CardBody><StaffForm mode="create" departments={(dep ?? []).map((x: any) => ({ value: x.id, label: x.name }))} designations={(des ?? []).map((x: any) => ({ value: x.id, label: x.name }))} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} /></CardBody></Card></>);
}
