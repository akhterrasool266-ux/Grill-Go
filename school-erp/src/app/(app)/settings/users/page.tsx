import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const ctx = await requirePerm('users.view');
  const sb = await createClient();
  const { data: users } = await sb.from('profiles').select('id,full_name,email,is_active,user_roles(roles(name))').order('full_name');
  return (<><PageHeader title="Users" back={{ href: '/settings', label: 'Settings' }} actions={<>{can(ctx, 'roles.view') && <LinkButton variant="secondary" href="/settings/roles">Roles</LinkButton>}{can(ctx, 'users.create') && <LinkButton href="/settings/users/new">+ New user</LinkButton>}</>} />
    <Card>{(users ?? []).length === 0 ? <EmptyState title="No users" /> : <TableWrap><thead><tr><Th>Name</Th><Th className="hidden sm:table-cell">Email</Th><Th>Roles</Th><Th>Status</Th></tr></thead><tbody>
      {(users ?? []).map((u: any) => <tr key={u.id} className="hover:bg-surface-2/50"><Td><Link className="font-medium text-brand hover:underline" href={`/settings/users/${u.id}`}>{u.full_name}</Link></Td><Td className="hidden text-muted sm:table-cell">{u.email}</Td><Td><div className="flex flex-wrap gap-1">{(u.user_roles ?? []).map((r: any) => <Badge key={r.roles?.name} tone="brand">{r.roles?.name}</Badge>)}</div></Td><Td>{u.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Blocked</Badge>}</Td></tr>)}
    </tbody></TableWrap>}</Card></>);
}
