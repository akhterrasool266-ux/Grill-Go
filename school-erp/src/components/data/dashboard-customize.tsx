'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveDashboardPrefs } from '@/app/actions/dashboard';
import { buttonClass } from '@/components/ui/button';

export function DashboardCustomize({ widgets, hidden, label }: { widgets: { id: string; label: string }[]; hidden: string[]; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [off, setOff] = useState<string[]>(hidden);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <button type="button" className={buttonClass({ variant: 'secondary', size: 'sm' })} onClick={() => ref.current?.showModal()}>{label}</button>
      <dialog ref={ref} className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40">
        <div className="space-y-3 p-5">
          <h3 className="text-base font-semibold">{label}</h3>
          <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
            {widgets.map((w) => (
              <li key={w.id}><label className="flex items-center gap-2.5 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={!off.includes(w.id)}
                onChange={(e) => setOff((o) => e.target.checked ? o.filter((x) => x !== w.id) : [...o, w.id])} />{w.label}</label></li>
            ))}
          </ul>
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass({ variant: 'secondary' })} onClick={() => ref.current?.close()}>Cancel</button>
            <button type="button" disabled={pending} className={buttonClass()} onClick={() => start(async () => {
              const r = await saveDashboardPrefs({ hidden: off });
              if (r.ok) { ref.current?.close(); router.refresh(); } else setErr(r.error);
            })}>{pending ? '…' : 'Save'}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
