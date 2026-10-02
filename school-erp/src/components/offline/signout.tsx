'use client';
import type { ReactNode } from 'react';
import { signOut } from '@/app/actions/shell';
import { listOps, wipeAll } from '@/lib/offline/db';
import { useOfflineUser } from './context';

/** Sign-out also removes the on-device copy. If work is still waiting to be sent, say so first. */
export function SignOutForm({ children }: { children: ReactNode }) {
  const userId = useOfflineUser();
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      try {
        if (userId) {
          const waiting = (await listOps(userId)).filter((o) => o.status === 'queued' || o.status === 'syncing').length;
          if (waiting > 0 && !confirm(`${waiting} item(s) saved offline have not been sent yet. Signing out will delete them from this phone. Sign out anyway?`)) return;
        }
        await wipeAll();
      } catch { /* no storage: nothing to wipe */ }
      await signOut();
    }}>{children}</form>
  );
}
