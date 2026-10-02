'use client';
import { useState } from 'react';
import { checkPin, setPin, validPin } from '@/lib/offline/pin';
import { Alert } from '@/components/ui/primitives';

const inputCls = 'input h-11 w-full text-center tracking-[0.4em]';

export function PinSetup({ onDone }: { onDone: () => void }) {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [err, setErr] = useState<string | null>(null);
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      if (!validPin(a)) return setErr('Use 4 to 8 digits.');
      if (a !== b) return setErr('The two PINs do not match.');
      await setPin(a); onDone();
    }}>
      <p className="text-sm">Choose a PIN for the offline area of this phone. It is asked before offline class lists open, because without internet the system cannot check who is holding the phone.</p>
      <input className={inputCls} inputMode="numeric" type="password" autoComplete="new-password" placeholder="PIN" aria-label="New PIN" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} maxLength={8} />
      <input className={inputCls} inputMode="numeric" type="password" autoComplete="new-password" placeholder="Repeat PIN" aria-label="Repeat PIN" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} maxLength={8} />
      {err && <Alert tone="bad">{err}</Alert>}
      <button className="h-11 w-full rounded-[10px] bg-brand text-sm font-medium text-brand-fg">Save PIN</button>
      <p className="text-xs text-muted">Keep your phone's own screen lock on too. Ten wrong PINs delete the offline copy from this phone.</p>
    </form>
  );
}

export function PinGate({ onOpen }: { onOpen: () => void }) {
  const [pin, setP] = useState(''); const [err, setErr] = useState<string | null>(null);
  return (
    <form className="mx-auto max-w-xs space-y-3 py-10" onSubmit={async (e) => {
      e.preventDefault();
      const r = await checkPin(pin); setP('');
      if (r.ok) return onOpen();
      setErr(r.reason === 'locked' ? `Too many wrong tries. Wait ${r.waitSeconds}s.` : r.reason === 'wiped' ? 'Too many wrong tries. The offline copy was deleted from this phone.' : `Wrong PIN. ${r.left} tries left.`);
    }}>
      <h1 className="text-center text-lg font-semibold">Offline area</h1>
      <input className={inputCls} inputMode="numeric" type="password" autoComplete="off" placeholder="PIN" aria-label="PIN" value={pin} onChange={(e) => setP(e.target.value.replace(/\D/g, ''))} maxLength={8} autoFocus />
      {err && <Alert tone="bad">{err}</Alert>}
      <button className="h-11 w-full rounded-[10px] bg-brand text-sm font-medium text-brand-fg">Open</button>
    </form>
  );
}
