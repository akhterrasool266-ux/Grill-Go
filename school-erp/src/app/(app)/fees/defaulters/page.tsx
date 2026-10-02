import type { Metadata } from 'next';
import Link from 'next/link';
import { DefaulterTable } from '@/components/data/defaulter-table';
import { LinkButton } from '@/components/ui/button';
import { Card, EmptyState, PageHeader, Stat } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { pkr } from '@/lib/format';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Fee defaulters' };

export default async function DefaultersPage({ searchParams }: { searchParams: Promise<{ class?: string; section?: string; from?: string; to?: string; type?: string; family?: string }> }) {
  const ctx = await requirePerm('fees.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const { data, error } = await sb.rpc('fee_defaulters', {
    p_campus: campus, p_class: sp.class || null, p_section: sp.section || null, p_from: sp.from ? `${sp.from}-01` : null, p_to: sp.to ? `${sp.to}-01` : null, p_invoice_type: sp.type || null, p_family: sp.family || null,
  });
  const rows = ((data ?? []) as any[]).map((r) => ({ id: r.student_id, code: r.student_code, name: r.student_name, cls: `${r.class_name ?? ''}${r.section_name ? ' – ' + r.section_name : ''}`, guardian: r.guardian_name, phone: r.guardian_phone, whatsapp: r.guardian_whatsapp, family: r.family_name, amount: Number(r.outstanding), months: Number(r.overdue_invoices), days: Number(r.max_days_overdue), last: r.last_payment_date }));
  const opts = await classSectionOptions(sb, campus);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Fee defaulters" back={{ href: '/fees', label: 'Fees' }} description="Students with vouchers past their due date."
        actions={can(ctx, 'fees.export') ? <LinkButton variant="secondary" href={`/api/fees/defaulters/export?${qs}`}>Export CSV</LinkButton> : undefined} />
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Defaulting students" value={rows.length} tone={rows.length ? 'bad' : 'ok'} /><Stat label="Overdue amount" value={pkr(total)} tone="warn" /></section>
      <form className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <select name="class" defaultValue={sp.class ?? ''} className="input sm:w-40"><option value="">All classes</option>{opts.classes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <select name="section" defaultValue={sp.section ?? ''} className="input sm:w-44"><option value="">All sections</option>{opts.sectionsFull.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <input name="from" type="month" defaultValue={sp.from} className="input sm:w-40" aria-label="From month" /><input name="to" type="month" defaultValue={sp.to} className="input sm:w-40" aria-label="To month" />
        <select name="type" defaultValue={sp.type ?? ''} className="input sm:w-40"><option value="">All fee types</option><option value="monthly">Monthly</option><option value="adhoc">One-off</option><option value="admission">Admission</option></select>
        <button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Filter</button>
        <Link href="/fees/defaulters" className="self-center text-sm text-muted">Reset</Link>
      </form>
      {error && <p role="alert" className="mb-3 text-sm text-bad">Could not load the list.</p>}
      <Card>{rows.length === 0 ? <EmptyState title="No defaulters 🎉" hint="Nobody has an overdue voucher for these filters." /> : <DefaulterTable rows={rows} canRemind={can(ctx, 'communication.create')} school={ctx.school.name} />}</Card>
    </>
  );
}
