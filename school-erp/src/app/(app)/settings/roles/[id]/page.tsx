import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PermissionMatrix } from '@/components/data/settings-forms';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Role permissions' };

export default async function RolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePerm('roles.view', 'roles.manage');
  const sb = await createClient();
  const { data: r } = await sb.from('roles').select('id,code,name,description,role_permissions(permission_code)').eq('id', id).maybeSingle();
  if (!r) notFound();
  const readOnly = !can(ctx, 'roles.manage') || r.code === 'super_admin';
  return (<><PageHeader title={r.name} description="Tick what this role may do. “campus · all” lets the user see every campus; “classes · all” lets a teacher see every class instead of only assigned ones; “financial · access” unlocks salaries and the finance module." back={{ href: '/settings/roles', label: 'Roles' }} />
    {r.code === 'super_admin' && <div className="mb-4"><Alert tone="info">The Super Admin role always has every permission.</Alert></div>}
    <PermissionMatrix roleId={id} granted={(r.role_permissions as any[]).map((p) => p.permission_code)} readOnly={readOnly} /></>);
}
