'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveAttendance } from '@/app/actions/attendance';
import { Alert } from '@/components/ui/primitives';
import { cn } from '@/components/ui/cn';

type Status = 'present' | 'absent' | 'late' | 'leave' | 'half_day';
export interface SheetStudent { id: string; name: string; code: string; roll: string | null; status: Status | null; remarks: string | null }
const OPTIONS: { v: Status; short: string; label: string; on: string }[] = [
  { v: 'present', short: 'P', label: 'Present', on: 'bg-ok text-white border-ok' },
  { v: 'absent', short: 'A', label: 'Absent', on: 'bg-bad text-white border-bad' },
  { v: 'late', short: 'L', label: 'Late', on: 'bg-warn text-white border-warn' },
  { v: 'leave', short: 'Lv', label: 'Leave', on: 'bg-info text-white border-info' },
  { v: 'half_day', short: '½', label: 'Half day', on: 'bg-brand text-brand-fg border-brand' },
];
const QUEUE_KEY = 'erp_attendance_queue_v1';

type Payload = { section_id: string; date: string; reason?: string; rows: { student_id: string; status: Status; remarks?: string }[] };
const readQueue = (): Payload[] => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); } catch { return []; } };
const writeQueue = (q: Payload[]) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* storage unavailable */ } };

/**
 * Tap-to-mark attendance. Works on a phone in a classroom with patchy Wi-Fi:
 * if the device is offline the marks wait in a small on-device outbox (NOT a database —
 * the server stays the single source of truth) and are sent when the connection returns.
 */
export function AttendanceSheet({ sectionId, date, students, canCorrect, locked }: { sectionId: string; date: string; students: SheetStudent[]; canCorrect: boolean; locked: boolean }) {
  const [marks, setMarks] = useState<Record<string, Status>>(() => Object.fromEntries(students.map((s) => [s.id, s.status ?? 'present'])));
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad' | 'warn'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(0);
  const router = useRouter();

  const existing = useMemo(() => students.some((s) => s.status), [students]);
  const changedExisting = students.some((s) => s.status && marks[s.id] !== s.status);
  const needsReason = changedExisting || (existing && date < new Date().toISOString().slice(0, 10));
  const counts = useMemo(() => Object.values(marks).reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {}), [marks]);

  async function flush() {
    const q = readQueue(); if (!q.length) return;
    const left: Payload[] = [];
    for (const p of q) { try { const r = await saveAttendance(p); if (!r.ok) left.push(p); } catch { left.push(p); } }
    writeQueue(left); setQueued(left.length);
    if (left.length < q.length) { setMsg({ tone: 'ok', text: 'Saved attendance that was waiting offline.' }); router.refresh(); }
  }
  useEffect(() => { setQueued(readQueue().length); void flush(); window.addEventListener('online', flush); return () => window.removeEventListener('online', flush); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const payload = (): Payload => ({ section_id: sectionId, date, reason: reason || undefined, rows: students.map((s) => ({ student_id: s.id, status: marks[s.id]!, remarks: s.remarks ?? undefined })) });
  function save() {
    setMsg(null);
    if (needsReason && canCorrect && reason.trim().length < 3) { setMsg({ tone: 'bad', text: 'Please give a reason for correcting existing attendance.' }); return; }
    start(async () => {
      const p = payload();
      if (!navigator.onLine) { writeQueue([...readQueue(), p]); setQueued(readQueue().length); setMsg({ tone: 'warn', text: 'You are offline. Attendance is saved on this device and will be sent automatically when you are back online.' }); return; }
      try {
        const r = await saveAttendance(p);
        if (r.ok) { setMsg({ tone: 'ok', text: r.message ?? 'Saved.' }); router.refresh(); } else setMsg({ tone: 'bad', text: r.error });
      } catch { writeQueue([...readQueue(), p]); setQueued(readQueue().length); setMsg({ tone: 'warn', text: 'Could not reach the server. Attendance is kept on this device and will be retried.' }); }
    });
  }
  const setAll = (s: Status) => setMarks(Object.fromEntries(students.map((x) => [x.id, s])));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium hover:bg-surface-2" onClick={() => setAll('present')} disabled={locked}>All present</button>
        <button type="button" className="rounded-full border border-line bg-surface px-3 py-1.5 font-medium hover:bg-surface-2" onClick={() => setAll('absent')} disabled={locked}>All absent</button>
        <span className="ms-auto flex gap-3 text-xs text-muted tabular"><span className="text-ok">P {counts.present ?? 0}</span><span className="text-bad">A {counts.absent ?? 0}</span><span className="text-warn">L {counts.late ?? 0}</span><span>Lv {counts.leave ?? 0}</span></span>
      </div>
      {queued > 0 && <Alert tone="warn">{queued} attendance sheet{queued === 1 ? '' : 's'} waiting to be sent. <button className="underline" onClick={() => void flush()}>Send now</button></Alert>}
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {students.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 shrink-0 text-end text-xs text-muted tabular">{s.roll ?? i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="block text-xs text-muted">{s.code}</span></span>
            <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex shrink-0 gap-1">
              {OPTIONS.map((o) => (
                <button key={o.v} type="button" role="radio" aria-checked={marks[s.id] === o.v} aria-label={o.label} title={o.label} disabled={locked}
                  onClick={() => setMarks((m) => ({ ...m, [s.id]: o.v }))}
                  className={cn('grid size-9 place-items-center rounded-full border text-xs font-semibold transition-colors', marks[s.id] === o.v ? o.on : 'border-line bg-surface text-muted hover:bg-surface-2')}>{o.short}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {needsReason && canCorrect && <label className="block space-y-1 text-sm font-medium">Reason for correction<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Parent confirmed child was present" /></label>}
      {needsReason && !canCorrect && changedExisting && <Alert tone="warn">Changing attendance that is already saved needs the “correct attendance” permission. Ask your administrator.</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="sticky bottom-16 z-10 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-0">
        <button type="button" onClick={save} disabled={pending || locked || students.length === 0 || (changedExisting && !canCorrect)} className="h-12 w-full rounded-[10px] bg-brand text-base font-medium text-brand-fg hover:bg-brand-hover disabled:opacity-50 sm:w-auto sm:px-8">
          {pending ? 'Saving…' : existing ? 'Update attendance' : 'Save attendance'}
        </button>
      </div>
    </div>
  );
}
