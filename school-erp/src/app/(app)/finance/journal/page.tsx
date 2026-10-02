import type { Metadata } from 'next';
import { JournalForm } from '@/components/data/journal-form';
import { Card, CardBody, CardHeader, EmptyState, PageHeader, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, pkr, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Journal entries' };

export default async function JournalPage() {
  const ctx = await requirePerm('finance.view');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const [{ data: gl }, { data: entries }] = await Promise.all([sb.from('gl_accounts').select('id,code,name').eq('is_active', true).order('code'), sb.from('journal_entries').select('id,entry_no,entry_date,memo,journal_lines(debit,credit,gl_accounts(code,name))').order('entry_date', { ascending: false }).limit(30)]);
  return (<><PageHeader title="Journal entries" description="Manual double-entry postings. Fee and expense cash movements are already in the cash book automatically." back={{ href: '/finance', label: 'Finance' }} />
    {can(ctx, 'finance.create') && <Card className="mb-5"><CardHeader title="New entry" /><CardBody><JournalForm today={todayISO()} accounts={(gl ?? []).map((a: any) => ({ value: a.id, label: `${a.code} · ${a.name}` }))} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} /></CardBody></Card>}
    <Card>{(entries ?? []).length === 0 ? <EmptyState title="No journal entries" /> : <TableWrap><thead><tr><Th>No.</Th><Th>Date</Th><Th>Memo / lines</Th><Th className="text-end">Amount</Th></tr></thead><tbody>{(entries ?? []).map((e: any) => <tr key={e.id} className="align-top"><Td className="tabular text-muted">{e.entry_no}</Td><Td>{fmtDate(e.entry_date)}</Td><Td>{e.memo}<ul className="mt-1 text-xs text-muted">{e.journal_lines.map((l: any, i: number) => <li key={i}>{Number(l.debit) > 0 ? 'Dr' : '   Cr'} {l.gl_accounts?.code} {l.gl_accounts?.name}</li>)}</ul></Td><Td className="tabular text-end">{pkr(e.journal_lines.reduce((a: number, l: any) => a + Number(l.debit), 0))}</Td></tr>)}</tbody></TableWrap>}</Card></>);
}
