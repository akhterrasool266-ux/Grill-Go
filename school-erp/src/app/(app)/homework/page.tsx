import type { Metadata } from 'next';
import { DeleteHomework, SubmitHomeworkForm } from '@/components/data/ops-forms';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDate, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Homework' };

export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const ctx = await requireUser();
  if (!can(ctx, 'homework.view') && ctx.studentIds.length === 0) redirect('/forbidden');
  const sp = await searchParams;
  const sb = await createClient();
  let q = sb.from('homework').select('id,title,description,due_date,allow_submission,section_id,subjects(name),sections(name,classes(name)),staff(full_name)').order('due_date', { ascending: false }).limit(60);
  if (sp.section) q = q.eq('section_id', sp.section);
  const { data } = await q;
  const mine = ctx.studentIds[0];
  const { data: subs } = mine ? await sb.from('homework_submissions').select('homework_id,status').eq('student_id', mine) : { data: [] };
  const done = new Set((subs ?? []).map((s: any) => s.homework_id));
  const today = todayISO();
  return (
    <>
      <PageHeader title="Homework" actions={can(ctx, 'homework.create') ? <LinkButton href="/homework/new">+ New homework</LinkButton> : undefined} />
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No homework" /> : <ul className="divide-y divide-line">{(data ?? []).map((h: any) => (
        <li key={h.id} className="space-y-1.5 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{h.title}</p><div className="flex items-center gap-2"><Badge tone={h.due_date < today ? 'neutral' : 'warn'}>Due {fmtDate(h.due_date)}</Badge>{done.has(h.id) && <Badge tone="ok">Submitted</Badge>}{can(ctx, 'homework.delete') && <DeleteHomework id={h.id} />}</div></div>
          <p className="text-muted">{h.sections?.classes?.name} – {h.sections?.name} · {h.subjects?.name ?? 'General'}{h.staff?.full_name ? ` · ${h.staff.full_name}` : ''}</p>
          {h.description && <p>{h.description}</p>}
          {h.allow_submission && mine && !done.has(h.id) && <SubmitHomeworkForm homeworkId={h.id} studentId={mine} />}
        </li>))}</ul>}</Card>
    </>
  );
}
