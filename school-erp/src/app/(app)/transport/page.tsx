import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { can, currentCampus, requirePerm } from '@/lib/auth/session';
import { fmtDate, pkr, todayISO } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Transport' };

export default async function TransportPage() {
  const ctx = await requirePerm('transport.view');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const fx = (t: string) => { let q = sb.from(t).select('*'); if (campus) q = q.eq('campus_id', campus); return q; };
  const today = todayISO(), soon = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  const [{ data: routes }, { data: assign }, { data: vehicles }, { data: drivers }, { data: trips }] = await Promise.all([
    (() => { let q = sb.from('routes').select('id,name,monthly_fee,is_active,vehicles(reg_no,capacity),drivers(full_name,phone)'); if (campus) q = q.eq('campus_id', campus); return q.order('name'); })(),
    (() => { let q = sb.from('student_transport').select('route_id').eq('is_active', true); if (campus) q = q.eq('campus_id', campus); return q; })(),
    fx('vehicles'), fx('drivers'),
    (() => { let q = sb.from('route_attendance').select('route_id,status,trip').eq('date', today); if (campus) q = q.eq('campus_id', campus); return q; })(),
  ]);
  const count = (id: string) => (assign ?? []).filter((a: any) => a.route_id === id).length;
  const expiring = [
    ...((vehicles ?? []) as any[]).flatMap((v) => [['Fitness', v.fitness_expiry, v.reg_no], ['Insurance', v.insurance_expiry, v.reg_no]].filter(([, d]) => d && d <= soon).map(([k, d, n]) => ({ what: `${n} · ${k}`, d }))),
    ...((drivers ?? []) as any[]).filter((d) => d.license_expiry && d.license_expiry <= soon).map((d) => ({ what: `${d.full_name} · Licence`, d: d.license_expiry })),
  ];
  return (
    <>
      <PageHeader title="Transport" description="Routes, vehicles, drivers and which children ride where."
        actions={can(ctx, 'transport.create') ? <><LinkButton variant="secondary" href="/manage/vehicles">Vehicles</LinkButton><LinkButton variant="secondary" href="/manage/drivers">Drivers</LinkButton><LinkButton variant="secondary" href="/manage/route-stops">Stops</LinkButton><LinkButton variant="secondary" href="/manage/student-transport">Assign students</LinkButton><LinkButton href="/manage/routes/new">+ Route</LinkButton></> : undefined} />
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Routes" value={(routes ?? []).length} /><Stat label="Vehicles" value={(vehicles ?? []).length} /><Stat label="Children riding" value={(assign ?? []).length} /><Stat label="Trips logged today" value={(trips ?? []).length} /></section>
      {expiring.length > 0 && <Card className="mb-5"><CardHeader title="Expiring within 45 days" /><ul className="divide-y divide-line">{expiring.map((e, i) => <li key={i} className="flex justify-between p-3.5 text-sm"><span>{e.what}</span><Badge tone={e.d < today ? 'bad' : 'warn'}>{e.d < today ? 'Expired ' : ''}{fmtDate(e.d)}</Badge></li>)}</ul></Card>}
      <Card><CardHeader title="Routes" />{(routes ?? []).length === 0 ? <EmptyState title="No routes yet" /> : <TableWrap><thead><tr><Th>Route</Th><Th>Vehicle</Th><Th className="hidden sm:table-cell">Driver</Th><Th className="text-end">Riders</Th><Th className="hidden sm:table-cell text-end">Fee</Th></tr></thead><tbody>
        {(routes ?? []).map((r: any) => <tr key={r.id}><Td><Link className="font-medium text-brand hover:underline" href={`/manage/routes/${r.id}`}>{r.name}</Link></Td><Td>{r.vehicles?.reg_no ?? '—'}</Td><Td className="hidden sm:table-cell">{r.drivers?.full_name ?? '—'}</Td><Td className="tabular text-end">{count(r.id)}{r.vehicles?.capacity ? <span className="text-muted"> / {r.vehicles.capacity}</span> : ''}</Td><Td className="hidden tabular text-end sm:table-cell">{pkr(r.monthly_fee)}</Td></tr>)}
      </tbody></TableWrap>}</Card>
      <p className="mt-4 text-sm text-muted">Live GPS tracking is not connected: vehicles have a GPS device field and a <code>vehicle_positions</code> table ready for a provider integration.</p>
    </>
  );
}
