import type { Metadata } from 'next';
import Link from 'next/link';
import { MarkAllRead } from '@/components/data/ops-forms';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { fmtDateTime } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  await requireUser();
  const sb = await createClient();
  const { data } = await sb.from('notifications').select('id,title,body,level,link,read_at,created_at').order('created_at', { ascending: false }).limit(60);
  const unread = (data ?? []).filter((n: any) => !n.read_at).length;
  return (
    <>
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : 'You are all caught up'} actions={unread ? <MarkAllRead /> : undefined} />
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No notifications yet" hint="Absence alerts, fee receipts, results and announcements appear here." /> : <ul className="divide-y divide-line">{(data ?? []).map((n: any) => (
        <li key={n.id} className={`p-4 text-sm ${n.read_at ? '' : 'bg-brand-soft/30'}`}><div className="flex items-center gap-2"><Badge tone={n.level === 'urgent' ? 'bad' : n.level === 'warning' ? 'warn' : n.level === 'success' ? 'ok' : 'neutral'}>{n.level}</Badge><p className="font-medium">{n.link ? <Link className="hover:underline" href={n.link}>{n.title}</Link> : n.title}</p><span className="ms-auto text-xs text-muted">{fmtDateTime(n.created_at)}</span></div>{n.body && <p className="mt-1 text-muted">{n.body}</p>}</li>))}</ul>}</Card>
      <p className="mt-4 text-sm text-muted">Choose which channels you want under <Link href="/settings/profile" className="text-brand hover:underline">Settings → Profile</Link>.</p>
    </>
  );
}
