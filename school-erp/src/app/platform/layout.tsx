import Link from 'next/link';
import { signOut } from '@/app/actions/shell';
import { requirePlatformAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="min-h-screen bg-surface-2 text-fg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <nav className="flex items-center gap-5 text-sm"><span className="font-semibold">Platform</span><Link href="/platform" className="hover:underline">Schools</Link><Link href="/platform/plans" className="hover:underline">Plans</Link></nav>
          <form action={signOut}><button className="text-sm text-muted hover:underline">Sign out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">{children}</main>
    </div>
  );
}
