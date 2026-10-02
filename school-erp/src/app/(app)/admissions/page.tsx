import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionButton } from '@/components/ui/confirm-form';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader, TableWrap, Td, Th, Stat, statusTone } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import { convertEnquiry } from '@/app/actions/admissions';
import { cn } from '@/components/ui/cn';

export const metadata: Metadata = { title: 'Admissions' };
const STAGES = ['application', 'document_verification', 'test_interview', 'approval', 'waitlisted', 'admitted', 'rejected'];

export default async function AdmissionsPage({ searchParams }: { searchParams: Promise<{ stage?: string; view?: string }> }) {
  const ctx = await requirePerm('admissions.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const view = sp.view === 'enquiries' ? 'enquiries' : 'applications';
  let cq = sb.from('admissions').select('stage');
  if (campus) cq = cq.eq('campus_id', campus);
  const { data: all } = await cq;
  const counts = (all ?? []).reduce<Record<string, number>>((a, r: any) => ({ ...a, [r.stage]: (a[r.stage] ?? 0) + 1 }), {});
  const stage = sp.stage && STAGES.includes(sp.stage) ? sp.stage : 'all';

  let apps: any[] = [], enq: any[] = [];
  if (view === 'applications') {
    let q = sb.from('admissions').select('id,application_no,full_name,phone,stage,type,created_at,source,classes(name)').order('created_at', { ascending: false }).limit(100);
    if (campus) q = q.eq('campus_id', campus);
    if (stage !== 'all') q = q.eq('stage', stage); else q = q.not('stage', 'in', '(admitted,rejected,withdrawn)');
    apps = (await q).data ?? [];
  } else {
    let q = sb.from('enquiries').select('id,enquiry_no,child_name,guardian_name,phone,status,followup_date,source,converted_admission_id,classes(name)').order('created_at', { ascending: false }).limit(100);
    if (campus) q = q.eq('campus_id', campus);
    enq = (await q).data ?? [];
  }
  return (
    <>
      <PageHeader title="Admissions" description="Enquiry → application → documents → test/interview → approval → student."
        actions={<>{can(ctx, 'admissions.view') && <LinkButton variant="secondary" href="/manage/enquiries/new">+ Enquiry</LinkButton>}{can(ctx, 'admissions.create') && <LinkButton href="/admissions/new">+ Application</LinkButton>}</>} />
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="In progress" value={(counts.application ?? 0) + (counts.document_verification ?? 0) + (counts.test_interview ?? 0) + (counts.approval ?? 0)} /><Stat label="Awaiting approval" value={counts.approval ?? 0} tone="warn" /><Stat label="Admitted" value={counts.admitted ?? 0} tone="ok" /><Stat label="Waitlisted" value={counts.waitlisted ?? 0} /></section>
      <div className="no-print scroll-x mb-4 flex gap-2 text-sm"><Link href="/admissions" className={cn('rounded-full border px-3.5 py-1.5 font-medium', view === 'applications' ? 'border-brand bg-brand-soft text-brand' : 'border-line')}>Applications</Link><Link href="/admissions?view=enquiries" className={cn('rounded-full border px-3.5 py-1.5 font-medium', view === 'enquiries' ? 'border-brand bg-brand-soft text-brand' : 'border-line')}>Enquiries</Link></div>
      {view === 'applications' && <div className="scroll-x mb-4 flex gap-2 text-sm">{['all', ...STAGES].map((s) => <Link key={s} href={`/admissions?stage=${s}`} className={cn('whitespace-nowrap rounded-full border px-3 py-1', stage === s ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted')}>{titleCase(s)}{s !== 'all' && counts[s] ? ` · ${counts[s]}` : ''}</Link>)}</div>}
      <Card>
        {view === 'applications' ? (apps.length === 0 ? <EmptyState title="No applications here" action={can(ctx, 'admissions.create') ? <LinkButton href="/admissions/new">+ Application</LinkButton> : undefined} /> : (
          <TableWrap><thead><tr><Th>Applicant</Th><Th>Class</Th><Th className="hidden sm:table-cell">Phone</Th><Th className="hidden md:table-cell">Received</Th><Th>Stage</Th></tr></thead><tbody>
            {apps.map((a) => <tr key={a.id} className="hover:bg-surface-2/50"><Td><Link className="font-medium text-brand hover:underline" href={`/admissions/${a.id}`}>{a.full_name}</Link><span className="block text-xs text-muted">{a.application_no} · {titleCase(a.type)}{a.source === 'online' ? ' · online' : ''}</span></Td><Td>{a.classes?.name}</Td><Td className="hidden sm:table-cell">{a.phone}</Td><Td className="hidden md:table-cell">{fmtDate(a.created_at)}</Td><Td><Badge tone={statusTone(a.stage)}>{titleCase(a.stage)}</Badge></Td></tr>)}
          </tbody></TableWrap>))
        : (enq.length === 0 ? <EmptyState title="No enquiries yet" action={<LinkButton href="/manage/enquiries/new">+ Enquiry</LinkButton>} /> : (
          <TableWrap><thead><tr><Th>Child</Th><Th>Class</Th><Th>Parent</Th><Th className="hidden sm:table-cell">Follow-up</Th><Th>Status</Th><Th><span className="sr-only">Action</span></Th></tr></thead><tbody>
            {enq.map((e) => <tr key={e.id}><Td><Link className="font-medium text-brand hover:underline" href={`/manage/enquiries/${e.id}`}>{e.child_name}</Link><span className="block text-xs text-muted">{e.enquiry_no}</span></Td><Td>{e.classes?.name}</Td><Td>{e.guardian_name}<span className="block text-xs text-muted">{e.phone}</span></Td><Td className="hidden sm:table-cell">{fmtDate(e.followup_date)}</Td><Td><Badge tone={statusTone(e.status === 'converted' ? 'admitted' : e.status === 'lost' ? 'rejected' : 'pending')}>{titleCase(e.status)}</Badge></Td>
              <Td className="text-end">{!e.converted_admission_id && e.status !== 'lost' && can(ctx, 'admissions.create') ? <ActionButton action={convertEnquiry} data={{ id: e.id }} variant="soft">Start application</ActionButton> : e.converted_admission_id ? <Link className="text-sm text-brand hover:underline" href={`/admissions/${e.converted_admission_id}`}>Open</Link> : null}</Td></tr>)}
          </tbody></TableWrap>))}
      </Card>
    </>
  );
}
