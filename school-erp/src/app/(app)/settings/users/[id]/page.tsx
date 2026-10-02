import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ResetPassword, UserAccessForm } from '@/components/data/settings-forms';
import { Alert, Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'User' };

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; tp?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requirePerm('users.view');
  const sb = await createClient();
  const { data: u } = await sb.from('profiles').select('id,full_name,email,phone,is_active,user_roles(role_id),user_campuses(campus_id)').eq('id', id).maybeSingle();
  if (!u) notFound();
  const { data: roles } = await sb.from('roles').select('id,name').order('name');
  return (<><PageHeader title={u.full_name} description={u.email} back={{ href: '/settings/users', label: 'Users' }} />
    {sp.created && <div className="mb-4"><Alert tone="ok" title="User created">{sp.tp ? <>Temporary password: <code className="select-all rounded bg-surface px-1.5 py-0.5 font-mono text-base">{sp.tp}</code> — copy it now and share it privately; it is not shown again. They must choose a new password at first sign-in.</> : 'Done.'}</Alert></div>}
    <Card><CardHeader title="Access" action={can(ctx, 'users.edit') && u.id !== ctx.userId ? <ResetPassword id={id} /> : undefined} /><CardBody>
      {can(ctx, 'users.edit') ? <UserAccessForm self={u.id === ctx.userId} canRoles={can(ctx, 'roles.manage')} roles={(roles ?? []).map((r: any) => ({ value: r.id, label: r.name }))} campuses={ctx.campuses.map((c) => ({ value: c.id, label: c.name }))} u={{ id, full_name: u.full_name, phone: u.phone, is_active: u.is_active, roleIds: (u.user_roles as any[]).map((x) => x.role_id), campusIds: (u.user_campuses as any[]).map((x) => x.campus_id) }} /> : <p className="text-sm text-muted">View only.</p>}</CardBody></Card></>);
}
