import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Letterhead } from '@/components/data/print-doc';
import { LinkButton } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { Card, EmptyState, PageHeader, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, currentCampus, requireUser } from '@/lib/auth/session';
import { fmtDate, todayISO } from '@/lib/format';
import { findReport, reportsFor } from '@/lib/reports';
import { getSchoolInfo } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { return { title: findReport((await params).slug)?.title ?? 'Report' }; }

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; to?: string; month?: string; exam?: string; date?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const def = findReport(slug);
  if (!def) notFound();
  const ctx = await requireUser();
  if (!reportsFor(ctx).some((r) => r.slug === slug)) redirect('/forbidden');
  const today = todayISO();
  const p = { campus: await currentCampus(ctx), from: sp.from ?? today.slice(0, 8) + '01', to: sp.to ?? today, month: sp.month ?? today.slice(0, 7), exam: sp.exam, date: sp.date ?? today };
  const sb = await createClient();
  const [res, school, exams] = await Promise.all([def.run(sb, p, ctx), getSchoolInfo(sb, ctx.school.id), def.params.includes('exam') ? sb.from('exams').select('id,name').order('created_at', { ascending: false }).limit(40) : Promise.resolve({ data: [] })]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title={def.title} description={def.description} back={{ href: '/reports', label: 'Reports' }}
        actions={<>{can(ctx, 'reports.export') && <LinkButton variant="secondary" href={`/api/reports/${slug}?${qs}`}>Export CSV</LinkButton>}{can(ctx, 'reports.print') && <PrintButton variant="secondary" />}</>} />
      <form className="no-print mb-4 flex flex-wrap items-end gap-2">
        {def.params.includes('range') && <><label className="text-xs text-muted">From<input type="date" name="from" defaultValue={p.from} className="input mt-1 w-40" /></label><label className="text-xs text-muted">To<input type="date" name="to" defaultValue={p.to} className="input mt-1 w-40" /></label></>}
        {def.params.includes('date') && <label className="text-xs text-muted">Date<input type="date" name="date" defaultValue={p.date} className="input mt-1 w-40" /></label>}
        {def.params.includes('exam') && <label className="text-xs text-muted">Exam<select name="exam" defaultValue={sp.exam ?? ''} className="input mt-1 w-64"><option value="">Choose…</option>{(exams.data ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}
        {def.params.length > 0 && <button className="h-10 rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Run</button>}
      </form>
      <div className="print-sheet space-y-3 rounded-[14px] border border-line bg-surface p-4 sm:p-6">
        <div className="hidden print:block"><Letterhead school={school} title={def.title} right={<p className="text-xs">{def.params.includes('range') ? `${fmtDate(p.from)} – ${fmtDate(p.to)}` : fmtDate(today)}</p>} /></div>
        {res.summary && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{res.summary.map(([k, v]) => <Stat key={k} label={k} value={v} />)}</div>}
        {res.rows.length === 0 ? <EmptyState title="No data for these filters" /> : <TableWrap><thead><tr>{res.columns.map((c, i) => <Th key={c} className={res.numericFrom !== undefined && i >= res.numericFrom ? 'text-end' : ''}>{c}</Th>)}</tr></thead><tbody>
          {res.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <Td key={j} className={res.numericFrom !== undefined && j >= res.numericFrom ? 'tabular text-end' : ''}>{typeof c === 'number' ? c.toLocaleString('en-PK') : c ?? '—'}</Td>)}</tr>)}
        </tbody></TableWrap>}
      </div>
    </>
  );
}
