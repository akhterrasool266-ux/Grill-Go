import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { can, requireUser } from '@/lib/auth/session';
import { fmtDateTime, titleCase } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Announcements' };

export default async function AnnouncementsPage() {
  const ctx = await requireUser();
  const sb = await createClient();
  const { data } = await sb.from('announcements').select('id,title,body,audience,level,is_pinned,publish_at,campuses(name)').order('is_pinned', { ascending: false }).order('publish_at', { ascending: false }).limit(50);
  return (
    <>
      <PageHeader title="Announcements" actions={can(ctx, 'announcements.create') ? <><LinkButton variant="secondary" href="/manage/announcements">Manage</LinkButton><LinkButton href="/announcements/new">+ New</LinkButton></> : undefined} />
      <Card>{(data ?? []).length === 0 ? <EmptyState title="No announcements" /> : <ul className="divide-y divide-line">{(data ?? []).map((a: any) => (
        <li key={a.id} className="space-y-1 p-4 text-sm"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{a.is_pinned && '📌 '}{a.title}</p><Badge tone={a.level === 'urgent' ? 'bad' : a.level === 'warning' ? 'warn' : 'neutral'}>{titleCase(a.audience)}</Badge><span className="text-xs text-muted">{fmtDateTime(a.publish_at)}</span></div><p className="whitespace-pre-line text-muted">{a.body}</p></li>))}</ul>}</Card>
    </>
  );
}
