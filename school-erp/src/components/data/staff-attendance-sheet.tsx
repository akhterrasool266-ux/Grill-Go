'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveStaffAttendance } from '@/app/actions/attendance';
import { Alert } from '@/components/ui/primitives';

interface Row { id: string; campus_id: string; name: string; code: string; shift: string; status: string; check_in: string; check_out: string; ot: number }
const STATUSES = ['present', 'late', 'absent', 'leave', 'half_day', 'holiday'];

export function StaffAttendanceSheet({ rows, date, canWrite }: { rows: Row[]; date: string; canWrite: boolean }) {
  const [data, setData] = useState(rows);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const upd = (id: string, k: keyof Row, v: string) => { setData((d) => d.map((r) => (r.id === id ? { ...r, [k]: v } : r))); setDirty((s) => new Set(s).add(id)); };
  const save = () => start(async () => {
    const changed = data.filter((r) => dirty.has(r.id) && r.status);
    if (!changed.length) { setMsg({ tone: 'bad', text: 'Nothing to save — choose a status first.' }); return; }
    const r = await saveStaffAttendance({ date, rows: changed.map((x) => ({ staff_id: x.id, campus_id: x.campus_id, status: x.status, check_in: x.check_in || undefined, check_out: x.check_out || undefined, overtime_minutes: x.ot || undefined })) });
    if (r.ok) { setMsg({ tone: 'ok', text: r.message ?? 'Saved.' }); setDirty(new Set()); router.refresh(); } else setMsg({ tone: 'bad', text: r.error });
  });
  return (
    <div>
      <ul className="divide-y divide-line">
        {data.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_9rem_6rem_6rem]">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{r.name}</p><p className="text-xs text-muted">{r.code} · shift {r.shift}</p></div>
            <select aria-label={`Status of ${r.name}`} disabled={!canWrite} value={r.status} onChange={(e) => upd(r.id, 'status', e.target.value)} className="input h-9 min-h-0 py-0 text-sm"><option value="">—</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
            <input aria-label="Check in" type="time" disabled={!canWrite} value={r.check_in} onChange={(e) => upd(r.id, 'check_in', e.target.value)} className="input h-9 min-h-0 py-0 text-sm" />
            <input aria-label="Check out" type="time" disabled={!canWrite} value={r.check_out} onChange={(e) => upd(r.id, 'check_out', e.target.value)} className="input h-9 min-h-0 py-0 text-sm" />
          </li>
        ))}
      </ul>
      {canWrite && <div className="space-y-3 border-t border-line p-4">{msg && <Alert tone={msg.tone}>{msg.text}</Alert>}<button onClick={save} disabled={pending || dirty.size === 0} className="h-11 rounded-[10px] bg-brand px-6 text-sm font-medium text-brand-fg disabled:opacity-50">{pending ? 'Saving…' : `Save ${dirty.size || ''} change${dirty.size === 1 ? '' : 's'}`}</button></div>}
    </div>
  );
}
