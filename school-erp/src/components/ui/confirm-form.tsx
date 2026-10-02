'use client';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { buttonClass, type ButtonStyle } from './button';
import type { ActionResult } from '@/lib/actions';
import { Alert } from './primitives';

/** A button that asks "are you sure?" in a proper dialog, then runs a server action with `data`. */
export function ConfirmAction({ action, data, title, message, confirmLabel = 'Confirm', children, variant = 'danger', size = 'sm', className, withReason }: ButtonStyle & {
  action: (input: any) => Promise<ActionResult<any>>; data?: Record<string, unknown>; title: string; message?: string; confirmLabel?: string; children: ReactNode; withReason?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <button type="button" className={buttonClass({ variant, size, className })} onClick={() => { setError(null); ref.current?.showModal(); }}>{children}</button>
      <dialog ref={ref} className="m-auto w-[min(92vw,420px)] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40">
        <div className="space-y-3 p-5">
          <h3 className="text-base font-semibold">{title}</h3>
          {message && <p className="text-sm text-muted">{message}</p>}
          {withReason && <textarea className="input" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />}
          {error && <Alert tone="bad">{error}</Alert>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={buttonClass({ variant: 'secondary' })} onClick={() => ref.current?.close()}>Cancel</button>
            <button type="button" disabled={pending} className={buttonClass({ variant })}
              onClick={() => start(async () => {
                const r = await action({ ...data, ...(withReason ? { reason } : {}) });
                if (r.ok) { ref.current?.close(); setReason(''); router.refresh(); } else setError(r.error);
              })}>{pending ? '…' : confirmLabel}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Fire-and-refresh button without a dialog (for non-destructive actions). */
export function ActionButton({ action, data, children, variant = 'secondary', size = 'sm', className, onOk }: ButtonStyle & {
  action: (input: any) => Promise<ActionResult<any>>; data?: Record<string, unknown>; children: ReactNode; onOk?: (r: ActionResult<any>) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={pending} className={buttonClass({ variant, size, className })}
        onClick={() => start(async () => { const r = await action(data ?? {}); if (r.ok) { setError(null); onOk?.(r); router.refresh(); } else setError(r.error); })}>
        {pending ? '…' : children}
      </button>
      {error && <span role="alert" className="text-xs text-bad">{error}</span>}
    </span>
  );
}
