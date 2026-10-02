import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FlagRow, StatusForm, SubscriptionForm } from '@/components/data/platform-forms';
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { fmtDateTime, titleCase } from '@/lib/format';
import { FEATURES } from '@/lib/platform';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Platform · School' };

export default async function SchoolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; tp?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const db = createAdminClient();
  const period = new Date().toISOString().slice(0, 7) + '-01';
  const [{ data: school }, { data: plans }, { data: sub }, { data: flags }, { data: usage }, { data: tickets }, st, sf] = await Promise.all([
    db.from('schools').select('*').eq('id', id).maybeSingle(), db.from('plans').select('id,name').order('name'), db.from('subscriptions').select('*').eq('school_id', id).maybeSingle(),
    db.from('feature_flags').select('key,enabled').eq('school_id', id), db.from('usage_counters').select('metric,value').eq('school_id', id).eq('period', period),
    db.from('support_tickets').select('id,subject,priority,status,created_at').eq('school_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('students').select('id', { count: 'exact', head: true }).eq('school_id', id).eq('status', 'active'), db.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', id).eq('status', 'active'),
  ]);
  if (!school) notFound();
  const mode = (k: string) => { const f = (flags ?? []).find((x) => x.key === k); return f ? (f.enabled ? 'on' : 'off') : 'inherit'; };
  return (
    <>
      <PageHeader title={school.name} description={`/site/${school.slug} · created ${fmtDateTime(school.created_at)}`} back={{ href: '/platform', label: 'Schools' }} />
      {sp.created && sp.tp && <Alert tone="ok" title="School created">Owner temporary password: <b>{sp.tp}</b> — copy it now and send it privately. It is not shown again, and the owner must change it at first sign-in.</Alert>}
      <Card><CardHeader title="Status" /><CardBody><StatusForm id={school.id} status={school.status} /></CardBody></Card>
      <Card><CardHeader title="Subscription" description={`Active students: ${st.count ?? 0} · Active staff: ${sf.count ?? 0}`} /><CardBody><SubscriptionForm schoolId={school.id} plans={(plans ?? []).map((p) => ({ value: p.id, label: p.name }))} sub={sub} /></CardBody></Card>
      <Card><CardHeader title="Feature switches" description="Follow plan = whatever the plan says. Force on/off overrides it for this school." /><CardBody className="grid gap-3 sm:grid-cols-2">{FEATURES.map((k) => <div key={k} className="flex items-center justify-between gap-3"><span className="text-sm">{titleCase(k)}</span><FlagRow schoolId={school.id} k={k} mode={mode(k) as 'on'} /></div>)}</CardBody></Card>
      <Card><CardHeader title="Usage this month" /><TableWrap><thead><tr><Th>Metric</Th><Th className="text-end">Used</Th></tr></thead><tbody>{(usage ?? []).length === 0 ? <tr><Td colSpan={2} className="text-muted">Nothing metered yet.</Td></tr> : (usage ?? []).map((u) => <tr key={u.metric}><Td>{titleCase(u.metric)}</Td><Td className="text-end">{Number(u.value).toLocaleString()}</Td></tr>)}</tbody></TableWrap></Card>
      <Card><CardHeader title="Support tickets" /><TableWrap><thead><tr><Th>Subject</Th><Th>Priority</Th><Th>Status</Th><Th>Opened</Th></tr></thead><tbody>{(tickets ?? []).length === 0 ? <tr><Td colSpan={4} className="text-muted">No tickets.</Td></tr> : (tickets ?? []).map((t) => <tr key={t.id}><Td>{t.subject}</Td><Td><Badge tone={t.priority === 'urgent' || t.priority === 'high' ? 'bad' : 'neutral'}>{t.priority}</Badge></Td><Td><Badge tone={statusTone(t.status)}>{t.status}</Badge></Td><Td>{fmtDateTime(t.created_at)}</Td></tr>)}</tbody></TableWrap></Card>
    </>
  );
}
