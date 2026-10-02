import type { Metadata } from 'next';
import { LeaveActions, LeaveForm } from '@/components/data/hr-forms';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { LinkButton } from '@/components/ui/button';
import { can, currentCampus, requireUser } from '@/lib/auth/session';
import { fmtDate, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Leave' };

export default async function LeavePage() {
  const ctx = await requireUser();
  if (!can(ctx, 'leave.view', 'leave.create')) redirect('/forbidden');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  let q = sb.from('leave_requests').select('id,requester_type,staff_id,from_date,to_date,days,status,reason,decision_note,staff(full_name),students(full_name),leave_types(name)').order('created_at', { ascending: false }).limit(60);
  if (campus) q = q.eq('campus_id', campus);
  const [{ data: reqs }, { data: types }] = await Promise.all([q, sb.from('leave_types').select('id,name').order('name')]);
  const rows = (reqs ?? []) as any[];
  const pending = rows.filter((r) => r.status === 'pending' && can(ctx, 'leave.approve'));
  return (
    <>
      <PageHeader title="Leave" actions={can(ctx, 'leave.approve') ? <LinkButton variant="secondary" href="/manage/leave-types">Leave types</LinkButton> : undefined} />
      {can(ctx, 'leave.create') && ctx.staffId && <Card className="mb-5"><CardHeader title="Request leave" /><CardBody><LeaveForm types={(types ?? []).map((t: any) => ({ value: t.id, label: t.name }))} /></CardBody></Card>}
      {pending.length > 0 && <Card className="mb-5"><CardHeader title={`Waiting for your decision (${pending.length})`} /><ul className="divide-y divide-line">{pending.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><div><p className="font-medium">{r.staff?.full_name ?? r.students?.full_name} <span className="font-normal text-muted">· {r.leave_types?.name ?? 'Student leave'}</span></p><p className="text-muted">{fmtDate(r.from_date)} – {fmtDate(r.to_date)} ({r.days} day{r.days === 1 ? '' : 's'}) — {r.reason}</p></div><LeaveActions id={r.id} canDecide mine={r.staff_id === ctx.staffId} /></li>)}</ul></Card>}
      <Card><CardHeader title="All requests" />{rows.length === 0 ? <EmptyState title="No leave requests" /> : <TableWrap><thead><tr><Th>Who</Th><Th>Type</Th><Th>Dates</Th><Th className="text-end">Days</Th><Th>Status</Th><Th><span className="sr-only">Actions</span></Th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><Td>{r.staff?.full_name ?? r.students?.full_name}</Td><Td>{r.leave_types?.name ?? 'Student'}</Td><Td>{fmtDate(r.from_date)} – {fmtDate(r.to_date)}</Td><Td className="tabular text-end">{r.days}</Td><Td><Badge tone={statusTone(r.status)}>{titleCase(r.status)}</Badge>{r.decision_note && <span className="block text-xs text-muted">{r.decision_note}</span>}</Td><Td>{r.status === 'pending' && r.staff_id === ctx.staffId ? <LeaveActions id={r.id} canDecide={false} mine /> : null}</Td></tr>)}
      </tbody></TableWrap>}</Card>
    </>
  );
}
