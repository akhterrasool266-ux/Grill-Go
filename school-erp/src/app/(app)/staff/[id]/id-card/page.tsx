import { notFound } from 'next/navigation';
import { IdCard } from '@/components/data/id-card';
import { PrintButton } from '@/components/ui/print-button';
import { PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export default async function StaffIdCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePerm('staff.print');
  const sb = await createClient();
  const { data: s } = await sb.from('staff').select('id,full_name,employee_code,photo_path,phone,designations(name),departments(name)').eq('id', id).maybeSingle();
  if (!s) notFound();
  return (<><PageHeader title="Staff ID card" back={{ href: `/staff/${id}`, label: s.full_name }} actions={<PrintButton />} /><div className="flex justify-center py-4"><IdCard kind="STAFF" schoolName={ctx.school.name} name={s.full_name} code={s.employee_code} line1={(s as any).designations?.name ?? ''} line2={(s as any).departments?.name} phone={s.phone} photoUrl={s.photo_path ? `/api/staff-photo/${s.id}` : null} /></div></>);
}
