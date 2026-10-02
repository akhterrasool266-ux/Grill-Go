import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, PageHeader, Stat } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Hostel' };

export default async function HostelPage() {
  const ctx = await requirePerm('hostel.view');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const rq = (t: string) => { let q = sb.from(t).select('*', { count: 'exact', head: true }); if (campus) q = q.eq('campus_id', campus); return q; };
  const [b, r, a, vis, { data: rooms }] = await Promise.all([rq('hostel_buildings'), rq('hostel_rooms'), rq('hostel_allocations').eq('status', 'active'), rq('hostel_visitors').is('out_time', null), (() => { let q = sb.from('hostel_rooms').select('capacity'); if (campus) q = q.eq('campus_id', campus); return q; })()]);
  const beds = (rooms ?? []).reduce((x: number, y: any) => x + y.capacity, 0);
  const links = [['Buildings', '/manage/hostel-buildings'], ['Rooms', '/manage/hostel-rooms'], ['Allocations', '/manage/hostel-allocations'], ['Visitors', '/manage/hostel-visitors']];
  return (<><PageHeader title="Hostel" description="Buildings, rooms and beds, who sleeps where, and visitors. Hostel fees are added to the monthly voucher automatically." /><section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Buildings" value={b.count ?? 0} /><Stat label="Rooms" value={r.count ?? 0} /><Stat label="Occupancy" value={`${a.count ?? 0} / ${beds}`} /><Stat label="Visitors inside" value={vis.count ?? 0} /></section><div className="grid gap-3 sm:grid-cols-4">{links.map(([t, h]) => <Link key={h} href={h!}><Card className="p-4 font-medium hover:border-brand/50">{t}</Card></Link>)}</div><p className="mt-4 text-sm text-muted">Not built: separate hostel attendance (night roll-call). Use the main attendance register for now.</p></>);
}
