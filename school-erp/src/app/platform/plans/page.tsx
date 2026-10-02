import type { Metadata } from 'next';
import { PlanForm } from '@/components/data/platform-forms';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Platform · Plans' };

export default async function PlansPage() {
  const { data } = await createAdminClient().from('plans').select('*').order('price_pkr_monthly');
  return (
    <>
      <PageHeader title="Plans" description="Limits are enforced by the database (students, staff, campuses) and the message sender. An empty limit means unlimited." />
      {(data ?? []).map((p) => <Card key={p.id}><CardHeader title={`${p.name} (${p.code})`} /><CardBody><PlanForm plan={p} /></CardBody></Card>)}
      <Card><CardHeader title="Add a plan" /><CardBody><PlanForm /></CardBody></Card>
    </>
  );
}
