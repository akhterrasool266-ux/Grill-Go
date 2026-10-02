import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateSchoolForm } from '@/components/data/platform-forms';
import { Badge, Card, CardBody, CardHeader, PageHeader, TableWrap, Td, Th, statusTone } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Platform · Schools' };

export default async function PlatformHome() {
  const db = createAdminClient();
  const [schools, plans, subs, studs] = await Promise.all([
    db.from('schools').select('id,name,slug,status,created_at').order('created_at', { ascending: false }),
    db.from('plans').select('id,name').eq('is_active', true).order('name'),
    db.from('subscriptions').select('school_id,status,current_period_end,plans(name)'),
    db.from('students').select('school_id').eq('status', 'active').limit(100000),
  ]);
  const sub = new Map((subs.data ?? []).map((s: any) => [s.school_id, s]));
  const count = new Map<string, number>(); for (const s of studs.data ?? []) count.set(s.school_id, (count.get(s.school_id) ?? 0) + 1);
  return (
    <>
      <PageHeader title="Schools" description="Every school on this installation." />
      <Card><TableWrap><thead><tr><Th>School</Th><Th>Status</Th><Th>Plan</Th><Th className="text-end">Active students</Th><Th>Paid until</Th><Th>Created</Th></tr></thead><tbody>
        {(schools.data ?? []).map((s) => { const sb: any = sub.get(s.id); return (
          <tr key={s.id}><Td><Link className="font-medium text-brand hover:underline" href={`/platform/schools/${s.id}`}>{s.name}</Link><div className="text-xs text-muted">/site/{s.slug}</div></Td><Td><Badge tone={statusTone(s.status)}>{s.status}</Badge></Td>
            <Td>{sb ? <>{sb.plans?.name} <Badge tone={statusTone(sb.status)}>{sb.status}</Badge></> : <span className="text-muted">Unmetered</span>}</Td><Td className="text-end">{count.get(s.id) ?? 0}</Td><Td>{sb?.current_period_end ? fmtDate(sb.current_period_end) : '—'}</Td><Td>{fmtDate(s.created_at)}</Td></tr>); })}
      </tbody></TableWrap></Card>
      <Card><CardHeader title="Create a school" description="Creates the school, its first campus, default roles and the owner's login. The owner gets a temporary password shown once." /><CardBody><CreateSchoolForm plans={(plans.data ?? []).map((p) => ({ value: p.id, label: p.name }))} /></CardBody></Card>
    </>
  );
}
