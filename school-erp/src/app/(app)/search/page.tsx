import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Search' };
const LABEL: Record<string, string> = { student: 'Students', guardian: 'Parents', staff: 'Staff', invoice: 'Fee vouchers', receipt: 'Receipts', admission: 'Admissions', exam: 'Exams', book: 'Books', vehicle: 'Vehicles' };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const { q } = await searchParams;
  const sb = await createClient();
  const { data } = q && q.trim().length >= 2 ? await sb.rpc('global_search', { p_q: q.trim(), p_limit: 6 }) : { data: [] };
  const groups = new Map<string, any[]>();
  for (const r of (data ?? []) as any[]) groups.set(r.kind, [...(groups.get(r.kind) ?? []), r]);
  return (
    <>
      <PageHeader title="Search" description="Finds students, parents, staff, vouchers, receipts, admissions, exams, books and vehicles you are allowed to see." />
      <form className="mb-5 flex gap-2" role="search"><input name="q" defaultValue={q} autoFocus placeholder="Name, ID, phone, voucher or receipt no…" className="input max-w-lg text-base" /><button className="rounded-[10px] bg-brand px-5 text-sm font-medium text-brand-fg">Search</button></form>
      {q && groups.size === 0 && <Card><EmptyState title="No results" hint={q.trim().length < 2 ? 'Type at least two characters.' : 'Try fewer letters, or a student ID like STD-0001.'} /></Card>}
      <div className="space-y-4">{[...groups.entries()].map(([k, rows]) => (
        <Card key={k}><p className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">{LABEL[k] ?? titleCase(k)}</p><ul className="divide-y divide-line">{rows.map((r) => <li key={r.id}><Link href={r.href} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2"><span className="font-medium">{r.title}</span><span className="truncate text-muted">{r.subtitle}</span></Link></li>)}</ul></Card>))}</div>
    </>
  );
}
