import type { Metadata } from 'next';
import { UserCreateForm } from '@/components/data/settings-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'New user' };

export default async function NewUser() {
  const ctx = await requirePerm('users.create');
  const sb = await createClient();
  const { data: roles } = await sb.from('roles').select('code,name,role_permissions(permission_code)').order('name');
  // Without roles.manage you may only assign roles that grant nothing beyond your own permissions.
  const allowed = (roles ?? []).filter((r: any) => ctx.permissions.includes('roles.manage') || (r.role_permissions as any[]).every((p) => ctx.permissions.includes(p.permission_code)));
  const campuses = ctx.campuses.map((c) => ({ value: c.id, label: c.name }));
  return (<><PageHeader title="New user" back={{ href: '/settings/users', label: 'Users' }} /><Card><CardBody><UserCreateForm roles={allowed.map((r: any) => ({ value: r.code, label: r.name }))} campuses={campuses} /></CardBody></Card></>);
}
