import { notFound } from 'next/navigation';
import { KV, Letterhead, Sheet } from '@/components/data/print-doc';
import { PrintButton } from '@/components/ui/print-button';
import { PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { pkr } from '@/lib/format';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';

export default async function Payslip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: p } = await sb.from('payroll').select('*,staff(full_name,employee_code,cnic,bank_name,bank_account,designations(name),departments(name))').eq('id', id).maybeSingle();
  if (!p) notFound();
  const [{ data: items }, school] = await Promise.all([sb.from('payroll_items').select('kind,label,amount').eq('payroll_id', id).order('kind', { ascending: false }), getSchoolInfo(sb, ctx.school.id)]);
  const month = new Date(p.month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const earn = (items ?? []).filter((i: any) => i.kind === 'earning'), ded = (items ?? []).filter((i: any) => i.kind === 'deduction');
  return (
    <>
      <PageHeader title="Payslip" back={{ href: '/payroll', label: 'Payroll' }} actions={<PrintButton />} />
      <Sheet>
        <Letterhead school={school} title="Salary slip" right={<p className="text-xs text-neutral-600">{month}<br />No. {p.payslip_no}</p>} />
        <KV items={[['Employee', p.staff.full_name], ['Employee ID', p.staff.employee_code], ['Designation', p.staff.designations?.name], ['Department', p.staff.departments?.name], ['CNIC', p.staff.cnic], ['Bank', [p.staff.bank_name, p.staff.bank_account].filter(Boolean).join(' · ')], ['Working days', p.working_days], ['Present / absent', `${p.present_days} / ${p.absent_days}`], ['Overtime', `${p.overtime_minutes} min`]]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <table className="w-full text-sm"><thead><tr className="border-b-2 border-neutral-800 text-left text-xs uppercase"><th className="py-1">Earnings</th><th className="text-right">PKR</th></tr></thead><tbody>{earn.map((i: any) => <tr key={i.label} className="border-b border-neutral-200"><td className="py-1">{i.label}</td><td className="text-right tabular">{pkr(i.amount, { symbol: false })}</td></tr>)}</tbody><tfoot><tr className="font-bold"><td className="pt-1">Gross</td><td className="pt-1 text-right tabular">{pkr(p.gross, { symbol: false })}</td></tr></tfoot></table>
          <table className="w-full text-sm"><thead><tr className="border-b-2 border-neutral-800 text-left text-xs uppercase"><th className="py-1">Deductions</th><th className="text-right">PKR</th></tr></thead><tbody>{ded.length === 0 ? <tr><td className="py-1 text-neutral-500" colSpan={2}>None</td></tr> : ded.map((i: any) => <tr key={i.label} className="border-b border-neutral-200"><td className="py-1">{i.label}</td><td className="text-right tabular">{pkr(i.amount, { symbol: false })}</td></tr>)}</tbody><tfoot><tr className="font-bold"><td className="pt-1">Total deductions</td><td className="pt-1 text-right tabular">{pkr(p.total_deductions, { symbol: false })}</td></tr></tfoot></table>
        </div>
        <p className="border-t-2 border-neutral-800 pt-2 text-end text-lg font-bold">Net salary: {pkr(p.net_salary)}</p>
        <p className="text-xs text-neutral-500">Computer-generated payslip. Status: {p.status}.</p>
      </Sheet>
    </>
  );
}
