import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PayrollActions } from '@/components/data/hr-forms';
import { Letterhead, Sheet } from '@/components/data/print-doc';
import { PrintButton } from '@/components/ui/print-button';
import { Alert, Badge, PageHeader, statusTone } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { pkr, titleCase } from '@/lib/format';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Salary sheet' };

export default async function PayrollRun({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ generated?: string; skipped?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireUser();
  if (!can(ctx, 'payroll.view') || !can(ctx, 'financial.access')) redirect('/forbidden');
  const sb = await createClient();
  const { data: r } = await sb.from('payroll_runs').select('*,campuses(name)').eq('id', id).maybeSingle();
  if (!r) notFound();
  const [{ data: slips }, { data: accts }, school] = await Promise.all([
    sb.from('payroll').select('id,payslip_no,working_days,present_days,absent_days,basic,allowances_total,conveyance,overtime_amount,bonus,gross,absence_deduction,loan_deduction,tax_deduction,other_deduction,total_deductions,net_salary,staff(full_name,employee_code)').eq('run_id', id).order('payslip_no'),
    sb.from('accounts').select('id,name').eq('is_active', true).order('name'),
    getSchoolInfo(sb, ctx.school.id),
  ]);
  const month = new Date(r.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const rows = (slips ?? []) as any[];
  return (
    <>
      <PageHeader back={{ href: '/payroll', label: 'Payroll' }} title={`Salary sheet — ${month}`} description={r.campuses?.name} actions={<><Badge tone={statusTone(r.status)} className="text-sm">{titleCase(r.status)}</Badge><PrintButton variant="secondary" /></>} />
      {sp.generated && <div className="mb-4"><Alert tone={Number(sp.skipped) ? 'warn' : 'ok'} title={`${sp.generated} payslips calculated`}>{Number(sp.skipped) ? `${sp.skipped} active staff were skipped because they have no salary structure. Add one under Salary structures and regenerate.` : 'Review the sheet, then approve it.'}</Alert></div>}
      <div className="no-print mb-4"><PayrollActions id={id} status={r.status} canApprove={can(ctx, 'payroll.approve')} accounts={(accts ?? []).map((a: any) => ({ value: a.id, label: a.name }))} /></div>
      <Sheet className="max-w-none">
        <Letterhead school={school} title={`Salary sheet — ${month}`} right={<p className="text-xs text-neutral-600">{r.campuses?.name}</p>} />
        <div className="scroll-x"><table className="w-full min-w-[900px] text-xs"><thead><tr className="border-b-2 border-neutral-800 text-left uppercase"><th className="py-1.5">Employee</th><th className="text-right">Days (P/A)</th><th className="text-right">Basic</th><th className="text-right">Allow.</th><th className="text-right">O/T</th><th className="text-right">Bonus</th><th className="text-right">Gross</th><th className="text-right">Absence</th><th className="text-right">Loan</th><th className="text-right">Tax</th><th className="text-right">Other</th><th className="text-right">Net</th><th className="no-print" /></tr></thead><tbody>
          {rows.map((p) => <tr key={p.id} className="border-b border-neutral-200"><td className="py-1.5">{p.staff?.full_name}<span className="block text-neutral-500">{p.staff?.employee_code}</span></td><td className="text-right tabular">{p.present_days}/{p.absent_days}</td><td className="text-right tabular">{pkr(p.basic, { symbol: false })}</td><td className="text-right tabular">{pkr(Number(p.allowances_total) + Number(p.conveyance), { symbol: false })}</td><td className="text-right tabular">{pkr(p.overtime_amount, { symbol: false })}</td><td className="text-right tabular">{pkr(p.bonus, { symbol: false })}</td><td className="text-right tabular font-medium">{pkr(p.gross, { symbol: false })}</td><td className="text-right tabular">{pkr(p.absence_deduction, { symbol: false })}</td><td className="text-right tabular">{pkr(p.loan_deduction, { symbol: false })}</td><td className="text-right tabular">{pkr(p.tax_deduction, { symbol: false })}</td><td className="text-right tabular">{pkr(p.other_deduction, { symbol: false })}</td><td className="text-right tabular font-bold">{pkr(p.net_salary, { symbol: false })}</td><td className="no-print ps-2"><Link className="text-brand hover:underline" href={`/payroll/slip/${p.id}`}>Slip</Link></td></tr>)}
        </tbody><tfoot><tr className="border-t-2 border-neutral-800 font-bold"><td className="py-1.5">Total ({rows.length})</td><td /><td colSpan={4} /><td className="text-right tabular">{pkr(r.total_gross, { symbol: false })}</td><td colSpan={4} className="text-right tabular">− {pkr(r.total_deductions, { symbol: false })}</td><td className="text-right tabular">{pkr(r.total_net, { symbol: false })}</td><td className="no-print" /></tr></tfoot></table></div>
      </Sheet>
    </>
  );
}
