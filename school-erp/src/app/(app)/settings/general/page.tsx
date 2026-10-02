import type { Metadata } from 'next';
import { LogoForm, SchoolForm } from '@/components/data/settings-forms';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { getSchoolInfo, logoUrl } from '@/lib/school';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'School profile' };

export default async function GeneralSettings() {
  const ctx = await requirePerm('settings.view');
  const sb = await createClient();
  const { data: s } = await sb.from('schools').select('*').eq('id', ctx.school.id).single();
  const info = await getSchoolInfo(sb, ctx.school.id);
  const logo = logoUrl(info);
  return (<><PageHeader title="School profile" back={{ href: '/settings', label: 'Settings' }} />
    <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader title="Details" /><CardBody>{can(ctx, 'settings.edit') ? <SchoolForm s={s as never} /> : <p className="text-sm text-muted">You can view but not change these.</p>}</CardBody></Card>
      <Card className="self-start"><CardHeader title="Logo" description="Printed on vouchers, receipts, result cards and ID cards." /><CardBody className="space-y-3">{logo /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={logo} alt="School logo" className="size-24 rounded-lg border border-line object-contain" /> : <p className="text-sm text-muted">No logo uploaded yet — initials are used.</p>}{can(ctx, 'settings.edit') && <LogoForm />}</CardBody></Card></div></>);
}
