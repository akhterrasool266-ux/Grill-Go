import type { Metadata } from 'next';
import Link from 'next/link';
import { RoleCreate } from '@/components/data/settings-forms';
import { Badge, Card, CardBody, CardHeader, PageHeader, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Roles & permissions' };

export default async function RolesPage() {
  const ctx = await requirePerm('roles.view', 'roles.manage');
  const sb = await createClient();
  const { data } = await sb.from('roles').select('id,code,name,name_ur,is_system,role_permissions(permission_code),user_roles(user_id)').order('name');
  const rows = ((data ?? []) as any[]).sort((a, b) => Number(b.is_system) - Number(a.is_system) || a.name.localeCompare(b.name));
  return (<><PageHeader title="Roles & permissions" description="Each role is a bundle of permissions. Open a role to tick exactly what it can view, create, edit, delete, export, approve, print and publish." back={{ href: '/settings', label: 'Settings' }} />
    <Card className="mb-5"><TableWrap><thead><tr><Th>Role</Th><Th className="text-end">Permissions</Th><Th className="text-end">Users</Th><Th>Type</Th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.id} className="hover:bg-surface-2/50"><Td><Link className="font-medium text-brand hover:underline" href={`/settings/roles/${r.id}`}>{r.name}</Link>{r.name_ur && <span className="ms-2 text-muted" dir="rtl">{r.name_ur}</span>}</Td><Td className="tabular text-end">{r.role_permissions.length}</Td><Td className="tabular text-end">{r.user_roles.length}</Td><Td>{r.is_system ? <Badge>Built-in</Badge> : <Badge tone="brand">Custom</Badge>}</Td></tr>)}
    </tbody></TableWrap></Card>
    {can(ctx, 'roles.manage') && <Card><CardHeader title="Create a custom role" /><CardBody><RoleCreate /></CardBody></Card>}</>);
}
