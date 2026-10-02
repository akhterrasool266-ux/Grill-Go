import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KV, Letterhead, Sheet } from '@/components/data/print-doc';
import { RefundForm } from '@/components/data/fees-forms';
import { LinkButton } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { QrSvg } from '@/components/ui/qr';
import { Alert, Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDateTime, pkr, titleCase } from '@/lib/format';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Receipt' };

export default async function ReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireUser();
  const sb = await createClient();
  const { data: p } = await sb.from('payments').select('*,students(full_name,student_code,classes(name),sections(name)),families(family_name,family_code),campuses(name)').eq('id', id).maybeSingle();
  if (!p) notFound();
  const [{ data: allocs }, { data: refunds }, school] = await Promise.all([
    sb.from('payment_allocations').select('amount,fee_invoices(id,invoice_no,period_label,students(full_name))').eq('payment_id', id),
    sb.from('refunds').select('amount,reason,created_at').eq('payment_id', id).order('created_at'),
    getSchoolInfo(sb, ctx.school.id),
  ]);
  const advance = Number(p.amount) - Number(p.allocated_amount) - Number(p.refunded_amount);
  const refundable = Number(p.amount) - Number(p.refunded_amount);
  return (
    <>
      {sp.new && <div className="no-print mb-4"><Alert tone="ok" title={`Payment received — ${p.receipt_no}`}>Print the receipt for the parent. A confirmation message has been queued for the guardian.</Alert></div>}
      <PageHeader back={{ href: '/fees/receipts', label: 'Receipts' }} title={`Receipt ${p.receipt_no}`} actions={<>{can(ctx, 'payments.create') && <LinkButton variant="secondary" href="/fees/collect">Next payment</LinkButton>}<PrintButton /></>} />
      <Sheet>
        <Letterhead school={school} title="Fee receipt" right={<p className="text-xs text-neutral-600">No. <b>{p.receipt_no}</b><br />{fmtDateTime(p.paid_at)}</p>} />
        <KV items={[['Received from', p.payer_name ?? p.students?.full_name ?? p.families?.family_name], [p.students ? 'Student' : 'Family', p.students ? `${p.students.full_name} (${p.students.student_code})` : `${p.families?.family_name} (${p.families?.family_code})`], ['Class', p.students ? `${p.students.classes?.name ?? ''}${p.students.sections?.name ? ' – ' + p.students.sections.name : ''}` : null], ['Method', titleCase(p.method)], ['Reference', p.reference_no], ['Campus', p.campuses?.name]]} />
        <table className="w-full text-sm"><thead><tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500"><th className="py-1.5">Applied to</th><th className="py-1.5 text-right">Amount (PKR)</th></tr></thead><tbody>
          {(allocs ?? []).map((a: any, i: number) => <tr key={i} className="border-b border-neutral-200"><td className="py-1.5">{a.fee_invoices?.period_label} <span className="text-neutral-500">· {a.fee_invoices?.invoice_no}{p.family_id ? ` · ${a.fee_invoices?.students?.full_name}` : ''}</span></td><td className="py-1.5 text-right tabular">{pkr(a.amount, { symbol: false })}</td></tr>)}
          {advance > 0 && <tr className="border-b border-neutral-200"><td className="py-1.5">Advance credit (applied to future vouchers)</td><td className="py-1.5 text-right tabular">{pkr(advance, { symbol: false })}</td></tr>}
          {(refunds ?? []).map((r: any, i: number) => <tr key={i} className="border-b border-neutral-200 text-red-700"><td className="py-1.5">Refund — {r.reason}</td><td className="py-1.5 text-right tabular">− {pkr(r.amount, { symbol: false })}</td></tr>)}
        </tbody><tfoot><tr className="border-t-2 border-neutral-800 text-base font-bold"><td className="pt-1.5 text-right">Total received</td><td className="pt-1.5 text-right tabular">{pkr(Number(p.amount), { symbol: false })}</td></tr></tfoot></table>
        <div className="flex items-end justify-between"><p className="text-xs text-neutral-500">This is a computer-generated receipt.</p><QrSvg value={p.receipt_no} size={64} /></div>
      </Sheet>
      {can(ctx, 'payments.approve') && refundable > 0 && <Card className="no-print mx-auto mt-5 max-w-[210mm]"><CardHeader title="Refund" description="Needs a reason and is written to the audit log." /><CardBody><RefundForm paymentId={id} max={refundable} /></CardBody></Card>}
      <p className="no-print mt-4 text-center text-sm text-muted"><Link href="/fees" className="hover:text-ink">Back to fees</Link></p>
    </>
  );
}
