'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMeta, listOps, listSnapshots, removeSnapshot, type Op, type Snapshot } from '@/lib/offline/db';
import { hasPin } from '@/lib/offline/pin';
import { discard, queueAttendance, queueMarks, retry, type MarkRowPayload } from '@/lib/offline/queue';
import { flush } from '@/lib/offline/sync';
import { Alert } from '@/components/ui/primitives';
import { cn } from '@/components/ui/cn';
import { PinGate } from './pin-ui';

type Status = 'present' | 'absent' | 'late' | 'leave' | 'half_day';
const OPTS: { v: Status; s: string; label: string; on: string }[] = [
  { v: 'present', s: 'P', label: 'Present', on: 'bg-ok text-white border-ok' }, { v: 'absent', s: 'A', label: 'Absent', on: 'bg-bad text-white border-bad' },
  { v: 'late', s: 'L', label: 'Late', on: 'bg-warn text-white border-warn' }, { v: 'leave', s: 'Lv', label: 'Leave', on: 'bg-info text-white border-info' },
  { v: 'half_day', s: '½', label: 'Half day', on: 'bg-brand text-brand-fg border-brand' },
];
const karachi = (offsetDays = 0) => new Date(Date.now() - offsetDays * 86400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const changed = () => window.dispatchEvent(new Event('erp-outbox-changed'));
const btn = 'rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-brand-fg disabled:opacity-50';

interface AttData { sectionId: string; students: { id: string; name: string; code: string; roll: string | null }[] }
interface MarksData { examSubjectId: string; max: number; passing: number; locked: boolean; rows: { id: string; name: string; code: string; roll: string | null; marks: number | null; absent: boolean }[] }

function AttendanceSheet({ userId, snap, onBack }: { userId: string; snap: Snapshot; onBack: () => void }) {
  const d = snap.data as AttData;
  const [date, setDate] = useState(karachi());
  const [marks, setMarks] = useState<Record<string, Status>>(() => Object.fromEntries(d.students.map((s) => [s.id, 'present'])));
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <button className="text-sm text-muted underline" onClick={onBack}>← Back</button>
      <h2 className="text-lg font-semibold">{snap.title}</h2>
      <label className="block text-sm font-medium">Date
        <select className="input mt-1" value={date} onChange={(e) => setDate(e.target.value)}>{[0, 1, 2, 3].map((n) => <option key={n} value={karachi(n)}>{n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`} · {karachi(n)}</option>)}</select></label>
      <p className="text-xs text-muted">Offline attendance can be sent up to 3 days late. If someone already marked this class online, their entry is kept and you will be told.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {d.students.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 text-end text-xs text-muted tabular">{s.roll ?? i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="block text-xs text-muted">{s.code}</span></span>
            <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex gap-1">
              {OPTS.map((o) => <button key={o.v} type="button" role="radio" aria-checked={marks[s.id] === o.v} aria-label={o.label} onClick={() => setMarks((m) => ({ ...m, [s.id]: o.v }))}
                className={cn('grid size-9 place-items-center rounded-full border text-xs font-semibold', marks[s.id] === o.v ? o.on : 'border-line bg-surface text-muted')}>{o.s}</button>)}
            </div>
          </li>
        ))}
      </ul>
      {msg && <Alert tone="ok">{msg}</Alert>}
      <button className={cn(btn, 'h-12 w-full')} onClick={async () => {
        await queueAttendance(userId, `${snap.title} · ${date}`, { section_id: d.sectionId, date, rows: d.students.map((s) => ({ student_id: s.id, status: marks[s.id]! })) });
        changed(); setMsg(navigator.onLine ? 'Saved. Sending now…' : 'Saved on this phone. It will be sent automatically when you are online.');
      }}>Save attendance</button>
    </div>
  );
}

function MarksSheet({ userId, snap, queued, onBack }: { userId: string; snap: Snapshot; queued: Op | undefined; onBack: () => void }) {
  const d = snap.data as MarksData;
  const waiting = useMemo(() => new Map(((queued?.payload as { rows: MarkRowPayload[] } | undefined)?.rows ?? []).map((r) => [r.student_id, r])), [queued]);
  const init = (id: string, marks: number | null, absent: boolean) => { const w = waiting.get(id); return w ? { m: w.absent ? '' : String(w.marks ?? ''), a: !!w.absent } : { m: marks === null ? '' : String(marks), a: absent }; };
  const [v, setV] = useState(() => Object.fromEntries(d.rows.map((r) => [r.id, init(r.id, r.marks, r.absent)])));
  const [msg, setMsg] = useState<string | null>(null);
  const bad = (id: string) => { const n = Number(v[id]!.m); return !v[id]!.a && v[id]!.m !== '' && (!Number.isFinite(n) || n < 0 || n > d.max); };
  const anyBad = d.rows.some((r) => bad(r.id));
  return (
    <div className="space-y-3">
      <button className="text-sm text-muted underline" onClick={onBack}>← Back</button>
      <h2 className="text-lg font-semibold">{snap.title}</h2>
      {d.locked && <Alert tone="warn">This exam was locked or published when you saved it. The server will refuse changes.</Alert>}
      <p className="text-xs text-muted">If someone changes a mark online before yours is sent, their mark is kept and yours is shown to you as a conflict. Nothing is overwritten silently.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {d.rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-6 text-end text-xs text-muted tabular">{r.roll ?? i + 1}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{r.name}</span><span className="block text-xs text-muted">{r.code}</span></span>
            <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" className="size-4" checked={v[r.id]!.a} onChange={(e) => setV((s) => ({ ...s, [r.id]: { m: '', a: e.target.checked } }))} />Abs</label>
            <input aria-label={`Marks for ${r.name}`} inputMode="decimal" disabled={v[r.id]!.a} value={v[r.id]!.m} placeholder={`/${d.max}`} aria-invalid={bad(r.id)}
              onChange={(e) => setV((s) => ({ ...s, [r.id]: { ...s[r.id]!, m: e.target.value } }))} className="input h-10 w-20 min-h-0 py-0 text-center tabular" />
          </li>
        ))}
      </ul>
      {anyBad && <Alert tone="bad">Marks must be between 0 and {d.max}.</Alert>}
      {msg && <Alert tone="ok">{msg}</Alert>}
      <button className={cn(btn, 'h-12 w-full')} disabled={anyBad} onClick={async () => {
        const rows: MarkRowPayload[] = d.rows.filter((r) => { const x = v[r.id]!; const same = x.a === r.absent && (x.a || (x.m === '' ? r.marks === null : Number(x.m) === r.marks)); return !same; })
          .map((r) => ({ student_id: r.id, marks: v[r.id]!.m, absent: v[r.id]!.a, base: { marks: r.marks, absent: r.absent } }));
        if (!rows.length) return setMsg('Nothing changed.');
        await queueMarks(userId, snap.title, { exam_subject_id: d.examSubjectId, rows });
        changed(); setMsg(navigator.onLine ? 'Saved. Sending now…' : 'Saved on this phone. It will be sent automatically when you are online.');
      }}>Save marks</button>
    </div>
  );
}

function Outbox({ ops, names, refresh, userId }: { ops: Op[]; names: Map<string, string>; refresh: () => void; userId: string }) {
  if (!ops.length) return <p className="text-sm text-muted">Nothing waiting to be sent.</p>;
  return (
    <ul className="space-y-2">{ops.map((o) => {
      const conflicts = ((o.result as { conflicts?: { student_id: string; yours?: unknown; server?: unknown }[] } | undefined)?.conflicts ?? []);
      return (
        <li key={o.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
          <div className="flex items-center justify-between gap-2"><span className="font-medium">{o.label}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs', o.status === 'queued' || o.status === 'syncing' ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad')}>{o.status === 'queued' ? 'Waiting' : o.status === 'syncing' ? 'Sending…' : o.status === 'conflict' ? 'Needs review' : 'Not accepted'}</span></div>
          {o.error && <p className="mt-1 text-bad">{o.error}</p>}
          {o.status === 'conflict' && <>
            <p className="mt-1 text-muted">Saved, except {conflicts.length} entr{conflicts.length === 1 ? 'y' : 'ies'} where someone else's value was already there. Their value was kept:</p>
            <ul className="mt-1 list-disc ps-5 text-xs">{conflicts.map((c) => <li key={c.student_id}>{names.get(c.student_id) ?? c.student_id.slice(0, 8)} — yours: {String(c.yours ?? '—')}, kept: {String(c.server ?? '—')}</li>)}</ul></>}
          <div className="mt-2 flex gap-3 text-xs">
            {o.status === 'rejected' && <button className="underline" onClick={async () => { await retry(o.id, userId); refresh(); changed(); }}>Try again</button>}
            {o.status !== 'syncing' && <button className="text-bad underline" onClick={async () => { if (o.status === 'queued' && !confirm('Delete this unsent item from the phone?')) return; await discard(o.id); refresh(); }}>{o.status === 'conflict' ? 'Dismiss (keep their value)' : 'Delete'}</button>}
          </div>
        </li>);
    })}</ul>
  );
}

export function OfflineWorkspace() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [locked, setLocked] = useState(true);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [ops, setOps] = useState<Op[]>([]);
  const [open, setOpen] = useState<Snapshot | null>(null);
  const [online, setOnline] = useState(true);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async (u: string) => { setSnaps(await listSnapshots(u)); setOps(await listOps(u)); }, []);
  useEffect(() => {
    setOnline(navigator.onLine);
    (async () => {
      try { const u = await getMeta<string>('lastUser'); setUserId(u); setLocked(await hasPin()); if (u) await load(u); } catch { setUserId(null); }
    })();
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load]);
  useEffect(() => {
    if (!userId) return;
    const h = () => { void load(userId); };
    window.addEventListener('erp-outbox-changed', h); const t = setInterval(h, 5000);
    return () => { window.removeEventListener('erp-outbox-changed', h); clearInterval(t); };
  }, [userId, load]);

  const names = useMemo(() => { const m = new Map<string, string>(); for (const s of snaps) for (const r of ((s.data as { students?: { id: string; name: string }[]; rows?: { id: string; name: string }[] }).students ?? (s.data as { rows?: { id: string; name: string }[] }).rows ?? [])) m.set(r.id, r.name); return m; }, [snaps]);

  if (userId === undefined) return <p className="p-6 text-sm text-muted">Loading…</p>;
  if (!userId) return <div className="mx-auto max-w-md space-y-3 p-6 text-center"><h1 className="text-xl font-semibold">Nothing saved on this phone</h1><p className="text-sm text-muted">Open a class's attendance or a marks sheet while you are online and tap “Keep available offline”.</p><a className={cn(btn, 'inline-block')} href="/">Open the app</a></div>;
  if (locked) return <PinGate onOpen={() => setLocked(false)} />;

  const sendNow = async () => { const r = await flush(userId); setInfo(r.stopped === 'signin' ? 'Please sign in again (online) to send.' : r.stopped === 'offline' ? 'Could not reach the server yet.' : `Sent ${r.sent}.`); await load(userId); changed(); };
  const att = snaps.filter((s) => s.kind === 'attendance'), mk = snaps.filter((s) => s.kind === 'marks');
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <div className="flex items-center justify-between gap-2"><h1 className="text-xl font-semibold">Offline work</h1>
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', online ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')}>{online ? 'Online' : 'Offline'}</span></div>
      {open ? (open.kind === 'attendance' ? <AttendanceSheet userId={userId} snap={open} onBack={() => { setOpen(null); void load(userId); }} />
        : <MarksSheet userId={userId} snap={open} queued={ops.find((o) => o.kind === 'marks' && o.status === 'queued' && (o.payload as { exam_subject_id: string }).exam_subject_id === (open.data as MarksData).examSubjectId)} onBack={() => { setOpen(null); void load(userId); }} />) : (
        <>
          {([['Attendance', att], ['Marks', mk]] as const).map(([title, list]) => (
            <section key={title} className="space-y-2"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
              {list.length === 0 ? <p className="text-sm text-muted">Nothing kept offline yet.</p> : list.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3">
                  <button className="min-w-0 flex-1 text-start" onClick={() => setOpen(s)}><span className="block truncate text-sm font-medium">{s.title}</span><span className="block text-xs text-muted">Copied {new Date(s.savedAt).toLocaleString()}</span></button>
                  <button className="text-xs text-bad underline" onClick={async () => { await removeSnapshot(s.key); await load(userId); }}>Remove</button>
                </div>))}
            </section>))}
          <section className="space-y-2"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Waiting to be sent</h2>
            {online && ops.some((o) => o.status === 'queued') && <button className="text-xs underline" onClick={sendNow}>Send now</button>}</div>
            {info && <Alert tone="info">{info}</Alert>}
            <Outbox ops={ops} names={names} userId={userId} refresh={() => load(userId)} /></section>
          <p className="text-xs text-muted">This is a temporary copy on your phone, not the school's record. It is removed when you sign out or after 14 days. The school's server is always the master copy.</p>
        </>)}
    </div>
  );
}
