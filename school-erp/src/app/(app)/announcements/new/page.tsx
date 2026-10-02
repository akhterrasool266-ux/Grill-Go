import type { Metadata } from 'next';
import { AnnouncementForm } from '@/components/data/ops-forms';
import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { currentCampus, requirePerm } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'New announcement' };

export default async function NewAnnouncement() {
  const ctx = await requirePerm('announcements.create');
  const campus = await currentCampus(ctx);
  return (<><PageHeader title="New announcement" back={{ href: '/announcements', label: 'Announcements' }} /><Card><CardBody><AnnouncementForm campuses={!campus && ctx.campuses.length > 1 ? ctx.campuses.map((c) => ({ value: c.id, label: c.name })) : undefined} /></CardBody></Card></>);
}
