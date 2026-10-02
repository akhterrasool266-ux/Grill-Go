import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Exams' };

export default async function ExamsPage() {
  const ctx = await requirePerm('exams.view');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  let q = sb.from('exams').select('id,name,kind,status,start_date,end_date,campuses(name)').order('start_date', { ascending: false, nullsFirst: true });
  if (campus) q = q.eq('campus_id', campus);
  const { data } = await q;
  return (
    <>
      <PageHeader title="Exams" description="Schedule papers, enter marks, generate and publish result cards."
        actions={<>{can(ctx, 'exams.manage', 'exams.create') && <LinkButton variant="secondary" href="/manage/grading-systems">Grading</LinkButton>}{can(ctx, 'exams.create') && <LinkButton href="/exams/new">+ New exam</LinkButton>}</>} />
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No exams yet" action={can(ctx, 'exams.create') ? <LinkButton href="/exams/new">+ New exam</LinkButton> : undefined} /> : (
        <TableWrap><thead><tr><Th>Exam</Th><Th>Type</Th><Th className="hidden sm:table-cell">Dates</Th><Th className="hidden md:table-cell">Campus</Th><Th>Status</Th></tr></thead><tbody>
          {(data ?? []).map((e: any) => <tr key={e.id} className="hover:bg-surface-2/50"><Td><Link href={`/exams/${e.id}`} className="font-medium text-brand hover:underline">{e.name}</Link></Td><Td>{titleCase(e.kind)}</Td><Td className="hidden sm:table-cell">{fmtDate(e.start_date)} – {fmtDate(e.end_date)}</Td><Td className="hidden md:table-cell">{e.campuses?.name}</Td><Td><Badge tone={statusTone(e.status)}>{titleCase(e.status)}</Badge></Td></tr>)}
        </tbody></TableWrap>)}</Card>
    </>
  );
}
