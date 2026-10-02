import type { Metadata } from 'next';
import { GenerateForm } from '@/components/data/fees-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';
import { todayISO } from '@/lib/format';
import { classSectionOptions } from '@/lib/lookups';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Generate vouchers' };

export default async function GeneratePage() {
  const ctx = await requirePerm('fees.create');
  const campus = await currentCampus(ctx);
  const sb = await createClient();
  const [opts, { data: cats }] = await Promise.all([classSectionOptions(sb, campus), sb.from('fee_categories').select('id,name,kind').eq('is_active', true).order('name')]);
  const today = todayISO();
  const due = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="Generate fee vouchers" back={{ href: '/fees', label: 'Fees' }} />
      <Card><CardBody>
        <GenerateForm classes={opts.classes} categories={(cats ?? []).filter((c: any) => c.kind !== 'monthly').map((c: any) => ({ value: c.id, label: c.name }))}
          campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} month={today.slice(0, 7)} due={due} />
      </CardBody></Card>
    </>
  );
}
