import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { likePattern } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Families' };
const PAGE = 25;

export default async function FamiliesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePerm('guardians.view');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  let q = sb.from('families').select('id,family_code,family_name,primary_phone,students(id)', { count: 'exact' });
  if (sp.q) { const p = likePattern(sp.q); q = q.or(`family_name.ilike.${p},family_code.ilike.${p},primary_phone.ilike.${p}`); }
  const { data, count } = await q.order('family_name').range((page - 1) * PAGE, page * PAGE - 1);
  return (
    <>
      <PageHeader title="Families" description="One family can have many students. Fees can be collected for the whole family at once." />
      <form className="mb-4 flex gap-2" role="search"><input name="q" defaultValue={sp.q} placeholder="Family name, ID or phone" className="input max-w-sm" /><button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Search</button></form>
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No families found" /> : (<>
        <TableWrap><thead><tr><Th>Family</Th><Th>ID</Th><Th>Phone</Th><Th className="text-end">Children</Th></tr></thead><tbody>
          {(data ?? []).map((f: any) => <tr key={f.id} className="hover:bg-surface-2/50"><Td><Link className="font-medium text-brand hover:underline" href={`/families/${f.id}`}>{f.family_name}</Link></Td><Td className="tabular text-muted">{f.family_code}</Td><Td>{f.primary_phone ?? '—'}</Td><Td className="tabular text-end">{f.students?.length ?? 0}</Td></tr>)}
        </tbody></TableWrap><Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/families?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} /></>)}</Card>
    </>
  );
}
