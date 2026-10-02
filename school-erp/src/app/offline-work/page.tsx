import type { Metadata } from 'next';
import { OfflineWorkspace } from '@/components/offline/workspace';

export const metadata: Metadata = { title: 'Offline work' };
export const dynamic = 'force-static';   // no data in the HTML: it is filled from the phone's own storage, so it can be cached for offline use

export default function OfflineWorkPage() { return <div className="min-h-dvh bg-bg"><OfflineWorkspace /></div>; }
