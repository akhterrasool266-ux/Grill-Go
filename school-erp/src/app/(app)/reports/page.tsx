import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { reportsFor } from '@/lib/reports';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const ctx = await requirePerm('reports.view');
  const list = reportsFor(ctx);
  const groups = ['People', 'Academics', 'Money', 'Operations'] as const;
  return (
    <>
      <PageHeader title="Report center" description="Every report supports date range, campus, print / PDF and CSV (opens in Excel)." />
      {groups.map((g) => { const items = list.filter((r) => r.group === g); return items.length ? (
        <section key={g} className="mb-6"><h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((r) => <Link key={r.slug} href={`/reports/${r.slug}`} className="rounded-[14px] border border-line bg-surface p-4 hover:border-brand/50 hover:bg-brand-soft/30"><p className="font-semibold">{r.title}</p><p className="text-sm text-muted">{r.description}</p></Link>)}</div></section>) : null; })}
    </>
  );
}
