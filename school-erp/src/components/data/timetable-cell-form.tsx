'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { checkConflicts, clearTimetableCell, saveTimetableEntry } from '@/app/actions/timetable';
import { Alert } from '@/components/ui/primitives';

type Opt = { value: string; label: string };
export function TimetableCellForm({ sectionId, day, periodId, label, subjects, staff, rooms, initial, backHref, canDelete }: { sectionId: string; day: number; periodId: string; label: string; subjects: Opt[]; staff: Opt[]; rooms: Opt[]; initial: { subject_id?: string; staff_id?: string; room_id?: string }; backHref: string; canDelete: boolean }) {
  const [v, setV] = useState({ subject_id: initial.subject_id ?? '', staff_id: initial.staff_id ?? '', room_id: initial.room_id ?? '' });
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const payload = { section_id: sectionId, day, period_id: periodId, subject_id: v.subject_id || undefined, staff_id: v.staff_id || undefined, room_id: v.room_id || undefined };
  const change = (k: keyof typeof v, val: string) => {
    const nv = { ...v, [k]: val }; setV(nv); setMsg(null);
    // live clash check as soon as a teacher or room is picked
    if (k !== 'subject_id') start(async () => { const r = await checkConflicts({ ...payload, [k]: val || undefined }); setConflicts(r.ok ? ((r.data as { conflicts: string[] }).conflicts.filter((c) => !c.startsWith('This class already'))) : []); });
  };
  const sel = (k: keyof typeof v, name: string, opts: Opt[]) => (
    <label className="block space-y-1 text-sm font-medium">{name}<select className="input" value={v[k]} onChange={(e) => change(k, e.target.value)}><option value="">—</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  );
  return (
    <div className="space-y-3 rounded-[14px] border border-brand/40 bg-surface p-4">
      <h3 className="font-semibold">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-3">{sel('subject_id', 'Subject', subjects)}{sel('staff_id', 'Teacher', staff)}{sel('room_id', 'Room', rooms)}</div>
      {conflicts.length > 0 && <Alert tone="bad" title="Clash detected — fix before saving">{conflicts.map((c) => <p key={c}>{c}</p>)}</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex flex-wrap gap-2">
        <button disabled={pending || conflicts.length > 0} className="h-10 rounded-[10px] bg-brand px-5 text-sm font-medium text-brand-fg disabled:opacity-50" onClick={() => start(async () => { const r = await saveTimetableEntry(payload); if (r.ok) { router.push(backHref); router.refresh(); } else setMsg({ tone: 'bad', text: r.error }); })}>Save lesson</button>
        {canDelete && initial.subject_id !== undefined && <button className="h-10 rounded-[10px] border border-line px-4 text-sm text-bad" onClick={() => start(async () => { const r = await clearTimetableCell({ section_id: sectionId, day, period_id: periodId }); if (r.ok) { router.push(backHref); router.refresh(); } else setMsg({ tone: 'bad', text: r.error }); })}>Clear</button>}
        <a href={backHref} className="h-10 rounded-[10px] border border-line px-4 text-sm leading-10">Cancel</a>
      </div>
    </div>
  );
}
