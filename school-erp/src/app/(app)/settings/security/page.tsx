import type { Metadata } from 'next';
import Link from 'next/link';
import { SecuritySettings } from '@/components/data/settings-forms';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { can, requirePerm } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage() {
  const ctx = await requirePerm('settings.view');
  const sb = await createClient();
  const { data } = await sb.from('settings').select('value').eq('key', 'security').maybeSingle();
  return (<><PageHeader title="Security" back={{ href: '/settings', label: 'Settings' }} />
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Policy" /><CardBody><fieldset disabled={!can(ctx, 'settings.edit')}><SecuritySettings v={(data?.value ?? {}) as never} /></fieldset></CardBody></Card>
      <Card><CardHeader title="What is protected" /><CardBody><ul className="list-disc space-y-1.5 ps-5 text-sm">
        <li>Every table is protected by database row-level security — schools and campuses cannot see each other&apos;s data even if a page has a bug.</li>
        <li>Roles are checked on the server for every page and action, never only in the browser.</li>
        <li>Fee, marks, attendance-correction, refund, salary and permission changes are written to an append-only <Link className="text-brand hover:underline" href="/audit">audit log</Link>.</li>
        <li>Student documents are in a private bucket; downloads use 60-second links and are logged.</li>
        <li>Sign-in is rate-limited; password reset never reveals whether an email exists.</li>
        <li>2-step verification: Supabase Auth supports TOTP; enabling it for admins is a project setting (README → Security).</li></ul></CardBody></Card></div></>);
}
