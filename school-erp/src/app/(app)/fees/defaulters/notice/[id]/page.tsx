import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KV, Letterhead, Sheet } from '@/components/data/print-doc';
import { PrintButton } from '@/components/ui/print-button';
import { PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { fmtDate, pkr, todayISO } from '@/lib/format';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Fee notice' };

export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePerm('fees.view');
  const sb = await createClient();
  const { data: s } = await sb.from('students').select('full_name,student_code,father_name,classes(name),sections(name)').eq('id', id).maybeSingle();
  if (!s) notFound();
  const { data: inv } = await sb.from('fee_invoices').select('invoice_no,period_label,due_date,balance').eq('student_id', id).in('status', ['unpaid', 'partial']).lt('due_date', todayISO()).order('due_date');
  const total = (inv ?? []).reduce((a: number, i: any) => a + Number(i.balance), 0);
  const school = await getSchoolInfo(sb, ctx.school.id);
  return (
    <>
      <PageHeader title="Fee notice" back={{ href: '/fees/defaulters', label: 'Defaulters' }} actions={<PrintButton />} />
      <Sheet>
        <Letterhead school={school} title="Fee reminder notice" right={<p className="text-xs text-neutral-600">Date {fmtDate(todayISO())}</p>} />
        <KV items={[['Student', (s as any).full_name], ['Student ID', (s as any).student_code], ['Class', `${(s as any).classes?.name ?? ''} ${(s as any).sections?.name ?? ''}`], ['To', (s as any).father_name]]} />
        <p className="text-sm leading-relaxed">Dear Parent / Guardian, our records show that the following fee vouchers are overdue. You are requested to clear the dues at the school accounts office at the earliest to avoid further late fines.</p>
        <table className="w-full text-sm"><thead><tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500"><th className="py-1.5">Voucher</th><th>Period</th><th>Due date</th><th className="text-right">Balance (PKR)</th></tr></thead><tbody>
          {(inv ?? []).map((i: any) => <tr key={i.invoice_no} className="border-b border-neutral-200"><td className="py-1.5">{i.invoice_no}</td><td>{i.period_label}</td><td>{fmtDate(i.due_date)}</td><td className="text-right tabular">{pkr(i.balance, { symbol: false })}</td></tr>)}
        </tbody><tfoot><tr className="border-t-2 border-neutral-800 font-bold"><td colSpan={3} className="pt-1.5 text-right">Total overdue</td><td className="pt-1.5 text-right tabular">{pkr(total, { symbol: false })}</td></tr></tfoot></table>
        <p className="pt-8 text-right text-sm">Accounts Office<br /><span className="text-neutral-500">{school.name}</span></p>
      </Sheet>
    </>
  );
}
