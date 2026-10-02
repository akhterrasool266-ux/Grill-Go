import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart } from '@/components/data/charts';
import { LinkButton } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader, Stat } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { pkr } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Fees' };

export default async function FeesHub() {
  const ctx = await requirePerm('fees.view');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const [{ data: st }, { data: se }] = await Promise.all([sb.rpc('dashboard_stats', { p_campus: campus }), sb.rpc('dashboard_series', { p_campus: campus })]);
  const s = (st ?? {}) as Record<string, number>;
  const links: [string, string, string, boolean][] = [
    ['Collect fee', '/fees/collect', 'Take a payment and print the receipt', can(ctx, 'payments.create')],
    ['Generate vouchers', '/fees/generate', 'Monthly or one-off fee vouchers for a class or the whole campus', can(ctx, 'fees.create')],
    ['Vouchers', '/fees/invoices', 'Search, print, adjust or cancel vouchers', true],
    ['Receipts', '/fees/receipts', 'All payments, refunds', can(ctx, 'payments.view')],
    ['Defaulters', '/fees/defaulters', 'Overdue fees, reminders, notices', true],
    ['Daily closing', '/fees/closing', 'Reconcile the cash drawer', can(ctx, 'payments.approve')],
    ['Fee structure', '/manage/fee-structures', 'Amounts per class and category', true],
    ['Fee categories', '/manage/fee-categories', 'Tuition, transport, annual…', true],
    ['Discounts & scholarships', '/manage/student-discounts', 'Sibling, merit, concession', can(ctx, 'fees.approve')],
    ['Per-student overrides', '/manage/student-fee-assignments', 'Custom amounts and exemptions', can(ctx, 'fees.approve')],
    ['Import fee amounts', '/import/fees', 'Upload a CSV of class fees', can(ctx, 'fees.create')],
  ];
  return (
    <>
      <PageHeader title="Fees" description="Vouchers, collection, discounts and defaulters." actions={<>{can(ctx, 'payments.create') && <LinkButton href="/fees/collect">Collect fee</LinkButton>}</>} />
      {s.outstanding_fees !== undefined && (
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Collected today" value={pkr(s.fee_collected_today)} /><Stat label="Collected this month" value={pkr(s.fee_collected_month)} />
          <Stat label="Outstanding" value={pkr(s.outstanding_fees)} tone="warn" href="/fees/invoices?status=unpaid" /><Stat label="Defaulters" value={s.defaulters} tone="bad" href="/fees/defaulters" />
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-2">
          {links.filter((l) => l[3]).map(([t, h, d]) => (
            <Link key={h} href={h} className="rounded-[14px] border border-line bg-surface p-4 transition-colors hover:border-brand/50 hover:bg-brand-soft/40"><p className="font-semibold">{t}</p><p className="text-sm text-muted">{d}</p></Link>
          ))}
        </div>
        {(se as any)?.monthly_collection && <Card className="self-start"><CardHeader title="Monthly collection" /><CardBody><BarChart title="Monthly collection" data={(se as any).monthly_collection} /></CardBody></Card>}
      </div>
    </>
  );
}
