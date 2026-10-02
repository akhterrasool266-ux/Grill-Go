import type { Metadata } from 'next';
import { NotifPrefs, ProfileForm } from '@/components/data/settings-forms';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My profile' };
const EVENTS: [string, string][] = [['absence_alert', 'Absence alerts'], ['fee_receipt', 'Fee receipts'], ['fee_reminder', 'Fee reminders'], ['result_published', 'Results'], ['announcement', 'Announcements'], ['homework', 'Homework']];

export default async function ProfilePage() {
  const ctx = await requireUser();
  const sb = await createClient();
  const { data } = await sb.from('notification_preferences').select('channel,event_key,enabled');
  const initial = Object.fromEntries((data ?? []).map((p: any) => [`${p.channel}:${p.event_key}`, p.enabled]));
  return (<><PageHeader title="My profile" back={{ href: '/settings', label: 'Settings' }} />
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Details" /><CardBody><ProfileForm p={ctx.profile} /><p className="mt-4 text-sm text-muted">Roles: {ctx.roles.join(', ') || '—'}. To change your password use “Forgot password” on the sign-in page.</p></CardBody></Card>
      <Card><CardHeader title="How should we notify you?" /><CardBody><NotifPrefs channels={['in_app', 'email', 'push']} events={EVENTS} initial={initial} /><p className="mt-3 text-xs text-muted">WhatsApp and SMS messages to parents follow the school&apos;s rules under Settings → Notifications.</p></CardBody></Card></div></>);
}
