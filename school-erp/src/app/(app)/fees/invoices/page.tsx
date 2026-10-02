import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, likePattern, pkr, titleCase, todayISO } from '@/lib/format';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Fee vouchers' };
const PAGE = 25;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; class?: string; month?: string; page?: string }> }) {
  const ctx = await requirePerm('fees.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const page = Math.max(1, Number(sp.page) || 1);
  const today = todayISO();
  let q = sb.from('fee_invoices').select('id,invoice_no,period_label,due_date,net_amount,paid_amount,balance,status,students!inner(full_name,student_code,class_id,classes(name))', { count: 'exact' });
  if (campus) q = q.eq('campus_id', campus);
  if (sp.status === 'overdue') q = q.in('status', ['unpaid', 'partial']).lt('due_date', today);
  else if (sp.status === 'unpaid') q = q.in('status', ['unpaid', 'partial']);
  else if (sp.status) q = q.eq('status', sp.status);
  if (sp.class) q = q.eq('students.class_id', sp.class);
  if (sp.month) q = q.eq('fee_month', `${sp.month}-01`);
  if (sp.q) { const p = likePattern(sp.q); q = q.or(`invoice_no.ilike.${p},students.full_name.ilike.${p},students.student_code.ilike.${p}`, { referencedTable: undefined }); }
  const { data, count } = await q.order('due_date', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const opts = await classSectionOptions(sb, campus);
  const rows = (data ?? []) as any[];
  const qs = (p: number) => `/fees/invoices?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== 'page') as [string, string][]), page: String(p) })}`;
  return (
    <>
      <PageHeader title="Fee vouchers" back={{ href: '/fees', label: 'Fees' }} />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Voucher no. or student" className="input col-span-2 sm:w-60" />
        <select name="status" defaultValue={sp.status ?? ''} className="input sm:w-36"><option value="">Any status</option>{['unpaid', 'overdue', 'partial', 'paid', 'cancelled'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
        <select name="class" defaultValue={sp.class ?? ''} className="input sm:w-40"><option value="">All classes</option>{opts.classes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <input name="month" type="month" defaultValue={sp.month} className="input sm:w-44" aria-label="Month" />
        <button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Filter</button>
      </form>
      <Card>
        {rows.length === 0 ? <EmptyState title="No vouchers found" hint="Generate this month's vouchers from the Fees page." /> : (
          <>
            <TableWrap><thead><tr><Th>Voucher</Th><Th>Student</Th><Th className="hidden sm:table-cell">Period</Th><Th>Due</Th><Th className="text-end">Amount</Th><Th className="text-end">Balance</Th><Th>Status</Th></tr></thead><tbody>
              {rows.map((i) => {
                const st = ['unpaid', 'partial'].includes(i.status) && i.due_date < today ? 'overdue' : i.status;
                return (
                  <tr key={i.id} className="hover:bg-surface-2/50">
                    <Td><Link href={`/fees/invoices/${i.id}`} className="font-medium text-brand hover:underline">{i.invoice_no}</Link></Td>
                    <Td>{i.students?.full_name}<span className="block text-xs text-muted">{i.students?.student_code} · {i.students?.classes?.name}</span></Td>
                    <Td className="hidden sm:table-cell">{i.period_label}</Td><Td>{fmtDate(i.due_date)}</Td>
                    <Td className="tabular text-end">{pkr(i.net_amount)}</Td><Td className="tabular text-end font-medium">{pkr(i.balance)}</Td>
                    <Td><Badge tone={statusTone(st)}>{titleCase(st)}</Badge></Td>
                  </tr>
                );
              })}
            </tbody></TableWrap>
            <Pagination page={page} pageSize={PAGE} total={count ?? rows.length} hrefFor={qs} />
          </>
        )}
      </Card>
    </>
  );
}
