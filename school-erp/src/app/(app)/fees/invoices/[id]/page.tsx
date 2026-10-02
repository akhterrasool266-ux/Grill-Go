import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KV, Letterhead, Sheet } from '@/components/data/print-doc';
import { AdjustForm, CancelInvoiceButton } from '@/components/data/fees-forms';
import { LinkButton } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { QrSvg } from '@/components/ui/qr';
import { Badge, Card, CardBody, CardHeader, PageHeader, statusTone } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDate, pkr, titleCase, todayISO } from '@/lib/format';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Fee voucher' };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: inv } = await sb.from('fee_invoices').select('*,students(full_name,student_code,father_name,classes(name),sections(name)),campus_id').eq('id', id).maybeSingle();
  if (!inv) notFound();
  const [{ data: items }, { data: allocs }, school, { data: settings }, { data: camp }] = await Promise.all([
    sb.from('fee_invoice_items').select('kind,description,amount').eq('invoice_id', id).order('created_at'),
    sb.from('payment_allocations').select('amount,payments(id,receipt_no,paid_at,method)').eq('invoice_id', id),
    getSchoolInfo(sb, ctx.school.id),
    sb.from('settings').select('value').eq('key', 'fees').maybeSingle(),
    sb.from('campuses').select('name').eq('id', inv.campus_id).maybeSingle(),
  ]);
  const st = ['unpaid', 'partial'].includes(inv.status) && inv.due_date < todayISO() ? 'overdue' : inv.status;
  const note = (settings?.value as any)?.voucher_note as string | undefined;
  const staff = can(ctx, 'fees.approve');
  const lines = (k: string) => (items ?? []).filter((i: any) => i.kind === k);
  return (
    <>
      <PageHeader back={{ href: '/fees/invoices', label: 'Vouchers' }} title={`Voucher ${inv.invoice_no}`}
        actions={<>{can(ctx, 'payments.create') && inv.balance > 0 && inv.status !== 'cancelled' && <LinkButton href={`/fees/collect?student=${inv.students.student_code}`}>Collect fee</LinkButton>}<PrintButton variant="secondary" /></>} />
      <Sheet>
        <Letterhead school={school} title="Fee voucher" right={<p className="text-xs text-neutral-600">No. <b>{inv.invoice_no}</b><br />Issued {fmtDate(inv.issue_date)}</p>} />
        <KV items={[['Student', inv.students.full_name], ['Student ID', inv.students.student_code], ['Class', `${inv.students.classes?.name ?? ''}${inv.students.sections?.name ? ' – ' + inv.students.sections.name : ''}`], ['Father / guardian', inv.students.father_name], ['Fee period', inv.period_label], ['Campus', camp?.name]]} />
        <table className="w-full text-sm"><thead><tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500"><th className="py-1.5">Description</th><th className="py-1.5 text-right">Amount (PKR)</th></tr></thead><tbody>
          {Number(inv.previous_balance) > 0 && <tr className="border-b border-neutral-200"><td className="py-1.5">Previous balance (carried from earlier vouchers — shown for reference)</td><td className="py-1.5 text-right tabular text-neutral-500">{pkr(inv.previous_balance, { symbol: false })}</td></tr>}
          {lines('charge').map((l: any, i: number) => <tr key={i} className="border-b border-neutral-200"><td className="py-1.5">{l.description}</td><td className="py-1.5 text-right tabular">{pkr(l.amount, { symbol: false })}</td></tr>)}
          {lines('discount').map((l: any, i: number) => <tr key={i} className="border-b border-neutral-200 text-emerald-700"><td className="py-1.5">{l.description}</td><td className="py-1.5 text-right tabular">− {pkr(l.amount, { symbol: false })}</td></tr>)}
          {lines('fine').map((l: any, i: number) => <tr key={i} className="border-b border-neutral-200 text-red-700"><td className="py-1.5">{l.description}</td><td className="py-1.5 text-right tabular">{pkr(l.amount, { symbol: false })}</td></tr>)}
        </tbody><tfoot>
          <tr><td className="pt-2 text-right font-medium">This voucher</td><td className="pt-2 text-right tabular font-medium">{pkr(inv.net_amount, { symbol: false })}</td></tr>
          <tr><td className="text-right text-neutral-600">Paid so far</td><td className="text-right tabular text-neutral-600">{pkr(inv.paid_amount, { symbol: false })}</td></tr>
          <tr className="border-t-2 border-neutral-800 text-base font-bold"><td className="pt-1.5 text-right">{Number(inv.previous_balance) > 0 ? 'Total payable (incl. previous balance, less paid)' : 'Balance due'}</td><td className="pt-1.5 text-right tabular">{pkr(Number(inv.previous_balance) + Number(inv.balance), { symbol: false })}</td></tr>
        </tfoot></table>
        <div className="flex items-end justify-between gap-4">
          <div className="text-sm"><p>Due date: <b>{fmtDate(inv.due_date)}</b></p><p>Status: <b>{titleCase(st)}</b></p>{note && <p className="mt-2 max-w-md text-xs text-neutral-600">{note}</p>}</div>
          <div className="text-center"><QrSvg value={inv.voucher_ref} size={84} /><p className="mt-1 text-[10px] text-neutral-500">Payment ref<br /><span className="tabular">{inv.voucher_ref.slice(0, 12).toUpperCase()}</span></p></div>
        </div>
      </Sheet>
      <div className="no-print mt-5 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Payments on this voucher" action={<Badge tone={statusTone(st)}>{titleCase(st)}</Badge>} />
          {(allocs ?? []).length === 0 ? <CardBody><p className="text-sm text-muted">No payments yet.</p></CardBody> : <ul className="divide-y divide-line">{(allocs ?? []).map((a: any, i: number) => <li key={i} className="flex justify-between p-3.5 text-sm"><Link className="text-brand hover:underline" href={`/fees/receipts/${a.payments.id}`}>{a.payments.receipt_no}</Link><span className="text-muted">{titleCase(a.payments.method)}</span><span className="tabular font-medium">{pkr(a.amount)}</span></li>)}</ul>}
        </Card>
        {staff && inv.status !== 'cancelled' && (
          <Card><CardHeader title="Adjust voucher" description="Every change needs a reason and is written to the audit log." /><CardBody className="space-y-4">
            <AdjustForm invoiceId={id} canWaive />
            {Number(inv.paid_amount) === 0 && <CancelInvoiceButton invoiceId={id} />}
          </CardBody></Card>
        )}
      </div>
    </>
  );
}
