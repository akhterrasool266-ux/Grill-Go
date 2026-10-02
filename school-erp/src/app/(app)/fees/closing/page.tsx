import type { Metadata } from 'next';
import { CloseDayForm } from '@/components/data/fees-forms';
import { Card, CardBody, CardHeader, EmptyState, PageHeader, TableWrap, Td, Th } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, pkr, titleCase, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Daily closing' };

export default async function ClosingPage() {
  const ctx = await requirePerm('payments.approve');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const today = todayISO();
  let pq = sb.from('payments').select('method,amount,refunded_amount').eq('status', 'completed').gte('paid_at', `${today}T00:00:00+05:00`).lte('paid_at', `${today}T23:59:59+05:00`);
  let cq = sb.from('cash_closings').select('id,closing_no,closing_date,expected_cash,counted_cash,difference,totals_by_method').order('closing_date', { ascending: false }).limit(30);
  if (campus) { pq = pq.eq('campus_id', campus); cq = cq.eq('campus_id', campus); }
  const [{ data: pays }, { data: closings }] = await Promise.all([pq, cq]);
  const by: Record<string, number> = {};
  for (const p of (pays ?? []) as any[]) by[p.method] = (by[p.method] ?? 0) + Number(p.amount) - Number(p.refunded_amount);
  const closedToday = (closings ?? []).some((c: any) => c.closing_date === today);
  return (
    <>
      <PageHeader title="Daily closing" back={{ href: '/fees', label: 'Fees' }} description="Count the cash drawer against what the system recorded, then lock the day." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title={`Today · ${fmtDate(today)}`} /><CardBody className="space-y-4">
          {Object.keys(by).length === 0 ? <p className="text-sm text-muted">No payments recorded today.</p> : <ul className="divide-y divide-line text-sm">{Object.entries(by).map(([m, v]) => <li key={m} className="flex justify-between py-2"><span>{titleCase(m)}</span><span className="tabular font-medium">{pkr(v)}</span></li>)}<li className="flex justify-between py-2 font-semibold"><span>Total</span><span className="tabular">{pkr(Object.values(by).reduce((a, b) => a + b, 0))}</span></li></ul>}
          {closedToday ? <p className="rounded-[10px] bg-ok-soft p-3 text-sm text-ok">Today is closed.</p> : <CloseDayForm today={today} expected={by.cash ?? 0} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} />}
        </CardBody></Card>
        <Card><CardHeader title="Previous closings" />
          {(closings ?? []).length === 0 ? <EmptyState title="No closings yet" /> : <TableWrap><thead><tr><Th>Date</Th><Th className="text-end">Expected</Th><Th className="text-end">Counted</Th><Th className="text-end">Diff</Th></tr></thead><tbody>
            {(closings ?? []).map((c: any) => <tr key={c.id}><Td>{fmtDate(c.closing_date)}<span className="block text-xs text-muted">{c.closing_no}</span></Td><Td className="tabular text-end">{pkr(c.expected_cash)}</Td><Td className="tabular text-end">{pkr(c.counted_cash)}</Td><Td className={`tabular text-end font-medium ${Number(c.difference) === 0 ? 'text-ok' : 'text-bad'}`}>{pkr(c.difference)}</Td></tr>)}
          </tbody></TableWrap>}
        </Card>
      </div>
    </>
  );
}
