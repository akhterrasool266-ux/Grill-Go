import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { likePattern, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Staff' };
const PAGE = 25;

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const ctx = await requirePerm('staff.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status ?? 'active';
  const sb = await createClient();
  let q = sb.from('staff').select('id,employee_code,full_name,phone,status,photo_path,designations(name),departments(name),campuses(name)', { count: 'exact' });
  if (campus) q = q.eq('campus_id', campus);
  if (status !== 'all') q = q.eq('status', status);
  if (sp.q) { const p = likePattern(sp.q); q = q.or(`full_name.ilike.${p},employee_code.ilike.${p},phone.ilike.${p}`); }
  const { data, count } = await q.order('full_name').range((page - 1) * PAGE, page * PAGE - 1);
  return (
    <>
      <PageHeader title="Staff" description={`${count ?? 0} ${status === 'all' ? '' : status} staff`} actions={<>{can(ctx, 'staff.create') && <LinkButton variant="secondary" href="/import/staff">Import CSV</LinkButton>}{can(ctx, 'staff.view') && <LinkButton variant="secondary" href="/manage/designations">Designations</LinkButton>}{can(ctx, 'staff.create') && <LinkButton href="/staff/new">+ Add staff</LinkButton>}</>} />
      <form className="mb-4 flex flex-wrap gap-2" role="search"><input name="q" defaultValue={sp.q} placeholder="Name, ID or phone" className="input w-64" /><select name="status" defaultValue={status} className="input w-36">{['active', 'all', 'on_leave', 'resigned', 'terminated'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select><button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Filter</button></form>
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No staff found" action={can(ctx, 'staff.create') ? <LinkButton href="/staff/new">+ Add staff</LinkButton> : undefined} /> : (<>
        <TableWrap><thead><tr><Th>Name</Th><Th>ID</Th><Th className="hidden sm:table-cell">Designation</Th><Th className="hidden md:table-cell">Department</Th><Th className="hidden lg:table-cell">Phone</Th><Th>Status</Th></tr></thead><tbody>
          {(data ?? []).map((s: any) => <tr key={s.id} className="hover:bg-surface-2/50"><Td><Link href={`/staff/${s.id}`} className="flex items-center gap-3 font-medium hover:text-brand"><Avatar name={s.full_name} size={34} src={s.photo_path ? `/api/staff-photo/${s.id}` : null} />{s.full_name}</Link></Td><Td className="tabular text-muted">{s.employee_code}</Td><Td className="hidden sm:table-cell">{s.designations?.name ?? '—'}</Td><Td className="hidden md:table-cell">{s.departments?.name ?? '—'}</Td><Td className="hidden lg:table-cell">{s.phone ?? '—'}</Td><Td><Badge tone={statusTone(s.status)}>{titleCase(s.status)}</Badge></Td></tr>)}
        </tbody></TableWrap><Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/staff?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), status, page: String(p) })}`} /></>)}</Card>
    </>
  );
}
