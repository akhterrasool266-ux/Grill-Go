import { requireUser } from '@/lib/auth/session';
import { AppShell } from '@/components/shell/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  return <AppShell ctx={ctx}>{children}</AppShell>;
}
