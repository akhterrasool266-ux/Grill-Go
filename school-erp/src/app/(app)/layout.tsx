import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { AppShell } from '@/components/shell/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  if (ctx.profile.preferences.must_change_password) redirect('/reset-password?first=1');
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
