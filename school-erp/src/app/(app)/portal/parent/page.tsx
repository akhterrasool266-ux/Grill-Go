import type { Metadata } from 'next';
import { PortalHome } from '@/components/data/portal-home';
import { PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My children' };

export default async function ParentPortal({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const sb = await createClient();
  return (<><PageHeader title={`Assalam o Alaikum, ${ctx.profile.full_name.split(' ')[0]}`} description={ctx.school.name} /><PortalHome sb={sb} studentIds={ctx.studentIds} child={sp.child} basePath="/portal/parent" /></>);
}
