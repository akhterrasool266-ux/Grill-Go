import type { Metadata } from 'next';
import { Scanner } from '@/components/data/scanner';
import { PageHeader } from '@/components/ui/primitives';
import { requirePerm } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'QR attendance' };

export default async function ScanPage() {
  await requirePerm('attendance.qr');
  return (<><PageHeader title="Gate scan" description="Point the camera at a student's ID card. Students arriving after the late time are marked Late automatically." /><div className="mx-auto max-w-lg"><Scanner /></div></>);
}
