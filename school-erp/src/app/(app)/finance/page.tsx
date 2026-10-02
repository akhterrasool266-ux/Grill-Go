import type { Metadata } from 'next';
import Link from 'next/link';
import { GroupedBars } from '@/components/data/charts';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, currentCampus, requireUser } from '@/lib/auth/session';
import { fmtDate, pkr, titleCase, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Finance' };

export default async function FinancePage() {
  const ctx = await requireUser();
  if (!can(ctx, 'finance.view') || !can(ctx, 'financial.access')) redirect('/forbidden');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const month = todayISO().slice(0, 8) + '01';
  let tq = sb.from('transactions').select('id,txn_date,direction,amount,source_type,description,accounts(name)').order('created_at', { ascending: false }).limit(15);
  let mq = sb.from('transactions').select('direction,amount,source_type').gte('txn_date', month);
  let eq = sb.from('expenses').select('amount').in('status', ['pending', 'approved']);
  if (campus) { tq = tq.eq('campus_id', campus); mq = mq.eq('campus_id', campus); eq = eq.eq('campus_id', campus); }
  const [{ data: bal }, { data: txns }, { data: mon }, { data: pend }, { data: series }, { data: out }] = await Promise.all([
    sb.from('account_balances').select('account_id,name,kind,balance'), tq, mq, eq, sb.rpc('dashboard_series', { p_campus: campus }),
    (() => { let q = sb.from('fee_invoices').select('balance').in('status', ['unpaid', 'partial']); if (campus) q = q.eq('campus_id', campus); return q; })(),
  ]);
  const m = (mon ?? []) as any[];
  const inc = m.filter((t) => t.direction === 'in').reduce((a, t) => a + Number(t.amount), 0), exp = m.filter((t) => t.direction === 'out' && t.source_type !== 'refund').reduce((a, t) => a + Number(t.amount), 0);
  const payable = (pend ?? []).reduce((a: number, e: any) => a + Number(e.amount), 0), receivable = (out ?? []).reduce((a: number, e: any) => a + Number(e.balance), 0);
  const inex = (series as any)?.income_vs_expense as { label: string; income: number; expense: number }[] | undefined;
  return (
    <>
      <PageHeader title="Finance" description="Cash book, expenses, accounts and reports." actions={<>{can(ctx, 'finance.create') && <LinkButton variant="secondary" href="/manage/expenses/new">+ Expense</LinkButton>}<LinkButton variant="secondary" href="/reports/income-statement">Income statement</LinkButton></>} />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Income this month" value={pkr(inc)} tone="ok" /><Stat label="Spent this month" value={pkr(exp)} /><Stat label="Receivable (fees)" value={pkr(receivable)} tone="warn" href="/fees/invoices?status=unpaid" /><Stat label="Payable (unpaid expenses)" value={pkr(payable)} href="/manage/expenses" /></section>
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Accounts" action={<Link className="text-sm text-brand hover:underline" href="/manage/accounts">Manage</Link>} />{(bal ?? []).length === 0 ? <EmptyState title="No accounts" /> : <TableWrap><thead><tr><Th>Account</Th><Th>Type</Th><Th className="text-end">Balance</Th></tr></thead><tbody>{(bal ?? []).map((a: any) => <tr key={a.account_id}><Td className="font-medium">{a.name}</Td><Td>{titleCase(a.kind)}</Td><Td className="tabular text-end">{pkr(a.balance)}</Td></tr>)}</tbody></TableWrap>}</Card>
        {inex && <Card><CardHeader title="Income vs expense" /><div className="p-4"><GroupedBars title="Income vs expense" series={['Income', 'Expense']} data={inex.map((r) => ({ label: r.label, a: r.income, b: r.expense }))} /></div></Card>}
      </div>
      <Card className="mb-5"><CardHeader title="Recent cash-book entries" />{(txns ?? []).length === 0 ? <EmptyState title="No transactions yet" /> : <TableWrap><thead><tr><Th>Date</Th><Th>Description</Th><Th className="hidden sm:table-cell">Account</Th><Th className="text-end">Amount</Th></tr></thead><tbody>{(txns ?? []).map((t: any) => <tr key={t.id}><Td>{fmtDate(t.txn_date)}</Td><Td>{t.description}<span className="block text-xs text-muted">{titleCase(t.source_type)}</span></Td><Td className="hidden sm:table-cell">{t.accounts?.name}</Td><Td className={`tabular text-end font-medium ${t.direction === 'in' ? 'text-ok' : 'text-bad'}`}>{t.direction === 'in' ? '+' : '−'}{pkr(t.amount)}</Td></tr>)}</tbody></TableWrap>}</Card>
      <div className="flex flex-wrap gap-2 text-sm"><LinkButton variant="secondary" href="/manage/expenses">Expenses</LinkButton><LinkButton variant="secondary" href="/manage/expense-categories">Categories</LinkButton><LinkButton variant="secondary" href="/manage/vendors">Vendors</LinkButton><LinkButton variant="secondary" href="/finance/journal">Journal entries</LinkButton><LinkButton variant="secondary" href="/manage/gl-accounts">Chart of accounts</LinkButton><LinkButton variant="secondary" href="/reports/expenses">Expense report</LinkButton>{can(ctx, 'finance.view') && <Badge>Pending expenses need approval</Badge>}</div>
    </>
  );
}
