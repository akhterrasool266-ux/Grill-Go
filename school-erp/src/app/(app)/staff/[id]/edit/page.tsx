import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StaffForm } from '@/components/data/hr-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit staff' };

export default async function EditStaff({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm('staff.edit');
  const sb = await createClient();
  const { data: s } = await sb.from('staff').select('*').eq('id', id).maybeSingle();
  if (!s) notFound();
  const [{ data: dep }, { data: des }] = await Promise.all([sb.from('departments').select('id,name').order('name'), sb.from('designations').select('id,name').order('name')]);
  return (<><PageHeader title={`Edit ${s.full_name}`} back={{ href: `/staff/${id}`, label: 'Profile' }} /><Card><CardBody><StaffForm mode="edit" id={id} v={s} departments={(dep ?? []).map((x: any) => ({ value: x.id, label: x.name }))} designations={(des ?? []).map((x: any) => ({ value: x.id, label: x.name }))} /></CardBody></Card></>);
}
