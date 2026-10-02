import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDateTime, likePattern, pkr, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Receipts' };
const PAGE = 25;

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ q?: string; method?: string; from?: string; to?: string; page?: string }> }) {
  const ctx = await requirePerm('payments.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);
  let q = sb.from('payments').select('id,receipt_no,amount,refunded_amount,method,paid_at,payer_name,students(full_name,student_code),families(family_name)', { count: 'exact' });
  if (campus) q = q.eq('campus_id', campus);
  if (sp.method) q = q.eq('method', sp.method);
  if (sp.from) q = q.gte('paid_at', `${sp.from}T00:00:00+05:00`);
  if (sp.to) q = q.lte('paid_at', `${sp.to}T23:59:59+05:00`);
  if (sp.q) q = q.or(`receipt_no.ilike.${likePattern(sp.q)},reference_no.ilike.${likePattern(sp.q)}`);
  const { data, count } = await q.order('paid_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const rows = (data ?? []) as any[];
  const total = rows.reduce((a, r) => a + Number(r.amount) - Number(r.refunded_amount), 0);
  const qs = (p: number) => `/fees/receipts?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][]), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Receipts" back={{ href: '/fees', label: 'Fees' }} description={`Page total ${pkr(total)}`} actions={<LinkButton href="/fees/collect">Collect fee</LinkButton>} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Receipt or reference no." className="input col-span-2 sm:w-56" />
        <select name="method" defaultValue={sp.method ?? ''} className="input sm:w-40"><option value="">Any method</option>{['cash', 'bank', 'jazzcash', 'easypaisa', 'card', 'online_transfer', 'other'].map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}</select>
        <input name="from" type="date" defaultValue={sp.from} className="input sm:w-40" aria-label="From" /><input name="to" type="date" defaultValue={sp.to} className="input sm:w-40" aria-label="To" />
        <button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Filter</button>
      </form>
      <Card>
        {rows.length === 0 ? <EmptyState title="No receipts found" /> : (<>
          <TableWrap><thead><tr><Th>Receipt</Th><Th>Paid by</Th><Th className="hidden sm:table-cell">When</Th><Th>Method</Th><Th className="text-end">Amount</Th></tr></thead><tbody>
            {rows.map((r) => <tr key={r.id} className="hover:bg-surface-2/50"><Td><Link className="font-medium text-brand hover:underline" href={`/fees/receipts/${r.id}`}>{r.receipt_no}</Link></Td><Td>{r.students?.full_name ?? r.families?.family_name ?? r.payer_name}<span className="block text-xs text-muted">{r.students?.student_code}</span></Td><Td className="hidden sm:table-cell">{fmtDateTime(r.paid_at)}</Td><Td>{titleCase(r.method)}</Td><Td className="tabular text-end">{pkr(r.amount)}{Number(r.refunded_amount) > 0 && <span className="block text-xs text-bad">−{pkr(r.refunded_amount)} refunded</span>}</Td></tr>)}
          </tbody></TableWrap><Pagination page={page} pageSize={PAGE} total={count ?? rows.length} hrefFor={qs} /></>)}
      </Card>
    </>
  );
}
