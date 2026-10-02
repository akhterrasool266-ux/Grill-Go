import type { Metadata } from 'next';
import { RouteRoster } from '@/components/data/route-roster';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My route' };

export default async function MyRoute() {
  await requireUser();
  const sb = await createClient();
  const { data } = await sb.rpc('my_route_roster');
  const rows = ((data ?? []) as any[]).map((r) => ({ route_id: r.route_id, student_id: r.student_id, name: r.student_name, code: r.student_code, cls: r.class_name, stop: r.stop_name, pickup: r.pickup_status, drop: r.drop_status }));
  const name = (data as any[])?.[0]?.route_name;
  return (<><PageHeader title={name ?? 'My route'} description="Mark each child as they board and get off. Parents see this on their portal." />{rows.length === 0 ? <Card><EmptyState title="No children on your route" hint="If this looks wrong, ask the transport manager to link your login to your driver record." /></Card> : <RouteRoster rows={rows} />}</>);
}
