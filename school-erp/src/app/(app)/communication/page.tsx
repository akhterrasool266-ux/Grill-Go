import type { Metadata } from 'next';
import Link from 'next/link';
import { ClassMessageForm, RetryButton, SendNowButton } from '@/components/data/comm-forms';
import { LinkButton } from '@/components/ui/button';
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Pagination, Stat, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDateTime, titleCase } from '@/lib/format';
import { classSectionOptions } from '@/lib/lookups';
import { providerFor } from '@/lib/notify/registry';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Communication' };
const PAGE = 30;

export default async function CommunicationPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const ctx = await requirePerm('communication.view');
  const sp = await searchParams;
  const campus = await currentCampus(ctx);
  const page = Math.max(1, Number(sp.page) || 1);
  const sb = await createClient();
  const counts = await Promise.all(['queued', 'sent', 'delivered', 'failed'].map((s) => { let q = sb.from('notification_logs').select('id', { count: 'exact', head: true }).eq('status', s); if (campus) q = q.eq('campus_id', campus); return q; }));
  let q = sb.from('notification_logs').select('id,channel,provider,to_address,template_key,status,error,created_at,students(full_name)', { count: 'exact' });
  if (campus) q = q.eq('campus_id', campus);
  if (sp.status) q = q.eq('status', sp.status);
  const { data, count } = await q.order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const opts = await classSectionOptions(sb, campus);
  const ch = providerFor('whatsapp') ?? providerFor('sms');
  const [queued, sent, delivered, failed] = counts.map((c) => c.count ?? 0);
  return (
    <>
      <PageHeader title="Communication center" description="WhatsApp, SMS and email to parents, in English or Urdu. Status shown is what the provider reported — nothing is faked."
        actions={<>{can(ctx, 'communication.manage') && <><SendNowButton /><RetryButton /></>}<LinkButton variant="secondary" href="/manage/notification-templates">Templates</LinkButton><LinkButton variant="secondary" href="/settings/notifications">Providers</LinkButton></>} />
      {!ch && <div className="mb-4"><Alert tone="warn" title="No WhatsApp or SMS provider is connected">Messages are kept in the outbox and marked “failed — provider not configured” when sending is attempted. Add credentials under Settings → Notifications & integrations (see the README).</Alert></div>}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Waiting" value={queued} tone={queued ? 'warn' : undefined} href="/communication?status=queued" /><Stat label="Sent" value={sent} href="/communication?status=sent" /><Stat label="Delivered" value={delivered} tone="ok" href="/communication?status=delivered" /><Stat label="Failed" value={failed} tone={failed ? 'bad' : undefined} href="/communication?status=failed" /></section>
      {can(ctx, 'communication.create') && <Card className="mb-5"><CardHeader title="Message a class" /><CardBody><ClassMessageForm classes={opts.classes} sections={opts.sectionsFull} campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} /></CardBody></Card>}
      <Card><CardHeader title={sp.status ? `Messages · ${titleCase(sp.status)}` : 'Message log'} action={sp.status ? <Link href="/communication" className="text-sm text-brand hover:underline">Show all</Link> : undefined} />
        {(data ?? []).length === 0 ? <EmptyState title="No messages yet" hint="Absence alerts, fee receipts and reminders will appear here." /> : (<><TableWrap><thead><tr><Th>When</Th><Th>About</Th><Th>To</Th><Th>Channel</Th><Th>Status</Th></tr></thead><tbody>
          {(data ?? []).map((m: any) => <tr key={m.id}><Td className="whitespace-nowrap text-xs">{fmtDateTime(m.created_at)}</Td><Td>{titleCase(m.template_key ?? 'custom')}<span className="block text-xs text-muted">{m.students?.full_name}</span></Td><Td className="text-muted">{m.to_address}</Td><Td>{titleCase(m.channel)}{m.provider && <span className="block text-xs text-muted">{m.provider}</span>}</Td><Td><Badge tone={statusTone(m.status)}>{titleCase(m.status)}</Badge>{m.error && <span className="mt-1 block max-w-[16rem] text-xs text-bad">{m.error}</span>}</Td></tr>)}
        </tbody></TableWrap><Pagination page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(p) => `/communication?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`} /></>)}</Card>
    </>
  );
}
