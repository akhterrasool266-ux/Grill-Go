'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { housekeeping, setMeta } from '@/lib/offline/db';
import { flush, pendingCount } from '@/lib/offline/sync';
import { cn } from '@/components/ui/cn';

/** Small pill in the top bar: offline / N waiting / N need attention. Also runs the background sync. */
export function OfflineStatus({ userId }: { userId: string }) {
  const [online, setOnline] = useState(true);
  const [n, setN] = useState({ waiting: 0, attention: 0 });
  const [note, setNote] = useState<string | null>(null);
  const [signin, setSignin] = useState(false);
  const busy = useRef(false);
  const router = useRouter();

  const refresh = useCallback(async () => { try { setN(await pendingCount(userId)); } catch { /* storage unavailable (private mode) */ } }, [userId]);
  const sync = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    try {
      const r = await flush(userId);
      setSignin(r.stopped === 'signin');
      if (r.saved > 0 || r.conflicts > 0) { setNote(r.conflicts ? `${r.conflicts} sheet(s) need your review` : `Sent ${r.sent} offline sheet${r.sent === 1 ? '' : 's'}`); router.refresh(); setTimeout(() => setNote(null), 6000); }
    } catch { /* retried on the next tick */ } finally { busy.current = false; await refresh(); }
  }, [userId, refresh, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    (async () => { try { await housekeeping(userId); await setMeta('lastUser', userId); } catch { /* no storage */ } await refresh(); void sync(); })();
    const on = () => { setOnline(true); void sync(); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const poll = setInterval(() => { void refresh(); void sync(); }, 60_000);
    const changed = () => { void refresh(); void sync(); };
    window.addEventListener('erp-outbox-changed', changed);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('erp-outbox-changed', changed); clearInterval(poll); };
  }, [userId, refresh, sync]);

  const show = !online || n.waiting > 0 || n.attention > 0 || signin || note;
  if (!show) return null;
  const tone = n.attention > 0 || signin ? 'bg-bad-soft text-bad' : !online || n.waiting > 0 ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok';
  const text = signin ? 'Sign in again to send' : note ?? (n.attention > 0 ? `${n.attention} need attention` : !online ? (n.waiting ? `Offline · ${n.waiting} waiting` : 'Offline') : `${n.waiting} waiting to send`);
  return (
    // hard link on purpose: the offline area must load from the service worker cache when there is no network
    <a href="/offline-work" role="status" className={cn('hidden whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium sm:inline-block', tone)}>{text}</a>
  );
}
