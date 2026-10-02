'use client';
import { useEffect, useState } from 'react';
import { getSnapshot, putSnapshot, removeSnapshot, type OpKind } from '@/lib/offline/db';
import { hasPin } from '@/lib/offline/pin';
import { useOfflineUser } from './context';
import { PinSetup } from './pin-ui';

/** "Keep this class available offline": stores a read-only copy of this sheet on the phone (14 days, wiped on sign-out). Refreshed each time it is opened online. */
export function KeepOffline({ kind, snapKey, title, data }: { kind: OpKind; snapKey: string; title: string; data: unknown }) {
  const userId = useOfflineUser();
  const [on, setOn] = useState<boolean | null>(null);
  const [needPin, setNeedPin] = useState(false);
  const save = async () => { if (userId) { await putSnapshot({ key: snapKey, kind, userId, title, savedAt: Date.now(), data }); setOn(true); setNeedPin(false); navigator.serviceWorker?.controller?.postMessage('warm-offline'); } };

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try { const s = await getSnapshot(userId, snapKey); setOn(Boolean(s)); if (s && navigator.onLine) await putSnapshot({ ...s, title, savedAt: Date.now(), data }); } catch { setOn(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, snapKey]);

  if (!userId || on === null || typeof indexedDB === 'undefined') return null;
  if (needPin) return <div className="rounded-xl border border-line bg-surface p-4"><PinSetup onDone={save} /></div>;
  return on ? (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">✓ Available offline on this phone.
      <button type="button" className="underline" onClick={async () => { await removeSnapshot(snapKey); setOn(false); }}>Remove</button></p>
  ) : (
    <button type="button" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
      onClick={async () => { if (await hasPin()) await save(); else setNeedPin(true); }}>📥 Keep available offline</button>
  );
}
