import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, Pagination, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { pct, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Result cards' };
const PAGE = 30;

export default async function ResultsList({ searchParams }: { searchParams: Promise<{ exam?: string; class?: string; page?: string }> }) {
  await requirePerm('results.view');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  const { data: exams } = await sb.from('exams').select('id,name').order('created_at', { ascending: false }).limit(30);
  const examId = sp.exam ?? exams?.[0]?.id;
  let q = sb.from('result_cards').select('id,total_obtained,total_max,percentage,grade,position,result_status,is_published,students(full_name,student_code),classes(name),sections(name)', { count: 'exact' });
  if (examId) q = q.eq('exam_id', examId);
  const { data, count } = await q.order('percentage', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  return (
    <>
      <PageHeader title="Result cards" />
      <form className="mb-4 flex gap-2"><select name="exam" defaultValue={examId} className="input w-72">{(exams ?? []).map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}</select><button className="rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-fg">Show</button></form>
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No result cards for this exam yet" hint="Generate results from the exam page." /> : (<>
        <TableWrap><thead><tr><Th>Student</Th><Th>Class</Th><Th className="text-end">Marks</Th><Th className="text-end">%</Th><Th>Grade</Th><Th>Pos.</Th><Th>Result</Th></tr></thead><tbody>
          {(data ?? []).map((r: any) => <tr key={r.id} className="hover:bg-surface-2/50"><Td><Link className="font-medium text-brand hover:underline" href={`/results/${r.id}`}>{r.students?.full_name}</Link><span className="block text-xs text-muted">{r.students?.student_code}</span></Td><Td>{r.classes?.name} {r.sections?.name}</Td><Td className="tabular text-end">{r.total_obtained}/{r.total_max}</Td><Td className="tabular text-end">{pct(r.percentage)}</Td><Td>{r.grade ?? '—'}</Td><Td>{r.position ?? '—'}</Td><Td><Badge tone={statusTone(r.result_status)}>{titleCase(r.result_status)}</Badge>{!r.is_published && <Badge tone="warn" className="ms-1">Draft</Badge>}</Td></tr>)}
        </tbody></TableWrap><Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/results?exam=${examId}&page=${p}`} /></>)}</Card>
    </>
  );
}
