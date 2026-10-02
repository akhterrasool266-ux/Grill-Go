import type { Metadata } from 'next';
import { PortalHome } from '@/components/data/portal-home';
import { PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My school' };

export default async function StudentPortal() {
  const ctx = await requireUser();
  const sb = await createClient();
  return (<><PageHeader title={`Hello, ${ctx.profile.full_name.split(' ')[0]}`} description={ctx.school.name} /><PortalHome sb={sb} studentIds={ctx.studentIds.slice(0, 1)} basePath="/portal/student" /></>);
}
