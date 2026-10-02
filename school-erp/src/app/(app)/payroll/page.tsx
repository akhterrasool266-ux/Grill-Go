import type { Metadata } from 'next';
import Link from 'next/link';
import { PayrollGenerate } from '@/components/data/hr-forms';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { can, currentCampus, requireUser } from '@/lib/auth/session';
import { pkr, titleCase, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Payroll' };

export default async function PayrollPage() {
  const ctx = await requireUser();
  if (!can(ctx, 'payroll.view') || !can(ctx, 'financial.access')) redirect('/forbidden');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  let q = sb.from('payroll_runs').select('id,month,status,total_gross,total_deductions,total_net,campuses(name)').order('month', { ascending: false }).limit(24);
  if (campus) q = q.eq('campus_id', campus);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Payroll" description="Salary sheets are calculated from salary structures, attendance, leave, overtime, loans and adjustments."
        actions={<><LinkButton variant="secondary" href="/manage/salary-structures">Salary structures</LinkButton><LinkButton variant="secondary" href="/manage/payroll-adjustments">Bonuses & deductions</LinkButton><LinkButton variant="secondary" href="/manage/staff-loans">Loans</LinkButton></>} />
      {can(ctx, 'payroll.create') && <Card className="mb-5"><CardHeader title="Run payroll" description="Regenerating a draft recalculates it. Approved payroll is locked." /><CardBody><PayrollGenerate month={todayISO().slice(0, 7)} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} /></CardBody></Card>}
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No payroll runs yet" /> : <TableWrap><thead><tr><Th>Month</Th><Th className="hidden sm:table-cell">Campus</Th><Th className="text-end">Gross</Th><Th className="hidden sm:table-cell text-end">Deductions</Th><Th className="text-end">Net</Th><Th>Status</Th></tr></thead><tbody>
        {(data ?? []).map((r: any) => <tr key={r.id} className="hover:bg-surface-2/50"><Td><Link href={`/payroll/${r.id}`} className="font-medium text-brand hover:underline">{new Date(r.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Link></Td><Td className="hidden sm:table-cell">{r.campuses?.name}</Td><Td className="tabular text-end">{pkr(r.total_gross)}</Td><Td className="hidden tabular text-end sm:table-cell">{pkr(r.total_deductions)}</Td><Td className="tabular text-end font-medium">{pkr(r.total_net)}</Td><Td><Badge tone={statusTone(r.status)}>{titleCase(r.status)}</Badge></Td></tr>)}
      </tbody></TableWrap>}</Card>
    </>
  );
}
