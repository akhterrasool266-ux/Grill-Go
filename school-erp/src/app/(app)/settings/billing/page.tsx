import type { Metadata } from 'next';
import { Alert, Badge, Card, CardHeader, PageHeader, TableWrap, Td, Th } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';
import { fmtDate, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Subscription' };

export default async function BillingPage() {
  const ctx = await requirePerm('billing.view');
  const sb = await createClient();
  const { data: sub } = await sb.from('subscriptions').select('status,trial_ends_at,current_period_end,limits_override,plans(name,code,price_pkr_monthly,limits,features)').maybeSingle();
  const period = new Date().toISOString().slice(0, 7) + '-01';
  const [st, sf, cp, { data: usage }] = await Promise.all([sb.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'), sb.from('staff').select('id', { count: 'exact', head: true }).eq('status', 'active'), sb.from('campuses').select('id', { count: 'exact', head: true }).eq('is_active', true), sb.from('usage_counters').select('metric,value').eq('period', period)]);
  const used: Record<string, number> = { students: st.count ?? 0, staff: sf.count ?? 0, campuses: cp.count ?? 0, ...Object.fromEntries((usage ?? []).map((u: any) => [u.metric, Number(u.value)])) };
  const plan = (sub as any)?.plans;
  const limits = { ...(plan?.limits ?? {}), ...((sub as any)?.limits_override ?? {}) } as Record<string, number>;
  const metrics = ['students', 'staff', 'campuses', 'whatsapp_messages', 'sms', 'ai_requests'];
  return (<><PageHeader title="Subscription & usage" description={ctx.school.name} back={{ href: '/settings', label: 'Settings' }} />
    {!sub ? <Alert tone="info" title="Unmetered">This school has no subscription record, so no plan limits are applied (self-hosted mode).</Alert> : <div className="mb-4 flex flex-wrap items-center gap-3"><Badge tone="brand" className="text-sm">{plan?.name}</Badge><Badge tone={sub.status === 'active' || sub.status === 'trialing' ? 'ok' : 'bad'}>{titleCase(sub.status)}</Badge>{sub.trial_ends_at && <span className="text-sm text-muted">Trial ends {fmtDate(sub.trial_ends_at)}</span>}{sub.current_period_end && <span className="text-sm text-muted">Renews {fmtDate(sub.current_period_end)}</span>}</div>}
    <Card><CardHeader title="Usage this month" /><TableWrap><thead><tr><Th>Item</Th><Th className="text-end">Used</Th><Th className="text-end">Limit</Th></tr></thead><tbody>{metrics.map((m) => <tr key={m}><Td>{titleCase(m)}</Td><Td className="tabular text-end">{(used[m] ?? 0).toLocaleString()}</Td><Td className="tabular text-end">{limits[m] === undefined ? 'Unlimited' : limits[m]!.toLocaleString()}</Td></tr>)}</tbody></TableWrap></Card>
    <p className="mt-4 text-sm text-muted">Limits are enforced in one place (the database and the message dispatcher). Plan changes are made by the platform operator.</p></>);
}
