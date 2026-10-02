import type { Metadata } from 'next';
import Link from 'next/link';
import { IssueForm, LoanActions } from '@/components/data/ops-forms';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Library' };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requirePerm('library.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const today = todayISO();
  let lq = sb.from('library_transactions').select('id,issued_on,due_on,status,renewals,library_books(title),students(full_name,student_code),staff(full_name,employee_code)').eq('status', 'issued').order('due_on');
  let bq = sb.from('library_books').select('id,title,available').gt('available', 0).order('title').limit(500);
  if (campus) { lq = lq.eq('campus_id', campus); bq = bq.eq('campus_id', campus); }
  const [{ data: loans }, { data: books }] = await Promise.all([lq, bq]);
  const all = (loans ?? []) as any[];
  const overdue = all.filter((l) => l.due_on < today);
  const shown = sp.view === 'overdue' ? overdue : all;
  return (
    <>
      <PageHeader title="Library" actions={<><LinkButton variant="secondary" href="/manage/library-books">Books</LinkButton>{can(ctx, 'library.create') && <LinkButton href="/manage/library-books/new">+ Book</LinkButton>}</>} />
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label="Books out" value={all.length} /><Stat label="Overdue" value={overdue.length} tone={overdue.length ? 'bad' : 'ok'} href="/library?view=overdue" /></section>
      {can(ctx, 'library.create') && <Card className="mb-5"><CardHeader title="Issue a book" /><CardBody><IssueForm books={(books ?? []).map((b: any) => ({ value: b.id, label: `${b.title} (${b.available} left)` }))} /></CardBody></Card>}
      <Card><CardHeader title={sp.view === 'overdue' ? 'Overdue books' : 'Books currently issued'} action={sp.view ? <Link className="text-sm text-brand hover:underline" href="/library">Show all</Link> : undefined} />
        {shown.length === 0 ? <EmptyState title="Nothing here" /> : <TableWrap><thead><tr><Th>Book</Th><Th>Borrower</Th><Th>Due</Th><Th><span className="sr-only">Actions</span></Th></tr></thead><tbody>
          {shown.map((l) => <tr key={l.id}><Td className="font-medium">{l.library_books?.title}</Td><Td>{l.students?.full_name ?? l.staff?.full_name}<span className="block text-xs text-muted">{l.students?.student_code ?? l.staff?.employee_code}</span></Td><Td><Badge tone={l.due_on < today ? 'bad' : 'neutral'}>{fmtDate(l.due_on)}</Badge></Td><Td className="text-end">{can(ctx, 'library.edit') && <LoanActions id={l.id} />}</Td></tr>)}
        </tbody></TableWrap>}
      </Card>
    </>
  );
}
