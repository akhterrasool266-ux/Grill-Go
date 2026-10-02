'use client';
import { useState, useTransition } from 'react';
import { markRoute } from '@/app/actions/ops';
import { Alert, Badge } from '@/components/ui/primitives';

interface R { route_id: string; student_id: string; name: string; code: string; cls: string | null; stop: string | null; pickup: string | null; drop: string | null }
export function RouteRoster({ rows }: { rows: R[] }) {
  const [trip, setTrip] = useState<'pickup' | 'drop'>('pickup');
  const [state, setState] = useState<Record<string, string | null>>(() => Object.fromEntries(rows.flatMap((r) => [[`${r.student_id}:pickup`, r.pickup], [`${r.student_id}:drop`, r.drop]])));
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  const set = (r: R, status: 'boarded' | 'absent' | 'dropped') => start(async () => {
    setErr(null);
    const res = await markRoute({ route_id: r.route_id, student_id: r.student_id, trip, status });
    if (res.ok) setState((s) => ({ ...s, [`${r.student_id}:${trip}`]: status })); else setErr(res.error);
  });
  const done = rows.filter((r) => state[`${r.student_id}:${trip}`]).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><div role="tablist" className="inline-flex rounded-full border border-line p-0.5 text-sm">{(['pickup', 'drop'] as const).map((t) => <button key={t} role="tab" aria-selected={trip === t} onClick={() => setTrip(t)} className={`rounded-full px-4 py-1.5 font-medium ${trip === t ? 'bg-brand text-brand-fg' : 'text-muted'}`}>{t === 'pickup' ? 'Morning pickup' : 'Afternoon drop'}</button>)}</div><span className="text-sm text-muted tabular">{done}/{rows.length}</span></div>
      {err && <Alert tone="bad">{err}</Alert>}
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {rows.map((r) => { const s = state[`${r.student_id}:${trip}`]; return (
          <li key={r.student_id} className="flex items-center gap-3 px-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.name}</p><p className="text-xs text-muted">{r.stop ?? 'No stop'} · {r.cls}</p></div>
            {s && <Badge tone={s === 'absent' ? 'bad' : 'ok'}>{s}</Badge>}
            <div className="flex gap-1.5"><button onClick={() => set(r, trip === 'pickup' ? 'boarded' : 'dropped')} className="h-10 rounded-full bg-ok-soft px-3.5 text-sm font-medium text-ok">{trip === 'pickup' ? 'Boarded' : 'Dropped'}</button><button onClick={() => set(r, 'absent')} className="h-10 rounded-full bg-bad-soft px-3.5 text-sm font-medium text-bad">Absent</button></div></li>); })}
      </ul>
    </div>
  );
}
